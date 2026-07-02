import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

type LegalDoc = {
  slug: string;
  title: string;
  content_md: string;
  version: number;
  published_at: string | null;
  updated_at: string;
};

/**
 * Renders the DB-published version of a legal document when available.
 * Falls back to `fallback` (the built-in static JSX) when the doc is
 * unpublished or empty. Subscribes to realtime updates so admin edits go
 * live without a refresh.
 */
export function LegalDocOverride({
  slug,
  fallback,
}: {
  slug: string;
  fallback: ReactNode;
}) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("legal_documents")
        .select("slug,title,content_md,version,published_at,updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (!alive) return;
      setDoc(data as LegalDoc | null);
      setLoaded(true);
    })();

    const channel = supabase
      .channel(`legal-doc-${slug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "legal_documents", filter: `slug=eq.${slug}` },
        (payload) => {
          const next = (payload.new ?? null) as LegalDoc | null;
          setDoc(next);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [slug]);

  if (!loaded) return <>{fallback}</>;

  const hasPublished = doc && doc.published_at && doc.content_md.trim().length > 0;
  if (!hasPublished) return <>{fallback}</>;

  return (
    <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
      <p className="text-xs text-muted-foreground">
        Ultima actualizare: {new Date(doc!.updated_at).toLocaleString("ro-RO")} · v{doc!.version}
      </p>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc!.content_md}</ReactMarkdown>
    </article>
  );
}
