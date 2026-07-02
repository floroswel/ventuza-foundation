/**
 * USER 360 — ecran unic admin cu tot ce ține de un user + acțiuni de editare
 * (Art. 16, push unicast, force logout, password reset, ban/suspend, manual
 * age verify, restore deletion).
 *
 * Reguli AGENTS.md:
 *  - Gate rol verificat și server-side (toate fns); UI ascunde doar butoanele.
 *  - Orice editare cere `justification` >= 10 caractere → audit log.
 *  - MFA enforced server-side pe acțiuni cu efect (vezi admin-mfa-guard).
 *  - Niciun câmp Art. 9 / locație / mesaj brut afișat — vine prin break-glass.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronLeft,
  Mail,
  ShieldAlert,
  KeyRound,
  LogOut,
  Pencil,
  Send,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
  Loader2,
  Crown,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { adminGetUserView } from "@/lib/admin-wave1.functions";
import {
  adminGetUserActivity,
  adminUpdateUserProfile,
  adminChangeUserEmail,
  adminPushUnicast,
  adminGetConsentHistory,
  adminExportConsentHistoryCsv,
} from "@/lib/admin-user360.functions";
import {
  adminForceLogout,
  adminTriggerPasswordReset,
  adminManualAgeVerify,
  adminCancelDeletion,
} from "@/lib/admin-wave1.functions";
import { adminBanUser, adminUnbanUser, adminSuspendUser } from "@/lib/admin-enterprise.functions";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({
    meta: [{ title: "User 360 — Admin Ventuza" }, { name: "robots", content: "noindex" }],
  }),
  component: User360Page,
});

function User360Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const getView = useServerFn(adminGetUserView);
  const getActivity = useServerFn(adminGetUserActivity);

  const viewQ = useQuery({
    queryKey: ["admin-user-view", id],
    queryFn: async () => getView({ data: { userId: id } }),
    retry: false,
  });
  const actQ = useQuery({
    queryKey: ["admin-user-activity", id],
    queryFn: async () => getActivity({ data: { userId: id } }),
    retry: false,
  });

  if (viewQ.isLoading) {
    return (
      <div className="container max-w-6xl py-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Încarc User 360…
      </div>
    );
  }
  if (viewQ.error) {
    const msg = String((viewQ.error as Error)?.message ?? viewQ.error);
    const forbidden = /forbidden|denied|role|permission/i.test(msg);
    return (
      <div className="container max-w-6xl py-8">
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <ShieldAlert className="h-5 w-5" />
            {forbidden ? "Acces refuzat" : "Eroare la încărcare"}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{msg}</p>
          <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Înapoi în Admin
          </Button>
        </Card>
      </div>
    );
  }

  const view = viewQ.data!;
  const profile = view.profile;
  const activity = actQ.data;

  if (!profile) {
    return (
      <div className="container max-w-6xl py-8">
        <Card className="p-6">User inexistent (id: {id})</Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          to="/admin"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="text-xs font-mono text-muted-foreground">{id}</div>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {profile.display_name ?? "(fără nume)"}
              {profile.is_premium && (
                <Crown className="h-5 w-5 text-amber-500" aria-label="Premium" />
              )}
              {profile.verified && (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Vârstă verificată" />
              )}
            </h1>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
              <span>Cont creat: {fmtDate(profile.created_at)}</span>
              <span>Ultima activitate: {fmtDate(profile.last_active_at)}</span>
              {profile.report_count > 0 && (
                <span className="text-amber-600">Rapoarte primite: {profile.report_count}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.banned_at && (
                <Badge variant="destructive">Ban ({fmtDate(profile.banned_at)})</Badge>
              )}
              {profile.suspended_until && new Date(profile.suspended_until) > new Date() && (
                <Badge variant="secondary">Suspendat până {fmtDate(profile.suspended_until)}</Badge>
              )}
              {view.roles.map((r: string) => (
                <Badge key={r} variant="outline">
                  {r}
                </Badge>
              ))}
            </div>
          </div>

          <ActionsBar
            userId={id}
            profile={profile}
            authEmail={activity?.auth?.email ?? null}
            onSuccess={() => {
              viewQ.refetch();
              actQ.refetch();
            }}
          />
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="auth">Auth & device-uri</TabsTrigger>
          <TabsTrigger value="consents">Consimțăminte</TabsTrigger>
          <TabsTrigger value="reports">Rapoarte</TabsTrigger>
          <TabsTrigger value="payments">Plăți / Abonament</TabsTrigger>
          <TabsTrigger value="risk">Risc</TabsTrigger>
          <TabsTrigger value="gdpr">GDPR</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Profil (mascat)</div>
            <KV label="Display name" value={profile.display_name} />
            <KV label="Vârstă publică" value={profile.age != null ? `${profile.age}` : "—"} />
            <KV label="Oraș (călătorie)" value={profile.travel_city ?? "—"} />
            <KV label="Verificat (Didit)" value={profile.verified ? "DA" : "NU"} />
            <KV label="Premium" value={profile.is_premium ? "DA" : "NU"} />
            <KV label="Level / XP" value={`${profile.level ?? 0} / ${profile.xp ?? 0}`} />
            <KV label="Banned reason" value={profile.banned_reason ?? "—"} />
            <p className="mt-3 text-xs text-muted-foreground">
              Câmpurile Art. 9 (orientare, sănătate), locația precisă și conținutul mesajelor sunt
              accesibile EXCLUSIV prin <b>Break-glass</b> (Admin → Compliance).
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Auth</div>
            <KV label="Email" value={activity?.auth?.email ?? "—"} />
            <KV label="Email confirmat" value={fmtDate(activity?.auth?.email_confirmed_at)} />
            <KV label="Cont creat (auth)" value={fmtDate(activity?.auth?.created_at)} />
            <KV label="Ultima autentificare" value={fmtDate(activity?.auth?.last_sign_in_at)} />
            <KV label="Provideri" value={(activity?.auth?.providers ?? []).join(", ") || "—"} />
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Device fingerprints (max 10, mascat)</div>
            <MiniTable
              rows={activity?.devices ?? []}
              cols={[
                { k: "first_seen_at", h: "Prima dată", fmt: fmtDate },
                { k: "last_seen_at", h: "Ultima dată", fmt: fmtDate },
                { k: "ua_family", h: "UA" },
                { k: "fingerprint_prefix", h: "Fingerprint" },
              ]}
            />
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Abonamente push</div>
            <MiniTable
              rows={activity?.push_subscriptions ?? []}
              cols={[
                { k: "kind", h: "Tip" },
                { k: "platform", h: "Platformă" },
                { k: "created_at", h: "Creat", fmt: fmtDate },
                { k: "last_seen_at", h: "Ultima dată", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="consents" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">
              Istoric consimțăminte (50 cele mai recente)
            </div>
            <MiniTable
              rows={view.consents}
              cols={[
                { k: "kind", h: "Kind" },
                { k: "version", h: "Versiune" },
                { k: "accepted", h: "Acceptat", fmt: (v) => (v ? "✓" : "✗") },
                { k: "created_at", h: "Data", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Rapoarte primite</div>
            <MiniTable
              rows={activity?.reports_received ?? view.reports}
              cols={[
                { k: "reason", h: "Motiv" },
                { k: "status", h: "Status" },
                {
                  k: "reporter_id",
                  h: "Reporter",
                  fmt: (v) => (v ? String(v).slice(0, 8) + "…" : "—"),
                },
                { k: "created_at", h: "Data", fmt: fmtDate },
              ]}
            />
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Rapoarte făcute de user</div>
            <MiniTable
              rows={activity?.reports_made ?? []}
              cols={[
                { k: "reason", h: "Motiv" },
                { k: "status", h: "Status" },
                {
                  k: "reported_id",
                  h: "Țintă",
                  fmt: (v) => (v ? String(v).slice(0, 8) + "…" : "—"),
                },
                { k: "created_at", h: "Data", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Abonamente</div>
            <MiniTable
              rows={activity?.subscriptions ?? []}
              cols={[
                { k: "status", h: "Status" },
                { k: "platform", h: "Platformă" },
                { k: "product_id", h: "Produs" },
                { k: "started_at", h: "Start", fmt: fmtDate },
                { k: "expires_at", h: "Expiră", fmt: fmtDate },
                { k: "auto_renew", h: "Auto-renew", fmt: (v) => (v ? "✓" : "✗") },
              ]}
            />
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">
              Facturi parteneri (dacă userul e partener)
            </div>
            <MiniTable
              rows={activity?.invoices_as_partner ?? []}
              cols={[
                {
                  k: "series",
                  h: "Serie",
                  fmt: (_, r: any) => `${r.series}-${String(r.number).padStart(5, "0")}/${r.year}`,
                },
                { k: "status", h: "Status" },
                {
                  k: "total_minor",
                  h: "Total",
                  fmt: (v, r: any) => `${(Number(v) / 100).toFixed(2)} ${r.currency ?? "RON"}`,
                },
                { k: "issued_at", h: "Emisă", fmt: fmtDate },
                { k: "paid_at", h: "Plătită", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Risk flags</div>
            <MiniTable
              rows={activity?.risk_flags ?? []}
              cols={[
                { k: "kind", h: "Kind" },
                { k: "severity", h: "Severitate" },
                { k: "status", h: "Status" },
                { k: "created_at", h: "Detectat", fmt: fmtDate },
                { k: "resolved_at", h: "Rezolvat", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="gdpr" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Cereri de ștergere</div>
            <MiniTable
              rows={activity?.deletion_requests ?? []}
              cols={[
                { k: "status", h: "Status" },
                { k: "created_at", h: "Creată", fmt: fmtDate },
                { k: "scheduled_at", h: "Programată", fmt: fmtDate },
              ]}
            />
            {(activity?.deletion_requests ?? []).some((d: any) => d.status === "scheduled") && (
              <RestoreDeletionButton
                requestId={
                  (activity!.deletion_requests as any[]).find((d) => d.status === "scheduled").id
                }
                onDone={() => {
                  actQ.refetch();
                  viewQ.refetch();
                }}
              />
            )}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">
              Verificări vârstă (Didit + override manual)
            </div>
            <MiniTable
              rows={view.verifications}
              cols={[
                { k: "provider", h: "Sursă" },
                { k: "result", h: "Rezultat" },
                { k: "estimated_age", h: "Vârstă estim." },
                { k: "created_at", h: "Data", fmt: fmtDate },
              ]}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- ACTIONS BAR -------------------- */

function ActionsBar({
  userId,
  profile,
  authEmail,
  onSuccess,
}: {
  userId: string;
  profile: any;
  authEmail: string | null;
  onSuccess: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <EditProfileDialog userId={userId} profile={profile} onDone={onSuccess} />
      <ChangeEmailDialog userId={userId} currentEmail={authEmail} onDone={onSuccess} />
      <PushUnicastDialog userId={userId} onDone={onSuccess} />
      <ForceLogoutDialog userId={userId} onDone={onSuccess} />
      <PasswordResetDialog userId={userId} onDone={onSuccess} />
      <ManualAgeVerifyDialog userId={userId} verified={profile.verified} onDone={onSuccess} />
      {profile.banned_at ? (
        <UnbanDialog userId={userId} onDone={onSuccess} />
      ) : (
        <BanDialog userId={userId} onDone={onSuccess} />
      )}
      <SuspendDialog userId={userId} onDone={onSuccess} />
    </div>
  );
}

/* -------------------- Reusable reason dialog -------------------- */

type ReasonDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  fields?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  minLen?: number;
  onConfirm: (reason: string) => Promise<void>;
};

function ReasonDialog({
  trigger,
  title,
  description,
  fields,
  confirmLabel = "Confirmă",
  destructive = false,
  minLen = 10,
  onConfirm,
}: ReasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reason.trim().length < minLen) {
      toast.error(`Justificarea trebuie să aibă cel puțin ${minLen} caractere.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      toast.success("Acțiune executată.");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {fields}
          <div>
            <Label htmlFor="reason" className="text-sm">
              Justificare (obligatorie, min. {minLen} caractere){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: cerere user pe email, ticket #1234, Art. 16 GDPR rectificare"
              rows={3}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Această justificare e salvată în <code>admin_audit_log</code> (append-only). Vor fi
              vizibile pentru auditor/super_admin.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Anulează
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            variant={destructive ? "destructive" : "default"}
          >
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- specific dialogs -------------------- */

function EditProfileDialog({
  userId,
  profile,
  onDone,
}: {
  userId: string;
  profile: any;
  onDone: () => void;
}) {
  const [name, setName] = useState<string>(profile.display_name ?? "");
  const [bio, setBio] = useState<string>(profile.bio ?? "");
  const [birth, setBirth] = useState<string>(profile.birthdate ?? "");
  const [city, setCity] = useState<string>(profile.travel_city ?? "");
  const fn = useServerFn(adminUpdateUserProfile);
  const m = useMutation({
    mutationFn: (j: string) =>
      fn({
        data: {
          userId,
          changes: {
            ...(name !== (profile.display_name ?? "") ? { display_name: name } : {}),
            ...(bio !== (profile.bio ?? "") ? { bio } : {}),
            ...(birth !== (profile.birthdate ?? "") && birth ? { birthdate: birth } : {}),
            ...(city !== (profile.travel_city ?? "") ? { travel_city: city } : {}),
          },
          justification: j,
        },
      }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1" /> Editează profil
        </Button>
      }
      title="Editează profil (Art. 16 — rectificare)"
      description="Doar câmpuri publice. Vârsta (<18) e refuzată la nivel DB."
      confirmLabel="Salvează"
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
      fields={
        <div className="space-y-2">
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <div>
            <Label>Birthdate (YYYY-MM-DD)</Label>
            <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </div>
          <div>
            <Label>Travel city</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </div>
        </div>
      }
    />
  );
}

function ChangeEmailDialog({
  userId,
  currentEmail,
  onDone,
}: {
  userId: string;
  currentEmail: string | null;
  onDone: () => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const fn = useServerFn(adminChangeUserEmail);
  const m = useMutation({
    mutationFn: (j: string) => fn({ data: { userId, newEmail, justification: j } }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-1" /> Schimbă email
        </Button>
      }
      title="Schimbă emailul (GDPR Art. 16)"
      description={currentEmail ? `Curent: ${currentEmail}` : "User fără email vizibil."}
      confirmLabel="Schimbă email"
      destructive
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
      fields={
        <div>
          <Label>Email nou</Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
        </div>
      }
    />
  );
}

function PushUnicastDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const fn = useServerFn(adminPushUnicast);
  const m = useMutation({
    mutationFn: (j: string) =>
      fn({
        data: {
          userId,
          title,
          body,
          url: url || undefined,
          justification: j,
        },
      }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-1" /> Trimite mesaj
        </Button>
      }
      title="Trimite mesaj direct (in-app + push)"
      description="Respectă opt-out hard (master_push=false). Apare oricum în clopoțel."
      confirmLabel="Trimite"
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
      fields={
        <div className="space-y-2">
          <div>
            <Label>Titlu (max 80)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Mesaj (max 280)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>
          <div>
            <Label>Link (opțional)</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/settings sau https://…"
              maxLength={500}
            />
          </div>
        </div>
      }
    />
  );
}

function ForceLogoutDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fn = useServerFn(adminForceLogout);
  const m = useMutation({ mutationFn: (j: string) => fn({ data: { userId, justification: j } }) });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <LogOut className="h-4 w-4 mr-1" /> Force logout
        </Button>
      }
      title="Revocă toate sesiunile active"
      description="Userul va fi forțat să se reautentifice pe toate device-urile."
      confirmLabel="Revocă sesiuni"
      minLen={5}
      destructive
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
    />
  );
}

function PasswordResetDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fn = useServerFn(adminTriggerPasswordReset);
  const m = useMutation({ mutationFn: (j: string) => fn({ data: { userId, justification: j } }) });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-1" /> Reset parolă
        </Button>
      }
      title="Trimite link de resetare parolă"
      description="Userul primește email cu link de recovery."
      confirmLabel="Trimite link"
      minLen={5}
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
    />
  );
}

function ManualAgeVerifyDialog({
  userId,
  verified,
  onDone,
}: {
  userId: string;
  verified: boolean;
  onDone: () => void;
}) {
  const [makeVerified, setMakeVerified] = useState<boolean>(!verified);
  const fn = useServerFn(adminManualAgeVerify);
  const m = useMutation({
    mutationFn: (j: string) => fn({ data: { userId, verified: makeVerified, justification: j } }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          {verified ? (
            <XCircle className="h-4 w-4 mr-1" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Override vârstă
        </Button>
      }
      title="Override manual verificare vârstă"
      description="Folosește DOAR când Didit eșuează și userul a trimis documente prin alt canal."
      confirmLabel={makeVerified ? "Aprobă" : "Respinge"}
      destructive={!makeVerified}
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
      fields={
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={makeVerified} onChange={() => setMakeVerified(true)} />{" "}
            Aprobă (verified=true)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!makeVerified} onChange={() => setMakeVerified(false)} />{" "}
            Respinge (verified=false)
          </label>
        </div>
      }
    />
  );
}

function BanDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fn = useServerFn(adminBanUser);
  const m = useMutation({ mutationFn: (j: string) => fn({ data: { userId, justification: j } }) });
  return (
    <ReasonDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Ban className="h-4 w-4 mr-1" /> Ban
        </Button>
      }
      title="Banează userul"
      description="Acțiune reversibilă (Unban). Userul nu mai poate intra."
      confirmLabel="Banează"
      destructive
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
    />
  );
}

function UnbanDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fn = useServerFn(adminUnbanUser);
  const m = useMutation({ mutationFn: (j: string) => fn({ data: { userId, justification: j } }) });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-1" /> Unban
        </Button>
      }
      title="Anulează banul"
      confirmLabel="Unban"
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
    />
  );
}

function SuspendDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [hours, setHours] = useState<number>(24);
  const fn = useServerFn(adminSuspendUser);
  const m = useMutation({
    mutationFn: (j: string) => fn({ data: { userId, hours, justification: j } }),
  });
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" size="sm">
          <AlertTriangle className="h-4 w-4 mr-1" /> Suspendă
        </Button>
      }
      title="Suspendă temporar"
      confirmLabel={`Suspendă ${hours}h`}
      destructive
      onConfirm={async (j) => {
        await m.mutateAsync(j);
        onDone();
      }}
      fields={
        <div>
          <Label>Ore</Label>
          <Input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={(e) => setHours(parseInt(e.target.value, 10) || 24)}
          />
        </div>
      }
    />
  );
}

function RestoreDeletionButton({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const fn = useServerFn(adminCancelDeletion);
  const m = useMutation({
    mutationFn: (j: string) => fn({ data: { requestId, justification: j } }),
  });
  return (
    <div className="mt-3">
      <ReasonDialog
        trigger={
          <Button size="sm">
            <RotateCcw className="h-4 w-4 mr-1" /> Restore cont (în fereastra de 30 zile)
          </Button>
        }
        title="Anulează ștergerea programată"
        description="Reverse la flow-ul GDPR Art. 17 înainte de purge."
        confirmLabel="Restore"
        onConfirm={async (j) => {
          await m.mutateAsync(j);
          onDone();
        }}
      />
    </div>
  );
}

/* -------------------- mini display helpers -------------------- */

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function MiniTable({
  rows,
  cols,
}: {
  rows: any[];
  cols: { k: string; h: string; fmt?: (v: any, row: any) => any }[];
}) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">— niciun rând —</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground">
            {cols.map((c) => (
              <th key={c.k} className="px-2 py-1 font-medium">
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t border-border/40">
              {cols.map((c) => (
                <td key={c.k} className="px-2 py-1.5">
                  {c.fmt ? c.fmt(r[c.k], r) : (r[c.k] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(v: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(v);
  }
}
