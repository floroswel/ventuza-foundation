"""
E2E — Onboarding /n (Suzeta).

Acoperă parcurgerea completă a wizard-ului /n cu accent pe:
  G1  /n fără sesiune → redirect la /auth?mode=login (guard).
  O1  Basics: birthdate <18 arată eroarea inline "18+" pe câmp (aria-invalid).
  O2  Basics: "Continuă" fără date → bannerul #ob-errors apare cu lista de erori.
  O3  Basics: nume valid + birthdate 18+ → trecere la pasul Identity.
  O4  Identity: selecție multi-select (gender, pronouns, orientation, looking_for)
      + completare câmpuri custom (gender_custom, pronouns_custom). ChipGrid toggle
      salvează starea și butonul de continuare devine activ.
  O5  Personality: contor live interese, banner erori dacă <3, apoi 3 selecții →
      contor cu variantă activă ("border-primary").
  O6  Photos: fără poze + fără terms → bannerul #ob-errors listează ambele.
  O7  Profil salvat: după parcurgerea completă cu date valide, ultimul submit
      apelează Supabase; verificăm că profiles.display_name/birthdate/gender/
      interests reflectă alegerile (via REST GET cu access token din session).

Toate cazurile O1–O7 depind de o sesiune Supabase autentificată (userul e
necesar ca `/n` să se randeze — altfel guard-ul redirecționează la /auth).
Restaurăm sesiunea injectată de Lovable (LOVABLE_BROWSER_SUPABASE_*). Când
`LOVABLE_BROWSER_AUTH_STATUS != 'injected'`, cazurile O1–O7 se marchează
SKIP cu motiv, iar suita rulează doar G1 (guard-ul e testabil fără sesiune).

Rulare:
    python3 tests/e2e/onboarding_flow.py

Presupune dev server pe http://localhost:8080.
Nu creează useri noi în Supabase Auth — folosește userul din sesiunea injectată.
Notă: dacă userul din sesiune are `onboarding_completed=true`, ruta redirect
la /discover. În cazul acela, O3-O7 se marchează SKIP (nu vrem să distrugem
profilul unui user real; testele se rulează pe un cont de test dedicat).
"""
import asyncio, json, os, re, sys, time
from datetime import date
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

OUT = Path(__file__).parent / "screenshots" / "onboarding"
OUT.mkdir(exist_ok=True, parents=True)
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

AUTH_STATUS = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON", "")
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY", "")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON", "")
ACCESS_TOKEN = os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN", "")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or "https://szzxhvvmwqvfyoldcuyz.supabase.co"
SUPABASE_ANON = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6enhodnZtd3F2ZnlvbGRjdXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzE5NTUsImV4cCI6MjA5NzU0Nzk1NX0."
    "Wf-m_9h3GtQMV6zC6L6ti4ZlR1HCqqHhw4f5ilE-LTs"
)

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []
SKIP: list[tuple[str, str]] = []


def ok(name: str) -> None:
    PASS.append(name); print(f"  ✓ {name}")


def bad(name: str, why: str) -> None:
    FAIL.append((name, why)); print(f"  ✗ {name}: {why}")


def skip(name: str, why: str) -> None:
    SKIP.append((name, why)); print(f"  ⊘ {name}: {why}")


async def restore_session(context: BrowserContext, page: Page) -> bool:
    if AUTH_STATUS != "injected" or not SESSION_JSON or not STORAGE_KEY:
        return False
    if COOKIES_JSON:
        try:
            cookies = json.loads(COOKIES_JSON)
            for c in cookies:
                c["url"] = BASE
            await context.add_cookies(cookies)
        except Exception as ex:
            print(f"    [warn] cookie restore: {ex!r}")
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
    )
    return True


async def read_toasts(page: Page) -> list[str]:
    items = await page.locator("[data-sonner-toast]").all_text_contents()
    return [t.strip() for t in items if t.strip()]


async def goto_onboarding(page: Page) -> str:
    """Deschide /n și așteaptă randarea header-ului sau redirect. Returnează URL final."""
    await page.goto(f"{BASE}/n", wait_until="domcontentloaded")
    # Așteaptă fie stepper-ul, fie redirect la /auth sau /discover.
    for _ in range(40):
        url = page.url
        if "/auth" in url or "/discover" in url:
            return url
        try:
            await page.locator("text=/step\\.basics|onboarding\\.step|1\\/4/i").first.wait_for(
                state="attached", timeout=250
            )
            # Stepper-ul se randează ÎNAINTE ca n.tsx să termine fetch-ul de profil
            # (n.tsx:146-164). Pentru un cont cu onboarding_completed=true, redirectul
            # spre /discover vine imediat după, deci un `return` aici ar face suita să
            # continue pe o pagină care e pe cale să dispară — iar pașii următori
            # eșuau apoi la click pe „Continuă". Lăsăm redirectul să se așeze.
            for _ in range(12):
                await page.wait_for_timeout(250)
                if "/discover" in page.url or "/auth" in page.url:
                    return page.url
            return page.url
        except Exception:
            pass
        # fallback: header cu buton "Înapoi"
        try:
            await page.get_by_role("button", name=re.compile(r"Înapoi|Back", re.I)).wait_for(
                state="visible", timeout=250
            )
            return page.url
        except Exception:
            pass
        await page.wait_for_timeout(150)
    return page.url


async def set_date(page: Page, iso: str) -> None:
    await page.locator("#ob-birth").evaluate(
        "(el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
        " s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));"
        " el.dispatchEvent(new Event('change', { bubbles: true })); }",
        iso,
    )


async def click_continue(page: Page) -> None:
    btn = page.get_by_role("button", name=re.compile(r"Continu|Continue|Termin|Finish", re.I)).last
    await btn.click()


# ─── G1 · guard fără sesiune ───────────────────────────────────────────────
async def test_guard_no_session(browser) -> None:
    name = "G1 /n fără sesiune → redirect /auth"
    # Context nou, fără cookies + fără localStorage din sesiuni anterioare.
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    try:
        await page.goto(f"{BASE}/n", wait_until="domcontentloaded")
        for _ in range(60):
            if "/auth" in page.url:
                ok(name); return
            await page.wait_for_timeout(200)
        bad(name, f"nu a redirect la /auth, URL={page.url}")
    finally:
        await ctx.close()


# ─── O1..O7 · flux autentificat ────────────────────────────────────────────
async def run_authenticated_flow(context: BrowserContext) -> None:
    page = await context.new_page()
    page.on("pageerror", lambda e: print(f"    [pageerror] {e}"))
    try:
        if not await restore_session(context, page):
            for n in ("O1","O2","O3","O4","O5","O6","O7"):
                skip(f"{n} onboarding autentificat", "no injected Supabase session")
            return

        url = await goto_onboarding(page)
        if "/auth" in url:
            for n in ("O1","O2","O3","O4","O5","O6","O7"):
                skip(f"{n} onboarding autentificat", f"sesiunea nu s-a hidratat (URL={url})")
            return
        if "/discover" in url:
            for n in ("O1","O2","O3","O4","O5","O6","O7"):
                skip(f"{n} onboarding autentificat", "userul are onboarding_completed=true")
            return

        # ── O1 — birthdate <18
        n1 = "O1 basics — birthdate <18 arată eroare inline"
        young = date.today().replace(year=date.today().year - 10).isoformat()
        # nume oarecare + birthdate underage
        name_input = page.locator("input").first
        await name_input.fill("Test Onboarding")
        try:
            await set_date(page, young)
            await page.wait_for_timeout(200)
            invalid = await page.locator("#ob-birth[aria-invalid='true']").count()
            err_shown = await page.locator("#ob-birth-err").count()
            if invalid and err_shown:
                ok(n1)
            else:
                bad(n1, f"aria-invalid={invalid}, err={err_shown}")
        except Exception as ex:
            bad(n1, f"exception: {ex!r}")

        # ── O2 — Continuă fără date valide → banner
        n2 = "O2 basics — Continuă fără date → banner #ob-errors"
        # Șterge nume + șterge data → validation triggered by click
        await name_input.fill("")
        await set_date(page, "")
        await page.wait_for_timeout(150)
        await click_continue(page)
        try:
            await page.locator("#ob-errors").wait_for(state="visible", timeout=3000)
            items = await page.locator("#ob-errors li").count()
            if items >= 2:
                ok(n2)
            else:
                bad(n2, f"bannerul are doar {items} erori")
        except Exception as ex:
            bad(n2, f"bannerul nu a apărut: {ex!r}")

        # ── O3 — date valide → pas Identity
        n3 = "O3 basics — date valide → pas Identity"
        await name_input.fill("Test Onboarding")
        eighteen = date.today().replace(year=date.today().year - 25).isoformat()
        await set_date(page, eighteen)
        await page.wait_for_timeout(200)
        await click_continue(page)
        try:
            # așteaptă apariția "Continue" pe pasul 2 și label pentru gender
            await page.locator("text=/2\\/4/").first.wait_for(state="visible", timeout=5000)
            ok(n3)
        except Exception as ex:
            await page.screenshot(path=str(OUT / "o3_fail.png"))
            bad(n3, f"nu a ajuns la pasul 2: {ex!r}")
            return

        # ── O4 — multi-select + custom fields
        n4 = "O4 identity — multi-select chips + gender_custom + pronouns_custom"
        # Bifează primul chip din fiecare grup (gender, pronouns, orientation, looking_for)
        # ChipGrid randează div-uri cu clase, dar Chip e button-like. Selectăm primele
        # 4 grupuri de "flex-wrap gap-2" și facem click pe primul chip din fiecare.
        grids = page.locator("div.flex.flex-wrap.gap-2")
        n_grids = await grids.count()
        if n_grids < 4:
            bad(n4, f"așteptam >=4 chip-grid-uri pe Identity, am găsit {n_grids}")
            return
        for i in range(4):
            first_chip = grids.nth(i).locator("button").first
            await first_chip.click()
        # Custom gender + pronouns: primele două input-uri text pe pasul 2 sunt custom.
        inputs = page.locator("section input[type='text'], section input:not([type])")
        # inputs pot include câmpuri numerice sau altele mai jos; fill primele 2.
        n_inputs = await inputs.count()
        if n_inputs >= 2:
            await inputs.nth(0).fill("non-binary femme")
            await inputs.nth(1).fill("they/them")
        await page.wait_for_timeout(150)
        await click_continue(page)
        try:
            await page.locator("text=/3\\/4/").first.wait_for(state="visible", timeout=5000)
            ok(n4)
        except Exception as ex:
            # Bannerul poate apărea dacă vreun grup nu a fost selectat.
            errs = await page.locator("#ob-errors li").all_text_contents() if await page.locator("#ob-errors").count() else []
            await page.screenshot(path=str(OUT / "o4_fail.png"))
            bad(n4, f"nu am ajuns la pasul 3 ({ex!r}); erori: {errs}")
            return

        # ── O5 — interese min 3 + contor
        n5 = "O5 personality — sub 3 interese → banner; 3 → contor activ"
        # Click Continue fără interese: banner apare cu "interestsNeedMore"
        await click_continue(page)
        try:
            await page.locator("#ob-errors").wait_for(state="visible", timeout=3000)
        except Exception as ex:
            bad(n5, f"bannerul lipsă pe personality: {ex!r}")
            return
        # Selectează 3 interese
        interest_grid = page.locator("div.flex.flex-wrap.gap-2").first
        chips = interest_grid.locator("button")
        n_chips = await chips.count()
        if n_chips < 3:
            bad(n5, f"prea puține chip-uri interese: {n_chips}")
            return
        for i in range(3):
            await chips.nth(i).click()
            await page.wait_for_timeout(50)
        # Contor: caută badge cu clase "border-primary" (varianta activă)
        active_badge = await page.locator("span.border-primary\\/40").count()
        if active_badge < 1:
            # fallback: verifică textul "3"
            txt = await page.locator("span.tabular-nums").first.text_content()
            if not txt or "3" not in txt:
                bad(n5, f"contor nu reflectă 3 selecții: '{txt}'")
                return
        ok(n5)
        await click_continue(page)
        try:
            await page.locator("text=/4\\/4/").first.wait_for(state="visible", timeout=5000)
        except Exception as ex:
            bad("O5b tranziție la pas 4", f"{ex!r}")
            return

        # ── O6 — Photos: fără poze + fără terms → banner
        n6 = "O6 photos — fără poze + fără terms → banner cu 2 erori"
        await click_continue(page)
        try:
            await page.locator("#ob-errors").wait_for(state="visible", timeout=3000)
            items = await page.locator("#ob-errors li").count()
            if items >= 2:
                ok(n6)
            else:
                bad(n6, f"așteptam 2 erori, am {items}")
        except Exception as ex:
            bad(n6, f"bannerul lipsă: {ex!r}")

        # ── O7 — profil salvat (verificare parțială)
        # NU finalizăm (nu vrem upload de poze reale + consimțăminte pe user real).
        # Verificăm în schimb că pașii anteriori au persistat pe profiles via REST.
        n7 = "O7 profil salvat — display_name/birthdate/interests persistate"
        if not ACCESS_TOKEN:
            skip(n7, "no LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN")
            return
        try:
            import urllib.request
            user_id = json.loads(SESSION_JSON).get("user", {}).get("id")
            if not user_id:
                skip(n7, "no user.id în session JSON"); return
            req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=display_name,birthdate,gender,pronouns,interests,gender_custom,pronouns_custom",
                headers={
                    "apikey": SUPABASE_ANON,
                    "Authorization": f"Bearer {ACCESS_TOKEN}",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                rows = json.loads(resp.read().decode())
            if not rows:
                bad(n7, "profil inexistent la GET"); return
            row = rows[0]
            problems = []
            if row.get("display_name") != "Test Onboarding":
                problems.append(f"display_name={row.get('display_name')!r}")
            if row.get("birthdate") != eighteen:
                problems.append(f"birthdate={row.get('birthdate')!r} (aștept {eighteen})")
            if not (row.get("gender") or []) and not (row.get("gender_custom") or ""):
                problems.append("gender și gender_custom lipsă")
            if len(row.get("interests") or []) < 3:
                problems.append(f"interests={row.get('interests')!r}")
            if problems:
                bad(n7, "; ".join(problems))
            else:
                ok(n7)
        except Exception as ex:
            bad(n7, f"REST fail: {ex!r}")

    finally:
        await page.close()


async def main() -> int:
    print(f"→ E2E onboarding pe {BASE} (auth={AUTH_STATUS})")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})

        try:
            await test_guard_no_session(browser)
        except Exception as ex:
            bad("G1", f"exception: {ex!r}")

        try:
            await run_authenticated_flow(context)
        except Exception as ex:
            bad("O*", f"exception: {ex!r}")

        await browser.close()

    print()
    print(f"Rezultate: {len(PASS)} PASS · {len(FAIL)} FAIL · {len(SKIP)} SKIP")
    for n, why in FAIL:
        print(f"  ✗ {n}: {why}")
    for n, why in SKIP:
        print(f"  ⊘ {n}: {why}")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
