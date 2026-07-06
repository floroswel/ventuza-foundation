import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const TAP_EMOJIS = ["👋", "🔥", "😈", "👀", "💋", "🍆"] as const;

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "send_tap",
  title: "Trimite tap",
  description:
    "Trimite un tap (emoji reaction) către un alt utilizator Ventuza. Respectă blocările și preferințele destinatarului la nivel de DB.",
  inputSchema: {
    receiver_id: z.string().uuid().describe("UUID-ul userului destinatar."),
    emoji: z.enum(TAP_EMOJIS).describe("Emoji tap: 👋 🔥 😈 👀 💋 🍆"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ receiver_id, emoji }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    if (receiver_id === uid) {
      return { content: [{ type: "text", text: "Nu îți poți trimite tap ție însuți." }], isError: true };
    }
    const { error } = await sb
      .from("taps")
      .insert({ sender_id: uid, receiver_id, emoji });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Tap ${emoji} trimis.` }],
      structuredContent: { ok: true, emoji, receiver_id },
    };
  },
});
