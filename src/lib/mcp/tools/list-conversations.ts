import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_conversations",
  title: "Conversații recente",
  description:
    "Listă cu conversațiile utilizatorului (id, celălalt participant, ultimul mesaj, timp, câte necitite). Nu returnează conținutul brut al mesajelor — doar metadata.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Câte conversații (1-50). Default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const max = limit ?? 20;

    const { data: convs, error } = await sb
      .from("conversations")
      .select("id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(max);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!convs?.length) {
      return {
        content: [{ type: "text", text: "Nicio conversație." }],
        structuredContent: { conversations: [] },
      };
    }
    const ids = convs.map((c) => c.id);
    const { data: unread } = await sb
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .neq("sender_id", uid)
      .is("read_at", null);
    const unreadBy: Record<string, number> = {};
    for (const m of (unread ?? []) as Array<{ conversation_id: string }>) {
      unreadBy[m.conversation_id] = (unreadBy[m.conversation_id] ?? 0) + 1;
    }
    const result = convs.map((c) => ({
      conversation_id: c.id,
      other_user_id: c.user_a === uid ? c.user_b : c.user_a,
      last_message_at: c.last_message_at,
      unread: unreadBy[c.id] ?? 0,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { conversations: result },
    };
  },
});
