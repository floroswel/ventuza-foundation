import { createFileRoute } from "@tanstack/react-router";
import { downloadFirebaseAndroidConfig } from "@/lib/firebase-android-config.server";

export const Route = createFileRoute("/api/public/firebase-android-config")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = await downloadFirebaseAndroidConfig();
          return new Response(config, {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=300",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          console.error("[firebase-android-config] download failed", {
            message: error instanceof Error ? error.message : "unknown error",
          });
          return Response.json({ error: "Firebase Android config unavailable" }, { status: 503 });
        }
      },
    },
  },
});