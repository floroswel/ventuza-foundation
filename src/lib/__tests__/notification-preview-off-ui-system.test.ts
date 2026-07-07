/**
 * E2E UI + SYSTEM: `show_preview = false`
 *
 * Simulează integral pipe-ul de notificări atunci când destinatarul are
 * `notification_prefs.show_preview = false`, pe cele două suprafețe pe care
 * userul le vede efectiv:
 *
 *   A. NOTIFICĂRI DE SISTEM (OS-level push)
 *      Încarcă `public/push-sw.js` într-un scope de service worker mocked,
 *      dispecerizează un event `push` cu payload OSTIL (text mesaj, caption
 *      foto, media_url etc.) și verifică ce ajunge la
 *      `registration.showNotification(title, options)` — adică notificarea
 *      pe care o vede userul în tavă. Payload-ul trece prin
 *      `sanitizeNotificationPayload` exact ca în producție (serverul îl
 *      sanitizează înainte de trimitere), deci notificarea de sistem NU
 *      trebuie să conțină nici text, nici indicii media.
 *
 *   B. UI IN-APP (toast + inbox list)
 *      Reproduce apelurile efective:
 *        - toast: `buildToastBody(showPreview=false, dbBody, type)` —
 *          folosit de `notifications-context.tsx`
 *        - inbox: `buildInboxPreview(showPreview=false, lastPreview, has)` —
 *          folosit de `routes/messages.index.tsx`
 *      Ambele trebuie să afișeze DOAR copy generic („Ai un mesaj nou" sau
 *      „Previzualizare dezactivată"), niciodată text/caption/tip media.
 *
 * Regula de aur: cu `show_preview=false`, indiferent ce vine din DB,
 * indiferent ce vine din push, indiferent ce se face render — userul NU
 * vede niciun cuvânt din mesaj și nicio indicație despre media.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import {
  sanitizeNotificationPayload,
  buildToastBody,
  buildInboxPreview,
  GENERIC_MESSAGE_BODY,
  PREVIEW_DISABLED_BODY,
} from "@/lib/notification-privacy";

// ─────────────────────────────────────────────────────────────────────────────
// Payload-uri „mesaj primit" ostile — text, caption, media, PII.
// Sunt intenționat divers-e (RO/EN, cu emoji-uri, URL-uri, tipuri media)
// astfel încât orice regres să lovească măcar unul.
// ─────────────────────────────────────────────────────────────────────────────
const HOSTILE = [
  { label: "text plain",           body: "Hei, vii la 20?",                media_type: "text" },
  { label: "photo cu caption",     body: "📷 Photo",   caption: "nudes",   media_type: "photo",    media_url: "https://cdn.x/y.jpg" },
  { label: "voice",                body: "🎤 Voice",                        media_type: "voice",    voice_url: "https://cdn.x/v.ogg" },
  { label: "location",             body: "Loc: 44.4268, 26.1025",          media_type: "location" },
  { label: "PII (phone)",          body: "Sună-mă +40 712 345 678",         media_type: "text" },
  { label: "PII (email)",          body: "user@example.com",                media_type: "text" },
  { label: "sensibil (HIV)",       body: "Sunt HIV+, ai grijă",             media_type: "text" },
  { label: "IBAN",                 body: "IBAN RO49AAAA1B31007593840000",   media_type: "text" },
];

// Tokeni care nu trebuie să apară niciodată în notificarea de sistem sau în
// UI atunci când preview e off (text brut, caption, hint media, URL media).
const LEAK_TOKENS = [
  "vii la 20", "nudes", "cdn.x", ".jpg", ".ogg", "44.4268", "26.1025",
  "+40 712", "user@example.com", "HIV", "IBAN", "📷", "🎤", "Photo", "Voice",
];

function assertNoLeak(s: string) {
  for (const t of LEAK_TOKENS) {
    expect(s, `leak token "${t}" found in "${s}"`).not.toContain(t);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A. NOTIFICĂRI DE SISTEM (push service worker)
// ─────────────────────────────────────────────────────────────────────────────
describe("[preview=off · SYSTEM] push-sw.js → OS notification", () => {
  type ShowCall = { title: string; options: Record<string, unknown> };

  function bootSW(): {
    listeners: Record<string, Function>;
    shown: ShowCall[];
  } {
    const shown: ShowCall[] = [];
    const listeners: Record<string, Function> = {};
    const scope: any = {
      addEventListener: (name: string, fn: Function) => {
        listeners[name] = fn;
      },
      skipWaiting: () => {},
      clients: {
        claim: () => Promise.resolve(),
        matchAll: () => Promise.resolve([]),
        openWindow: () => Promise.resolve(),
      },
      registration: {
        showNotification: (title: string, options: Record<string, unknown>) => {
          shown.push({ title, options });
          return Promise.resolve();
        },
      },
    };
    scope.self = scope;
    const src = readFileSync(join(process.cwd(), "public/push-sw.js"), "utf8");
    vm.runInNewContext(src, scope);
    return { listeners, shown };
  }

  function fireSanitizedPush(hostile: (typeof HOSTILE)[number]) {
    const { listeners, shown } = bootSW();

    // Serverul (edge fn / trigger) ar fi apelat înainte de trimitere:
    const sanitized = sanitizeNotificationPayload({
      title: "Andrei",
      body: hostile.body,
      category: "messages",
      type: "new_message",
      data: {
        media_type: hostile.media_type,
        media_url: (hostile as any).media_url,
        voice_url: (hostile as any).voice_url,
        caption: (hostile as any).caption,
        body: hostile.body,
        conversation_id: "conv-1",
        url: "/messages/conv-1",
      },
    });

    const event: any = {
      data: { json: () => ({ ...sanitized, url: sanitized.data?.url ?? "/" }) },
      waitUntil: (p: Promise<unknown>) => p,
    };
    listeners.push!(event);
    return shown;
  }

  for (const h of HOSTILE) {
    it(`OS notif nu conține text/media pentru "${h.label}"`, () => {
      const shown = fireSanitizedPush(h);
      expect(shown).toHaveLength(1);
      const { title, options } = shown[0];
      expect(title).toBe("Andrei"); // nick e OK, e display name public
      // Body-ul afișat de OS = strict generic
      expect(options.body).toBe(GENERIC_MESSAGE_BODY);
      assertNoLeak(String(options.body));
      // Nicio scurgere prin `data` (URL-ul de deep-link e permis, dar
      // trebuie să nu conțină body/media_url/caption/voice_url)
      const data = (options.data ?? {}) as Record<string, unknown>;
      expect("body" in data).toBe(false);
      expect("media_url" in data).toBe(false);
      expect("voice_url" in data).toBe(false);
      expect("caption" in data).toBe(false);
      expect("media_type" in data).toBe(false);
      for (const v of Object.values(data)) {
        if (typeof v === "string") assertNoLeak(v);
      }
    });
  }

  it("chiar dacă payload-ul brut ar ajunge nesanitizat, SW-ul afișează exact ce primește — de aceea sanitizarea se face SERVER-SIDE (invariant documentat)", () => {
    // Acest test protejează contra unei tentații viitoare de a muta
    // sanitizarea în SW. SW-ul e minimal by design; sursa de adevăr rămâne
    // `sanitizeNotificationPayload` apelat înainte de push.
    const sw = readFileSync(join(process.cwd(), "public/push-sw.js"), "utf8");
    expect(sw).not.toMatch(/sanitizeNotificationPayload/);
    expect(sw).not.toMatch(/show_preview/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. UI IN-APP (toast + inbox)
// ─────────────────────────────────────────────────────────────────────────────
describe("[preview=off · UI] toast in-app", () => {
  for (const h of HOSTILE) {
    it(`toast afișează copy generic pentru "${h.label}"`, () => {
      // În producție: n.body vine deja generic de la trigger SQL, dar
      // buildToastBody re-forțează generic pentru type=message ca safety net.
      const description = buildToastBody(false, h.body, "message");
      expect(description).toBe(PREVIEW_DISABLED_BODY);
      assertNoLeak(description);
    });
  }

  it("chiar dacă type-ul lipsește, fallback pe safe-branch (message)", () => {
    const out = buildToastBody(false, "conținut secret", undefined);
    expect(out).toBe(PREVIEW_DISABLED_BODY);
    assertNoLeak(out);
  });
});

describe("[preview=off · UI] inbox list", () => {
  for (const h of HOSTILE) {
    it(`inbox afișează copy generic pentru "${h.label}"`, () => {
      const preview = buildInboxPreview(false, h.body, true);
      expect(preview).toBe(PREVIEW_DISABLED_BODY);
      assertNoLeak(preview);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Cross-check: sursele UI nu au regresat la citire brută
// ─────────────────────────────────────────────────────────────────────────────
describe("[preview=off · source guard] fișierele user-facing", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("notifications-context.tsx nu randează n.body direct în toast", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/notifications-context.tsx"),
      "utf8",
    );
    expect(src).toMatch(/buildToastBody\s*\(/);
    expect(src).not.toMatch(/description:\s*n\.body\b/);
  });

  it("messages.index.tsx nu randează last_message_preview direct", () => {
    const src = readFileSync(
      join(process.cwd(), "src/routes/messages.index.tsx"),
      "utf8",
    );
    expect(src).toMatch(/buildInboxPreview\s*\(/);
    expect(src).not.toMatch(/\{c\.last_message_preview\}/);
  });
});
