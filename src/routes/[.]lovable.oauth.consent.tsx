import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Typed shim over the Supabase Auth OAuth beta API. Keeps our route code
// off `any` while `supabase.auth.oauth` is still marked beta in the JS SDK.
type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};
function oauthApi(): OAuthApi {
  const anyAuth = supabase.auth as unknown as { oauth: OAuthApi };
  return anyAuth.oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/auth", search: { mode: "login", redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-white">
      <h1 className="text-xl font-semibold mb-2">Nu am putut încărca cererea de autorizare</h1>
      <p className="text-white/70">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("Serverul de autorizare nu a returnat un redirect."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "această aplicație";

  return (
    <main className="mx-auto max-w-md p-6 text-white space-y-4">
      <h1 className="text-2xl font-semibold">Conectează {clientName} la contul tău Ventuza</h1>
      <p className="text-white/80">
        {clientName} va putea folosi aplicația Ventuza ca tine, prin instrumentele
        MCP publicate (profil propriu, contor mesaje/notificări necitite, notificări
        recente). Nu se expun date despre alți utilizatori.
      </p>
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="rounded-md bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-60"
        >
          Aprobă
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-md border border-white/20 px-4 py-2 disabled:opacity-60"
        >
          Refuză
        </button>
      </div>
    </main>
  );
}
