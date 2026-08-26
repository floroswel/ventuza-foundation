import { createFileRoute } from "@tanstack/react-router";
import { getBearerSupabaseContext } from "@/lib/bearer-supabase.server";
import { getDiditStatusForUser } from "@/lib/didit-status.server";

export const Route = createFileRoute("/api/public/didit-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const bearer = await getBearerSupabaseContext(request);
        if (!bearer.ok) return bearer.response;
        try {
          const data = await getDiditStatusForUser(bearer.context.supabase, bearer.context.user.id);
          return Response.json(data, { headers: { "Cache-Control": "no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Nu am putut citi statusul verificării.";
          console.error("[didit-status] failed", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
