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

    // 7) Admin modules — populate each panel with realistic seed data.
    const adminLog = await seedAdminModules(supabaseAdmin, partnerIds);
    log.push(...adminLog);

    return { ok: true, log, summary: await summary(supabaseAdmin) };
  });

/* ---------------------------- ADMIN MODULES SEED ---------------------------- */

/**
 * Populează modulele admin cu date demo realiste (toate is_seed=true unde
 * coloana există; restul marcate prin actor_email='seed@ventuza.local' sau
 * justification cu prefix '[SEED]' pentru append-only tables).
 *
 * CSAM: NICIODATĂ imagini reale. Doar metadate + hash-uri sintetice.
 */
async function seedAdminModules(
  supabaseAdmin: any,
  partnerIds: Record<string, string>,
): Promise<string[]> {
  const log: string[] = [];
  const partnerArr = Object.values(partnerIds);
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
  const now = Date.now();

  // --- A. User reports (reports) ---
  const reportReasons = ["harassment", "fake_profile", "spam", "underage", "hate_speech", "scam"];
  const reportStatuses = ["pending", "pending", "pending", "reviewing", "resolved", "dismissed"];
  for (let i = 0; i < 8; i++) {
    const reporter = pick(partnerArr, i);
    const reported = pick(partnerArr, i + 3);
    if (reporter === reported) continue;
    await supabaseAdmin.from("reports").insert({
      reporter_id: reporter,
      reported_id: reported,
      reason: pick(reportReasons, i),
      details: `[SEED] Raport demo #${i + 1} — comportament suspect raportat în chat.`,
      status: pick(reportStatuses, i),
      created_at: new Date(now - (i + 1) * 86400_000).toISOString(),
      is_seed: true,
    });
  }
  log.push("reports: 8");

  // --- B. Illegal content reports (DSA) ---
  const dsaCategories = ["illegal_hate_speech", "copyright", "csam_suspected", "terrorism", "defamation"];
  const dsaStatuses = ["pending", "pending", "reviewing", "resolved", "rejected"];
  for (let i = 0; i < 6; i++) {
    await supabaseAdmin.from("illegal_content_reports").insert({
      reporter_email: `reporter${i}@example.test`,
      reporter_user_id: pick(partnerArr, i),
      content_url: `https://app.ventuza.test/p/seed-${i}`,
      content_type: i % 2 === 0 ? "profile" : "message",
      category: pick(dsaCategories, i),
      description: `[SEED] Raport DSA demo #${i + 1}.`,
      legal_basis: "DSA Art. 16",
      status: pick(dsaStatuses, i),
      created_at: new Date(now - (i + 1) * 2 * 86400_000).toISOString(),
      is_seed: true,
    });
  }
  log.push("dsa_reports: 6");

  // --- C. CSAM reports (HASH-ONLY, fără imagini reale) ---
  const csamStatuses = ["pending_review", "escalated_ncmec", "blocked", "false_positive"];
  for (let i = 0; i < 4; i++) {
    const fakeSha = Array.from({ length: 64 }, (_, k) => "0123456789abcdef"[(i * 7 + k) % 16]).join("");
    const fakePhash = Array.from({ length: 16 }, (_, k) => "0123456789abcdef"[(i * 11 + k) % 16]).join("");
    await supabaseAdmin.from("csam_reports").insert({
      user_id: pick(partnerArr, i + 1),
      photo_url: null, // intenționat NULL — nu stocăm/randăm imagini suspecte
      hash: `phash:${fakePhash}|sha256:${fakeSha}`,
      match_source: i === 0 ? "ncmec_hashlist" : i === 1 ? "internal_blocklist" : "perceptual_match",
      ncmec_report_id: i === 1 ? `NCMEC-SEED-${1000 + i}` : null,
      status: pick(csamStatuses, i),
      notes: `[SEED] Caz demo doar pentru UI. Niciodată conținut real.`,
      reported_at: new Date(now - (i + 1) * 3 * 86400_000).toISOString(),
      is_seed: true,
    });
  }
  log.push("csam_reports: 4 (hash-only)");

  // --- D. Risk flags + profile risk_score ---
  const riskKinds = ["velocity_signup", "duplicate_device", "vpn_exit", "report_spike", "ml_score_high"];
  for (let i = 0; i < 7; i++) {
    const uid = pick(partnerArr, i);
    const sev = (i % 4) + 1;
    await supabaseAdmin.from("risk_flags").insert({
      user_id: uid,
      kind: pick(riskKinds, i),
      severity: sev,
      details: { source: "seed", note: `demo flag #${i + 1}` },
      status: i % 3 === 0 ? "open" : i % 3 === 1 ? "reviewing" : "resolved",
      created_at: new Date(now - i * 36 * 3600_000).toISOString(),
      is_seed: true,
    });
    // boost the partner's risk_score so the Risk panel shows variety
    await supabaseAdmin.from("profiles").update({
      risk_score: 20 + i * 11,
      report_count: i % 3,
    }).eq("id", uid);
  }
  log.push("risk_flags: 7");

  // --- E. Breach incidents (demo) ---
  for (let i = 0; i < 3; i++) {
    await supabaseAdmin.from("breach_incidents").insert({
      title: `[SEED] Incident demo #${i + 1}`,
      discovered_at: new Date(now - (i + 1) * 5 * 86400_000).toISOString(),
      notify_deadline: new Date(now - (i + 1) * 5 * 86400_000 + 72 * 3600_000).toISOString(),
      description: "Eveniment de securitate fictiv, generat pentru testarea UI.",
      affected_users_count: 10 * (i + 1),
      data_categories: ["email", i === 0 ? "ip" : "device_fingerprint"],
      dpo_contact: "dpo@ventuza.test",
      authority_notified_at: i === 0 ? new Date(now - 4 * 86400_000).toISOString() : null,
      users_notified_at: i === 0 ? new Date(now - 3 * 86400_000).toISOString() : null,
      status: i === 0 ? "closed" : i === 1 ? "notified" : "open",
      is_seed: true,
    });
  }
  log.push("breach_incidents: 3");

  // --- F. Business applications (pending B2B) ---
  const bizStatuses = ["pending", "pending", "reviewing", "approved", "rejected"];
  const bizCats = ["venue", "event_organizer", "brand", "media"];
  for (let i = 0; i < 5; i++) {
    await supabaseAdmin.from("business_applications").insert({
      user_id: pick(partnerArr, i + 2),
      entity_type: i % 2 === 0 ? "srl" : "pfa",
      legal_name: `[SEED] Demo Business ${i + 1} SRL`,
      brand_name: `DemoBrand${i + 1}`,
      cui: `RO${10000000 + i * 137}`,
      reg_com: `J40/${1000 + i}/2024`,
      country: "RO",
      city: pick(["București", "Cluj-Napoca", "Iași", "Timișoara"], i),
      contact_name: `Persoană Demo ${i + 1}`,
      contact_email: `biz${i + 1}@seed.ventuza.local`,
      contact_phone: `+4072000000${i}`,
      category: pick(bizCats, i),
      goals: "Vrem să listăm venue și să publicăm oferte pentru comunitate.",
      monthly_budget_eur: 200 + i * 150,
      accepts_terms: true,
      accepts_dpa: true,
      accepts_lgbt_charter: true,
      status: pick(bizStatuses, i),
      is_seed: true,
    });
  }
  log.push("business_applications: 5");

  // --- G. Deletion requests (GDPR) ---
  const delStatuses = ["pending", "pending", "scheduled", "processed", "cancelled"];
  for (let i = 0; i < 5; i++) {
    await supabaseAdmin.from("deletion_requests").insert({
      user_id: pick(partnerArr, i),
      requested_at: new Date(now - (i + 1) * 2 * 86400_000).toISOString(),
      scheduled_for: new Date(now + (30 - i * 5) * 86400_000).toISOString(),
      reason: i === 0 ? "Nu mai folosesc aplicația." : i === 1 ? "Vreau să-mi șterg datele." : null,
      status: pick(delStatuses, i),
      processed_at: i >= 3 ? new Date(now - i * 86400_000).toISOString() : null,
      is_seed: true,
    });
  }
  log.push("deletion_requests: 5");

  // --- H. Policy versions ---
  const policyKinds = ["terms", "privacy", "dsa", "cookies"];
  for (let i = 0; i < policyKinds.length; i++) {
    await supabaseAdmin.from("policy_versions").insert({
      kind: policyKinds[i],
      version: `2026.0${i + 1}-seed`,
      content_url: `https://ventuza.test/legal/${policyKinds[i]}/seed-${i + 1}`,
      effective_at: new Date(now - (policyKinds.length - i) * 30 * 86400_000).toISOString(),
      is_seed: true,
    });
  }
  log.push(`policy_versions: ${policyKinds.length}`);

  // --- I. Admin alerts ---
  const alertKinds = ["risk_spike", "csam_match", "breach_window_72h", "moderation_backlog"];
  for (let i = 0; i < 4; i++) {
    await supabaseAdmin.from("admin_alerts").insert({
      kind: alertKinds[i],
      severity: pick(["info", "warning", "critical", "warning"], i),
      title: `[SEED] Alertă demo: ${alertKinds[i]}`,
      body: "Notificare generată pentru testarea panoului admin.",
      target_table: i === 1 ? "csam_reports" : i === 0 ? "risk_flags" : null,
      created_at: new Date(now - i * 6 * 3600_000).toISOString(),
      is_seed: true,
    });
  }
  log.push("admin_alerts: 4");

  // --- J. Audit log entries (append-only; marcăm prin justification [SEED]) ---
  const auditActions = [
    { action: "user.ban", severity: "warning" },
    { action: "user.unban", severity: "info" },
    { action: "moderation.approve_venue", severity: "info" },
    { action: "moderation.reject_event", severity: "warning" },
    { action: "settings.update", severity: "info" },
    { action: "gdpr.process_deletion", severity: "warning" },
  ];
  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i];
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: pick(partnerArr, i),
      actor_email: "seed@ventuza.local",
      action: a.action,
      target_table: a.action.startsWith("moderation") ? "venues" : "profiles",
      target_id: pick(partnerArr, i + 1),
      before_data: { status: "active" },
      after_data: { status: "modified" },
      justification: `[SEED] Audit demo pentru acțiunea ${a.action}.`,
      severity: a.severity,
      created_at: new Date(now - i * 4 * 3600_000).toISOString(),
    });
  }
  log.push(`audit_log: ${auditActions.length}`);

  // --- K. Break-glass sensitive access log ---
  const breakKinds: Array<{ kind: string; fields: string[] }> = [
    { kind: "orientation", fields: ["orientation", "tribes"] },
    { kind: "location", fields: ["location"] },
    { kind: "selfie", fields: ["selfie_url"] },
    { kind: "messages", fields: ["body", "media_url"] },
  ];
  for (let i = 0; i < breakKinds.length; i++) {
    const bk = breakKinds[i];
    await supabaseAdmin.from("admin_sensitive_access_log").insert({
      actor_id: pick(partnerArr, i),
      target_user_id: pick(partnerArr, i + 2),
      kind: bk.kind,
      fields: bk.fields,
      justification: `[SEED] Acces demo break-glass (${bk.kind}) pentru testare UI.`,
      created_at: new Date(now - i * 12 * 3600_000).toISOString(),
    });
  }
  log.push(`break_glass: ${breakKinds.length}`);

  // --- L. Pending advertiser + ad campaigns (variate stări) ---
  const adStatuses = ["pending_review", "active", "paused", "rejected"];
  for (let i = 0; i < 4; i++) {
    const owner = pick(partnerArr, i + 1);
    const { data: adv } = await supabaseAdmin.from("advertisers").insert({
      owner_id: owner,
      brand_name: `[SEED] Advertiser Demo ${i + 1}`,
      contact_email: `advertiser${i}@seed.ventuza.local`,
      category: pick(["venue", "event", "brand", "app"], i),
      verified: i % 2 === 0,
      is_seed: true,
    }).select("id").single();
    if (!adv) continue;
    await supabaseAdmin.from("ad_campaigns").insert({
      advertiser_id: adv.id,
      placement: pick(["nearby_top", "discover_inline", "events_banner", "nearby_top"], i),
      title: `[SEED] Campanie demo #${i + 1}`,
      body: "Conținut sponsorizat fictiv pentru testarea panoului.",
      image_url: `https://picsum.photos/seed/adcamp-${i}/640/360`,
      cta_label: "Vezi oferta",
      cta_url: "/nearby",
      city: pick(["București", "Cluj-Napoca", "Iași", "Timișoara"], i),
      budget_cents: 25000 + i * 15000,
      starts_at: new Date(now - i * 86400_000).toISOString(),
      ends_at: new Date(now + (30 - i * 3) * 86400_000).toISOString(),
      status: pick(adStatuses, i),
      is_seed: true,
    });
  }
  log.push("ads_pending: 4");

  return log;
}

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

    // Admin modules cleanup
    await (supabaseAdmin as any).from("reports").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("illegal_content_reports").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("csam_reports").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("risk_flags").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("breach_incidents").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("business_applications").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("deletion_requests").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("policy_versions").delete().eq("is_seed", true);
    await (supabaseAdmin as any).from("admin_alerts").delete().eq("is_seed", true);
    // Append-only tables (admin_audit_log, admin_sensitive_access_log): only
    // a SECURITY DEFINER RPC can bypass the no-mutation triggers, and ONLY for
    // rows marked as seed (`seed@ventuza.local` / justification `[SEED]%`).
    await (supabaseAdmin as any).rpc("wipe_seed_admin_appendonly");



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
