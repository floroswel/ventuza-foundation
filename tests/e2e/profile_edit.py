"""
E2E — Editare profil via EditDrawer (Ventuza).

Acoperire:
  G1  /profile fără sesiune → redirect /auth (guard).
  E1  Deschide EditDrawer, editează Display Name + About Me (bio), Save →
      valorile persistă în DB (verificare prin supabase REST) și în UI.
  E2  Toggle chip Pronouns + Orientation + adăugare min. 3 Interests →
      Save → persistă în DB.
  E3  Badge "Unverified" apare pe header cât timp `verified_at IS NULL`.
      Când e populat, se afișează "Verified" în locul lui.
  E4  Contorul de caractere se actualizează live (display_name /15, bio /255)
      + maxLength=15 taie automat inputul peste 15.
  E5  Prompts — deși nu există UI de adăugare în editor, payload-ul de Save
      include array-ul `prompts` existent și îl repostează neschimbat
      (regresie: nu îl șterge din DB când salvezi alte câmpuri).

G1 rulează fără sesiune. E1–E5 rulează DOAR când
LOVABLE_BROWSER_AUTH_STATUS=injected și E2E_ALLOW_REAL_WRITE=1 (mută valori
în DB pentru userul curent — nu rula pe cont "real" fără intenție).

Rulare:
    python3 tests/e2e/profile_edit.py

Presupune dev server pe http://localhost:8080.
"""
import asyncio, json, os, sys, time
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

OUT = Path(__file__).parent / "screenshots" / "profile_edit"
OUT.mkdir(exist_ok=True, parents=True)
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

AUTH_STATUS = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON", "")
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY", "")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON", "")
ACCESS_TOKEN = os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN", "")
ALLOW_WRITE = os.environ.get("E2E_ALLOW_REAL_WRITE") == "1"

# Read the anon publishable key from .env (mounted read-only). We only need it
# to shape REST requests; the bearer token comes from the injected session.
def _anon_key() -> str:
    envf = Path(__file__).resolve().parents[2] / ".env"
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("VITE_SUPABASE_PUBLISHABLE_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    return ""

def _supabase_url() -> str:
    envf = Path(__file__).resolve().parents[2] / ".env"
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("VITE_SUPABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    return ""

ANON_KEY = _anon_key()
SUPA_URL = _supabase_url()

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []
SKIP: list[tuple[str, str]] = []


def ok(n: str) -> None:
    PASS.append(n); print(f"  ✓ {n}")
def bad(n: str, why: str) -> None:
    FAIL.append((n, why)); print(f"  ✗ {n}: {why}")
def skip(n: str, why: str) -> None:
    SKIP.append((n, why)); print(f"  ⊘ {n}: {why}")


async def restore_session(context: BrowserContext, page: Page) -> None:
    if COOKIES_JSON:
        cookies = json.loads(COOKIES_JSON)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if STORAGE_KEY and SESSION_JSON:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
        )


async def rest_get_profile(page: Page) -> dict | None:
    """Fetch own profile row via PostgREST (RLS = own row only)."""
    if not (SUPA_URL and ANON_KEY and ACCESS_TOKEN):
        return None
    js = f"""
    const res = await fetch({json.dumps(SUPA_URL)} +
      '/rest/v1/profiles?select=display_name,bio,pronouns,orientation,interests,prompts,verified_at&limit=1',
      {{ headers: {{
        apikey: {json.dumps(ANON_KEY)},
        Authorization: 'Bearer ' + {json.dumps(ACCESS_TOKEN)},
      }} }});
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
    """
    return await page.evaluate(js)


async def open_editor(page: Page) -> None:
    await page.goto(BASE + "/profile", wait_until="domcontentloaded")
    await page.get_by_role("button", name="Edit profile").click()
    await page.get_by_role("heading", name="Edit Profile").wait_for()


# ---------- G1 --------------------------------------------------------------
async def test_guard(context: BrowserContext) -> None:
    page = await context.new_page()
    try:
        await page.goto(BASE + "/profile", wait_until="domcontentloaded")
        await page.wait_for_url("**/auth**", timeout=15000)
        await page.screenshot(path=str(OUT / "g1_guard.png"))
        ok("G1 unauth → /auth")
    except Exception as e:
        bad("G1 unauth → /auth", str(e))
    finally:
        await page.close()


# ---------- E1 --------------------------------------------------------------
async def test_edit_basics(context: BrowserContext) -> None:
    if AUTH_STATUS != "injected":
        skip("E1 edit display_name+bio", f"AUTH_STATUS={AUTH_STATUS}"); return
    if not ALLOW_WRITE:
        skip("E1 edit display_name+bio", "E2E_ALLOW_REAL_WRITE!=1"); return
    page = await context.new_page()
    try:
        await restore_session(context, page)
        await open_editor(page)
        stamp = str(int(time.time()))[-6:]
        new_name = f"E2E{stamp}"  # <=15 chars
        new_bio = f"E2E bio {stamp} — autotest edit."
        # Display name
        name_input = page.get_by_label("Display Name")
        await name_input.fill("")
        await name_input.type(new_name)
        # Bio
        bio_input = page.get_by_label("About Me")
        await bio_input.fill("")
        await bio_input.type(new_bio)
        await page.screenshot(path=str(OUT / "e1_before_save.png"))
        await page.get_by_role("button", name="Save").click()
        # Drawer închide la succes
        await page.get_by_role("heading", name="Your profile").or_(
            page.get_by_role("button", name="Edit profile")
        ).wait_for(timeout=8000)
        row = await rest_get_profile(page)
        assert row and row.get("display_name") == new_name, f"name not persisted: {row}"
        assert row and row.get("bio") == new_bio, f"bio not persisted: {row}"
        await page.screenshot(path=str(OUT / "e1_after_save.png"))
        ok("E1 edit display_name+bio")
    except Exception as e:
        await page.screenshot(path=str(OUT / "e1_fail.png"))
        bad("E1 edit display_name+bio", str(e))
    finally:
        await page.close()


# ---------- E2 --------------------------------------------------------------
async def test_edit_chips(context: BrowserContext) -> None:
    if AUTH_STATUS != "injected":
        skip("E2 chips pronouns+orientation+interests", f"AUTH_STATUS={AUTH_STATUS}"); return
    if not ALLOW_WRITE:
        skip("E2 chips pronouns+orientation+interests", "E2E_ALLOW_REAL_WRITE!=1"); return
    page = await context.new_page()
    try:
        await restore_session(context, page)
        await open_editor(page)
        # Interests block (label "My Tags")
        my_tags = page.locator("text=My Tags").locator("..")
        chips = my_tags.get_by_role("button")
        n = min(3, await chips.count())
        for i in range(n):
            await chips.nth(i).click()
        # Pronouns — activează primul chip
        pronouns = page.locator("text=Pronouns").locator("..").get_by_role("button")
        if await pronouns.count():
            await pronouns.first.click()
        # Orientation — activează primul chip
        orient = page.locator("text=Orientation").locator("..").get_by_role("button")
        if await orient.count():
            await orient.first.click()
        await page.screenshot(path=str(OUT / "e2_chips_before_save.png"))
        await page.get_by_role("button", name="Save").click()
        await page.get_by_role("button", name="Edit profile").wait_for(timeout=8000)
        row = await rest_get_profile(page)
        assert row and len(row.get("interests") or []) >= 3, f"interests not persisted: {row}"
        assert row and len(row.get("pronouns") or []) >= 1, f"pronouns not persisted: {row}"
        assert row and len(row.get("orientation") or []) >= 1, f"orientation not persisted: {row}"
        ok("E2 chips pronouns+orientation+interests")
    except Exception as e:
        await page.screenshot(path=str(OUT / "e2_fail.png"))
        bad("E2 chips pronouns+orientation+interests", str(e))
    finally:
        await page.close()


# ---------- E3 --------------------------------------------------------------
async def test_unverified_badge(context: BrowserContext) -> None:
    if AUTH_STATUS != "injected":
        skip("E3 unverified badge", f"AUTH_STATUS={AUTH_STATUS}"); return
    page = await context.new_page()
    try:
        await restore_session(context, page)
        await page.goto(BASE + "/profile", wait_until="domcontentloaded")
        # Așteaptă header-ul de profil
        await page.get_by_role("button", name="Edit profile").wait_for(timeout=8000)
        row = await rest_get_profile(page)
        expected = "Verified" if (row and row.get("verified_at")) else "Unverified"
        badge = page.get_by_text(expected, exact=True).first
        await badge.wait_for(timeout=5000)
        await page.screenshot(path=str(OUT / f"e3_{expected.lower()}.png"))
        ok(f"E3 badge = {expected}")
    except Exception as e:
        await page.screenshot(path=str(OUT / "e3_fail.png"))
        bad("E3 unverified badge", str(e))
    finally:
        await page.close()


# ---------- E4 --------------------------------------------------------------
async def test_char_counters(context: BrowserContext) -> None:
    if AUTH_STATUS != "injected":
        skip("E4 char counters + maxLength", f"AUTH_STATUS={AUTH_STATUS}"); return
    page = await context.new_page()
    try:
        await restore_session(context, page)
        await open_editor(page)
        name_input = page.get_by_label("Display Name")
        await name_input.fill("")
        # 25 caractere — maxLength=15 taie la 15
        await name_input.type("ABCDEFGHIJKLMNOPQRSTUVWXY")
        val = await name_input.input_value()
        assert len(val) == 15, f"maxLength not enforced: len={len(val)} ({val!r})"
        # Contorul afișează 15/15
        counter = page.get_by_text("15/15", exact=True).first
        await counter.wait_for(timeout=2000)
        # Bio counter
        bio_input = page.get_by_label("About Me")
        await bio_input.fill("test123")
        await page.get_by_text("7/255", exact=True).first.wait_for(timeout=2000)
        await page.screenshot(path=str(OUT / "e4_counters.png"))
        # Nu salvăm — închidem cu X
        await page.get_by_role("button", name="Close").click()
        ok("E4 char counters + maxLength")
    except Exception as e:
        await page.screenshot(path=str(OUT / "e4_fail.png"))
        bad("E4 char counters + maxLength", str(e))
    finally:
        await page.close()


# ---------- E5 --------------------------------------------------------------
async def test_prompts_regression(context: BrowserContext) -> None:
    """Save nu trebuie să șteargă prompts existente când editezi alte câmpuri."""
    if AUTH_STATUS != "injected":
        skip("E5 prompts regression on save", f"AUTH_STATUS={AUTH_STATUS}"); return
    if not ALLOW_WRITE:
        skip("E5 prompts regression on save", "E2E_ALLOW_REAL_WRITE!=1"); return
    page = await context.new_page()
    try:
        await restore_session(context, page)
        before = await rest_get_profile(page)
        prompts_before = (before or {}).get("prompts") or []
        await open_editor(page)
        # Modificare non-invazivă: toggle un chip Interests, apoi toggle înapoi
        my_tags = page.locator("text=My Tags").locator("..").get_by_role("button")
        if await my_tags.count():
            await my_tags.first.click()
            await my_tags.first.click()  # revert
        await page.get_by_role("button", name="Save").click()
        await page.get_by_role("button", name="Edit profile").wait_for(timeout=8000)
        after = await rest_get_profile(page)
        prompts_after = (after or {}).get("prompts") or []
        assert prompts_before == prompts_after, (
            f"prompts changed by unrelated save: before={prompts_before} after={prompts_after}"
        )
        ok("E5 prompts regression on save")
    except Exception as e:
        await page.screenshot(path=str(OUT / "e5_fail.png"))
        bad("E5 prompts regression on save", str(e))
    finally:
        await page.close()


# ---------- runner ----------------------------------------------------------
async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            ctx1 = await browser.new_context(viewport={"width": 1280, "height": 1800})
            await test_guard(ctx1)
            await ctx1.close()

            ctx2 = await browser.new_context(viewport={"width": 1280, "height": 1800})
            await test_edit_basics(ctx2)
            await test_edit_chips(ctx2)
            await test_unverified_badge(ctx2)
            await test_char_counters(ctx2)
            await test_prompts_regression(ctx2)
            await ctx2.close()
        finally:
            await browser.close()
    print(f"\nPASS={len(PASS)} FAIL={len(FAIL)} SKIP={len(SKIP)}")
    for n, w in FAIL: print(f"  FAIL {n}: {w}")
    for n, w in SKIP: print(f"  SKIP {n}: {w}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
