import { describe, expect, it } from "vitest";
import { normalizeConversationList } from "@/lib/chat";

describe("normalizeConversationList", () => {
  it("elimină rândurile corupte din cache fără să arunce", () => {
    expect(
      normalizeConversationList([
        null,
        "invalid",
        { id: "" },
        { id: "conversation-1", other_id: "user-2", unread_count: "vechi" },
      ]),
    ).toEqual([
      {
        id: "conversation-1",
        other_id: "user-2",
        other_name: null,
        other_photo: null,
        last_message_preview: null,
        last_message_at: "",
        unread: false,
        unread_count: 0,
        other_online: false,
      },
    ]);
  });

  it("întoarce listă goală pentru un payload care nu este array", () => {
    expect(normalizeConversationList({ stale: true })).toEqual([]);
  });
});