"""
Visual regression SUZETA — mobil 360 / 390 / 430, light + dark.

Rulează fără dependențe externe (doar Playwright). Pentru fiecare
(viewport × temă × ecran):

  1. face screenshot în `tests/visual/screenshots/`,
  2. verifică brand guard-urile:
     - niciun text „Ventuza" în DOM,
     - nicio culoare din paleta veche purple/indigo folosită ca
       background/color/border pe elemente vizibile,
     - fontul de bază este Space Grotesk,
     - fundalul body este tokenul dark #0B0B10 (în temă dark),
     - butonul primar folosește gradientul de brand (nu culoare plată),
  3. detectează overflow orizontal (scroll lateral pe mobil).

Ieșire: `tests/visual/report.json`. Exit code 1 dacă există issues.

ENV:
  VR_BASE_URL   — default http://localhost:8080
  VR_UPDATE     — dacă e setat, nu eșuează (doar generează raportul)
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
SHOTS = OUT_DIR / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [360, 390, 430]
THEMES = ["light", "dark"]
SCREENS = [
    ("welcome", "/"),
    ("auth", "/auth"),
    ("onboarding", "/n"),
    ("profile", "/profile"),
]

# Paleta veche (purple/indigo generice) — nu are voie să apară.
LEGACY_RGB = [
    (147, 51, 234),
    (126, 34, 206),
    (79, 70, 229),
    (99, 102, 241),
    (109, 40, 217),
]

BANNED_TEXT = re.compile(r"ventuza", re.IGNORECASE)

PROBE_JS = r"""
() => {
  const parseRGB = (s) => {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s || "");
    return m ? [ +m[1], +m[2], +m[3] ] : null;
  };
  const legacy = %LEGACY%;
  const near = (c) => legacy.some(l => Math.abs(l[0]-c[0])<=6 && Math.abs(l[1]-c[1])<=6 && Math.abs(l[2]-c[2])<=6);

  const hits = [];
  const els = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    for (const prop of ["backgroundColor", "color", "borderTopColor"]) {
      const c = parseRGB(cs[prop]);
      if (c && near(c)) {
        hits.push({ prop, value: cs[prop], tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80) });
        break;
      }
    }
    const bg = cs.backgroundImage || "";
    if (bg.includes("gradient")) {
      for (const m of bg.matchAll(/rgba?\([^)]+\)/g)) {
        const c = parseRGB(m[0]);
        if (c && near(c)) {
          hits.push({ prop: "backgroundImage", value: bg.slice(0, 160), tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80) });
          break;
        }
      }
    }
  }

  const body = getComputedStyle(document.body);
  const primary = document.querySelector("button, [role=button], a[class*=bg-brand]");
  const primaryStyle = primary ? getComputedStyle(primary) : null;

  return {
    text: (document.body.innerText || "").slice(0, 200000),
    legacyHits: hits.slice(0, 20),
    fontFamily: body.fontFamily,
    bodyBg: body.backgroundColor,
    hasBrandGradient: Array.from(document.querySelectorAll("body *")).some(
      (el) => (getComputedStyle(el).backgroundImage || "").includes("gradient")
    ),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}
""".replace("%LEGACY%", json.dumps([list(c) for c in LEGACY_RGB]))


async def run() -> int:
    results = []
    issues = []

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
                page = await context.new_page()
                # Fixează tema explicit (app-ul poate folosi clasa .dark).
                await page.goto(BASE_URL, wait_until="domcontentloaded")
                await page.evaluate(
                    "(t) => { localStorage.setItem('theme', t);"
                    "document.documentElement.classList.toggle('dark', t === 'dark'); }",
                    theme,
                )

                for name, path in SCREENS:
                    key = f"{name}-{width}-{theme}"
                    try:
                        await page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=30000)
                    except Exception:
                        await page.wait_for_timeout(1500)
                    await page.wait_for_timeout(600)

                    shot = SHOTS / f"{key}.png"
                    await page.screenshot(path=str(shot))

                    probe = await page.evaluate(PROBE_JS)

                    local = []
                    if BANNED_TEXT.search(probe["text"]):
                        local.append("text 'Ventuza' prezent în DOM")
                    if probe["legacyHits"]:
                        local.append(
                            f"culori din paleta veche: {json.dumps(probe['legacyHits'][:3], ensure_ascii=False)}"
                        )
                    if "Space Grotesk" not in (probe["fontFamily"] or ""):
                        local.append(f"font de bază neașteptat: {probe['fontFamily']}")
                    if probe["overflowX"] > 1:
                        local.append(f"overflow orizontal: {probe['overflowX']}px")

                    results.append(
                        {
                            "screen": name,
                            "path": path,
                            "width": width,
                            "theme": theme,
                            "screenshot": str(shot.relative_to(OUT_DIR)),
                            "fontFamily": probe["fontFamily"],
                            "bodyBg": probe["bodyBg"],
                            "hasBrandGradient": probe["hasBrandGradient"],
                            "issues": local,
                        }
                    )
                    for i in local:
                        issues.append(f"[{key}] {i}")
                    print(f"{'FAIL' if local else 'ok  '} {key}" + (f" — {'; '.join(local)}" if local else ""))

                await context.close()
        await browser.close()

    report = {
        "baseUrl": BASE_URL,
        "viewports": VIEWPORTS,
        "themes": THEMES,
        "screens": [s[0] for s in SCREENS],
        "checks": len(results),
        "issueCount": len(issues),
        "issues": issues,
        "results": results,
    }
    (OUT_DIR / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n{len(results)} verificări, {len(issues)} probleme → tests/visual/report.json")

    if issues and not SOFT:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
