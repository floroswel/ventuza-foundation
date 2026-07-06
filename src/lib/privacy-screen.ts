// Anti-screenshot / anti-recorder init.
// - On Android (Capacitor): activează FLAG_SECURE via @capacitor-community/privacy-screen.
// - Pe web: best-effort — dezactivează context menu pe imagini/media, drag,
//   selectare text și afișează un overlay negru când tab-ul iese din focus
//   (mitigare parțială pentru screenshot-uri făcute din alt app).

export type PrivacyScreenStatus = {
  platform: "web" | "android" | "ios" | "unknown";
  native: boolean;
  enabled: boolean;
  preventScreenshots: boolean;
  error?: string;
};

// Ultimul status calculat — util pentru UI (badge/toast în Setări → Securitate).
let lastStatus: PrivacyScreenStatus = {
  platform: "unknown",
  native: false,
  enabled: false,
  preventScreenshots: false,
};

export function getPrivacyScreenStatus(): PrivacyScreenStatus {
  return lastStatus;
}

async function notify(status: PrivacyScreenStatus) {
  lastStatus = status;
  try {
    window.dispatchEvent(new CustomEvent("ventuza:privacy-screen", { detail: status }));
  } catch {
    /* ignore */
  }
  // Toast doar pe nativ (pe web e zgomot — nu putem bloca screenshot-uri oricum).
  if (!status.native) return;
  try {
    const { toast } = await import("sonner");
    if (status.enabled && status.preventScreenshots) {
      toast.success("Protecție capturi activă", {
        description: `${status.platform === "ios" ? "iOS" : "Android"} · screenshot-urile sunt blocate`,
        duration: 2500,
      });
    } else if (status.enabled) {
      toast("Protecție capturi parțială", {
        description: "Ecranul e ascuns la switch de app, dar screenshot-urile nu sunt blocate.",
        duration: 4000,
      });
    } else {
      toast.error("Protecție capturi INACTIVĂ", {
        description: status.error ?? "PrivacyScreen nu a putut fi pornit.",
        duration: 6000,
      });
    }
  } catch {
    /* sonner poate lipsi în SSR */
  }
}

export async function initPrivacyScreen(): Promise<PrivacyScreenStatus> {
  if (typeof window === "undefined") return lastStatus;

  // 1) Native (Android/iOS): FLAG_SECURE / screenshot prevention
  try {
    const { Capacitor } = await import("@capacitor/core");
    const isNative = Capacitor.isNativePlatform();
    const platform = (Capacitor.getPlatform?.() ?? "web") as PrivacyScreenStatus["platform"];

    if (isNative) {
      const t0 = performance.now();
      try {
        const mod = await import("@capacitor-community/privacy-screen");
        await mod.PrivacyScreen.enable();
        const ms = Math.round(performance.now() - t0);
        console.info(
          `[privacy-screen] ✅ enabled on ${platform} in ${ms}ms (preventScreenshots=true via capacitor.config)`,
        );
        await notify({
          platform,
          native: true,
          enabled: true,
          preventScreenshots: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[privacy-screen] ❌ native enable failed on ${platform}:`, msg);
        await notify({
          platform,
          native: true,
          enabled: false,
          preventScreenshots: false,
          error: msg,
        });
      }
    } else {
      console.info("[privacy-screen] web platform — native FLAG_SECURE not available");
      await notify({
        platform: "web",
        native: false,
        enabled: false,
        preventScreenshots: false,
      });
    }
  } catch (err) {
    console.info("[privacy-screen] native init skipped", err);
    await notify({
      ...lastStatus,
      error: err instanceof Error ? err.message : String(err),
    });
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
