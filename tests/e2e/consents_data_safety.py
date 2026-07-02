"""
E2E — Consimțăminte ↔ Data Safety ↔ comportament aplicație.

Rulare:
    python3 tests/e2e/consents_data_safety.py

Presupune dev server pe http://localhost:8080 și sesiune Supabase injectată
(`LOVABLE_BROWSER_AUTH_STATUS=injected`).

Acoperire (per kind opțional din CONSENT_REGISTRY):
  T1  toggle-ul din /settings (ConsentsCard) devine ON → checkbox reflectă starea
      după reload
  T2  `has_active_consent(kind)` întoarce true după ON
  T3  toggle-ul devine OFF → checkbox reflectă starea după reload
  T4  `has_active_consent(kind)` întoarce false după OFF; ultimul `consent_log`
      pentru user are `accepted=false`
  T5  /legal/data-safety conține o secțiune care menționează kind-ul (label sau
      cuvânt-cheie) și oferă un link de control către /settings
  T6  gate comportamental:
        - push_notifications OFF → nu există PushSubscription activă
        - ai_features OFF/ON → RPC has_active_consent reflectă corect
        - background_location OFF → has_active_consent = false (Strat 2 blocat)

Kind-urile obligatorii `terms` și `privacy` NU sunt testate (nu apar în UI).
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(exist_ok=True, parents=True)
BASE = "http://localhost:8080"

OPTIONAL_KINDS = [
    "age_verification",
    "ai_features",
    "push_notifications",
    "background_location",
    "marketing",
]

# Cuvinte-cheie așteptate pe /legal/data-safety per kind
KEYWORDS = {
    "age_verification": ["Selfie verificare vârstă", "Didit"],
    "ai_features": ["funcții AI", "Lovable AI"],
    "push_notifications": ["Notificări push", "FCM"],
    "background_location": ["Locație în fundal", "geofencing"],
    "marketing": [],  # marketing nu apare distinct pe data-safety (email newsletter)
}


async def restore_session(context, page):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def rpc_has_active_consent(page, kind: str) -> bool:
    """Cheamă RPC has_active_consent via supabase-js din context browser."""
    return await page.evaluate(
        """async (kind) => {
            const mod = await import('/src/integrations/supabase/client.ts');
            const { data: { user } } = await mod.supabase.auth.getUser();
            if (!user) return { __err: 'no user' };
            const { data, error } = await mod.supabase.rpc('has_active_consent', { _user_id: user.id, _kind: kind });
            if (error) return { __err: error.message };
            return !!data;
        }""",
        kind,
    )


async def latest_consent_row(page, kind: str):
    return await page.evaluate(
        """async (kind) => {
            const mod = await import('/src/integrations/supabase/client.ts');
            const { data: { user } } = await mod.supabase.auth.getUser();
            if (!user) return null;
            const { data } = await mod.supabase.from('consent_log')
                .select('kind, accepted, created_at')
                .eq('user_id', user.id).eq('kind', kind)
                .order('created_at', { ascending: false }).limit(1);
            return data && data[0] || null;
        }""",
        kind,
    )


def consents_section(page):
    return page.locator("section").filter(has_text="Consimțăminte GDPR")


async def set_toggle(page, kind: str, desired: bool):
    cb = consents_section(page).locator("input[type=checkbox]").nth(OPTIONAL_KINDS.index(kind))
    await cb.wait_for(state="visible", timeout=5000)
    if await cb.is_checked() == desired:
        return
    await cb.click()
    try:
        await page.wait_for_function(
            """(args) => {
                const secs = Array.from(document.querySelectorAll('section'));
                const sec = secs.find(s => s.textContent && s.textContent.includes('Consimțăminte GDPR'));
                if (!sec) return false;
                const boxes = sec.querySelectorAll('input[type=checkbox]');
                return boxes[args.idx] && boxes[args.idx].checked === args.desired;
            }""",
            arg={"idx": OPTIONAL_KINDS.index(kind), "desired": desired},
            timeout=8000,
        )
    except Exception:
        toast = await page.locator("[data-sonner-toast]").all_inner_texts()
        raise RuntimeError(f"toggle {kind}->{desired} nu a persistat; toast={toast}")
    await page.wait_for_timeout(300)


async def push_subscription_active(page) -> bool:
    return await page.evaluate(
        """async () => {
            try {
                const reg = await navigator.serviceWorker?.getRegistration();
                const sub = await reg?.pushManager?.getSubscription();
                return !!sub;
            } catch { return false; }
        }"""
    )


async def main() -> int:
    failures: list[str] = []

    async def fail(msg: str):
        print("FAIL:", msg)
        failures.append(msg)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # 1. sesiune + settings
        await restore_session(context, page)
        await page.goto(f"{BASE}/settings", wait_until="networkidle")
        try:
            await page.locator("section:has-text('Consimțăminte GDPR')").wait_for(timeout=8000)
        except Exception:
            await page.screenshot(path=str(OUT / "e_settings.png"))
            print("Nu s-a încărcat /settings (probabil auth). URL:", page.url)
            await browser.close()
            return 1
        await page.screenshot(path=str(OUT / "0_settings_initial.png"))

        # 2. per fiecare kind: ON, verifică, OFF, verifică
        for kind in OPTIONAL_KINDS:
            for desired in (True, False):
                await set_toggle(page, kind, desired)

                # reload și verifică că checkbox persistă (T1/T3)
                await page.reload(wait_until="networkidle")
                await page.locator("section:has-text('Consimțăminte GDPR')").wait_for(timeout=8000)
                cb = consents_section(page).locator("input[type=checkbox]").nth(OPTIONAL_KINDS.index(kind))
                actual = await cb.is_checked()
                if actual != desired:
                    await fail(f"[{kind}] checkbox după reload={actual}, așteptat {desired}")

                # T2/T4: has_active_consent
                rpc = await rpc_has_active_consent(page, kind)
                if isinstance(rpc, dict) and "__err" in rpc:
                    await fail(f"[{kind}] RPC has_active_consent eroare: {rpc['__err']}")
                elif rpc != desired:
                    await fail(f"[{kind}] has_active_consent={rpc}, așteptat {desired}")

                # T4: ultima intrare consent_log reflectă noua stare
                row = await latest_consent_row(page, kind)
                if not row or bool(row.get("accepted")) != desired:
                    await fail(f"[{kind}] ultima intrare consent_log={row}, așteptat accepted={desired}")

                # T6: gate comportamental pentru push_notifications
                if kind == "push_notifications" and desired is False:
                    if await push_subscription_active(page):
                        await fail("[push_notifications] PushSubscription încă activă după retragere")

        await page.screenshot(path=str(OUT / "1_settings_after.png"))

        # 3. /legal/data-safety (T5) — verificăm publică + fără auth necesar
        await page.goto(f"{BASE}/legal/data-safety", wait_until="networkidle")
        body_text = (await page.locator("body").inner_text()).lower()
        for kind in OPTIONAL_KINDS:
            for kw in KEYWORDS[kind]:
                if kw.lower() not in body_text:
                    await fail(f"[data-safety] lipsă mențiune pentru {kind}: '{kw}'")
        # link de control către /settings prezent
        links = await page.locator("a[href='/settings']").count()
        if links < 1:
            await fail("[data-safety] fără link de control către /settings")
        await page.screenshot(path=str(OUT / "2_data_safety.png"))

        await browser.close()

    print("\n=== REZULTAT ===")
    print(f"Failures: {len(failures)}")
    for f in failures:
        print(" -", f)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
