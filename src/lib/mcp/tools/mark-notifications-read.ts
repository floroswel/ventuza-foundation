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
  name: "mark_notifications_read",
  title: "Marchează notificări citite",
  description:
    "Marchează notificările utilizatorului ca fiind citite. Dacă `ids` este furnizat, doar acele notificări; altfel toate cele necitite.",
  inputSchema: {
    ids: z
      .array(z.string().uuid())
      .max(200)
      .optional()
      .describe("Listă de UUID-uri de notificări. Omite pentru a marca toate necitite."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ ids }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    let q = sb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);
    if (ids && ids.length) q = q.in("id", ids);
    const { data, error } = await q.select("id");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Marcate ${data?.length ?? 0} notificări ca citite.` }],
      structuredContent: { updated: data?.length ?? 0 },
    };
  },
});
