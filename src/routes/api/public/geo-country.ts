/**
 * Country detection served by our own edge, from the request headers the CDN
 * already attaches. Replaces the third-party ipapi.co lookup, which rate-limits
 * (HTTP 429) under real traffic and silently disabled the country safety gates.
 *
 * Returns ONLY a 2-letter country code. No IP is stored, logged or returned.
 */
import { createFileRoute } from "@tanstack/react-router";

function pick(request: Request): string | null {
  const headers = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-nf-client-connection-country",
    "x-geo-country",
    "x-country-code",
  ];
  for (const h of headers) {
    const v = (request.headers.get(h) ?? "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") return v;
  }
  return null;
}

export const Route = createFileRoute("/api/public/geo-country")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const country = pick(request);
        return new Response(JSON.stringify({ country }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
