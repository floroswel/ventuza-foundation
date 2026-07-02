import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, Phone, ArrowLeft, Navigation } from "lucide-react";

export const Route = createFileRoute("/venues/$id")({
  component: VenueDetailPage,
  errorComponent: ({ error }) => <div className="p-6">A apărut o eroare: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Localul nu există.</div>,
});

function VenueDetailPage() {
  const { id } = Route.useParams();
  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: offers } = useQuery({
    queryKey: ["venue-offers", id],
    enabled: !!venue,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id,title,description,valid_to")
        .eq("venue_id", id)
        .eq("is_published", true);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (isLoading) return <div className="p-6">Se încarcă…</div>;
  if (!venue) return <div className="p-6">Localul nu există sau nu e publicat.</div>;

  const directionsHref = `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=18/${venue.lat}/${venue.lng}`;

  return (
    <div className="container max-w-3xl py-4 px-3 space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/nearby">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Înapoi
        </Link>
      </Button>
      {venue.cover_url && (
        <div
          className="w-full h-56 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${venue.cover_url})` }}
        />
      )}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">{venue.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{venue.category}</Badge>
              {venue.city && <span className="text-sm text-muted-foreground">{venue.city}</span>}
            </div>
          </div>
        </div>
        {venue.description && <p className="text-sm">{venue.description}</p>}
        {venue.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{venue.address}</span>
          </div>
        )}
        {venue.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4" />
            <a
              href={venue.website}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {venue.website}
            </a>
          </div>
        )}
        {venue.phone_e164 && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4" />
            <a href={`tel:${venue.phone_e164}`} className="text-primary underline">
              {venue.phone_e164}
            </a>
          </div>
        )}
      </div>
      <Button asChild className="w-full" size="lg">
        <a href={directionsHref} target="_blank" rel="noreferrer">
          <Navigation className="h-4 w-4 mr-2" />
          Direcții
        </a>
      </Button>
      {offers && offers.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Oferte active</h2>
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.id}>
                <Link to="/offers/$id" params={{ id: o.id }} className="text-primary underline">
                  {o.title}
                </Link>
                {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
