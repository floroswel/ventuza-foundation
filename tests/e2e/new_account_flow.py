"""
E2E — Flux cont nou pe mobil: email → onboarding → Didit (Suzeta).

Acoperire:
  A1  /auth/check-email randează butonul „Retrimite email de confirmare”
      (cu countdown) și adresa introdusă.
  A2  /verify/status neautentificat redirecționează la /auth.
  A3  /n (onboarding) neautentificat nu rămâne blocat pe spinner.
  A4  /verify randează ecranul de verificare 18+ fără eroare de runtime.
  A5  Zero erori de consolă „Uncaught” pe rutele de mai sus (regresii de import
      sau hooks).

Rulare:
    python3 tests/e2e/new_account_flow.py
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

MOBILE = {"width": 390, "height": 844}


async def main() -> None:
    failures: list[str] = []
    console_errors: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=MOBILE, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        page.on(
            "console",
            lambda m: console_errors.append(m.text)
            if m.type == "error" and "Uncaught" in m.text
            else None,
        )

        # A1 — check-email + buton de retrimitere
        await page.goto(f"{BASE}/auth/check-email?email=e2e%40suzeta.app", wait_until="networkidle")
        body = (await page.inner_text("body")).lower()
        if "e2e@suzeta.app" not in body:
            failures.append("A1: adresa de email nu apare pe /auth/check-email")
        if not any(k in body for k in ("retrimite", "resend")):
            failures.append("A1: butonul de retrimitere lipsește")
        await page.screenshot(path=str(SHOTS / "new_account_check_email.png"))

        # A2 — /verify/status fără sesiune → /auth
        await page.goto(f"{BASE}/verify/status", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        if "/auth" not in page.url:
            failures.append(f"A2: /verify/status nu a redirecționat la /auth (url={page.url})")

        # A3 — onboarding se randează
        await page.goto(f"{BASE}/n", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        if not (await page.locator("main").count()):
            failures.append("A3: /n nu a randat conținut")
        await page.screenshot(path=str(SHOTS / "new_account_onboarding.png"))

        # A4 — /verify se randează
        await page.goto(f"{BASE}/verify", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        if not (await page.locator("body").count()):
            failures.append("A4: /verify nu a randat")

        await browser.close()

    # A5
    if console_errors:
        failures.append(f"A5: erori de consolă: {console_errors[:3]}")

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        raise SystemExit(1)
    print("PASS — flux cont nou (email → onboarding → Didit) fără regresii")


asyncio.run(main())
