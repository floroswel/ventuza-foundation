// Anti-screenshot / anti-recorder init.
// - On Android (Capacitor): activează FLAG_SECURE via @capacitor-community/privacy-screen.
// - Pe web: best-effort — dezactivează context menu pe imagini/media, drag,
//   selectare text și afișează un overlay negru când tab-ul iese din focus
//   (mitigare parțială pentru screenshot-uri făcute din alt app).
export async function initPrivacyScreen(): Promise<void> {
  if (typeof window === "undefined") return;

  // 1) Native (Android): FLAG_SECURE
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const mod = await import("@capacitor-community/privacy-screen");
      // Enables Android FLAG_SECURE + iOS screenshot prevention (when configured).
      await mod.PrivacyScreen.enable();

    }
  } catch (err) {
    console.info("[privacy-screen] native init skipped", err);
  }

  // 2) Web best-effort
  try {
    // Block context menu on chat/photo areas (allow inputs)
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, [contenteditable='true']")) return;
      if (t.closest("[data-allow-context]")) return;
      if (t.closest("img, video, [data-private-media]")) e.preventDefault();
    };
    window.addEventListener("contextmenu", onCtx, { capture: true });

    // Block drag of images
    const onDrag = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "IMG") e.preventDefault();
    };
    window.addEventListener("dragstart", onDrag, { capture: true });

    // Hide sensitive media when tab hidden (helps against OS screenshot APIs
    // that grab the last visible frame after switching apps).
    const overlayId = "__privacy_hide_overlay";
    const ensureOverlay = () => {
      if (document.getElementById(overlayId)) return;
      const el = document.createElement("div");
      el.id = overlayId;
      el.style.cssText =
        "position:fixed;inset:0;background:#000;z-index:2147483647;display:none;pointer-events:none;";
      document.body.appendChild(el);
    };
    const onVis = () => {
      ensureOverlay();
      const el = document.getElementById(overlayId);
      if (!el) return;
      el.style.display = document.visibilityState === "hidden" ? "block" : "none";
    };
    document.addEventListener("visibilitychange", onVis);
  } catch (err) {
    console.info("[privacy-screen] web init failed", err);
  }
}
