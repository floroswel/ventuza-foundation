/**
 * Lightweight device fingerprint (anti-ban-evasion).
 * NOT a tracking pixel — only hashed locally, stored in `device_fingerprints`.
 * Combines stable browser signals into a single hex hash.
 */

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasSignal(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-ctx";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 60, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("ventuza-fp-😀", 2, 2);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("ventuza-fp-😀", 4, 4);
    return canvas.toDataURL();
  } catch {
    return "no-canvas";
  }
}

function webglSignal(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}|${renderer}`;
  } catch {
    return "no-webgl";
  }
}

export async function computeDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "ssr";
  const nav = window.navigator;
  const signals = [
    nav.userAgent,
    nav.language,
    (nav.languages ?? []).join(","),
    nav.hardwareConcurrency ?? "",
    (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? "",
    nav.platform ?? "",
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    `${screen.availWidth}x${screen.availHeight}`,
    new Date().getTimezoneOffset(),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    canvasSignal(),
    webglSignal(),
  ].join("|");
  return await sha256Hex(signals);
}
