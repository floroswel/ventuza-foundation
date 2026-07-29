/**
 * PartnerAccessGate — gate reutilizabil pentru sub-paginile /partner/*
 * (billing, dashboard, etc). Afișează un empty-state clar când userul
 * nu poate accesa pagina, ca să înțeleagă DE CE și CE să facă.
 *
 * Scenarii tratate:
 *  - unauthenticated → CTA login
 *  - fără rol business + fără cerere → CTA aplică
 *  - cerere pending/reviewing/needs_info → status + link /partner
 *  - cerere rejected → mesaj + contact
 *  - suspended → mesaj + contact
 *
 * Copiii sunt afișați DOAR dacă `allowed=true`. Altfel se randează
 * empty-state-ul în locul lor.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert, Clock, XCircle, ArrowLeft, Mail, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/hooks/useUserRole";

type AppRow = {
  id: string;
  status: string | null;
  legal_name: string | null;
  suspended_at?: string | null;
} | null;

export function PartnerAccessGate({
  pageLabel,
  children,
}: {
  /** Ex: "Facturarea partener" / "Campanii publicitare". Apare în titlul empty-state-ului. */
  pageLabel: string;
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const [app, setApp] = useState<AppRow>(null);
  const [checking, setChecking] = useState(true);
  const [suspendedAt, setSuspendedAt] = useState<string | null>(null);

  const isPartner = roles.includes("business") || roles.includes("admin");

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [{ data: appRow }, { data: profRow }] = await Promise.all([
          supabase
            .from("business_applications")
            .select("id, status, legal_name")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("partner_suspended_at")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
        if (!alive) return;
        setApp((appRow as AppRow) ?? null);
        setSuspendedAt((profRow as any)?.partner_suspended_at ?? null);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, authLoading, rolesLoading]);

  if (authLoading || rolesLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 1. Not logged in
  if (!user) {
    return (
      <GateShell
        title={pageLabel}
        icon={<ShieldAlert className="size-6 text-primary" />}
        headline="Conectează-te ca să continui"
        body="Această pagină e disponibilă doar conturilor autentificate. După login te aducem înapoi aici."
        actions={
          <Button asChild>
            <Link to="/auth" search={{ mode: "login" }}>
              Conectează-te
            </Link>
          </Button>
        }
      />
    );
  }

  // 2. Suspended partner
  if (isPartner && suspendedAt) {
    return (
      <GateShell
        title={pageLabel}
        icon={<XCircle className="size-6 text-red-500" />}
        headline="Contul partener este suspendat"
        body="Nu poți accesa detaliile de partener cât timp contul e suspendat. Conținutul tău nu apare în Nearby și nu poți crea sau edita resurse. Contactează echipa de moderare pentru clarificări."
        actions={
          <>
            <Button asChild>
              <a href="mailto:business@suzeta.eu?subject=Cont%20partener%20suspendat">
                <Mail className="size-4 mr-1" /> Contactează moderarea
              </a>
            </Button>
            <BackHome />
          </>
        }
      />
    );
  }

  // 3. Approved partner → allow
  if (isPartner) {
    return <>{children}</>;
  }

  // 4. Has application but not yet approved
  if (app) {
    const map: Record<
      string,
      { icon: ReactNode; headline: string; body: string }
    > = {
      pending: {
        icon: <Clock className="size-6 text-yellow-500" />,
        headline: "Cererea ta e în așteptare",
        body: "Echipa Suzeta analizează cererea în maximum 3 zile lucrătoare. Sub-paginile de partener (facturare, campanii, statistici) se deblochează automat după aprobare.",
      },
      reviewing: {
        icon: <Clock className="size-6 text-blue-500" />,
        headline: "Cererea ta e în analiză",
        body: "Un membru al echipei verifică documentele. Te anunțăm pe email imediat ce e gata; până atunci pagina asta nu e disponibilă.",
      },
      needs_info: {
        icon: <Clock className="size-6 text-orange-500" />,
        headline: "Cererea ta așteaptă clarificări",
        body: "Avem nevoie de informații suplimentare înainte să-ți deschidem această pagină. Deschide pagina Portal Partener ca să răspunzi mai repede.",
      },
      rejected: {
        icon: <XCircle className="size-6 text-red-500" />,
        headline: "Cererea a fost respinsă",
        body: "Momentan contul de partener nu e activ, așa că nu putem încărca această pagină. Pentru clarificări scrie-ne la business@suzeta.eu.",
      },
    };
    const s = map[app.status ?? "pending"] ?? map.pending;
    return (
      <GateShell
        title={pageLabel}
        icon={s.icon}
        headline={s.headline}
        body={s.body}
        meta={app.legal_name ? `Firma: ${app.legal_name}` : undefined}
        actions={
          <>
            <Button asChild>
              <Link to="/partner">Vezi statusul cererii</Link>
            </Button>
            {app.status === "rejected" && (
              <Button variant="outline" asChild>
                <a href="mailto:business@suzeta.eu">
                  <Mail className="size-4 mr-1" /> Contactează echipa
                </a>
              </Button>
            )}
            <BackHome />
          </>
        }
      />
    );
  }

  // 5. No application at all
  return (
    <GateShell
      title={pageLabel}
      icon={<ShieldAlert className="size-6 text-primary" />}
      headline="Ai nevoie de un cont partener aprobat"
      body="Această pagină arată detalii disponibile doar partenerilor Suzeta. Aplică pentru un cont business — durează câteva minute și primești răspuns în maximum 3 zile lucrătoare."
      actions={
        <>
          <Button asChild>
            <Link to="/business">Aplică pentru cont partener</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/partner/guide">
              <BookOpen className="size-4 mr-1" /> Vezi ghidul partenerului
            </Link>
          </Button>
          <BackHome />
        </>
      }
    />
  );
}

function GateShell({
  title,
  icon,
  headline,
  body,
  meta,
  actions,
}: {
  title: string;
  icon: ReactNode;
  headline: string;
  body: string;
  meta?: string;
  actions: ReactNode;
}) {
  return (
    <div className="container max-w-xl py-10 space-y-4">
      <h1 className="text-lg font-medium text-muted-foreground">{title}</h1>
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            {icon}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{headline}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            {meta && <p className="text-xs text-muted-foreground/80">{meta}</p>}
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-1">{actions}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function BackHome() {
  return (
    <Button variant="ghost" asChild>
      <Link to="/">
        <ArrowLeft className="size-4 mr-1" /> Acasă
      </Link>
    </Button>
  );
}
