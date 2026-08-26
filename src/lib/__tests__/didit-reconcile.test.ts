import { describe, expect, it } from "vitest";
import {
  pickDiditReconcileUserIds,
  DIDIT_REconcile_MAX_USERS,
  DIDIT_REconcile_MIN_AGE_MS,
  DIDIT_REconcile_MAX_AGE_MS,
} from "@/lib/didit-reconcile";

const NOW = Date.parse("2026-08-26T22:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("pickDiditReconcileUserIds", () => {
  it("selectează sesiunile nerezolvate mai vechi de 1 oră", () => {
    const ids = pickDiditReconcileUserIds(
      [
        { user_id: "u1", session_id: "s1", resolved_at: null, created_at: iso(2 * 60 * 60 * 1000) },
      ],
      NOW,
    );
    expect(ids).toEqual(["u1"]);
  });

  it("ignoră sesiunile rezolvate și cele prea proaspete (< 1 oră)", () => {
    const ids = pickDiditReconcileUserIds(
      [
        { user_id: "u1", session_id: "s1", resolved_at: iso(0), created_at: iso(3 * 60 * 60 * 1000) },
        { user_id: "u2", session_id: "s2", resolved_at: null, created_at: iso(10 * 60 * 1000) },
        { user_id: "u3", session_id: "s3", resolved_at: null, created_at: iso(DIDIT_REconcile_MIN_AGE_MS + 1) },
      ],
      NOW,
    );
    expect(ids).toEqual(["u3"]);
  });

  it("ignoră sesiunile mai vechi de 7 zile (expirate la provider)", () => {
    const ids = pickDiditReconcileUserIds(
      [
        { user_id: "u1", session_id: "s1", resolved_at: null, created_at: iso(DIDIT_REconcile_MAX_AGE_MS + 1) },
      ],
      NOW,
    );
    expect(ids).toEqual([]);
  });

  it("deduplică userii și prioritizează cea mai veche sesiune", () => {
    const ids = pickDiditReconcileUserIds(
      [
        { user_id: "u1", session_id: "s1", resolved_at: null, created_at: iso(2 * 60 * 60 * 1000) },
        { user_id: "u1", session_id: "s2", resolved_at: null, created_at: iso(5 * 60 * 60 * 1000) },
        { user_id: "u2", session_id: "s3", resolved_at: null, created_at: iso(3 * 60 * 60 * 1000) },
      ],
      NOW,
    );
    // u1 are sesiune de 5h (cea mai veche) → înaintea lui u2 (3h)
    expect(ids).toEqual(["u1", "u2"]);
  });

  it("respectă plafonul de useri per rulare", () => {
    const sessions = Array.from({ length: DIDIT_REconcile_MAX_USERS + 20 }, (_, i) => ({
      user_id: `u${i}`,
      session_id: `s${i}`,
      resolved_at: null,
      created_at: iso((2 + i) * 60 * 60 * 1000),
    }));
    const ids = pickDiditReconcileUserIds(sessions, NOW);
    expect(ids.length).toBe(DIDIT_REconcile_MAX_USERS);
    // cei mai vechi primii
    expect(ids[0]).toBe(`u${DIDIT_REconcile_MAX_USERS + 19}`);
  });

  it("tolerează created_at invalid", () => {
    const ids = pickDiditReconcileUserIds(
      [{ user_id: "u1", session_id: "s1", resolved_at: null, created_at: "not-a-date" }],
      NOW,
    );
    expect(ids).toEqual([]);
  });
});
