import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Star } from "lucide-react";
import {
  adminListMacros,
  adminUpsertMacro,
  adminDeleteMacro,
  adminCsatStats,
} from "@/lib/admin-macros.functions";
import { ReasonDialog } from "@/components/admin/ReasonDialog";

type Macro = {
  id: string;
  key: string;
  title: string;
  category: string;
  body: string;
  lang: string;
  active: boolean;
  usage_count: number;
};

export function SupportMacrosPanel() {
  const list = useServerFn(adminListMacros);
  const upsert = useServerFn(adminUpsertMacro);
  const del = useServerFn(adminDeleteMacro);
  const stats = useServerFn(adminCsatStats);
  const [rows, setRows] = useState<Macro[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Macro | null>(null);
  const [creating, setCreating] = useState(false);
  const [csat, setCsat] = useState<{
    count: number;
    avg: number;
    csat_pct: number;
    detractor_pct: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [r, s] = await Promise.all([list(), stats()]);
      setRows(r as any);
      setCsat(s as any);
    } catch (e: any) {
      setErr(e?.message ?? "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const empty: Macro = {
    id: "",
    key: "",
    title: "",
    category: "general",
    body: "",
    lang: "ro",
    active: true,
    usage_count: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Macros & CSAT</h3>
          <p className="text-sm text-muted-foreground">
            Răspunsuri predefinite pentru staff support + scor satisfacție ultimele 30 zile.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(empty);
            setCreating(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Macro nou
        </button>
      </div>

      {csat && (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="CSAT răspunsuri (30z)" value={csat.count.toString()} />
          <Stat label="Scor mediu (1-5)" value={csat.avg.toFixed(2)} />
          <Stat
            label="Satisfacție (%)"
            value={`${csat.csat_pct}%`}
            tone={csat.csat_pct >= 80 ? "good" : csat.csat_pct >= 60 ? "warn" : "bad"}
          />
          <Stat
            label="Detractori (%)"
            value={`${csat.detractor_pct}%`}
            tone={csat.detractor_pct <= 10 ? "good" : csat.detractor_pct <= 25 ? "warn" : "bad"}
          />
        </div>
      )}

      {err && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
          {err}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Se încarcă…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-muted-foreground">
          Niciun macro încă. Adaugă unul.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left">Titlu</th>
                <th className="px-3 py-2 text-left">Cheie</th>
                <th className="px-3 py-2 text-left">Categorie</th>
                <th className="px-3 py-2 text-left">Limbă</th>
                <th className="px-3 py-2 text-right">Folosit</th>
                <th className="px-3 py-2 text-center">Activ</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.key}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 uppercase">{r.lang}</td>
                  <td className="px-3 py-2 text-right">
                    <Star className="mr-1 inline size-3 text-amber-500" />
                    {r.usage_count}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${r.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.active ? "ON" : "OFF"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        setEditing(r);
                        setCreating(false);
                      }}
                      className="mr-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      <Pencil className="inline size-3" />
                    </button>
                    <ReasonDialog
                      title="Ștergere macro"
                      description={`Sigur ștergi macro-ul "${r.title}"?`}
                      onConfirm={async (reason) => {
                        try {
                          await del({ data: { id: r.id } } as any);
                          toast.success("Șters");
                          void load();
                        } catch (e: any) {
                          toast.error(e?.message ?? "Eroare");
                        }
                      }}
                      trigger={
                        <button className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-500 hover:bg-red-500/20">
                          <Trash2 className="inline size-3" />
                        </button>
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MacroEditor
          initial={editing}
          isNew={creating}
          onCancel={() => setEditing(null)}
          onSave={async (m) => {
            try {
              await upsert({
                data: {
                  id: creating ? null : m.id,
                  key: m.key,
                  title: m.title,
                  category: m.category,
                  body: m.body,
                  lang: m.lang,
                  active: m.active,
                },
              } as any);
              toast.success("Salvat");
              setEditing(null);
              void load();
            } catch (e: any) {
              toast.error(e?.message ?? "Eroare la salvare");
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-red-500"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function MacroEditor({
  initial,
  isNew,
  onSave,
  onCancel,
}: {
  initial: Macro;
  isNew: boolean;
  onSave: (m: Macro) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<Macro>(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-xl">
        <div className="mb-3 text-base font-semibold">{isNew ? "Macro nou" : "Editare macro"}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Cheie (a-z, 0-9, _)
            <input
              value={m.key}
              onChange={(e) => setM({ ...m, key: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1.5 font-mono text-xs"
              placeholder="ex: greet_ro"
              disabled={!isNew}
            />
          </label>
          <label className="text-sm">
            Titlu
            <input
              value={m.title}
              onChange={(e) => setM({ ...m, title: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            Categorie
            <input
              value={m.category}
              onChange={(e) => setM({ ...m, category: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
              placeholder="general, billing, moderation…"
            />
          </label>
          <label className="text-sm">
            Limbă
            <select
              value={m.lang}
              onChange={(e) => setM({ ...m, lang: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
            >
              <option value="ro">RO</option>
              <option value="en">EN</option>
              <option value="hu">HU</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm">
          Corp mesaj
          <textarea
            value={m.body}
            onChange={(e) => setM({ ...m, body: e.target.value })}
            rows={8}
            className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={m.active}
            onChange={(e) => setM({ ...m, active: e.target.checked })}
          />
          Activ (vizibil în picker)
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Anulează
          </button>
          <button
            onClick={() => onSave(m)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}
