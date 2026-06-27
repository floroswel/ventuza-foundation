import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Bell, Image as ImgIcon, Shield, ChevronLeft } from "lucide-react";
import { StatusNotificationsBell } from "@/components/partner/StatusNotificationsBell";


export const Route = createFileRoute("/partner/guide")({
  head: () => ({
    meta: [
      { title: "Ghid pentru parteneri — Ventuza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerGuide,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2 text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function GoodBad({ good, bad }: { good: string[]; bad: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300 mb-1">
          <CheckCircle2 className="w-4 h-4" /> Așa DA
        </div>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          {good.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>
      <div className="rounded border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-center gap-1 font-medium text-red-700 dark:text-red-300 mb-1">
          <XCircle className="w-4 h-4" /> Așa NU
        </div>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          {bad.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PartnerGuide() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/partner">
              <ChevronLeft className="w-4 h-4" /> Portal
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Ghid pentru parteneri</h1>
        </div>
        <StatusNotificationsBell />
      </div>


      <p className="text-sm text-muted-foreground">
        Citește o dată acest ghid înainte să postezi. Te scutește de respingeri și
        ajunge mai repede la utilizatori.
      </p>

      <Section icon={CheckCircle2} title="Ce poți posta">
        <p>
          Trei tipuri de conținut: <strong>Local</strong> (spațiu permanent),{" "}
          <strong>Eveniment</strong> (cu dată) și <strong>Ofertă</strong> (promoție
          legată de un local al tău).
        </p>
        <GoodBad
          good={[
            "Bar/club LGBTQ+ deschis regulat, cu adresă fixă.",
            "Drag night cu dată, oră, line-up clar.",
            "Happy hour 19-21 cu condiții explicite.",
            "Marș Pride sau eveniment comunitar real.",
          ]}
          bad={[
            "Pop-up de o seară fără adresă reală.",
            "„Cea mai mare petrecere” fără line-up sau detalii.",
            "Ofertă vagă fără termeni de revendicare.",
            "Repostarea aceluiași eveniment de mai multe ori.",
          ]}
        />
      </Section>

      <Section icon={XCircle} title="Ce e INTERZIS">
        <ul className="list-disc pl-4 space-y-1">
          <li>Servicii escort sau prostituție (legale sau nu).</li>
          <li>Conținut sexual explicit, nuditate explicită în imagini.</li>
          <li>Înșelătorie, scheme piramidale, "garantat câștigi bani".</li>
          <li>Spam: același conținut repetat, titluri în caps, emoji-spam.</li>
          <li>Discriminare, incitare la ură, outing involuntar.</li>
          <li>Imagini fără drepturi (stock plătit, ID-uri ale altora).</li>
          <li>Reclame la alcool/tutun direcționate explicit la minori.</li>
        </ul>
        <p className="text-xs">
          Detalii în{" "}
          <Link to="/legal/terms" className="underline">
            Termenii și condițiile
          </Link>
          .
        </p>
      </Section>

      <Section icon={ImgIcon} title="Imagini">
        <ul className="list-disc pl-4 space-y-1">
          <li>Format: JPG, PNG, WebP. Max 5 MB.</li>
          <li>Recomandat 1200×800 (peisaj). Verticalele sunt cropate.</li>
          <li>Arată locul/evenimentul, nu logo pe toată imaginea.</li>
          <li>Drepturi: doar imagini făcute de tine sau cu licență.</li>
        </ul>
      </Section>

      <Section icon={Shield} title="De ce moderăm">
        <p>
          Fiecare postare este verificată de echipa noastră înainte să devină
          publică. Nu există auto-publicare. Asta protejează utilizatorii de spam,
          conținut ilegal sau înșelător.
        </p>
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3 h-3" /> SLA: 1–2 zile lucrătoare.
        </div>
      </Section>

      <Section icon={Bell} title="Cum funcționează notificările de proximitate">
        <p>
          Când postarea ta este aprobată, utilizatorii aflați în raza pe care ai
          setat-o (max 10 km) pot primi o notificare scurtă: „📍 [Nume] • 450m”.
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong>Cooldown 24h per punct</strong> — un user e notificat o singură
            dată per loc/eveniment pe zi.
          </li>
          <li>
            <strong>Plafon zilnic per user</strong> — limităm câte notificări de
            proximitate primește un user pe zi, indiferent de partener.
          </li>
          <li>
            <strong>Ore liniștite</strong> — fără notificări noaptea, default
            22:00–08:00 (configurat per user).
          </li>
          <li>
            <strong>NU controlezi aceste limite</strong>. Toate notificările tale
            trec prin aceeași politică anti-spam. Userii nu sunt bombardați.
          </li>
        </ul>
      </Section>

      <Section icon={XCircle} title="Dacă postarea ta este respinsă">
        <ol className="list-decimal pl-4 space-y-1">
          <li>Vezi motivul exact în portal, la postarea respectivă.</li>
          <li>Editează și corectează — la salvare retrimitem automat la moderare.</li>
          <li>Pentru ajutor: scrie la support@ventuza.app.</li>
        </ol>
      </Section>

      <Section icon={Clock} title="Limite cont (quota)">
        <p>
          Fiecare cont partener are o limită de locuri, evenimente și oferte
          active, în funcție de plan. O vezi sus în portal („Limite cont”).
          Pentru limite mai mari →{" "}
          <Link to="/partner/billing" className="underline">
            Facturare & abonament
          </Link>
          .
        </p>
        <Badge variant="secondary">Anti-spam: max drafts/oră</Badge>
      </Section>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/partner">Înapoi în portal</Link>
        </Button>
      </div>
    </div>
  );
}
