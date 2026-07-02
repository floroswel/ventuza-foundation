import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Upload, EyeOff, History, FileText, ExternalLink, CheckCircle2 } from "lucide-react";
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

type VersionRow = {
  id: string;
  slug: string;
  title: string;
  content_md: string;
  version: number;
  published_at: string | null;
  edited_by: string | null;
  action: string;
  created_at: string;
};

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const denied = /forbidden|denied|permission|role|policy/i.test(error);
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <div className="font-semibold text-destructive">{denied ? "Acces refuzat" : "Eroare"}</div>
      <div className="mt-1 text-destructive/90">{error}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
          Reîncearcă
        </button>
      )}
    </div>
  );
}

export function LegalDocsAdminPanel() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<VersionRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("admin_list_legal_documents");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as LegalDoc[];
    setDocs(rows);
    if (!activeSlug && rows.length > 0) {
      setActiveSlug(rows[0].slug);
      setDraftTitle(rows[0].title);
      setDraftBody(rows[0].content_md);
    }
    setLoading(false);
  }, [activeSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => docs.find((d) => d.slug === activeSlug) ?? null, [docs, activeSlug]);

  const selectDoc = (slug: string) => {
    const d = docs.find((x) => x.slug === slug);
    if (!d) return;
    setActiveSlug(slug);
    setDraftTitle(d.title);
    setDraftBody(d.content_md);
    setPreview(false);
    setHistoryOpen(false);
  };

  const saveDraft = async () => {
    if (!activeSlug) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_upsert_legal_document", {
      _slug: activeSlug,
      _title: draftTitle,
      _content_md: draftBody,
    });
    setSaving(false);
    if (error) {
      toast.error("Nu am putut salva: " + error.message);
      return;
    }
    toast.success("Draft salvat");
    const next = data as unknown as LegalDoc;
    setDocs((prev) => prev.map((d) => (d.slug === next.slug ? next : d)));
  };

  const publish = async () => {
    if (!activeSlug) return;
    // Auto-save draft first, so publish always reflects textarea.
    setPublishing(true);
    const { error: saveErr } = await supabase.rpc("admin_upsert_legal_document", {
      _slug: activeSlug,
      _title: draftTitle,
      _content_md: draftBody,
    });
    if (saveErr) {
      setPublishing(false);
      toast.error("Salvare eșuată înainte de publicare: " + saveErr.message);
      return;
    }
    const { data, error } = await supabase.rpc("admin_publish_legal_document", { _slug: activeSlug });
    setPublishing(false);
    if (error) {
      toast.error("Publicare eșuată: " + error.message);
      return;
    }
    toast.success("Publicat live pentru toți userii");
    const next = data as unknown as LegalDoc;
    setDocs((prev) => prev.map((d) => (d.slug === next.slug ? next : d)));
  };

  const unpublish = async () => {
    if (!activeSlug) return;
    if (!confirm("Depublici documentul? Userii vor vedea din nou versiunea statică built-in.")) return;
    const { data, error } = await supabase.rpc("admin_unpublish_legal_document", { _slug: activeSlug });
    if (error) {
      toast.error("Depublicare eșuată: " + error.message);
      return;
    }
    toast.success("Depublicat — fallback la versiunea statică");
    const next = data as unknown as LegalDoc;
    setDocs((prev) => prev.map((d) => (d.slug === next.slug ? next : d)));
  };

  const loadHistory = async () => {
    if (!activeSlug) return;
    const { data, error } = await supabase.rpc("admin_legal_document_history", { _slug: activeSlug });
    if (error) {
      toast.error("Nu pot încărca istoricul: " + error.message);
      return;
    }
    setHistory((data ?? []) as VersionRow[]);
    setHistoryOpen(true);
  };

  const restoreVersion = (v: VersionRow) => {
    setDraftTitle(v.title);
    setDraftBody(v.content_md);
    setHistoryOpen(false);
    toast.info(`Am încărcat v${v.version} în editor. Salvează / Publică pentru a activa.`);
  };

  const dirty = active && (draftTitle !== active.title || draftBody !== active.content_md);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Se încarcă documentele legale…
      </div>
    );
  }
  if (error) return <div className="p-4"><ErrorBanner error={error} onRetry={load} /></div>;
  if (docs.length === 0) return <div className="p-6 text-sm text-muted-foreground">Nu există sloturi legale definite.</div>;

  return (
    <div className="grid gap-4 p-4 md:grid-cols-[260px_1fr]">
      <aside className="rounded-lg border border-border bg-card/40 p-2">
        <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
          <FileText className="size-3.5" /> Documente
        </div>
        <ul className="space-y-1">
          {docs.map((d) => {
            const published = !!d.published_at;
            return (
              <li key={d.slug}>
                <button
                  onClick={() => selectDoc(d.slug)}
                  className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    activeSlug === d.slug ? "bg-accent" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">/legal/{d.slug} · v{d.version}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      published ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                    title={published ? "Publicat" : "Draft / static fallback"}
                  >
                    {published ? "LIVE" : "DRAFT"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0 space-y-3">
        {active ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{active.title}</div>
                <div className="text-xs text-muted-foreground">
                  slug <code>{active.slug}</code> · v{active.version} ·{" "}
                  {active.published_at ? (
                    <span className="text-emerald-400">publicat {new Date(active.published_at).toLocaleString("ro-RO")}</span>
                  ) : (
                    <span>nepublicat (userii văd versiunea statică built-in)</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/legal/${active.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  <ExternalLink className="size-3" /> Deschide pagina
                </a>
                <button
                  onClick={() => setPreview((p) => !p)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  {preview ? "Editor" : "Preview"}
                </button>
                <button
                  onClick={loadHistory}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  <History className="size-3" /> Istoric
                </button>
              </div>
            </div>

            {historyOpen && (
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ultimele 100 versiuni</div>
                {history.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nicio versiune înregistrată.</div>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-auto text-xs">
                    {history.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded border border-border/60 p-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            v{v.version} · {v.action}
                            {v.published_at ? " · publicat" : ""}
                          </div>
                          <div className="text-muted-foreground">{new Date(v.created_at).toLocaleString("ro-RO")}</div>
                        </div>
                        <button
                          onClick={() => restoreVersion(v)}
                          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
                        >
                          Încarcă în editor
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border bg-card/40 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Titlu</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Titlul afișat"
              />
              <label className="mb-1 mt-3 block text-xs font-semibold uppercase text-muted-foreground">
                Conținut (Markdown · suport GFM · titluri #, liste, link-uri, tabele)
              </label>
              {preview ? (
                <div className="prose prose-invert min-h-[400px] max-w-none rounded-md border border-border bg-background p-3 text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftBody || "*Preview gol.*"}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="min-h-[400px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  placeholder="# Titlu&#10;&#10;Textul documentului în Markdown…"
                />
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {dirty ? (
                    <span className="text-amber-400">Modificări nesalvate</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="size-3" /> Sincronizat cu ultima versiune salvată
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {active.published_at && (
                    <button
                      onClick={unpublish}
                      className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      <EyeOff className="size-3" /> Depublică
                    </button>
                  )}
                  <button
                    onClick={saveDraft}
                    disabled={saving || !dirty}
                    className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Salvează draft
                  </button>
                  <button
                    onClick={publish}
                    disabled={publishing}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {publishing ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Publică live
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Publicarea se propagă instant prin realtime către toate device-urile. Depublicarea revine la textul static
              built-in din cod. Toate acțiunile sunt logate în <code>admin_audit_log</code> + istoric complet în{" "}
              <code>legal_document_versions</code>.
            </p>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Selectează un document.</div>
        )}
      </section>
    </div>
  );
}
