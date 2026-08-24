// Editor pentru linkul public de profil (/u/<slug>).
// Slug-ul e validat server-side de `public.set_my_profile_link` (rezervări, unicitate).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function PublicLinkCard() {
  const [slug, setSlug] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("profile_slug")
          .eq("id", u.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!alive) return;
        setSlug(data?.profile_slug ?? "");
        setInitial(data?.profile_slug ?? "");
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const url = slug ? `https://suzeta.app/u/${slug}` : "";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("set_my_profile_link", { _slug: slug.trim() });
      if (error) throw error;
      setInitial(slug.trim());
      toast.success("Link public actualizat");
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        /taken|duplicate|unique/i.test(msg)
          ? "Linkul e deja luat. Încearcă altă variantă."
          : /reserved/i.test(msg)
            ? "Acest nume e rezervat."
            : /invalid/i.test(msg)
              ? "Folosește 3–30 caractere: litere mici, cifre, - sau _."
              : msg,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Link2 className="size-4 text-primary" /> Link public de profil
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Se încarcă…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">suzeta.app/u/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="numele-tau"
              maxLength={30}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="hero"
              onClick={save}
              disabled={saving || slug.trim().length < 3 || slug.trim() === initial}
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvează
            </Button>
            {url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast.success("Link copiat");
                }}
              >
                <Copy className="mr-2 size-4" /> Copiază
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Așa te găsesc alții mai ușor. 3–30 caractere: litere mici, cifre, „-" sau „_".
          </p>
        </>
      )}
    </section>
  );
}
