import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import unreadCounts from "./tools/unread-counts";
import recentNotifications from "./tools/recent-notifications";

// Direct Supabase issuer (not the .lovable.cloud proxy) — RFC 8414 requires
// the OAuth issuer to match the discovery document. VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ventuza-mcp",
  title: "Ventuza",
  version: "0.1.0",
  instructions:
    "Instrumente Ventuza pentru utilizatorul autentificat: profil propriu, contor mesaje/notificări necitite, listă notificări recente. Toate acțiunile rulează sub RLS ca utilizatorul curent și nu returnează date despre alți useri.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, unreadCounts, recentNotifications],
});
