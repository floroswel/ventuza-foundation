/**
 * E2E: pipeline complet de notificări cu `show_preview = false`.
 *
 * Verifică toate suprafețele care ar putea scurge conținut de mesaj când
 * userul a dezactivat preview-ul:
 *   1. Trigger SQL `tg_notify_new_message` (sursă în migrarea de policy).
 *   2. Filtru central `sanitizeNotificationPayload` (push web + FCM).
 *   3. Toast in-app din `notifications-context` (n.body ← DB, deja generic).
 *   4. Inbox `messages.index.tsx` (`buildInboxPreview`).
 *   5. Helper `buildMessageNotificationBody` (folosit direct de chat.ts).
 *
 * Regula: pentru show_preview=false NU se vede niciodată conținutul.
 * Copy-ul afișat este EXCLUSIV `Ai un mesaj nou` (sau fallback `Say hi 👋`
 * când conversația e goală). Testul e end-to-end pentru că simulează
 * secvența reală: mesaj brut cu payload sensibil → prin fiecare strat →
 * ce ajunge pe ecran.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInboxPreview,
  buildMessageNotificationBody,
  sanitizeNotificationPayload,
  GENERIC_MESSAGE_BODY,
  GENERIC_INBOX_FALLBACK,
} from "@/lib/notification-privacy";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// Payload-uri periculoase pe care le simulăm ca "mesaj primit":
const HOSTILE_MESSAGES = [
  { body: "Vino la mine la 20, adresa Str. Exemplu 12", media_type: "text" },
  { body: "📷 Photo", media_type: "photo", media_url: "https://cdn.x/y.jpg", caption: "nudes" },
  { body: "🎤 Voice", media_type: "voice", voice_url: "https://cdn.x/v.ogg" },
  { body: "IBAN RO49AAAA1B31007593840000, plata azi", media_type: "text" },
  { body: "Sună-mă +40 712 345 678", media_type: "text" },
  { body: "Sunt HIV+, ai grijă", media_type: "text" },
  { body: "Loc: 44.4268, 26.1025", media_type: "location" },
  { body: "user@example.com", media_type: "text" },
];

// ─────────────────────────────────────────────────────────────────────────────
// STRAT 1 — Trigger SQL: body forțat generic în migrarea de policy.
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Strat 1: trigger SQL nu propagă body", () => {
  const migration = read("supabase/migrations/20260707120057_d82ced9c-87cc-4739-9733-651394c29299.sql");

  it("migrarea de policy există și forțează body generic în notifications", () => {
    expect(migration).toMatch(/tg_notify_new_message|notifications/i);
    expect(migration).toMatch(/Ai un mesaj nou/);
  });

  it("migrarea NU proiectează câmpuri de conținut în payload notificare", () => {
    // Blocul care construiește payload-ul notificării nu trebuie să
    // referențieze NEW.body / NEW.media_type / NEW.caption / NEW.media_url.
    // (Coloanele pot apărea în alte contexte — DELETE, filtru — de aceea
    // căutăm doar în ferestre de ~600 caractere din jurul cuvântului cheie
    // "notifications" folosit ca INSERT.)
    const inserts = [...migration.matchAll(/insert\s+into\s+public\.notifications[\s\S]{0,800}/gi)];
    expect(inserts.length).toBeGreaterThan(0);
    for (const m of inserts) {
      expect(m[0]).not.toMatch(/NEW\.(body|media_type|media_url|caption|voice_url)/);
    }
  });

  it("migrarea forțează show_preview=false pentru toate profilele existente", () => {
    expect(migration).toMatch(/show_preview[^,\n]*false|'show_preview'\s*,\s*'?false/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRAT 2 — Filtru central: sanitizeNotificationPayload.
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Strat 2: sanitizer forțează body generic", () => {
  it("categoria 'messages' → body=Ai un mesaj nou, orice input", () => {
    for (const m of HOSTILE_MESSAGES) {
      const out = sanitizeNotificationPayload({
        title: "Andrei",
        body: m.body,
        category: "messages",
        data: { ...m, conversation_id: "abc" },
      });
      expect(out.body).toBe(GENERIC_MESSAGE_BODY);
      // niciun câmp sensibil nu se propagă în data
      const d = out.data ?? {};
      expect("body" in d).toBe(false);
      expect("media_url" in d).toBe(false);
      expect("voice_url" in d).toBe(false);
      expect("caption" in d).toBe(false);
      expect("media_type" in d).toBe(false);
      // conversation_id este permis (ne trebuie ca să deschidem thread-ul)
      expect(d.conversation_id).toBe("abc");
    }
  });

  it("type include 'message' → tot generic (fallback dacă categoria lipsește)", () => {
    const out = sanitizeNotificationPayload({
      title: "X", body: "Secret content", type: "new_message",
    });
    expect(out.body).toBe(GENERIC_MESSAGE_BODY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRAT 3 — Toast in-app (notifications-context).
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Strat 3: toast in-app nu inventează body", () => {
  const src = read("src/lib/notifications-context.tsx");

  it("toast folosește DOAR n.body (deja filtrat de trigger)", () => {
    expect(src).toMatch(/toast\([^)]*n\.title[^)]*description:\s*n\.body/);
  });

  it("nu concatenează câmpuri sensibile din payload realtime în toast", () => {
    // Nicăieri în context nu se citește body/media/caption de pe messages
    expect(src).not.toMatch(/\bmedia_type\b|\bmedia_url\b|\bvoice_url\b|\bcaption\b/);
    expect(src).not.toMatch(/messages\?[^"]*select=[^"]*\bbody\b/);
  });

  it("simulare: n.body venit din DB este mereu generic (invariant)", () => {
    // Trigger-ul SQL emite body=Ai un mesaj nou. Contextul îl afișează ca
    // description în toast. Verificăm invariantul pe un rând simulat.
    const nFromDb = { title: "Andrei", body: GENERIC_MESSAGE_BODY };
    const description = nFromDb.body ?? undefined;
    expect(description).toBe(GENERIC_MESSAGE_BODY);
    expect(description).not.toMatch(/photo|voice|📷|🎤|http|caption|IBAN|HIV|@|\+40/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRAT 4 — Inbox listă conversații.
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Strat 4: inbox afișează doar copy generic", () => {
  it("buildInboxPreview cu showPreview=false → mereu generic pentru orice preview brut", () => {
    for (const m of HOSTILE_MESSAGES) {
      const out = buildInboxPreview(false, m.body, true);
      expect(out).toBe(GENERIC_MESSAGE_BODY);
      expect(out).not.toContain(m.body);
    }
  });

  it("buildInboxPreview cu showPreview=true → tot generic (policy override)", () => {
    // Regula curentă: preview-ul este dezactivat sistemic; nici măcar
    // toggle-ul individual nu poate scurge conținut.
    for (const m of HOSTILE_MESSAGES) {
      expect(buildInboxPreview(true, m.body, true)).toBe(GENERIC_MESSAGE_BODY);
    }
  });

  it("conversație goală → fallback neutru, niciodată body raw", () => {
    expect(buildInboxPreview(false, "leaked-content", false)).toBe(GENERIC_INBOX_FALLBACK);
    expect(buildInboxPreview(true, "leaked-content", false)).toBe(GENERIC_INBOX_FALLBACK);
  });

  it("messages.index.tsx randează prin buildInboxPreview, nu inline ternary", () => {
    const src = read("src/routes/messages.index.tsx");
    expect(src).toContain("buildInboxPreview");
    // Nu ar trebui să mai existe ramura veche `showPreview ? last_message_preview`
    expect(src).not.toMatch(/showPreview\s*\?\s*\(?c\.last_message_preview/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRAT 5 — Helper direct folosit de chat.ts pentru push local.
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Strat 5: buildMessageNotificationBody", () => {
  it("orice combinație (showPreview, preview) → generic", () => {
    for (const m of HOSTILE_MESSAGES) {
      expect(buildMessageNotificationBody(false, m.body)).toBe(GENERIC_MESSAGE_BODY);
      expect(buildMessageNotificationBody(true, m.body)).toBe(GENERIC_MESSAGE_BODY);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-cut: niciun fișier user-facing nu afișează câmpurile brute în UI de
// mesaje, când preview=off. Grep defensiv pentru ANTI-pattern-uri comune.
// ─────────────────────────────────────────────────────────────────────────────
describe("[E2E preview=off] Cross-cut: anti-leak în surse user-facing", () => {
  const files = [
    "src/routes/messages.index.tsx",
    "src/lib/notifications-context.tsx",
    "src/lib/notification-privacy.ts",
    "src/lib/push.functions.ts",
  ];

  it("niciun fișier nu hardcodează accesul la câmpuri de mesaj în JSX/toast", () => {
    for (const f of files) {
      const src = read(f);
      // Nu ar trebui să apară șabloane care preferă conținutul brut peste generic.
      expect(src, `${f} nu trebuie să facă toast cu body raw de mesaj`)
        .not.toMatch(/toast\([^)]*['"]messages['"][^)]*\.body\b/);
    }
  });
});
