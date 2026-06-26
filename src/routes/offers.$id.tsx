import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { claimOffer } from "@/lib/nearby.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Tag, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/offers/$id")({
  component: OfferDetailPage,
  errorComponent: ({ error }) => <div className="p-6">A apărut o eroare: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Oferta nu există.</div>,
});

function OfferDetailPage() {
  const { id } = Route.useParams();
  const [code, setCode] = useState<string | null>(null);

  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, venues!inner(id,name,address,city,is_published,lat,lng)")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const claimFn = useServerFn(claimOffer);
  const mutation = useMutation({
    mutationFn: () => claimFn({ data: { offerId: id } }),
    onSuccess: (res) => {
      setCode(res.redemption_code);
      toast.success("Ofertă revendicată!");
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes("already_claimed")) toast.error("Ai revendicat deja această ofertă.");
      else if (msg.includes("expired")) toast.error("Oferta a expirat.");
      else if (msg.includes("auth_required")) toast.error("Trebuie să fii autentificat.");
      else toast.error(`Nu s-a putut revendica: ${msg}`);
    },
  });

  if (isLoading) return <div className="p-6">Se încarcă…</div>;
  if (!offer) return <div className="p-6">Oferta nu mai este disponibilă.</div>;

  const venue = offer.venues as { id: string; name: string; address: string | null; city: string | null } | null;
  const validTo = offer.valid_to ? new Date(offer.valid_to) : null;

  return (
    <div className="container max-w-2xl py-4 px-3 space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/nearby"><ArrowLeft className="h-4 w-4 mr-1" />Înapoi</Link>
      </Button>
      <Card className="p-5 space-y-3">
        <Badge variant="secondary"><Tag className="h-3 w-3 mr-1" />Ofertă</Badge>
        <h1 className="text-2xl font-bold">{offer.title}</h1>
        {venue && (
          <Link to="/venues/$id" params={{ id: venue.id }} className="text-sm text-primary underline">
            {venue.name}{venue.city ? ` · ${venue.city}` : ""}
          </Link>
        )}
        {offer.description && <p className="text-sm">{offer.description}</p>}
        {offer.terms && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <strong>Termeni:</strong> {offer.terms}
          </div>
        )}
        {validTo && (
          <div className="text-xs text-muted-foreground">
            Valabilă până la {validTo.toLocaleDateString("ro-RO")}
          </div>
        )}
        {code ? (
          <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">Cod de revendicare</div>
            <div className="text-2xl font-mono font-bold tracking-wider">{code}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Arată acest cod la {venue?.name ?? "local"}.
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Se revendică…" : (<><Check className="h-4 w-4 mr-2" />Revendică</>)}
          </Button>
        )}
      </Card>
      <p className="text-[10px] text-muted-foreground text-center px-4">
        Revendicarea înregistrează doar contul tău și un cod unic. Partenerul vede doar numărul total
        de revendicări, nu identitatea ta.
      </p>
    </div>
  );
}
