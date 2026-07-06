import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "unread_counts",
  title: "Necitite",
  description: "Numărul de mesaje și notificări necitite pentru utilizatorul autentificat.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [notifRes, msgRes] = await Promise.all([
      sb.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("read_at", null),
      sb.from("messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", userId).is("read_at", null),
    ]);

    if (notifRes.error) {
      return { content: [{ type: "text", text: notifRes.error.message }], isError: true };
    }

    const notifications = notifRes.count ?? 0;
    const messages = msgRes.error ? null : (msgRes.count ?? 0);
    const payload = { unread_notifications: notifications, unread_messages: messages };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
