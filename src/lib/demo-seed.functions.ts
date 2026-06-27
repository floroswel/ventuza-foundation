/**
 * Demo seed — POPULATE / WIPE conținut demo prin fluxul REAL.
 *
 * Tot ce generăm aici e marcat `is_seed=true` și apare în app exact ca datele
 * reale (RLS, moderare bypass-uită ca staff, entitlements, RPC-uri).
 * Ștergerea se face cu un singur buton (`deleteDemoContent`).
 *
 * Gate: super_admin. Niciun anon. Niciun authenticated obișnuit.
 *
 * AGENTS.md:
 *  - MODERARE OBLIGATORIE → marcăm direct `approved` + `is_published` ca staff
 *    server-side (service_role bypass-uiește triggerele owner-no-self-publish
 *    pentru că `auth.uid() IS NULL`).
 *  - LOCAȚIE — venues/events au locație publică (sunt locuri fizice), OK pe hartă.
 *  - PORTAL PARTENER — quota nu se aplică la seed (intră ca staff), dar
 *    contează ca date reale după aceea.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEED_EMAIL_DOMAIN = "seed.ventuza.local";
const SEED_PASSWORD = "DemoSeed!2026-do-not-use";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin role required");
}

/* ---------------------------- DATA TABLES --------------------------- */

type City = { name: string; lat: number; lng: number };
const CITIES: Record<string, City> = {
  bucuresti:  { name: "București",   lat: 44.4378, lng: 26.0974 },
  cluj:       { name: "Cluj-Napoca", lat: 46.7712, lng: 23.6236 },
  timisoara:  { name: "Timișoara",   lat: 45.7489, lng: 21.2087 },
  iasi:       { name: "Iași",        lat: 47.1585, lng: 27.6014 },
  constanta:  { name: "Constanța",   lat: 44.1598, lng: 28.6348 },
};

type PartnerSpec = { key: string; brand: string; city: keyof typeof CITIES; plan: "basic" | "pro" | "premium" };
const PARTNERS: PartnerSpec[] = [
  { key: "p1",  brand: "Q Collective București",   city: "bucuresti", plan: "premium" },
  { key: "p2",  brand: "Misto Hospitality",        city: "bucuresti", plan: "pro" },
  { key: "p3",  brand: "Velvet Group",             city: "bucuresti", plan: "basic" },
  { key: "p4",  brand: "Bookhaus Queer SRL",       city: "bucuresti", plan: "basic" },
  { key: "p5",  brand: "Form Space Cluj",          city: "cluj",      plan: "pro" },
  { key: "p6",  brand: "Aici Cafe Cluj",           city: "cluj",      plan: "basic" },
  { key: "p7",  brand: "The Note Bar Timișoara",   city: "timisoara", plan: "premium" },
  { key: "p8",  brand: "Garage Club Timișoara",    city: "timisoara", plan: "pro" },
  { key: "p9",  brand: "Underground Iași",         city: "iasi",      plan: "basic" },
  { key: "p10", brand: "Bibilou Cafe Iași",        city: "iasi",      plan: "basic" },
  { key: "p11", brand: "Marina Pride Constanța",   city: "constanta", plan: "pro" },
];

type VenueSpec = {
  partner: string; name: string; category: string; description: string;
  offsetLat: number; offsetLng: number; address: string; promoted?: boolean;
};
const VENUES: VenueSpec[] = [
  { partner: "p1", name: "Q Club București",      category: "club",  description: "Club queer-friendly în centrul vechi.",      offsetLat:  0.002, offsetLng:  0.001, address: "Str. Lipscani 12", promoted: true },
  { partner: "p1", name: "Q Lounge București",    category: "bar",   description: "Lounge intim, cocktailuri, muzică house.",   offsetLat: -0.001, offsetLng:  0.003, address: "Bd. Magheru 22" },
  { partner: "p2", name: "Misto Bar",             category: "bar",   description: "Bar relaxat, brunch în weekend.",            offsetLat:  0.004, offsetLng: -0.002, address: "Str. Smârdan 7",  promoted: true },
  { partner: "p3", name: "Velvet Lounge",         category: "bar",   description: "Cocktail bar cu DJ live joi–sâmbătă.",       offsetLat: -0.003, offsetLng:  0.004, address: "Calea Victoriei 95" },
  { partner: "p4", name: "Bookhaus Queer",        category: "bookshop", description: "Librărie queer + cafenea, evenimente lectură.", offsetLat:  0.001, offsetLng: -0.004, address: "Str. Arthur Verona 13" },
  { partner: "p5", name: "Form Space",            category: "club",  description: "Club LGBTQ+ în Cluj, line-up techno.",       offsetLat:  0.001, offsetLng:  0.002, address: "Str. Memorandumului 8", promoted: true },
  { partner: "p6", name: "Aici Cafe",             category: "cafe",  description: "Cafenea inclusivă lângă universitate.",      offsetLat: -0.002, offsetLng:  0.001, address: "Str. Universității 4" },
  { partner: "p7", name: "The Note Bar",          category: "bar",   description: "Music bar friendly, live jazz duminica.",    offsetLat:  0.002, offsetLng: -0.001, address: "Piața Victoriei 1",   promoted: true },
  { partner: "p8", name: "Garage Club Timișoara", category: "club",  description: "Club industrial, after-parties pride.",      offsetLat: -0.001, offsetLng:  0.003, address: "Str. Take Ionescu 21" },
  { partner: "p9", name: "Underground Iași",      category: "club",  description: "Club underground, DJ residency lunar.",      offsetLat:  0.001, offsetLng: -0.002, address: "Str. Lăpușneanu 14" },
  { partner: "p10", name: "Bibilou Cafe",         category: "cafe",  description: "Cafenea queer-friendly, board games seara.", offsetLat: -0.002, offsetLng:  0.001, address: "Str. Cuza Vodă 4" },
  { partner: "p11", name: "Marina Pride Bar",     category: "bar",   description: "Bar pe faleză, vară prelungită până octombrie.", offsetLat:  0.001, offsetLng:  0.002, address: "Faleza Cazino 3", promoted: true },
  { partner: "p11", name: "La Mare Sauna",        category: "sauna", description: "Saună privată, members only, programare online.", offsetLat: -0.001, offsetLng:  0.003, address: "Str. Mircea cel Bătrân 87" },
  { partner: "p3", name: "Pride Bistro București",category: "cafe",  description: "Bistro de zi cu happy hours pride friendly.", offsetLat:  0.003, offsetLng:  0.001, address: "Bd. Unirii 18" },
  { partner: "p5", name: "Cluj Pride House",      category: "other", description: "Spațiu comunitar, ateliere, peer support.",  offsetLat:  0.003, offsetLng: -0.002, address: "Str. Horea 18" },
];

type EventSpec = {
  venueIdx: number; title: string; type: string; daysFromNow: number; durationH: number; official?: boolean;
};
const EVENTS: EventSpec[] = [
  { venueIdx: 0,  title: "Disco Drag Night Vol.7",   type: "party", daysFromNow: 3,  durationH: 6, official: true },
  { venueIdx: 5,  title: "Cluj Pride Warm-Up",       type: "pride", daysFromNow: 5,  durationH: 5, official: true },
  { venueIdx: 7,  title: "Karaoke Queer Tuesday",    type: "bar",   daysFromNow: 2,  durationH: 4 },
  { venueIdx: 2,  title: "Misto Brunch Sunday",      type: "meetup",daysFromNow: 6,  durationH: 3 },
  { venueIdx: 11, title: "Faleza After Pride",       type: "party", daysFromNow: 9,  durationH: 5, official: true },
  { venueIdx: 8,  title: "Garage Techno Open",       type: "party", daysFromNow: 4,  durationH: 6 },
  { venueIdx: 4,  title: "Lecturi queer @ Bookhaus", type: "meetup",daysFromNow: 7,  durationH: 2 },
  { venueIdx: 9,  title: "Underground Drag Battle",  type: "party", daysFromNow: 12, durationH: 5 },
  { venueIdx: 14, title: "Atelier consimțământ",     type: "meetup",daysFromNow: 10, durationH: 3 },
  { venueIdx: 6,  title: "Open Mic Cluj",            type: "meetup",daysFromNow: 8,  durationH: 3 },
];

type OfferSpec = { venueIdx: number; title: string; description: string; terms: string; promoted?: boolean };
const OFFERS: OfferSpec[] = [
  { venueIdx: 0,  title: "Happy hour -30%",          description: "Toate cocktailurile, marți–joi 19–21.",        terms: "Per persoană, fără cumul cu alte oferte." },
  { venueIdx: 2,  title: "2 cocktailuri la preț de 1", description: "În fiecare miercuri, după 20:00.",            terms: "Maxim 2 utilizări/persoană pe lună.", promoted: true },
  { venueIdx: 5,  title: "Intrare gratuită joi",     description: "Înainte de 23:00, cu cod în app.",             terms: "Valabil joi, lista 25+." },
  { venueIdx: 7,  title: "Brunch -25%",              description: "Duminică 11–14, masă rezervată în avans.",     terms: "Rezervare cu 24h înainte." },
  { venueIdx: 8,  title: "Tab open 100 lei",         description: "Plătești 70 lei, primești 100 lei pe cont.",    terms: "Valabil până la 31 decembrie." },
  { venueIdx: 11, title: "Cocktail welcome gratuit", description: "Prima comandă, primești drinkul casei.",        terms: "O dată per cont.", promoted: true },
  { venueIdx: 3,  title: "After-work -20%",          description: "Luni–vineri, 17–19.",                            terms: "Lista de cocktailuri clasice." },
  { venueIdx: 4,  title: "Cafea + carte 35 lei",     description: "Cafea + reducere 15% la o carte queer.",         terms: "Stoc limitat." },
  { venueIdx: 6,  title: "Latte cu lapte vegetal free", description: "Fără supliment pentru lapte vegetal.",        terms: "Permanent." },
  { venueIdx: 13, title: "Sauna -20% după 22",       description: "Acces redus între 22:00 și ora închiderii.",     terms: "Programare obligatorie." },
];

/* ---------------------------- HELPERS ---------------------------- */

function seedEmail(key: string) { return `demo-${key}@${SEED_EMAIL_DOMAIN}`; }

async function ensurePartnerUser(supabaseAdmin: any, spec: PartnerSpec): Promise<string> {
  const email = seedEmail(spec.key);
  // Idempotent: try to find existing.
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u: any) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: SEED_PASSWORD, email_confirm: true,
    user_metadata: { display_name: spec.brand, seed: true, plan: spec.plan },
  });
  if (error) throw new Error(`createUser ${spec.key}: ${error.message}`);
  return data.user!.id;
}

/* ---------------------------- SEED ---------------------------- */

export const seedDemoContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const log: string[] = [];

    // 1) Partners (auth user + profile + business role)
    const partnerIds: Record<string, string> = {};
    for (const p of PARTNERS) {
      const uid = await ensurePartnerUser(supabaseAdmin, p);
      partnerIds[p.key] = uid;
      const city = CITIES[p.city];
      await (supabaseAdmin as any).from("profiles").upsert({
        id: uid,
        display_name: p.brand,
        city: city.name,
        bio: `Partener Ventuza demo · plan ${p.plan}`,
        is_seed: true,
        verified: true,
        age_status: "verified",
      }, { onConflict: "id" });
      await (supabaseAdmin as any).from("user_roles").upsert({
        user_id: uid, role: "business",
      }, { onConflict: "user_id,role" });
    }
    log.push(`partners: ${PARTNERS.length}`);

    // 2) Subscriptions for paid plans (active, stripe)
    for (const p of PARTNERS) {
      if (p.plan === "basic") continue;
      const productId = p.plan === "premium" ? "partner_premium_monthly" : "partner_pro_monthly";
      const { data: existing } = await (supabaseAdmin as any)
        .from("subscriptions").select("id")
        .eq("user_id", partnerIds[p.key]).eq("platform", "stripe").eq("is_seed", true).maybeSingle();
      if (existing) continue;
      await (supabaseAdmin as any).from("subscriptions").insert({
        user_id: partnerIds[p.key], platform: "stripe", product_id: productId,
        purchase_token: `seed-${p.key}-${Date.now()}`,
        status: "active",
        started_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        auto_renew: true, is_seed: true,
      });
    }
    log.push("subscriptions: pro/premium active");

    // 3) Venues
    const venueIds: string[] = [];
    for (let i = 0; i < VENUES.length; i++) {
      const v = VENUES[i];
      const partner = PARTNERS.find((p) => p.key === v.partner)!;
      const city = CITIES[partner.city];
      const lat = city.lat + v.offsetLat;
      const lng = city.lng + v.offsetLng;
      const slug = `seed-${v.partner}-${i}-${v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
      // Idempotent
      const { data: existing } = await (supabaseAdmin as any)
        .from("venues").select("id").eq("slug", slug).maybeSingle();
      if (existing) { venueIds.push(existing.id); continue; }
      const { data: ins, error } = await (supabaseAdmin as any).from("venues").insert({
        owner_id: partnerIds[v.partner],
        name: v.name, slug, category: v.category, description: v.description,
        address: v.address, city: city.name, lat, lng,
        cover_url: `https://picsum.photos/seed/${slug}/640/360`,
        opening_hours: { mon: "16-02", tue: "16-02", wed: "16-02", thu: "16-03", fri: "16-04", sat: "16-04", sun: "16-23" },
        is_published: true, moderation_status: "approved",
        moderated_at: new Date().toISOString(),
        notification_radius_m: 2000,
        is_official: v.promoted === true,
        is_seed: true,
      }).select("id").single();
      if (error) throw new Error(`venue ${v.name}: ${error.message}`);
      venueIds.push(ins.id);
    }
    log.push(`venues: ${venueIds.length}`);

    // 4) Events
    for (let i = 0; i < EVENTS.length; i++) {
      const e = EVENTS[i];
      const venue = VENUES[e.venueIdx];
      const partner = PARTNERS.find((p) => p.key === venue.partner)!;
      const city = CITIES[partner.city];
      const lat = city.lat + venue.offsetLat;
      const lng = city.lng + venue.offsetLng;
      const startsAt = new Date(Date.now() + e.daysFromNow * 86400_000 + 21 * 3600_000); // 21:00
      const endsAt = new Date(startsAt.getTime() + e.durationH * 3600_000);
      // Idempotent: match by title+host+is_seed
      const { data: existing } = await (supabaseAdmin as any)
        .from("events").select("id").eq("title", e.title).eq("is_seed", true).maybeSingle();
      if (existing) continue;
      const { error } = await (supabaseAdmin as any).from("events").insert({
        host_id: partnerIds[venue.partner],
        title: e.title, description: `Eveniment demo @ ${venue.name}`,
        event_type: e.type, city: city.name, venue: venue.name, lat, lng,
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        cover_url: `https://picsum.photos/seed/${e.title.replace(/\s+/g, "-")}/640/360`,
        is_private: false, is_published: true, moderation_status: "approved",
        moderated_at: new Date().toISOString(),
        notification_radius_m: 2000, is_official: e.official === true,
        is_seed: true,
      });
      if (error) throw new Error(`event ${e.title}: ${error.message}`);
    }
    log.push(`events: ${EVENTS.length}`);

    // 5) Offers
    for (const o of OFFERS) {
      const vid = venueIds[o.venueIdx];
      const { data: existing } = await (supabaseAdmin as any)
        .from("offers").select("id").eq("title", o.title).eq("venue_id", vid).eq("is_seed", true).maybeSingle();
      if (existing) continue;
      const { error } = await (supabaseAdmin as any).from("offers").insert({
        venue_id: vid, title: o.title, description: o.description, terms: o.terms,
        valid_from: new Date().toISOString(),
        valid_to: new Date(Date.now() + 45 * 86400_000).toISOString(),
        max_claims_per_user: 1,
        is_published: true, moderation_status: "approved",
        moderated_at: new Date().toISOString(),
        is_seed: true,
      });
      if (error) throw new Error(`offer ${o.title}: ${error.message}`);
    }
    log.push(`offers: ${OFFERS.length}`);

    // 6) Promoted ads (advertiser + ad_campaign) for venues marked promoted
    const promotedVenues = VENUES.map((v, i) => ({ v, i })).filter((x) => x.v.promoted);
    for (const { v, i } of promotedVenues) {
      const partner = PARTNERS.find((p) => p.key === v.partner)!;
      const city = CITIES[partner.city];
      // Idempotent advertiser per partner
      const { data: existingAdv } = await (supabaseAdmin as any)
        .from("advertisers").select("id")
        .eq("owner_id", partnerIds[v.partner]).eq("is_seed", true).maybeSingle();
      let advId: string;
      if (existingAdv) advId = existingAdv.id;
      else {
        const { data, error } = await (supabaseAdmin as any).from("advertisers").insert({
          owner_id: partnerIds[v.partner], brand_name: partner.brand,
          contact_email: seedEmail(partner.key), category: "venue",
          verified: true, is_seed: true,
        }).select("id").single();
        if (error) throw new Error(`advertiser ${partner.key}: ${error.message}`);
        advId = data.id;
      }
      const { data: existingCamp } = await (supabaseAdmin as any)
        .from("ad_campaigns").select("id").eq("advertiser_id", advId).eq("is_seed", true).maybeSingle();
      if (existingCamp) continue;
      await (supabaseAdmin as any).from("ad_campaigns").insert({
        advertiser_id: advId, placement: "nearby_top",
        title: `${v.name} · sponsorizat`,
        body: v.description,
        image_url: `https://picsum.photos/seed/ad-${i}/640/360`,
        cta_label: "Vezi locul", cta_url: `/venues/${venueIds[i]}`,
        city: city.name, budget_cents: 50000, status: "active",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        is_seed: true,
      });
    }
    log.push(`ads: ${promotedVenues.length}`);

    return { ok: true, log, summary: await summary(supabaseAdmin) };
  });

async function summary(supabaseAdmin: any) {
  const { data } = await supabaseAdmin.rpc("seed_content_summary");
  return data ?? {};
}

/* ---------------------------- WIPE ---------------------------- */

export const deleteDemoContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Order matters for FK cascade clarity.
    await (supabaseAdmin as any).from("ad_campaigns").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("advertisers").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("offers").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("events").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("venues").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("subscriptions").delete().eq("is_seed", true);

    // Delete seed auth users (cascades profile + user_roles via FKs).
    const { data: seedProfiles } = await (supabaseAdmin as any)
      .from("profiles").select("id").eq("is_seed", true);
    let deletedUsers = 0;
    for (const p of seedProfiles ?? []) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id);
      if (!error) deletedUsers++;
    }
    return { ok: true, deletedUsers, summary: await summary(supabaseAdmin) };
  });

/* ---------------------------- SUMMARY ---------------------------- */

export const getSeedSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("seed_content_summary");
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });

/* ---------------------------- PROXIMITY SIMULATOR ---------------------------- */

/**
 * Simulează poziția super_admin-ului. Folosește RPC-urile REALE:
 *  - `nearby_points` cu bucket-ul calculat din lat/lng
 *  - `try_record_proximity_hit` (sub identitatea super_admin) pentru fiecare
 *    venue/event în raza dată
 *
 * Notificările locale NU sunt trimise — doar întoarcem rezultatele gate-ului
 * server (allowed / reason) ca să vedem ce s-AR declanșa. Logul real
 * `proximity_notification_log` se actualizează (la fel ca în viața reală
 * pentru super_admin), ceea ce e corect dacă vrei să verifici cooldown-ul.
 */
const SimInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(100).max(10000).default(2000),
});

export const simulateProximity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SimInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const bucketId = `${Math.floor(data.lat * 20)}:${Math.floor(data.lng * 20)}`;
    const { data: points, error } = await (context.supabase as any).rpc("nearby_points", {
      p_bucket_id: bucketId, p_kinds: ["venue", "event", "offer"],
    });
    if (error) throw new Error(error.message);

    const toRad = (d: number) => (d * Math.PI) / 180;
    const dist = (a: any, b: any) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    const results: Array<{
      kind: string; id: string; name: string; distance_m: number;
      gate?: { allowed: boolean; reason?: string };
    }> = [];

    for (const p of points ?? []) {
      const d = dist({ lat: data.lat, lng: data.lng }, { lat: p.lat, lng: p.lng });
      const entry: any = { kind: p.kind, id: p.id, name: p.name, distance_m: Math.round(d) };
      if ((p.kind === "venue" || p.kind === "event") && d <= data.radiusM) {
        const { data: gate, error: ge } = await (context.supabase as any).rpc("try_record_proximity_hit", {
          p_kind: p.kind, p_id: p.id, p_layer: "foreground",
        });
        if (ge) entry.gate = { allowed: false, reason: ge.message };
        else entry.gate = gate;
      }
      results.push(entry);
    }
    results.sort((a, b) => a.distance_m - b.distance_m);
    return { bucketId, count: results.length, results };
  });
