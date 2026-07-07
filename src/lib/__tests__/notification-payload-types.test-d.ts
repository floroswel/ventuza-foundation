/**
 * Compile-time test: `defineNotificationPayload` / `defineNotificationData`
 * refuză câmpurile care ar putea scurge conținut de mesaj.
 *
 * Toate directivele `@ts-expect-error` de mai jos TREBUIE să corespundă unei
 * erori TypeScript reale. Dacă cineva slăbește tipurile (elimină cheia din
 * `ForbiddenNotificationField`, schimbă `never` pe altceva, sau permite
 * index-signature laxă pe payload), `@ts-expect-error` devine „unused" și
 * `tsgo` iese cu eroare — deci regresia e prinsă la compilare.
 *
 * La runtime nu asertăm nimic: tipurile sunt tot ce vrem să testăm.
 */

import { describe, it, expect } from "vitest";
import {
  defineNotificationData,
  defineNotificationPayload,
  type SafeNotificationData,
  type SafeNotificationPayload,
} from "@/lib/notification-privacy";

describe("[compile-time] notification payload types refuză câmpurile interzise", () => {
  it("payload valid este acceptat", () => {
    const ok = defineNotificationPayload({
      title: "Andrei",
      body: "Ai un mesaj nou",
      url: "/messages/abc",
      category: "messages",
      type: "new_message",
      data: { conversation_id: "abc" },
    });
    expect(ok.title).toBe("Andrei");
    expect(ok.data?.conversation_id).toBe("abc");
  });

  it("payload cu media_url la nivel top → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      // @ts-expect-error media_url este interzis pe payload-uri
      media_url: "https://cdn.x/y.jpg",
    });
  });

  it("payload cu media_type la nivel top → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      // @ts-expect-error media_type este interzis pe payload-uri
      media_type: "photo",
    });
  });

  it("payload cu caption la nivel top → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      // @ts-expect-error caption este interzis pe payload-uri
      caption: "nudes",
    });
  });

  it("data.media_url → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      data: {
        conversation_id: "abc",
        // @ts-expect-error media_url este interzis în data
        media_url: "https://cdn.x/y.jpg",
      },
    });
  });

  it("data.media_type → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      data: {
        // @ts-expect-error media_type este interzis în data
        media_type: "photo",
      },
    });
  });

  it("data.caption → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      data: {
        // @ts-expect-error caption este interzis în data
        caption: "conținut secret",
      },
    });
  });

  it("data.voice_url → EROARE TS", () => {
    defineNotificationPayload({
      title: "x",
      data: {
        // @ts-expect-error voice_url este interzis în data
        voice_url: "https://cdn.x/v.ogg",
      },
    });
  });

  it("defineNotificationData respinge caption / media_url / media_type / voice_url", () => {
    defineNotificationData({
      // @ts-expect-error caption interzis
      caption: "x",
    });
    defineNotificationData({
      // @ts-expect-error media_url interzis
      media_url: "x",
    });
    defineNotificationData({
      // @ts-expect-error media_type interzis
      media_type: "x",
    });
    defineNotificationData({
      // @ts-expect-error voice_url interzis
      voice_url: "x",
    });
  });

  it("aliasurile de preview (body_preview, last_message_preview, message_body, text) sunt blocate", () => {
    defineNotificationPayload({
      // @ts-expect-error body_preview interzis
      body_preview: "leaked",
    });
    defineNotificationPayload({
      // @ts-expect-error last_message_preview interzis
      last_message_preview: "leaked",
    });
    defineNotificationPayload({
      // @ts-expect-error message_body interzis
      message_body: "leaked",
    });
    defineNotificationPayload({
      // @ts-expect-error text (câmp raw) interzis
      text: "leaked",
    });
    defineNotificationData({
      // @ts-expect-error body_preview interzis și în data
      body_preview: "leaked",
    });
  });

  it("tipurile pot fi folosite ca annotation pentru variabile/params externi", () => {
    const p: SafeNotificationPayload = {
      title: "x",
      body: "Ai un mesaj nou",
      data: { conversation_id: "abc" },
    };
    const d: SafeNotificationData = { conversation_id: "abc" };
    expect(p.title).toBe("x");
    expect(d.conversation_id).toBe("abc");

    // @ts-expect-error nu poți asigna un obiect cu media_url la SafeNotificationPayload
    const bad: SafeNotificationPayload = { title: "x", media_url: "leak" };
    expect(bad).toBeDefined();

    // @ts-expect-error nu poți asigna un obiect cu caption la SafeNotificationData
    const badData: SafeNotificationData = { caption: "leak" };
    expect(badData).toBeDefined();
  });
});
