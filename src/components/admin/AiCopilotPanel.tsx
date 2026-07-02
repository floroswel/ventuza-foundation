import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminAiCopilot } from "@/lib/admin-ai.functions";
import { Sparkles, Send, Loader2 } from "lucide-react";

const QUICK = [
  "Cum unban-uiesc un user fără să pierd istoricul?",
  "Pași pentru un raport CSAM nou primit.",
  "Cum aprob o cerere B2B și ce verific întâi?",
  "Cum opresc notificările de proximitate pentru un partener spam?",
  "Cum procesez o cerere GDPR de ștergere?",
];

type Turn = { q: string; a?: string; err?: string };

export function AiCopilotPanel() {
  const ask = useServerFn(adminAiCopilot);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [...t, { q: text }]);
    try {
      const { answer } = await ask({ data: { question: text } });
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: answer } : x)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, err: msg } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.82_0.115_85)] to-[oklch(0.62_0.14_50)] shadow-[0_0_18px_oklch(0.82_0.115_85/0.4)]">
          <Sparkles className="size-4 text-[oklch(0.16_0.012_70)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Copilot operațional</h2>
          <p className="text-xs text-muted-foreground">
            Asistent pentru staff — fără acces la date personale. Doar îndrumare procedurală.
          </p>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Întrebări frecvente
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-primary/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 px-3 py-2 text-sm">
                {t.q}
              </div>
            </div>
            <div className="flex">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface px-3 py-2 text-sm">
                {t.err ? (
                  <span className="text-red-300">⚠ {t.err}</span>
                ) : t.a ? (
                  <span className="whitespace-pre-wrap">{t.a}</span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> gândesc…
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="sticky bottom-3 flex items-center gap-2 rounded-2xl border border-border bg-surface/80 p-2 backdrop-blur"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Întreabă copilot-ul…"
          className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          Trimite
        </button>
      </form>
    </div>
  );
}
