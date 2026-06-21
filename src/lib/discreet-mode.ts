// Discreet mode: swap document title + favicon to look like a generic utility.
const KEY = "vz_discreet_mode";

export type DiscreetSkin = "off" | "calculator" | "weather" | "notes";

const SKINS: Record<Exclude<DiscreetSkin, "off">, { title: string; favicon: string }> = {
  calculator: {
    title: "Calculator",
    favicon:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1f2937"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="#fbbf24" font-family="Arial">=</text></svg>`,
      ),
  },
  weather: {
    title: "Weather",
    favicon:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0ea5e9"/><text x="16" y="22" font-size="18" text-anchor="middle">☀️</text></svg>`,
      ),
  },
  notes: {
    title: "Notes",
    favicon:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#facc15"/><text x="16" y="23" font-size="20" text-anchor="middle">📝</text></svg>`,
      ),
  },
};

export function loadDiscreetMode(): DiscreetSkin {
  if (typeof window === "undefined") return "off";
  return (localStorage.getItem(KEY) as DiscreetSkin) || "off";
}

export function applyDiscreetMode(skin: DiscreetSkin) {
  if (typeof document === "undefined") return;
  localStorage.setItem(KEY, skin);
  if (skin === "off") {
    document.title = "Ventuza";
    setFavicon("/favicon.ico");
    return;
  }
  const { title, favicon } = SKINS[skin];
  document.title = title;
  setFavicon(favicon);
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}
