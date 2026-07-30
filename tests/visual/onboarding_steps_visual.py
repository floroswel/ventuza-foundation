"""
Visual regression — ONBOARDING, câmp cu câmp.

Capturează screenshot separat pentru fiecare secțiune din onboarding:
display name, birthdate, gender, pronouns, orientation, looking for,
interests, prompt/bio answers. Rulează pe 360 / 390 / 430 × light + dark.

Siguranță: toate scrierile Supabase (`/rest/v1/profiles`,
`/rest/v1/onboarding_drafts`, RPC) sunt interceptate și returnate mock 200,
deci contul de test NU este modificat. Citirile trec normal.

Ieșire:
  tests/visual/screenshots-onboarding/<field>-<width>-<theme>.png  (element)
  tests/visual/screenshots-onboarding/<field>-<width>-<theme>-full.png
  tests/visual/report-onboarding.json

ENV: VR_BASE_URL (default http://localhost:8080), VR_UPDATE (soft mode)
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("VR_BASE_URL", "http://localhost:8080").rstrip("/")
SOFT = bool(os.environ.get("VR_UPDATE"))

OUT_DIR = Path(__file__).parent
SHOTS = OUT_DIR / "screenshots-onboarding"
SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [360, 390, 430]
THEMES = ["light", "dark"]

# (cheie, index pas 0-based, index secțiune în interiorul pasului)
# Pașii: 0 basics · 1 identity · 2 personality · 3 photos
FIELDS = [
    ("display-name", 0, 0),
    ("birthdate", 0, 1),
    ("gender", 1, 0),
    ("pronouns", 1, 1),
    ("orientation", 1, 2),
    ("looking-for", 1, 3),
    ("interests", 2, 0),
    ("prompt-answers", 2, 1),
]

LEGACY_RGB = [
    (147, 51, 234),
    (126, 34, 206),
    (79, 70, 229),
    (99, 102, 241),
    (109, 40, 217),
]
BANNED_TEXT = re.compile(r"ventuza", re.IGNORECASE)

SECTION_JS = r"""
(idx) => {
  const root = document.querySelector("section > div.max-w-lg") ||
               document.querySelector("main section");
  if (!root) return null;
  // Secțiunile de câmp: copiii direcți care conțin un <label>.
  const sections = Array.from(root.children).filter(
    (el) => el.querySelector("label, [data-slot=label]")
  );
  const el = sections[idx];
  if (!el) return null;
  el.setAttribute("data-vr-target", "1");
  el.scrollIntoView({ block: "center" });
  return { count: sections.length, text: el.innerText.slice(0, 400) };
}
"""

PROBE_JS = r"""
() => {
  const parseRGB = (s) => {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s || "");
    return m ? [ +m[1], +m[2], +m[3] ] : null;
  };
  const legacy = %LEGACY%;
  const near = (c) => legacy.some(l => Math.abs(l[0]-c[0])<=6 && Math.abs(l[1]-c[1])<=6 && Math.abs(l[2]-c[2])<=6);
  const target = document.querySelector("[data-vr-target]");
  const hits = [];
  if (target) {
    for (const el of [target, ...target.querySelectorAll("*")].slice(0, 800)) {
      const cs = getComputedStyle(el);
      for (const p of ["backgroundColor", "color", "borderTopColor"]) {
        const c = parseRGB(cs[p]);
        if (c && near(c)) { hits.push({ prop: p, value: cs[p] }); break; }
      }
    }
  }
  const label = target ? target.querySelector("label, [data-slot=label]") : null;
  const control = target ? target.querySelector("input, textarea, button, [role=button]") : null;
  const r = control ? control.getBoundingClientRect() : null;
  return {
    found: !!target,
    text: target ? target.innerText.slice(0, 2000) : "",
    labelText: label ? label.innerText.trim().slice(0, 120) : null,
    controlHeight: r ? Math.round(r.height) : null,
    legacyHits: hits.slice(0, 5),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}
""".replace("%LEGACY%", json.dumps([list(c) for c in LEGACY_RGB]))


async def mock_writes(route):
    req = route.request
    if req.method in ("POST", "PATCH", "PUT", "DELETE"):
        await route.fulfill(
            status=200,
            content_type="application/json",
            headers={"access-control-allow-origin": "*"},
            body="[]",
        )
    else:
        await route.continue_()


async def restore_session(context, page) -> bool:
    session = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        try:
            await context.add_cookies(cookies)
        except Exception:
            pass
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    if key and session:
        await page.evaluate(
            "([k, v]) => window.localStorage.setItem(k, v)", [key, session]
        )
        return True
    return False


async def fill_and_advance(page, target_step: int):
    """Din pasul 0, completează minimul și avansează până la `target_step`."""
    for _ in range(target_step):
        # basics: nume + dată
        inputs = page.locator("section input")
        n = await inputs.count()
        for i in range(n):
            el = inputs.nth(i)
            try:
                itype = await el.get_attribute("type")
                if await el.is_disabled():
                    continue
                if itype == "date":
                    if not await el.input_value():
                        await el.fill("1995-05-05")
                elif itype in (None, "text"):
                    if not await el.input_value():
                        await el.fill("Test Suzeta")
            except Exception:
                pass
        # identity: bifează câte un chip din fiecare grup
        groups = page.locator("section div.flex.flex-wrap")
        for i in range(await groups.count()):
            chip = groups.nth(i).locator("button").first
            try:
                await chip.click(timeout=1500)
            except Exception:
                pass
        await page.locator("footer button").last.click()
        await page.wait_for_timeout(900)


async def run() -> int:
    results, issues = [], []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for width in VIEWPORTS:
            for theme in THEMES:
                context = await browser.new_context(
                    viewport={"width": width, "height": 900},
                    device_scale_factor=2,
                    is_mobile=True,
                    has_touch=True,
                    color_scheme=theme,
                )
                await context.route("**/rest/v1/**", mock_writes)
                page = await context.new_page()
                signed_in = await restore_session(context, page)
                await page.evaluate(
                    "(t) => { localStorage.setItem('theme', t);"
                    "document.documentElement.classList.toggle('dark', t === 'dark'); }",
                    theme,
                )
                if not signed_in:
                    print("!! fără sesiune injectată — onboarding indisponibil")
                    await context.close()
                    await browser.close()
                    return 0 if SOFT else 1

                current_step = -1
                for key, step_idx, section_idx in FIELDS:
                    tag = f"{key}-{width}-{theme}"
                    if step_idx != current_step:
                        try:
                            await page.goto(f"{BASE_URL}/n", wait_until="commit", timeout=30000)
                        except Exception as e:
                            print(f"   goto /n: {e.__class__.__name__} — reîncerc")
                            await page.wait_for_timeout(1000)
                            try:
                                await page.goto(f"{BASE_URL}/n", wait_until="commit", timeout=30000)
                            except Exception:
                                pass
                        await page.wait_for_timeout(2000)
                        if not page.url.rstrip("/").endswith("/n"):
                            issues.append(f"[{tag}] redirect din /n → {page.url}")
                            break
                        await fill_and_advance(page, step_idx)
                        current_step = step_idx

                    info = await page.evaluate(SECTION_JS, section_idx)
                    await page.wait_for_timeout(250)
                    probe = await page.evaluate(PROBE_JS)

                    local = []
                    if not probe["found"]:
                        local.append(f"secțiune negăsită (index {section_idx}, pas {step_idx})")
                    else:
                        el = page.locator("[data-vr-target]").first
                        try:
                            await el.screenshot(path=str(SHOTS / f"{tag}.png"))
                        except Exception as e:
                            local.append(f"screenshot element eșuat: {e}")
                        await page.screenshot(path=str(SHOTS / f"{tag}-full.png"))

                        if BANNED_TEXT.search(probe["text"]):
                            local.append("text 'Ventuza' în secțiune")
                        if probe["legacyHits"]:
                            local.append(f"paletă veche: {probe['legacyHits'][:2]}")
                        if not probe["labelText"]:
                            local.append("label lipsă")
                        if probe["controlHeight"] is not None and probe["controlHeight"] < 40:
                            local.append(f"țintă tactilă mică: {probe['controlHeight']}px")
                        if probe["overflowX"] > 1:
                            local.append(f"overflow orizontal: {probe['overflowX']}px")

                    results.append(
                        {
                            "field": key,
                            "step": step_idx,
                            "section": section_idx,
                            "width": width,
                            "theme": theme,
                            "label": probe.get("labelText"),
                            "sectionsInStep": (info or {}).get("count"),
                            "screenshot": f"screenshots-onboarding/{tag}.png",
                            "issues": local,
                        }
                    )
                    for i in local:
                        issues.append(f"[{tag}] {i}")
                    print(f"{'FAIL' if local else 'ok  '} {tag}" + (f" — {'; '.join(local)}" if local else ""))

                    await page.evaluate(
                        "() => document.querySelectorAll('[data-vr-target]')"
                        ".forEach(e => e.removeAttribute('data-vr-target'))"
                    )
                await context.close()
        await browser.close()

    report = {
        "baseUrl": BASE_URL,
        "viewports": VIEWPORTS,
        "themes": THEMES,
        "fields": [f[0] for f in FIELDS],
        "checks": len(results),
        "issueCount": len(issues),
        "issues": issues,
        "results": results,
    }
    (OUT_DIR / "report-onboarding.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False)
    )
    print(f"\n{len(results)} verificări, {len(issues)} probleme → tests/visual/report-onboarding.json")
    return 1 if (issues and not SOFT) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
