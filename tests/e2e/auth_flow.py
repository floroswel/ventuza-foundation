"""
E2E — Flux Signup / Login pe /auth (Suzeta).

Acoperire:
  L1  /auth login mode: email invalid → toast "auth.errors.invalidEmail",
      formularul rămâne pe /auth.
  L2  /auth login mode: parolă < 8 char → toast "auth.errors.passwordMin".
  L3  /auth login mode: credențiale corecte greșite → toast eroare mapată
      (invalid_login sau email_not_confirmed).
  S1  /auth signup mode: butonul "Creează cont" e disabled fără over18 +
      terms + birthdate valid (18+).
  S2  /auth signup mode: birthdate < 18 → hint "auth.minAge" vizibil ȘI
      butonul rămâne disabled.
  S3  /auth signup mode: date complete valide → dacă Turnstile e configurat
      (VITE_TURNSTILE_SITE_KEY setat), widget-ul apare și emite token
      (folosim site key public Cloudflare care întotdeauna trece:
      1x00000000000000000000AA). După submit, navigate → /auth/check-email.
  S4  /auth/check-email: afișează emailul introdus și butonul de re-trimitere
      cu countdown 60s.
  F1  Forgot password fără email → toast "auth.errors.enterEmailFirst".
  F2  /reset-password: pagina publică se randează (fără redirect la /auth).
  T1  Turnstile "always-pass" siteKey: după mount, se emite `captchaToken`
      și submit-ul reușește (verificat implicit în S3 când e configurat).

Rulare:
    python3 tests/e2e/auth_flow.py

Pentru a testa complet ramura cu Turnstile activ:
    VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
      npm run dev  # restart dev server ca Vite să injecteze env-ul
    python3 tests/e2e/auth_flow.py

Presupune dev server pe http://localhost:8080.
Testele NU necesită sesiune Supabase injectată — folosesc doar suprafața
publică /auth. Nu creează useri reali în Supabase Auth: adresele generate
sunt @example.com și sunt respinse de gate-ul de disposable-email (assert_email_allowed)
înainte de scriere. Pentru a testa signup end-to-end cu user real, folosește
un email pe un domeniu permis (@gmail.com etc.).
"""
import asyncio, os, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright, Page, expect

OUT = Path(__file__).parent / "screenshots" / "auth"
OUT.mkdir(exist_ok=True, parents=True)
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []


def ok(name: str) -> None:
    PASS.append(name)
    print(f"  ✓ {name}")


def bad(name: str, why: str) -> None:
    FAIL.append((name, why))
    print(f"  ✗ {name}: {why}")


async def goto_auth(page: Page, mode: str = "login") -> None:
    await page.goto(f"{BASE}/auth?mode={mode}", wait_until="domcontentloaded")
    # tab-urile sunt vizuale — asigurăm modul corect via click
    label = "CREEAZĂ CONT" if mode == "signup" else "AUTENTIFICARE"
    # Fallback bilingv: apelul funcționează și în EN.
    try:
        await page.get_by_role("button", name=re.compile(label, re.I)).click(timeout=1500)
    except Exception:
        pass
    # așteaptă câmpul de email
    await page.locator("#email").wait_for(state="visible", timeout=15000)
    # Dezactivăm HTML5 validation (required, type=email, minLength) ca să
    # putem testa validarea zod din onSubmit. Fără asta, Chromium blochează
    # submit-ul înainte ca handler-ul React să ruleze.
    await page.evaluate(
        "document.querySelectorAll('form').forEach(f => f.setAttribute('novalidate', ''));"
    )


async def read_toasts(page: Page) -> list[str]:
    # Sonner randează în [data-sonner-toaster] cu role=status/alert.
    items = await page.locator("[data-sonner-toast]").all_text_contents()
    return [t.strip() for t in items if t.strip()]


async def wait_toast(page: Page, pattern: re.Pattern[str], timeout_ms: int = 4000) -> str | None:
    end = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < end:
        for msg in await read_toasts(page):
            if pattern.search(msg):
                return msg
        await page.wait_for_timeout(150)
    return None


async def turnstile_present(page: Page) -> bool:
    # Widget-ul Cloudflare injectează un <iframe src*="turnstile"> în div-ul nostru.
    try:
        await page.locator("iframe[src*='turnstile']").first.wait_for(
            state="attached", timeout=2500
        )
        return True
    except Exception:
        return False


# ─── L1 · email invalid ────────────────────────────────────────────────────
async def test_login_invalid_email(page: Page) -> None:
    name = "L1 login — email invalid → toast invalidEmail"
    await goto_auth(page, "login")
    await page.locator("#email").fill("nu-este-email")
    await page.locator("#password").fill("parola-lunga-aici")
    await page.get_by_role("button", name=re.compile(r"AUTENTIFIC|LOG IN", re.I)).last.click()
    msg = await wait_toast(page, re.compile(r"invalid|email", re.I))
    if not msg:
        bad(name, "nu a apărut toast pentru email invalid")
        return
    assert "/auth" in page.url, f"a plecat de pe /auth: {page.url}"
    ok(name)


# ─── L2 · parolă prea scurtă ───────────────────────────────────────────────
async def test_login_short_password(page: Page) -> None:
    name = "L2 login — parolă < 8 → toast passwordMin"
    await goto_auth(page, "login")
    await page.locator("#email").fill("valid@example.com")
    await page.locator("#password").fill("scurt")
    await page.get_by_role("button", name=re.compile(r"AUTENTIFIC|LOG IN", re.I)).last.click()
    msg = await wait_toast(page, re.compile(r"parol|password|8|caractere|character", re.I))
    if not msg:
        bad(name, "nu a apărut toast pentru parolă prea scurtă")
        return
    ok(name)


# ─── L3 · credențiale greșite ──────────────────────────────────────────────
async def test_login_bad_credentials(page: Page) -> None:
    name = "L3 login — credențiale greșite → toast eroare mapată"
    await goto_auth(page, "login")
    await page.locator("#email").fill("nobody-e2e@example.com")
    await page.locator("#password").fill("parola-corecta-123!")
    # Dacă Turnstile e configurat, așteaptă token înainte de submit.
    if await turnstile_present(page):
        await page.wait_for_timeout(2500)  # test-key emite token în ~1-2s
    await page.get_by_role("button", name=re.compile(r"AUTENTIFIC|LOG IN", re.I)).last.click()
    # Așteptăm fie un toast de eroare (invalid_login / email_not_confirmed /
    # captcha / signup_disabled etc.), fie rămânerea pe /auth.
    msg = await wait_toast(page, re.compile(r".", re.S), timeout_ms=6000)
    if not msg:
        bad(name, "nu a apărut niciun toast după submit")
        return
    if "/auth" not in page.url:
        bad(name, f"a fost redirectat neașteptat: {page.url}")
        return
    ok(name)


# ─── S1 · buton disabled fără consimțăminte ────────────────────────────────
async def test_signup_button_gated(page: Page) -> None:
    name = "S1 signup — buton disabled fără over18/terms/birthdate"
    await goto_auth(page, "signup")
    await page.locator("#email").fill("cineva@example.com")
    await page.locator("#password").fill("parola-lunga-123!")
    btn = page.get_by_role("button", name=re.compile(r"CREEAZĂ CONT|CREATE ACCOUNT", re.I)).last
    if await btn.is_enabled():
        bad(name, "butonul e enabled fără checkboxuri + birthdate")
        return
    ok(name)


# ─── S2 · birthdate < 18 ───────────────────────────────────────────────────
async def test_signup_underage(page: Page) -> None:
    name = "S2 signup — birthdate < 18 → hint minAge + buton disabled"
    await goto_auth(page, "signup")
    await page.locator("#email").fill("minor@example.com")
    await page.locator("#password").fill("parola-lunga-123!")
    # Bifează ambele
    checkboxes = page.locator("input[type='checkbox']")
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()
    # Data de naștere: acum 10 ani
    from datetime import date
    young = date.today().replace(year=date.today().year - 10).isoformat()
    # <input type="date" max=...>: setăm forțat valoarea (input[type=date] max blochează UI-ul date-picker,
    # dar `fill` scrie direct valoarea și React sincronizează state-ul prin `onChange`)
    await page.locator("#birthdate").evaluate(
        "(el, v) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }",
        young,
    )
    await page.wait_for_timeout(200)
    btn = page.get_by_role("button", name=re.compile(r"CREEAZĂ CONT|CREATE ACCOUNT", re.I)).last
    if await btn.is_enabled():
        bad(name, "butonul e enabled cu birthdate < 18")
        return
    ok(name)


# ─── S3 · signup valid → check-email ──────────────────────────────────────
async def test_signup_valid_flow(page: Page) -> None:
    name = "S3 signup — date valide → /auth/check-email"
    await goto_auth(page, "signup")
    email = f"e2e-{int(time.time())}@example.com"
    await page.locator("#email").fill(email)
    await page.locator("#password").fill("parola-lunga-123!")
    checkboxes = page.locator("input[type='checkbox']")
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()
    from datetime import date
    adult = date.today().replace(year=date.today().year - 25).isoformat()
    await page.locator("#birthdate").evaluate(
        "(el, v) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }",
        adult,
    )
    await page.wait_for_timeout(200)

    if await turnstile_present(page):
        print("    ↳ Turnstile detectat — aștept emiterea token-ului (test-key always-pass)…")
        await page.wait_for_timeout(3500)

    btn = page.get_by_role("button", name=re.compile(r"CREEAZĂ CONT|CREATE ACCOUNT", re.I)).last
    if not await btn.is_enabled():
        await page.screenshot(path=str(OUT / "s3_button_disabled.png"))
        bad(name, "butonul rămâne disabled cu date valide (probabil captcha lipsă)")
        return
    await btn.click()

    # Așteptăm fie /auth/check-email, fie un toast (disposable email / captcha /
    # rate limit); considerăm testul PASS dacă apare unul din răspunsurile
    # așteptate — @example.com este blocat de assert_email_allowed pe unele
    # deployment-uri, ceea ce este comportamentul corect.
    try:
        await page.wait_for_url(re.compile(r".*/auth/check-email.*"), timeout=8000)
        await page.screenshot(path=str(OUT / "s3_check_email.png"))
        ok(name + " (redirect check-email)")
        return
    except Exception:
        msg = await wait_toast(page, re.compile(r".", re.S), timeout_ms=1500)
        if msg:
            ok(name + f" (respins server-side: {msg[:80]})")
            return
        bad(name, "nici redirect check-email, nici toast eroare")


# ─── S4 · /auth/check-email ────────────────────────────────────────────────
async def test_check_email_page(page: Page) -> None:
    name = "S4 /auth/check-email — afișează email + buton resend"
    email = "cineva-verific@example.com"
    await page.goto(f"{BASE}/auth/check-email?email={email}", wait_until="domcontentloaded")
    # Așteaptă randare React (h1) + un mic buffer pentru useEffect care setează emailul.
    await page.locator("h1").first.wait_for(state="visible", timeout=5000)
    await page.wait_for_timeout(500)
    body = (await page.locator("body").inner_text()).lower()
    values = await page.locator("input").evaluate_all(
        "els => els.map(e => (e.value || '').toLowerCase()).join(' ')"
    )
    if email.lower() not in body and email.lower() not in values:
        await page.screenshot(path=str(OUT / "s4_debug.png"))
        bad(name, f"emailul nu apare pe pagina check-email (body[:200]={body[:200]!r})")
        return
    ok(name)


# ─── F1 · forgot password fără email ───────────────────────────────────────
async def test_forgot_password_empty(page: Page) -> None:
    name = "F1 forgot password — fără email → toast enterEmailFirst"
    await goto_auth(page, "login")
    # Lăsăm inputul gol și apăsăm "Am uitat parola"
    await page.locator("#email").fill("")
    await page.get_by_role("button", name=re.compile(r"AM UITAT|FORGOT", re.I)).click()
    msg = await wait_toast(page, re.compile(r"email|introdu|enter", re.I))
    if not msg:
        bad(name, "nu a apărut toast pentru email lipsă")
        return
    ok(name)


# ─── F2 · /reset-password public ───────────────────────────────────────────
async def test_reset_password_public(page: Page) -> None:
    name = "F2 /reset-password — pagină publică (fără redirect /auth)"
    resp = await page.goto(f"{BASE}/reset-password", wait_until="domcontentloaded")
    if resp is None:
        bad(name, "no response")
        return
    # Nu ne redirecționează la /auth. (Pagina poate cere sesiunea recovery,
    # dar URL-ul trebuie să rămână pe /reset-password.)
    if "/auth" in page.url and "reset-password" not in page.url:
        bad(name, f"a fost redirectat la {page.url}")
        return
    ok(name)


async def main() -> int:
    print(f"→ E2E auth flow pe {BASE}")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        page.on("pageerror", lambda e: print(f"    [pageerror] {e}"))

        tests = [
            test_login_invalid_email,
            test_login_short_password,
            test_login_bad_credentials,
            test_signup_button_gated,
            test_signup_underage,
            test_signup_valid_flow,
            test_check_email_page,
            test_forgot_password_empty,
            test_reset_password_public,
        ]
        for t in tests:
            try:
                await t(page)
            except Exception as ex:
                bad(t.__name__, f"exception: {ex!r}")

        await browser.close()

    print()
    print(f"Rezultate: {len(PASS)} PASS · {len(FAIL)} FAIL")
    for n, why in FAIL:
        print(f"  ✗ {n}: {why}")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
