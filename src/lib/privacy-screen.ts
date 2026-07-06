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

let webFallbackInstalled = false;

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

        // Re-arm imediat de câteva ori după boot: în unele WebView-uri native
        // primul enable() se pierde dacă Activity/Scene este încă în bootstrap.
        const reenable = (reason: string) => {
          void mod.PrivacyScreen.enable()
            .then(() => console.info(`[privacy-screen] re-arm ${reason} OK`))
            .catch((e) => console.warn(`[privacy-screen] re-arm ${reason} eșuat`, e));
        };
        window.setTimeout(() => reenable("post-boot 500ms"), 500);
        window.setTimeout(() => reenable("post-boot 2000ms"), 2000);

        // Re-arm după fiecare resume — unele OEM-uri Android pierd FLAG_SECURE
        // când activity-ul e recreat (rotire, split-screen).
        try {
          const { App } = await import("@capacitor/app");
          App.addListener("appStateChange", async ({ isActive }) => {
            if (isActive) {
              try {
                await mod.PrivacyScreen.enable();
                console.info("[privacy-screen] re-armat la resume");
                window.setTimeout(() => reenable("resume delayed"), 350);
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
        enabled: true,
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
    if (webFallbackInstalled) return lastStatus;
    webFallbackInstalled = true;

    // Bypass complet pe rutele /admin — adminul trebuie să poată face capturi
    // de ecran pentru rapoarte, audit vizual și support. Rutele sunt deja
    // gated server-side prin rol; dacă un non-admin ajunge acolo, nu are ce
    // să exfiltreze. Verificarea se face la runtime pentru că pathname-ul se
    // schimbă fără reload (SPA).
    const isAdminSurface = () => {
      try {
        return window.location.pathname.startsWith("/admin");
      } catch {
        return false;
      }
    };


    // Helper: descrie succint elementul care a declanșat blocarea (fără PII).
    const describe = (el: HTMLElement | null): string => {
      if (!el) return "unknown";
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
      const priv = el.closest("[data-private-media]") ? "[private]" : "";
      const src = tag === "img" ? ` src=${((el as HTMLImageElement).currentSrc || "").split("/").pop()?.slice(0, 40) || "?"}` : "";
      return `${tag}${id}${cls}${priv}${src}`;
    };

    // Throttle notificări (evită spam când user-ul insistă).
    let lastToastAt = 0;
    const maybeToast = async (action: string, detail: string) => {
      const now = Date.now();
      if (now - lastToastAt < 2500) return;
      lastToastAt = now;
      try {
        const { toast } = await import("sonner");
        toast.warning(`Acțiune blocată: ${action}`, { description: detail, duration: 2500 });
      } catch {
        /* sonner absent la SSR */
      }
    };

    const emit = (action: "contextmenu" | "drag" | "copy" | "cut" | "select" | "capture-key" | "window-leave", el: HTMLElement | null) => {
      const target = describe(el);
      console.warn(`[privacy-screen] 🚫 ${action} blocat pe ${target}`);
      window.dispatchEvent(
        new CustomEvent("ventuza:privacy-blocked", {
          detail: { action, target, at: new Date().toISOString() },
        }),
      );
      void maybeToast(
        action === "contextmenu" ? "meniu contextual" :
        action === "drag" ? "drag imagine" :
        action === "copy" ? "copiere" :
        action === "cut" ? "decupare" :
        action === "select" ? "selectare" :
        action === "capture-key" ? "scurtătură captură" : "ieșire din fereastră",
        target,
      );
    };

    // Context menu pe media (permite input-uri și zone marcate explicit).
    const onCtx = (e: MouseEvent) => {
      if (isAdminSurface()) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      if (t.closest("input, textarea, [contenteditable='true']")) return;
      if (t.closest("[data-allow-context]")) return;
      const hit = t.closest("img, video, picture, canvas, [data-private-media]") as HTMLElement | null;
      if (hit) {
        e.preventDefault();
        emit("contextmenu", hit);
      }
    };
    window.addEventListener("contextmenu", onCtx, { capture: true });

    // Drag pe imagini/video.
    const onDrag = (e: DragEvent) => {
      if (isAdminSurface()) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const hit =
        t.tagName === "IMG" || t.tagName === "VIDEO"
          ? t
          : (t.closest("[data-private-media]") as HTMLElement | null);
      if (hit) {
        e.preventDefault();
        emit("drag", hit);
      }
    };
    window.addEventListener("dragstart", onDrag, { capture: true });

    // Copy / cut pe zone private.
    const onClip = (kind: "copy" | "cut") => (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const hit =
        (t.closest("[data-private-media]") as HTMLElement | null) ??
        (t.closest("img, video") as HTMLElement | null);
      if (hit) {
        e.preventDefault();
        emit(kind, hit);
      }
    };
    window.addEventListener("copy", onClip("copy"), { capture: true });
    window.addEventListener("cut", onClip("cut"), { capture: true });

    // Selectarea pe media / zone private poate alimenta copy indirect.
    const onSelectStart = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const hit = t.closest("img, video, picture, canvas, [data-private-media]") as HTMLElement | null;
      if (hit) {
        e.preventDefault();
        emit("select", hit);
      }
    };
    window.addEventListener("selectstart", onSelectStart, { capture: true });

    // Middle-click / aux click pe media poate deschide resurse în tab separat.
    const onAuxClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const hit = t.closest("img, video, picture, canvas, [data-private-media]") as HTMLElement | null;
      if (hit) {
        e.preventDefault();
        emit("contextmenu", hit);
      }
    };
    window.addEventListener("auxclick", onAuxClick, { capture: true });

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
      html.__privacy_defocused body > *:not(#__privacy_hide_overlay) {
        filter: blur(34px) brightness(0.18) saturate(0) !important;
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
    let panicTimer: number | undefined;
    const applyDefocus = (defocused: boolean) => {
      ensureOverlay();
      const el = document.getElementById(overlayId);
      if (el) el.style.display = defocused ? "block" : "none";
      document.documentElement.classList.toggle("__privacy_defocused", defocused);
    };
    const panicMask = (reason: "capture-key" | "window-leave") => {
      applyDefocus(true);
      emit(reason, document.documentElement);
      window.clearTimeout(panicTimer);
      panicTimer = window.setTimeout(() => {
        if (!printOverride && document.visibilityState === "visible" && document.hasFocus()) {
          applyDefocus(false);
        }
      }, 2200);
    };
    const onVis = () => applyDefocus(document.visibilityState === "hidden");
    const onBlur = () => applyDefocus(true);
    const onFocus = () => applyDefocus(printOverride ? true : false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onBlur);
    window.addEventListener("pageshow", onFocus);
    window.addEventListener("freeze", onBlur);
    window.addEventListener("resume", onFocus);

    // Când cursorul părăsește fereastra, multe unelte de snipping încep selecția
    // din afara browserului. Mascăm rapid până revine focusul/pointerul.
    document.addEventListener("pointerleave", (e) => {
      if (!e.relatedTarget) panicMask("window-leave");
    });
    document.addEventListener("pointerenter", () => {
      if (!printOverride && document.visibilityState === "visible" && document.hasFocus()) {
        applyDefocus(false);
      }
    });

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
      const key = e.key.toLowerCase();
      const looksLikeCapture =
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["s", "p"].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(key));
      if (looksLikeCapture) {
        e.preventDefault();
        panicMask("capture-key");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", (e) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        panicMask("capture-key");
        void navigator.clipboard?.writeText("").catch(() => undefined);
      }
    }, { capture: true });

    console.info("[privacy-screen] fallback web întărit: blur/overlay la blur, print, capture keys, pointer leave, copy/cut/drag/select pe media");
  } catch (err) {
    console.info("[privacy-screen] web init failed", err);
  }

  return lastStatus;
}
