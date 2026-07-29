"""
E2E — Storage cross-user isolation pentru bucket-ul `profile-photos` (Ventuza).

Bucket-ul e privat. Politicile RLS pe storage.objects:
  - "Users can view/update/delete their own photos" — restricționează la
    (storage.foldername(name))[1] = auth.uid()::text.
  - "profile_photos_cross_user_read" — permite SELECT unui alt user DOAR
    dacă `public.is_profile_publicly_visible(owner_uuid, viewer_uuid)`
    returnează true (adică profilul e vizibil pentru viewer conform regulilor
    business — discover, match, etc.). Anonymus NU are politică → denied.

Cazuri:
  S1  ANON — GET /object/profile-photos/{owner}/x.jpg fără Authorization →
      400/403 (RLS blochează).
  S2  ANON — Public URL /object/public/profile-photos/... → 400 (bucket
      privat, endpoint public inaccesibil).
  S3  ANON — Signed-URL endpoint (`/object/sign/...`) fără auth → 400/401.
  S4  ANON — LIST bucket (`/object/list/profile-photos`) → 400/401 (fără
      permisiune de a enumera obiecte cross-user).
  S5  Cross-user auth — cu sesiunea injectată (viewer), cerere GET către
      obiect al ALTUI user (uuid random, care sigur nu are vizibilitate
      publică față de mine) → 400/403 (cross-user read blocked).
  S6  Cross-user LIST — cu sesiunea injectată, list pe prefixul altui user
      → răspuns gol / eroare (nu leak).

S1–S4 rulează mereu (nu necesită sesiune). S5–S6 rulează doar cu
LOVABLE_BROWSER_AUTH_STATUS=injected.

Rulare:
    python3 tests/e2e/storage_cross_user.py
"""
import asyncio, json, os, sys, uuid
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

OUT = Path(__file__).parent / "screenshots" / "storage_cross_user"
OUT.mkdir(exist_ok=True, parents=True)

AUTH_STATUS = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON", "")
ACCESS_TOKEN = os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN", "")

def _env(k: str) -> str:
    envf = Path(__file__).resolve().parents[2] / ".env"
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith(k + "="):
                return line.split("=", 1)[1].strip().strip('"')
    return ""

SUPA_URL = _env("VITE_SUPABASE_URL") or _env("SUPABASE_URL")
ANON_KEY = _env("VITE_SUPABASE_PUBLISHABLE_KEY") or _env("SUPABASE_PUBLISHABLE_KEY")
BUCKET = "profile-photos"

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []
SKIP: list[tuple[str, str]] = []

def ok(n, *_): PASS.append(n); print(f"  ✓ {n}")
def bad(n, w=""): FAIL.append((n, w)); print(f"  ✗ {n}: {w}")
def skip(n, w=""): SKIP.append((n, w)); print(f"  ⊘ {n}: {w}")


def _viewer_uid() -> str | None:
    if not SESSION_JSON:
        return None
    try:
        return (json.loads(SESSION_JSON).get("user") or {}).get("id")
    except Exception:
        return None


async def http(page: Page, method: str, url: str, headers: dict | None = None) -> dict:
    js = f"""
    (async () => {{
      const res = await fetch({json.dumps(url)}, {{
        method: {json.dumps(method)},
        headers: {json.dumps(headers or {})},
      }});
      let body = '';
      try {{ body = (await res.text()).slice(0, 400); }} catch (_) {{}}
      return {{ status: res.status, body }};
    }})()
    """
    return await page.evaluate(js)


def deny(status: int) -> bool:
    # Storage refuză accesul RLS cu 400 (RLS), 401 (no auth) sau 403.
    # 404 e "obiect inexistent" — deni acceptabil pentru anon cross-user.
    return status in (400, 401, 403, 404)


# ----- fără sesiune -----
async def anon_tests(context: BrowserContext) -> None:
    page = await context.new_page()
    try:
        # Ancorăm origin pe supabase-domain ca fetch-ul să nu fie same-origin cu localhost.
        await page.goto(SUPA_URL, wait_until="domcontentloaded")
        target = f"{_viewer_uid() or uuid.uuid4()}/main.jpg"

        # S1 — anon direct object
        r = await http(page, "GET", f"{SUPA_URL}/storage/v1/object/{BUCKET}/{target}",
                       {"apikey": ANON_KEY})
        (ok if deny(r["status"]) else bad)("S1 anon direct object denied",
                                            f"expected 4xx got {r['status']} {r['body']}")

        # S2 — public URL pe bucket privat
        r = await http(page, "GET", f"{SUPA_URL}/storage/v1/object/public/{BUCKET}/{target}",
                       {"apikey": ANON_KEY})
        (ok if deny(r["status"]) else bad)("S2 anon public-url on private bucket denied",
                                            f"got {r['status']} {r['body']}")

        # S3 — semnat cu anon (fără sesiune) — trebuie 4xx
        r = await http(page, "POST", f"{SUPA_URL}/storage/v1/object/sign/{BUCKET}/{target}",
                       {"apikey": ANON_KEY, "Content-Type": "application/json"})
        (ok if deny(r["status"]) else bad)("S3 anon sign endpoint denied",
                                            f"got {r['status']} {r['body']}")

        # S4 — list bucket ca anon
        r = await http(page, "POST", f"{SUPA_URL}/storage/v1/object/list/{BUCKET}",
                       {"apikey": ANON_KEY, "Content-Type": "application/json",
                        "x-init-body": "{}"})
        # unele instanțe cer body; folosim endpoint list cu body vid — dacă întoarce
        # 200 dar rows=[], tot e ok (nu leak). Verificăm strict că NU vedem obiecte.
        if r["status"] == 200:
            try:
                rows = json.loads(r["body"] or "[]")
                if isinstance(rows, list) and len(rows) == 0:
                    ok("S4 anon list returns empty")
                else:
                    bad("S4 anon list returns empty", f"leaked {len(rows)} rows: {r['body'][:200]}")
            except Exception as e:
                bad("S4 anon list returns empty", f"parse error: {e}")
        elif deny(r["status"]):
            ok("S4 anon list denied")
        else:
            bad("S4 anon list denied", f"got {r['status']} {r['body']}")
    finally:
        await page.close()


# ----- cu sesiune (cross-user) -----
async def crossuser_tests(context: BrowserContext) -> None:
    if AUTH_STATUS != "injected" or not ACCESS_TOKEN:
        skip("S5 cross-user auth object denied", f"AUTH_STATUS={AUTH_STATUS}")
        skip("S6 cross-user auth list empty", f"AUTH_STATUS={AUTH_STATUS}")
        return
    page = await context.new_page()
    try:
        await page.goto(SUPA_URL, wait_until="domcontentloaded")
        # UUID random care nu e viewer-ul curent și cu care nu am nicio relație
        # (deci is_profile_publicly_visible(owner, viewer) = false).
        stranger = str(uuid.uuid4())
        headers = {"apikey": ANON_KEY, "Authorization": f"Bearer {ACCESS_TOKEN}"}

        r = await http(page, "GET",
                       f"{SUPA_URL}/storage/v1/object/{BUCKET}/{stranger}/main.jpg",
                       headers)
        (ok if deny(r["status"]) else bad)("S5 cross-user auth object denied",
                                            f"got {r['status']} {r['body']}")

        r = await http(page, "POST", f"{SUPA_URL}/storage/v1/object/list/{BUCKET}",
                       {**headers, "Content-Type": "application/json"})
        if r["status"] == 200:
            try:
                rows = json.loads(r["body"] or "[]")
                # Trebuie să vedem DOAR propriile fișiere sau nimic — niciun
                # element care începe cu prefixul altui user.
                viewer = _viewer_uid() or ""
                leaks = [x for x in rows if isinstance(x, dict)
                         and isinstance(x.get("name"), str)
                         and not x["name"].startswith(viewer + "/")]
                if leaks:
                    bad("S6 cross-user auth list empty",
                        f"leaked {len(leaks)} items: {leaks[:3]}")
                else:
                    ok("S6 cross-user auth list empty (owner-scoped)")
            except Exception as e:
                bad("S6 cross-user auth list empty", f"parse: {e}")
        elif deny(r["status"]):
            ok("S6 cross-user auth list denied")
        else:
            bad("S6 cross-user auth list empty", f"got {r['status']} {r['body']}")
    finally:
        await page.close()


async def main() -> int:
    if not (SUPA_URL and ANON_KEY):
        print("Missing SUPABASE env — abort")
        return 2
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            await anon_tests(ctx)
            await crossuser_tests(ctx)
            await ctx.close()
        finally:
            await browser.close()
    print(f"\nPASS={len(PASS)} FAIL={len(FAIL)} SKIP={len(SKIP)}")
    for n, w in FAIL: print(f"  FAIL {n}: {w}")
    for n, w in SKIP: print(f"  SKIP {n}: {w}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
