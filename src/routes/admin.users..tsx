
/* ================= BREAK-GLASS PANEL ================= */
type BgKind = "orientation" | "location" | "messages";

function BreakGlassPanel({ userId }: { userId: string }) {
  const reveal = useServerFn(adminBreakGlassReveal);
  const [revealed, setRevealed] = useState<Partial<Record<BgKind, any>>>({});
  const [busy, setBusy] = useState<BgKind | null>(null);

  const onReveal = async (kind: BgKind) => {
    const j = window.prompt(
      `Justificare break-glass [${kind}] (min. 10 caractere).\n` +
        `Acțiunea e logată în admin_sensitive_access_log + admin_audit_log (critical).`,
    );
    if (!j || j.trim().length < 10) {
      toast.error("Justificare min. 10 caractere.");
      return;
    }
    setBusy(kind);
    try {
      const r = await reveal({
        data: { targetUserId: userId, kind, justification: j.trim() },
      });
      setRevealed((s) => ({ ...s, [kind]: r.payload }));
      toast.warning(`Acces ${kind} înregistrat în jurnalul sensibil.`);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const hide = (kind: BgKind) =>
    setRevealed((s) => {
      const c = { ...s };
      delete c[kind];
      return c;
    });

  const labels: Record<BgKind, { title: string; role: string; note: string }> = {
    orientation: {
      title: "Orientare / identitate (Art. 9)",
      role: "super_admin",
      note: "orientation, gender, gender_custom, pronouns, tribes",
    },
    location: {
      title: "Locație precisă",
      role: "super_admin",
      note: "location, travel_location, prev_location (coordonate exacte)",
    },
    messages: {
      title: "Conținut mesaje brut",
      role: "admin+",
      note: "body / media_url / voice_url / caption din messages",
    },
  };

  return (
    <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <div>
          <div className="text-sm font-semibold">Dezvăluire date sensibile (break-glass)</div>
          <div className="text-xs text-muted-foreground">
            Fiecare apel cere justificare ≥ 10 caractere și e logat critical în
            <code className="mx-1">admin_sensitive_access_log</code> + audit. Vizibil pentru
            super_admin și auditor.
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(labels) as BgKind[]).map((k) => (
          <div key={k} className="border rounded-md p-3 bg-background/60">
            <div className="text-sm font-medium">{labels[k].title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Rol necesar: <b>{labels[k].role}</b>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{labels[k].note}</div>
            <Button
              size="sm"
              variant="destructive"
              className="mt-2 w-full"
              disabled={busy === k}
              onClick={() => onReveal(k)}
            >
              {busy === k ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              Dezvăluie
            </Button>
          </div>
        ))}
      </div>

      {Object.entries(revealed).map(([k, v]) => (
        <div key={k} className="rounded-md border border-destructive/40 bg-background p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase text-destructive font-mono">{k}</span>
            <Button size="sm" variant="ghost" onClick={() => hide(k as BgKind)}>
              <EyeOff className="h-3 w-3 mr-1" /> Ascunde
            </Button>
          </div>
          <pre className="mt-1 overflow-x-auto text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(v, null, 2)}
          </pre>
        </div>
      ))}
    </Card>
  );
}

/* ================= PURGE ACCOUNT ================= */
function PurgeAccountDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fn = useServerFn(adminPurgeUserAccount);
  const m = useMutation({
    mutationFn: (j: string) => fn({ data: { userId, justification: j } }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-1" /> Ștergere GDPR
        </Button>
      }
      title="Ștergere completă cont (GDPR Art. 17)"
      description="Ireversibil: RC cancel, storage wipe, cascade DB. Necesită super_admin + MFA."
      confirmLabel="Șterge definitiv"
      destructive
      minLen={10}
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
    />
  );
}
