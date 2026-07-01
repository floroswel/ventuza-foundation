"""
Teste automate de accesibilitate pentru FullscreenViewer din ProfilePhotoGallery.
Rulare: python3 tests/a11y/gallery_fullscreen.py
Server dev trebuie să fie pornit pe http://localhost:8080.

Acoperire:
  T1  focus inițial se așează pe butonul „Închide galeria"
  T2  Tab repetat nu scoate focus-ul din dialog (focus trap forward)
  T3  Shift+Tab repetat nu scoate focus-ul din dialog (focus trap backward)
  T4  conținutul extra este inclus în ordinea de Tab (chiar și după scroll)
  T5  focusin guard readuce focus-ul înapoi în dialog când e mutat din afară
  T6  aria-current="true" reflectă poza curentă (după ArrowRight)
  T7  Home sare la prima poză
  T8  End sare la ultima poză
  T9  Esc închide dialogul
  T10 focus-ul se restaurează la elementul anterior deschiderii
  T11 body scroll unlock după închidere
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(exist_ok=True, parents=True)
URL = "http://localhost:8080/gallery-test"

async def active_label(page):
    return await page.evaluate(
        "() => document.activeElement && (document.activeElement.getAttribute('aria-label') "
        "|| document.activeElement.getAttribute('data-testid') || document.activeElement.tagName)"
    )

async def in_dialog(page) -> bool:
    return await page.evaluate(
        "() => { const d = document.querySelector('[role=\"dialog\"]'); "
        "return !!(d && d.contains(document.activeElement)); }"
    )

async def current_thumb_label(page) -> str | None:
    return await page.evaluate(
        "() => { const t = document.querySelector('[role=\"dialog\"] [role=\"tab\"][aria-current=\"true\"]'); "
        "return t && t.getAttribute('aria-label'); }"
    )

async def main() -> int:
    failures: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 420, "height": 900})
        page = await context.new_page()

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_selector('[role="region"][aria-roledescription="carusel"]', timeout=5000)
        await page.wait_for_function(
            "() => { const im = document.querySelector('.cursor-zoom-in'); "
            "return im && im.complete && im.naturalWidth > 0; }",
            timeout=10000,
        )
        await page.screenshot(path=str(OUT / "1_loaded.png"))

        # Focus outside → verificăm restaurarea focus-ului la close.
        await page.locator('[data-testid="outside-before"]').focus()

        # Dispatch click prin JS ca să păstreze focus-ul pe outside-before.
        await page.evaluate(
            "() => document.querySelector('.cursor-zoom-in')"
            ".dispatchEvent(new MouseEvent('click', { bubbles: true }))"
        )
        await page.wait_for_selector('[role="dialog"][aria-modal="true"]', timeout=3000)
        await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT / "2_fullscreen_open.png"))

        # T1 — focus inițial
        af = await active_label(page)
        if af != "Închide galeria":
            failures.append(f"T1 initial focus expected 'Închide galeria', got {af!r}")

        # T2 — focus trap forward
        trapped = True
        for _ in range(20):
            await page.keyboard.press("Tab")
            if not await in_dialog(page):
                trapped = False
                break
        if not trapped:
            failures.append("T2 focus escaped dialog on Tab")

        # T3 — focus trap backward
        trapped = True
        for _ in range(20):
            await page.keyboard.press("Shift+Tab")
            if not await in_dialog(page):
                trapped = False
                break
        if not trapped:
            failures.append("T3 focus escaped dialog on Shift+Tab")

        # T4 — extra content reachable (după scroll)
        await page.evaluate("() => document.querySelector('[role=\"dialog\"]').scrollTo(0, 800)")
        await page.wait_for_timeout(100)
        found_extra = False
        for _ in range(30):
            await page.keyboard.press("Tab")
            tid = await page.evaluate(
                "() => document.activeElement && document.activeElement.getAttribute('data-testid')"
            )
            if tid == "extra-btn-1":
                found_extra = True
                break
        if not found_extra:
            failures.append("T4 extra-btn-1 not reachable via Tab")

        # T5 — focusin guard
        await page.evaluate("() => document.querySelector('[data-testid=\"outside-after\"]').focus()")
        await page.wait_for_timeout(50)
        if not await in_dialog(page):
            failures.append("T5 focusin guard failed — focus stayed outside dialog")

        # T6 — aria-current după ArrowRight
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(80)
        cur = await current_thumb_label(page)
        if cur != "Poza 2 din 3":
            failures.append(f"T6 aria-current expected 'Poza 2 din 3', got {cur!r}")

        # T7 — Home
        await page.keyboard.press("Home")
        await page.wait_for_timeout(80)
        cur = await current_thumb_label(page)
        if cur != "Poza 1 din 3":
            failures.append(f"T7 Home expected 'Poza 1 din 3', got {cur!r}")

        # T8 — End
        await page.keyboard.press("End")
        await page.wait_for_timeout(80)
        cur = await current_thumb_label(page)
        if cur != "Poza 3 din 3":
            failures.append(f"T8 End expected 'Poza 3 din 3', got {cur!r}")

        # T9 — Esc închide
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)
        gone = await page.evaluate(
            "() => !document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]')"
        )
        if not gone:
            failures.append("T9 Esc did not close dialog")
        await page.screenshot(path=str(OUT / "3_after_esc.png"))

        # T10 — focus restaurat
        restored = await page.evaluate(
            "() => document.activeElement && document.activeElement.getAttribute('data-testid')"
        )
        if restored != "outside-before":
            failures.append(f"T10 focus restore expected 'outside-before', got {restored!r}")

        # T11 — body scroll unlock
        overflow = await page.evaluate("() => document.body.style.overflow")
        if overflow == "hidden":
            failures.append("T11 body overflow still 'hidden' after close")

        await browser.close()

    if failures:
        print("FAIL:")
        for f in failures:
            print(" -", f)
        return 1
    print("ALL PASSED (11/11)")
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
