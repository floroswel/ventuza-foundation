import { createFileRoute } from "@tanstack/react-router";
import { getBearerSupabaseContext } from "@/lib/bearer-supabase.server";
import { syncDiditStatusForUser } from "@/lib/didit-status.server";

export const Route = createFileRoute("/api/public/didit-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bearer = await getBearerSupabaseContext(request);
        if (!bearer.ok) return bearer.response;
        try {
          const data = await syncDiditStatusForUser(bearer.context.supabase, bearer.context.user.id);
          return Response.json(data, { headers: { "Cache-Control": "no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Nu am putut sincroniza statusul verificării.";
          console.error("[didit-sync] failed", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
