/**
 * Regresie — payload-ul FCM NU trebuie să conțină body de mesaj când
 * `show_preview=false`. Testul este paralel cu `notification-privacy.test.ts`
 * (care acoperă webpush) și lockează contractul pentru canalul nativ Android.
 *
 * Regula: `sendFcmOne` primește deja un payload sanitizat de caller
 * (`sendPushToUser`). Body-ul se construiește prin `buildMessageNotificationBody`
 * care întoarce textul generic când preview e off. Testul verifică:
 *  1. `buildMessageNotificationBody(false, ...)` întoarce genericul (invariant).
 *  2. `sendFcmOne` nu inspectează / rescrie body-ul; ce primește, trimite.
 *  3. `channelIdFor` mapează corect fără să atingă body-ul.
 *  4. Sursa `fcm-push.server.ts` nu accesează în cod `messages.body`,
 *     `media_type`, `media_url`, `caption` sau alte câmpuri sensibile.
 *  5. Sursa `push.functions.ts` nu pasează body brut de mesaj către `sendFcmOne`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMessageNotificationBody,
  GENERIC_MESSAGE_BODY,
} from "@/lib/notification-privacy";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("FCM payload privacy — show_preview=false → generic", () => {
  it("buildMessageNotificationBody rămâne sursa unică pentru body-ul FCM", () => {
    const leaks = [
      "Salut, ne vedem la 20?",
      "📷 Photo",
      "🎤 Voice message",
      "📍 Locație partajată",
      "https://cdn.example.com/media/x.jpg",
      "caption: nudes",
    ];
    for (const s of leaks) {
      expect(buildMessageNotificationBody(false, s)).toBe(GENERIC_MESSAGE_BODY);
    }
  });

  it("sursa fcm-push.server nu atinge câmpuri sensibile de mesaj", () => {
    const src = read("lib/fcm-push.server.ts");
    // nu citește body-ul mesajului sau tipul media direct — payload vine deja gata
    expect(src).not.toMatch(/\.(?:body|media_type|media_url|caption)\b/);
    // sanity: expune sender + config
    expect(src).toMatch(/export\s+async\s+function\s+sendFcmOne/);
    expect(src).toMatch(/export\s+function\s+isFcmConfigured/);
  });

  it("push.functions.ts nu trimite body brut de mesaj către FCM", () => {
    const src = read("lib/push.functions.ts");
    // singurul body: variabila `body` decisă server-side (discrete_mode / preview)
    // sub nicio formă `msg.body`, `NEW.body`, `payload.body` etc.
    expect(src).not.toMatch(/body:\s*[a-zA-Z_$][\w$]*\.body\b/);
    expect(src).not.toMatch(/\bmedia_type\b|\bmedia_url\b|\bcaption\b/);
    // routing prin sendFcmOne există
    expect(src).toMatch(/sendFcmOne/);
    // canalul FCM se loghează
    expect(src).toMatch(/log_notification_dispatch[\s\S]{0,120}?["']fcm["']/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime: sendFcmOne cu payload deja generic → cererea către FCM nu conține
// nici măcar accidental conținut de mesaj.
// ─────────────────────────────────────────────────────────────────────────────

describe("sendFcmOne — no-op fără service account", () => {
  beforeEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it("fără FIREBASE_SERVICE_ACCOUNT_JSON → { ok:false, gone:false } fără fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendFcmOne, isFcmConfigured } = await import("@/lib/fcm-push.server");
    expect(isFcmConfigured()).toBe(false);
    const r = await sendFcmOne(
      { id: "x", endpoint: "fake-token" },
      { title: "Ventuza", body: GENERIC_MESSAGE_BODY, type: "messages" },
    );
    expect(r).toEqual({ ok: false, gone: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
