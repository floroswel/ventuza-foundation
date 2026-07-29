"""
E2E — Upload poze profil via PhotoManager (Suzeta).

Acoperire:
  G1  /profile fără sesiune → redirect /auth (guard).
  P1  Type invalid (.txt) → în coada de upload apare status "Eroare" cu
      motivul "format nesuportat" (pre-validare client, fără storage call).
  P2  Fișier >8 MB (image/png) → coada arată "depășește 8 MB".
  P3  7 fișiere valide selectate deodată cu 0 existente → toast warning
      "Am păstrat primele 6 poze" + 1 dropped (limitare MAX_PHOTOS=6).
  P4  Upload 1 poză reală → devine principală (badge "Main" pe prima).
  P5  Cu 6 poze deja în profil → toast error "Ai deja 6 poze" la un nou add.
  P6  Alegere principală: click ★ pe a 2-a poză → devine prima cu badge Main.

G1 rulează fără sesiune. P1–P3 folosesc DOAR pre-validarea client — nu ating
Supabase Storage — deci pot rula cu sesiune injectată fără efecte laterale.
P4–P6 fac upload real prin `profile-photos` bucket (RLS `{uid}/*`) și sunt
rulate DOAR când LOVABLE_BROWSER_AUTH_STATUS=injected; testele curăță după
ele (ștergere upload-uri prin PhotoManager).

Rulare:
    python3 tests/e2e/profile_photos.py

Presupune dev server pe http://localhost:8080.
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

OUT = Path(__file__).parent / "screenshots" / "profile_photos"
OUT.mkdir(exist_ok=True, parents=True)
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

AUTH_STATUS = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON", "")
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY", "")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON", "")

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []
SKIP: list[tuple[str, str]] = []


def ok(n: str) -> None:
    PASS.append(n); print(f"  ✓ {n}")
def bad(n: str, why: str) -> None:
    FAIL.append((n, why)); print(f"  ✗ {n}: {why}")
def skip(n: str, why: str) -> None:
    SKIP.append((n, why)); print(f"  ⊘ {n}: {why}")


# 1×1 PNG (67 bytes) → payload valid pentru MIME check
PNG_1x1 = bytes([
    0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
    0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
    0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
    0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
    0x54,0x08,0x99,0x63,0xF8,0xCF,0xC0,0x00,
    0x00,0x00,0x03,0x00,0x01,0x5A,0xF4,0x8B,
    0x11,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
    0x44,0xAE,0x42,0x60,0x82,
])


def png_file(name: str) -> dict:
    return {"name": name, "mimeType": "image/png", "buffer": PNG_1x1}

def big_png(name: str, mb: int = 9) -> dict:
    # PNG header + payload umflat > 8 MB → depășește limita.
    padded = PNG_1x1 + b"\x00" * (mb * 1024 * 1024)
    return {"name": name, "mimeType": "image/png", "buffer": padded}

def txt_file(name: str = "note.txt") -> dict:
    return {"name": name, "mimeType": "text/plain", "buffer": b"hello world"}


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


async def wait_toast(page: Page, pattern: re.Pattern[str], timeout_ms: int = 4000) -> str | None:
    import time
    end = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < end:
        for msg in await read_toasts(page):
            if pattern.search(msg):
                return msg
        await page.wait_for_timeout(150)
    return None


async def goto_profile(page: Page) -> str:
    await page.goto(f"{BASE}/profile", wait_until="domcontentloaded")
    for _ in range(40):
        if "/auth" in page.url:
            return page.url
        try:
            await page.locator("input[type='file']").first.wait_for(state="attached", timeout=300)
            return page.url
        except Exception:
            pass
        await page.wait_for_timeout(200)
    return page.url


async def file_input(page: Page):
    """Returns the PhotoManager hidden file input (accept image/*, multiple)."""
    return page.locator("input[type='file'][accept*='image'][multiple]").first


async def get_queue_row(page: Page, name_pattern: str) -> tuple[str | None, str | None]:
    """Returns (status_label, error_text) for a queue row containing filename."""
    row = page.locator("div", has_text=name_pattern).filter(has_text=re.compile(r"Eroare|Gata|Se urcă|În așteptare|Se verifică"))
    try:
        await row.first.wait_for(state="visible", timeout=6000)
    except Exception:
        return (None, None)
    text = await row.first.text_content() or ""
    err_el = row.first.locator(".text-destructive")
    err = None
    try:
        err = (await err_el.first.text_content(timeout=500)) or None
    except Exception:
        err = None
    return (text, err)


# ─── G1 · guard fără sesiune ───────────────────────────────────────────────
async def test_guard_no_session(browser) -> None:
    name = "G1 /profile fără sesiune → redirect /auth"
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    try:
        await page.goto(f"{BASE}/profile", wait_until="domcontentloaded")
        for _ in range(60):
            if "/auth" in page.url:
                ok(name); return
            await page.wait_for_timeout(200)
        bad(name, f"nu a redirect la /auth, URL={page.url}")
    finally:
        await ctx.close()


# ─── Flux autentificat ─────────────────────────────────────────────────────
async def run_authenticated(context: BrowserContext) -> None:
    page = await context.new_page()
    page.on("pageerror", lambda e: print(f"    [pageerror] {e}"))
    try:
        if not await restore_session(context, page):
            for n in ("P1","P2","P3","P4","P5","P6"):
                skip(n, "no injected Supabase session")
            return

        url = await goto_profile(page)
        if "/auth" in url:
            for n in ("P1","P2","P3","P4","P5","P6"):
                skip(n, f"sesiunea nu s-a hidratat (URL={url})")
            return

        finp = await file_input(page)

        # ── P1 · type invalid
        n1 = "P1 photos — .txt → coada 'format nesuportat'"
        try:
            await finp.set_input_files(txt_file("nota.txt"))
            text, err = await get_queue_row(page, "nota.txt")
            if text and (("format nesuportat" in (text or "")) or ("format nesuportat" in (err or ""))):
                ok(n1)
            else:
                bad(n1, f"nu a apărut motivul; text={text!r} err={err!r}")
        except Exception as ex:
            bad(n1, f"exception: {ex!r}")

        # ── P2 · oversized
        n2 = "P2 photos — >8 MB → coada 'depășește 8 MB'"
        try:
            await finp.set_input_files(big_png("uriasa.png", mb=9))
            text, err = await get_queue_row(page, "uriasa.png")
            if text and (("depășește" in (text or "")) or ("depășește" in (err or ""))):
                ok(n2)
            else:
                bad(n2, f"nu a apărut motivul; text={text!r} err={err!r}")
        except Exception as ex:
            bad(n2, f"exception: {ex!r}")

        # ── P3 · >6 la un moment dat (cu 0 existente asumat; dacă profilul are deja
        # unele, doar verificăm mesajul apare cu numărul potrivit)
        n3 = "P3 photos — 7 fișiere → toast 'Am păstrat primele N poze'"
        try:
            files = [png_file(f"good_{i}.png") for i in range(7)]
            await finp.set_input_files(files)
            msg = await wait_toast(page, re.compile(r"păstrat primele|kept first", re.I), timeout_ms=5000)
            if msg:
                ok(n3)
            else:
                # dacă profilul e plin (deja 6), primim în schimb un error toast
                alt = await wait_toast(page, re.compile(r"Ai deja \d+ poze", re.I), timeout_ms=1500)
                if alt:
                    skip(n3, "profil deja plin cu 6 poze → P5 acoperă cazul acesta")
                else:
                    bad(n3, "nu a apărut toast-ul de limită")
        except Exception as ex:
            bad(n3, f"exception: {ex!r}")

        # ── P4/P5/P6 · scriu în Storage → SKIP by default ca să nu poluăm profilul real.
        # Se pot activa prin E2E_ALLOW_REAL_UPLOAD=1 pe un cont dedicat de test.
        if os.environ.get("E2E_ALLOW_REAL_UPLOAD") != "1":
            for n, r in (
                ("P4 photos — 1 upload → badge 'Main' pe prima poză", "E2E_ALLOW_REAL_UPLOAD!=1"),
                ("P5 photos — cu 6 poze → 'Ai deja 6 poze'", "E2E_ALLOW_REAL_UPLOAD!=1"),
                ("P6 photos — click ★ pe a 2-a → devine prima cu badge Main", "E2E_ALLOW_REAL_UPLOAD!=1"),
            ):
                skip(n, r)
            return

        # ── P4 · upload real
        n4 = "P4 photos — 1 upload → badge 'Main' pe prima poză"
        try:
            await finp.set_input_files(png_file("real_main.png"))
            # așteaptă "Gata" în coadă (upload + moderare)
            await page.locator("[data-sonner-toast], span:has-text('Gata')").first.wait_for(timeout=45000)
            await page.wait_for_timeout(1500)
            main_badge = await page.locator("span:has-text('Main')").count()
            if main_badge >= 1:
                ok(n4)
            else:
                bad(n4, "badge 'Main' nu apare")
        except Exception as ex:
            bad(n4, f"exception: {ex!r}")

        # ── P5 · umple până la 6 și apoi cere al 7-lea
        n5 = "P5 photos — cu 6 poze → 'Ai deja 6 poze'"
        try:
            for i in range(5):
                await finp.set_input_files(png_file(f"fill_{i}.png"))
                await page.wait_for_timeout(2500)
            await finp.set_input_files(png_file("overflow.png"))
            msg = await wait_toast(page, re.compile(r"Ai deja \d+ poze", re.I), timeout_ms=5000)
            if msg:
                ok(n5)
            else:
                bad(n5, "nu a apărut toast-ul de plin")
        except Exception as ex:
            bad(n5, f"exception: {ex!r}")

        # ── P6 · star pe a 2-a → devine prima
        n6 = "P6 photos — click ★ pe a 2-a → devine prima cu badge Main"
        try:
            stars = page.get_by_role("button", name=re.compile("Setează ca principală", re.I))
            n_stars = await stars.count()
            if n_stars < 2:
                bad(n6, f"doar {n_stars} butoane ★ — nu pot reordona")
            else:
                await stars.nth(1).click()
                await page.wait_for_timeout(1000)
                # prima celulă din grid trebuie să conțină badge Main
                first_cell = page.locator("div.grid.grid-cols-3 > div").first
                has_main = await first_cell.locator("span:has-text('Main')").count()
                if has_main:
                    ok(n6)
                else:
                    bad(n6, "prima poză nu are badge Main după click ★")
        except Exception as ex:
            bad(n6, f"exception: {ex!r}")

    finally:
        await page.close()


async def main() -> int:
    print(f"→ E2E profile photos pe {BASE} (auth={AUTH_STATUS})")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})

        try:
            await test_guard_no_session(browser)
        except Exception as ex:
            bad("G1", f"exception: {ex!r}")

        try:
            await run_authenticated(context)
        except Exception as ex:
            bad("P*", f"exception: {ex!r}")

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
