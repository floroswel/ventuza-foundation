import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint pentru Google OAuth Web Client ID.
 *
 * De ce public: Client ID-ul OAuth este public prin design (apare în URL-ul de
 * authorize și în orice APK). Secretul OAuth NU trece niciodată pe aici.
 *
 * De ce e nevoie de el ca rută HTTP (și nu doar server fn): în build-ul nativ
 * Android, aplicația rulează de pe `capacitor://localhost`, deci apelurile de
 * server fn relative nu ajung nicăieri. Wrapper-ul nativ cheamă acest endpoint
 * pe origin-ul de producție ca fallback dacă `VITE_GOOGLE_WEB_CLIENT_ID` nu a
 * fost injectat la build.
 */
export const Route = createFileRoute("/api/public/google-client-id")({
  server: {
    handlers: {
      GET: async () => {
        const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim() || null;
        return Response.json(
          { clientId },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        }),
    },
  },
});
