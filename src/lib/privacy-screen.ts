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

  // 1) Native (Android/iOS): FLAG_SECURE / preventScreenshots
  try {
    const { Capacitor } = await import("@capacitor/core");
    const isNative = Capacitor.isNativePlatform();
    const platform = (Capacitor.getPlatform?.() ?? "web") as PrivacyScreenStatus["platform"];

    if (isNative) {
      const t0 = performance.now();
      let pluginOk = false;
      let pluginErr: string | undefined;

      // 1a) Încearcă plugin-ul oficial (Android FLAG_SECURE + iOS
      //     preventScreenshots + splash mask la background).
      try {
        const mod = await import("@capacitor-community/privacy-screen");
        await mod.PrivacyScreen.enable();
        pluginOk = true;
        const ms = Math.round(performance.now() - t0);
        console.info(
          `[privacy-screen] ✅ plugin activ pe ${platform} în ${ms}ms (FLAG_SECURE / preventScreenshots)`,
        );

        // Re-arm după fiecare resume — unele OEM-uri Android pierd FLAG_SECURE
        // când activity-ul e recreat (rotire, split-screen).
        try {
          const { App } = await import("@capacitor/app");
          App.addListener("appStateChange", async ({ isActive }) => {
            if (isActive) {
              try {
                await mod.PrivacyScreen.enable();
                console.info("[privacy-screen] re-armat la resume");
              } catch (e) {
                console.warn("[privacy-screen] re-arm eșuat", e);
              }
            }
          });
        } catch {
          /* App plugin absent — best-effort */
        }

        // Listeners iOS: alertăm user-ul când OS raportează captură/ecran înregistrat.
        if (platform === "ios") {
          try {
            mod.PrivacyScreen.addListener("screenshotTaken", async () => {
              console.warn("[privacy-screen] iOS a semnalat screenshotTaken");
              const { toast } = await import("sonner");
              toast.warning("Cineva a făcut o captură de ecran", {
                description: "Sistemul iOS ne-a notificat. Fii atent la ce partajezi.",
                duration: 5000,
              });
              window.dispatchEvent(new CustomEvent("ventuza:screenshot-detected"));
            });
            mod.PrivacyScreen.addListener("screenRecordingStarted", async () => {
              console.warn("[privacy-screen] iOS screen recording pornit");
              const { toast } = await import("sonner");
              toast.error("Înregistrare de ecran detectată", {
                description: "Conținutul sensibil e ascuns până se oprește.",
                duration: 6000,
              });
              document.documentElement.classList.add("__privacy_defocused");
            });
            mod.PrivacyScreen.addListener("screenRecordingStopped", () => {
              console.info("[privacy-screen] iOS screen recording oprit");
              document.documentElement.classList.remove("__privacy_defocused");
            });
          } catch (e) {
            console.warn("[privacy-screen] listeners iOS indisponibili", e);
          }
        }

        await notify({
          platform,
          native: true,
          enabled: true,
          preventScreenshots: true,
        });
      } catch (err) {
        pluginErr = err instanceof Error ? err.message : String(err);
        console.error(`[privacy-screen] ❌ plugin indisponibil pe ${platform}:`, pluginErr);
      }

      // 1b) Fallback nativ fără plugin — cel puțin mascăm ecranul la background
      //     (recent-apps preview) via App.appStateChange + overlay CSS.
      if (!pluginOk) {
        try {
          const { App } = await import("@capacitor/app");
          const applyMask = (active: boolean) => {
            document.documentElement.classList.toggle("__privacy_defocused", !active);
            const el = document.getElementById("__privacy_hide_overlay");
            if (el) el.style.display = active ? "none" : "block";
          };
          App.addListener("appStateChange", ({ isActive }) => applyMask(isActive));
          console.info(
            `[privacy-screen] ⚠ fallback nativ activ pe ${platform} (mascare background, FĂRĂ blocare capturi)`,
          );
          await notify({
            platform,
            native: true,
            enabled: true,
            preventScreenshots: false,
            error: pluginErr,
          });
        } catch (e) {
          const emsg = e instanceof Error ? e.message : String(e);
          console.error(`[privacy-screen] fallback nativ eșuat pe ${platform}:`, emsg);
          await notify({
            platform,
            native: true,
            enabled: false,
            preventScreenshots: false,
            error: pluginErr ?? emsg,
          });
        }
      }
    } else {
      console.info("[privacy-screen] web — FLAG_SECURE indisponibil, aplicăm best-effort");
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



  // 2) Web best-effort — nu putem bloca screenshot-uri OS, dar reducem
  //    considerabil ferestrele "accidentale": long-press save, drag, copy,
  //    print, snipping tool care surprinde ecranul cât tabul e defocalizat.
  try {
    // Block context menu pe media (permite input-uri și zone marcate explicit).
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, [contenteditable='true']")) return;
      if (t.closest("[data-allow-context]")) return;
      if (t.closest("img, video, picture, canvas, [data-private-media]"))
        e.preventDefault();
    };
    window.addEventListener("contextmenu", onCtx, { capture: true });

    // Blochează drag pe orice imagine/video (previne salvare prin drag-out).
    const onDrag = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === "IMG" || t.tagName === "VIDEO" || t.closest("[data-private-media]"))
        e.preventDefault();
    };
    window.addEventListener("dragstart", onDrag, { capture: true });

    // Copy / cut pe zone private → blocat.
    const onCopy = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-private-media]") || t.closest("img, video")) e.preventDefault();
    };
    window.addEventListener("copy", onCopy, { capture: true });
    window.addEventListener("cut", onCopy, { capture: true });

    // Long-press save pe iOS/Android web → suprimă callout-ul.
    const style = document.createElement("style");
    style.setAttribute("data-privacy-screen", "");
    style.textContent = `
      img, video, picture, [data-private-media] {
        -webkit-touch-callout: none;
        -webkit-user-drag: none;
        -webkit-user-select: none;
        user-select: none;
      }
      [data-private-media] { -webkit-tap-highlight-color: transparent; }
      html.__privacy_defocused [data-private-media],
      html.__privacy_defocused img,
      html.__privacy_defocused video {
        filter: blur(28px) brightness(0.55) !important;
        transition: filter 120ms ease-out;
      }
      #__privacy_hide_overlay {
        position: fixed; inset: 0; background: #000; z-index: 2147483647;
        display: none; pointer-events: none;
        backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      }
    `;
    document.head.appendChild(style);

    // Overlay negru + blur pe media când tabul iese din focus SAU pagina e
    // ascunsă (switch tab / minimizare / snipping tool). Mitigare parțială
    // pentru capturi făcute cât fereastra nu e activă.
    const overlayId = "__privacy_hide_overlay";
    const ensureOverlay = () => {
      if (document.getElementById(overlayId)) return;
      const el = document.createElement("div");
      el.id = overlayId;
      document.body.appendChild(el);
    };
    let printOverride = false;
    const applyDefocus = (defocused: boolean) => {
      ensureOverlay();
      const el = document.getElementById(overlayId);
      if (el) el.style.display = defocused ? "block" : "none";
      document.documentElement.classList.toggle("__privacy_defocused", defocused);
    };
    const onVis = () => applyDefocus(document.visibilityState === "hidden");
    const onBlur = () => applyDefocus(true);
    const onFocus = () => applyDefocus(printOverride ? true : false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onBlur);
    window.addEventListener("pageshow", onFocus);

    // Blochează print (Ctrl+P / dialog OS) — mascăm complet conținutul.
    const onBeforePrint = () => {
      printOverride = true;
      applyDefocus(true);
    };
    const onAfterPrint = () => {
      printOverride = false;
      applyDefocus(document.visibilityState === "hidden");
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    // Ctrl+P / Cmd+P + Ctrl+S / Cmd+S → prevenim shortcut-ul.
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "s")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
  } catch (err) {
    console.info("[privacy-screen] web init failed", err);
  }

  return lastStatus;
}
