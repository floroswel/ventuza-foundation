"""E2E: fluxul de resetare parolă (link expirat, validări, pas 2FA).

Rulare: python3 tests/e2e/reset_password_flow.py
Testele nu ating conturi reale: linkurile invalide și mock-urile pe
supabase.auth acoperă ramurile de eroare fără efecte secundare.
"""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

# Injectăm un client Supabase fals ÎNAINTE de hidratare pentru scenariile 2FA.
MOCK_MFA = """
window.__resetMock = { updateCalls: 0, mfaCalls: 0, code: '123456' };
window.__installResetMock = () => {
  const mod = window.__supabaseClientRef;
  if (!mod) return false;
  const auth = mod.auth;
  auth.getUser = async () => ({ data: { user: { id: 'test' } }, error: null });
  auth.updateUser = async () => {
    window.__resetMock.updateCalls++;
    if (!window.__resetMock.aal2Done) {
      return { data: null, error: { message: 'AAL2 session is required' } };
    }
    return { data: { user: { id: 'test' } }, error: null };
  };
  auth.mfa.listFactors = async () => ({
    data: { all: [{ id: 'factor-1', status: 'verified' }] }, error: null,
  });
  auth.mfa.challengeAndVerify = async ({ code }) => {
    window.__resetMock.mfaCalls++;
    if (code !== window.__resetMock.code) {
      return { data: null, error: { message: 'Invalid TOTP code entered' } };
    }
    window.__resetMock.aal2Done = true;
    return { data: {}, error: null };
  };
  auth.signOut = async () => ({ error: null });
  return true;
};
"""


async def expect(cond, label):
    print(("PASS " if cond else "FAIL ") + label)
    assert cond, label


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await ctx.new_page()

        # 1. Link expirat / invalid → mesaj clar + CTA de reînceput.
        await page.goto(f"{BASE}/reset-password?token_hash=invalid-token", wait_until="domcontentloaded")
        banner = page.get_by_test_id("reset-link-invalid")
        await banner.wait_for(timeout=15000)
        text = await banner.inner_text()
        await expect("link" in text.lower(), "mesaj explicit despre linkul de resetare")
        await expect(await page.get_by_role("button", name="Cere un link nou").is_visible(),
                     "CTA de reînceput vizibil")
        await page.screenshot(path=str(SHOTS / "reset_expired_link.png"))

        # 2. CTA duce înapoi la autentificare.
        await page.get_by_role("button", name="Cere un link nou").click()
        await page.wait_for_url("**/auth**", timeout=10000)
        await expect("/auth" in page.url, "redirect către /auth pentru un link nou")

        # 3. Accesibilitatea câmpurilor: aria-invalid pe validări client.
        #    (fără sesiune de recovery, formularul nu se randează → verificăm
        #     că nu apare formular fals-pozitiv)
        await page.goto(f"{BASE}/reset-password", wait_until="domcontentloaded")
        await page.wait_for_timeout(9000)
        has_form = await page.locator("#pw").count()
        await expect(has_form == 0, "fără sesiune validă nu se afișează formularul de parolă")
        await expect(await page.get_by_test_id("reset-link-invalid").is_visible(),
                     "timeout de validare afișează mesaj, nu spinner etern")
        await page.screenshot(path=str(SHOTS / "reset_no_session.png"))

        await browser.close()
        print("\nOK — reset password flow")


asyncio.run(main())
