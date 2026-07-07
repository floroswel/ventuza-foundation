/**
 * UI render test — verifică că suprafețele vizibile de notificări
 * (toast in-app din `notifications-context` + previewul din inbox din
 * `routes/messages.index.tsx`) NU afișează niciodată câmpuri sensibile
 * (text mesaj, media, URL, PII), oricâte payload-uri ostile ar veni din DB.
 *
 * Testul are două straturi:
 *
 *  1. **Comportament** — simulează exact call-site-urile UI:
 *     - Toast: invocă handler-ul realtime prin apel direct la
 *       `toast(n.title, { description: buildToastBody(showPreview, n.body,
 *       n.type) })` cu un stub sonner care capturează descrierea.
 *     - Inbox row: randează exact JSX-ul `<p>{buildInboxPreview(...)}</p>`
 *       din `messages.index.tsx` via `renderToStaticMarkup` și extrage
 *       textul afișat.
 *     Fiecare payload ostil este verificat împotriva unui set de regex
 *     PII/media + o listă albă cu singurele string-uri permise
 *     (`GENERIC_MESSAGE_BODY`, `PREVIEW_DISABLED_BODY`, `GENERIC_INBOX_FALLBACK`).
 *
 *  2. **Regresie sursă** — grep pe fișierele UI: dacă cineva scoate
 *     `buildToastBody` / `buildInboxPreview` și randează `n.body` sau
 *     `c.last_message_preview` direct în JSX, testul cade.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildToastBody,
  buildInboxPreview,
  GENERIC_MESSAGE_BODY,
  GENERIC_INBOX_FALLBACK,
  PREVIEW_DISABLED_BODY,
} from "@/lib/notification-privacy";

// ---------------------------------------------------------------------------
// Payload-uri ostile — orice cuvânt sau format aici trebuie să NU apară în UI.
// ---------------------------------------------------------------------------
const HOSTILE_BODIES: Array<string | null | undefined> = [
  // text simplu
  "Ana: hey ce faci diseară?",
  "Vino la Str. Exemplu 12, ora 20",
  "Sunt HIV+",
  // media
  "📷 Photo",
  "photo attachment https://cdn.example.com/pic.jpg",
  "🎤 Voice message (0:42)",
  "voice.ogg",
  "video.mp4 sent",
  "[caption] nudes",
  // PII
  "Sună-mă la +40 712 345 678",
  "email: leak@example.com",
  "IBAN RO49AAAA1B31007593840000",
  "location: 44.4268,26.1025",
  "https://malicious.example.com/track?id=abc",
  // edge
  "",
  "   ",
  null,
  undefined,
];

// Regex-uri care NU au voie să apară în textul randat.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /photo/i,
  /voice/i,
  /video/i,
  /caption/i,
  /nudes?/i,
  /https?:\/\//i,
  /\.(jpg|jpeg|png|gif|webp|mp4|mov|ogg|m4a|wav)\b/i,
  /\+?\d[\d\s().-]{7,}\d/, // număr de telefon
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email
  /\bIBAN\b/i,
  /RO\d{2}[A-Z0-9]{10,}/,
  /-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/, // lat,lng
  /\bHIV\b/i,
  /Str\.\s/i,
  /Ana:/i,
];

// Singurele string-uri permise ca body vizibil.
const ALLOWED = new Set<string>([
  GENERIC_MESSAGE_BODY,
  GENERIC_INBOX_FALLBACK,
  PREVIEW_DISABLED_BODY,
]);

function expectSafe(rendered: string, sourcePayload: unknown) {
  const trimmed = rendered.trim();
  expect(
    ALLOWED.has(trimmed),
    `Rendered "${trimmed}" must be one of ${[...ALLOWED].join(" | ")} (payload=${JSON.stringify(sourcePayload)})`,
  ).toBe(true);
  for (const pat of FORBIDDEN_PATTERNS) {
    expect(
      pat.test(rendered),
      `Rendered "${rendered}" leaked pattern ${pat} for payload ${JSON.stringify(sourcePayload)}`,
    ).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// 1. TOAST — replică fidelă a call-site-ului din notifications-context.tsx.
// ---------------------------------------------------------------------------
type ToastCall = { title: string; description: string };
function makeToastStub() {
  const calls: ToastCall[] = [];
  const toast = (title: string, opts?: { description?: string }) => {
    calls.push({ title, description: String(opts?.description ?? "") });
  };
  return { toast, calls };
}

/** Reproduce EXACT linia 118-120 din `src/lib/notifications-context.tsx`. */
function fireToastForNotification(
  toast: (t: string, o?: { description?: string }) => void,
  showPreview: boolean | null | undefined,
  n: { id: string; title: string; body: string | null; type: string | null },
) {
  toast(n.title, {
    description: buildToastBody(showPreview, n.body, n.type),
  });
}

describe("UI toast rendering — never shows sensitive fields", () => {
  for (const showPreview of [true, false, null, undefined] as const) {
    it(`shows only generic/disabled body for type=message (show_preview=${showPreview})`, () => {
      const { toast, calls } = makeToastStub();
      HOSTILE_BODIES.forEach((body, i) => {
        fireToastForNotification(toast, showPreview, {
          id: `n-${i}`,
          title: "Cineva",
          body: body ?? null,
          type: "message",
        });
      });
      expect(calls).toHaveLength(HOSTILE_BODIES.length);
      for (const c of calls) {
        expectSafe(c.description, c);
        // Titlul e furnizat de trigger-ul DB, dar în test folosim un nume
        // fix ca să demonstrăm că descrierea (singurul câmp derivat din
        // `body`) e mereu sigură.
        expect(c.title).toBe("Cineva");
      }
    });
  }

  it("shows only generic/disabled body when type is missing", () => {
    const { toast, calls } = makeToastStub();
    HOSTILE_BODIES.forEach((body, i) => {
      fireToastForNotification(toast, true, {
        id: `nt-${i}`,
        title: "X",
        body: body ?? null,
        type: null,
      });
    });
    for (const c of calls) expectSafe(c.description, c);
  });
});

// ---------------------------------------------------------------------------
// 2. INBOX ROW — randăm exact JSX-ul din `messages.index.tsx`, linia 161.
// ---------------------------------------------------------------------------
function InboxRow(props: {
  showPreview: boolean | null | undefined;
  lastMessagePreview: string | null | undefined;
  hasLastMessage: boolean;
}) {
  return (
    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
      {buildInboxPreview(
        props.showPreview,
        props.lastMessagePreview,
        props.hasLastMessage,
      )}
    </p>
  );
}

function renderInboxPreview(
  showPreview: boolean | null | undefined,
  body: string | null | undefined,
  has: boolean,
): string {
  const html = renderToStaticMarkup(
    <InboxRow
      showPreview={showPreview}
      lastMessagePreview={body}
      hasLastMessage={has}
    />,
  );
  // Extrage textul din <p>...</p> (fără tag-uri).
  return html.replace(/<[^>]+>/g, "");
}

describe("UI inbox preview rendering — never shows sensitive fields", () => {
  for (const showPreview of [true, false, null, undefined] as const) {
    it(`renders only allowed strings (show_preview=${showPreview}, hasMessage=true)`, () => {
      for (const body of HOSTILE_BODIES) {
        const rendered = renderInboxPreview(showPreview, body, true);
        expectSafe(rendered, body);
      }
    });
  }

  it("renders the empty-inbox invitation when there is no message", () => {
    for (const body of HOSTILE_BODIES) {
      // hasMessage=false → chiar dacă cineva injectează un preview în DB,
      // UI-ul afișează fallback-ul.
      const rendered = renderInboxPreview(true, body, false);
      expect(rendered.trim()).toBe(GENERIC_INBOX_FALLBACK);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. REGRESIE SURSĂ — dacă call-site-urile scapă direct câmpul din DB, cade.
// ---------------------------------------------------------------------------
describe("source regression — UI call-sites go through the safe builders", () => {
  it("notifications-context.tsx passes n.body through buildToastBody", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/notifications-context.tsx"),
      "utf8",
    );
    expect(src).toMatch(/buildToastBody\(/);
    // Nu trebuie să apară `description: n.body` sau `description: n\.body`
    // (payload direct din DB fără sanitizare).
    expect(src).not.toMatch(/description:\s*n\.body\b/);
  });

  it("messages.index.tsx renders inbox preview only via buildInboxPreview", () => {
    const src = readFileSync(
      join(process.cwd(), "src/routes/messages.index.tsx"),
      "utf8",
    );
    expect(src).toMatch(/buildInboxPreview\(/);
    // Nu randează `{c.last_message_preview}` direct în JSX.
    expect(src).not.toMatch(/\{\s*c\.last_message_preview\s*\}/);
  });
});
