/**
 * Integrare: toast-urile din `notifications-context` NU expun niciodată
 * conținut de mesaj sau indicii de media.
 *
 * Suprafață testată:
 *   1. Regresie sursă: `notifications-context.tsx` trebuie să folosească
 *      `buildToastBody(...)` și NICIODATĂ `n.body` direct.
 *   2. Comportament: helper-ul `buildToastBody` — invocat cu exact
 *      argumentele pe care le trimite handler-ul realtime (showPreview din
 *      `useNotificationPrefs`, `n.body` din DB) — nu scurge niciun payload
 *      periculos.
 *
 * De ce nu montăm React: mediul vitest este `node`; @testing-library/react
 * nu e disponibil. În schimb, reproducem exact linia de dispatch din
 * `notifications-context` (call-site-ul spre `toast`) și o testăm ca unitate
 * de integrare. Dacă cineva mută logica înapoi la `n.body` direct, testul
 * de regresie sursă cade imediat.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildToastBody,
  GENERIC_MESSAGE_BODY,
  PREVIEW_DISABLED_BODY,
} from "@/lib/notification-privacy";

const SRC = readFileSync(
  join(process.cwd(), "src/lib/notifications-context.tsx"),
  "utf8",
);

// Payload-uri periculoase pe care un trigger DB compromis / un actor rău
// intenționat le-ar putea împinge în coloana `notifications.body`.
const HOSTILE_BODIES: Array<string | null> = [
  "Vino la Str. Exemplu 12, ora 20",
  "📷 Photo",
  "photo attachment: https://cdn.x/y.jpg",
  "🎤 Voice message (0:42)",
  "voice.ogg",
  "video.mp4 sent",
  "IBAN RO49AAAA1B31007593840000",
  "Sună-mă +40 712 345 678",
  "email: test@example.com",
  "Sunt HIV+",
  "location: 44.4268,26.1025",
  "Ana: hey, ce faci diseară?",
  "[caption] nudes",
  null,
];

// Cuvinte/pattern-uri care NU trebuie să apară niciodată în description-ul
// toast-ului, indiferent de payload-ul din DB sau de preferință.
const FORBIDDEN = [
  /photo/i,
  /voice/i,
  /video/i,
  /\.(jpg|jpeg|png|gif|webp|mp4|mov|ogg|m4a|wav)\b/i,
  /https?:\/\//i,
  /\+?\d[\d\s().-]{6,}/, // telefon
  /RO\d{2}[A-Z0-9]{4,}/i, // IBAN
  /HIV/i,
  /caption/i,
  /nudes/i,
  /\d+\.\d+\s*,\s*\d+\.\d+/, // coords
  /Str\.?\s/i,
  /Ana:/i,
  /diseară/i,
  /attachment/i,
  /📷/,
  /🎤/,
  /🎥/,
];

const ALLOWED = new Set<string>([
  GENERIC_MESSAGE_BODY,
  PREVIEW_DISABLED_BODY,
]);

describe("notifications-context toast — regresie sursă", () => {
  it("realtime INSERT handler folosește buildToastBody, nu n.body brut", () => {
    // Trebuie să existe importul și call-site-ul curent.
    expect(SRC).toMatch(/from ["']@\/lib\/notification-privacy["']/);
    expect(SRC).toMatch(/buildToastBody\s*\(/);
    // NU are voie să existe vreun toast(title, { description: n.body ... })
    // fără să treacă prin helper. Căutăm literal `description: n.body`.
    expect(SRC).not.toMatch(/description:\s*n\.body/);
  });

  it("citește preferința curentă printr-un ref (fără stale closure)", () => {
    expect(SRC).toMatch(/showPreviewRef/);
    expect(SRC).toMatch(/useNotificationPrefs/);
  });
});

describe("notifications-context toast — comportament buildToastBody", () => {
  const cases: Array<{ label: string; showPreview: boolean | null | undefined }> = [
    { label: "show_preview = undefined (implicit)", showPreview: undefined },
    { label: "show_preview = true", showPreview: true },
    { label: "show_preview = false", showPreview: false },
    { label: "show_preview = null", showPreview: null },
  ];

  for (const { label, showPreview } of cases) {
    describe(label, () => {
      for (const body of HOSTILE_BODIES) {
        it(`nu scurge conținut pentru body=${JSON.stringify(body)}`, () => {
          const description = buildToastBody(showPreview, body);
          // 1. Description-ul e mereu una din valorile albe.
          expect(ALLOWED.has(description)).toBe(true);
          // 2. Nicio pattern periculoasă.
          for (const pattern of FORBIDDEN) {
            expect(description).not.toMatch(pattern);
          }
          // 3. Cazul show_preview=false → copy explicit.
          if (showPreview === false) {
            expect(description).toBe(PREVIEW_DISABLED_BODY);
          } else {
            expect(description).toBe(GENERIC_MESSAGE_BODY);
          }
        });
      }
    });
  }

  it("body gol / whitespace cade tot pe generic, nu pe stringul gol", () => {
    expect(buildToastBody(true, "")).toBe(GENERIC_MESSAGE_BODY);
    expect(buildToastBody(true, "   ")).toBe(GENERIC_MESSAGE_BODY);
    expect(buildToastBody(undefined, null)).toBe(GENERIC_MESSAGE_BODY);
  });
});
