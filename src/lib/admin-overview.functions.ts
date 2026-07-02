import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Panoul Overview enterprise. Un singur call → toate agregările necesare:
 * KPI-uri + trenduri 7d + deltas + queue depths + SLA + revenue + kill-switches
 * + moderatori online + audit critic + funnel + geografie.
 *
 * Toate acțiunile respectă REGULA ADMIN — nu proiectează câmpuri sensibile
 * (doar count-uri agregate + acțiuni + severitate + timestamp).
 */
export const adminGetOverviewRich = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Doar staff. Rolul e verificat prin has_any_role.
    const { data: isStaff, error: eStaff } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["super_admin", "admin", "moderator", "auditor", "support"],
    });
    if (eStaff) throw new Error(eStaff.message);
    if (!isStaff) throw new Error("Forbidden: staff role required");

    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa: any = _sa;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const iso = (ms: number) => new Date(ms).toISOString();
    const DAY = 24 * 3600 * 1000;
    const since24h = iso(now - DAY);
    const since48h = iso(now - 2 * DAY);
    const since7d = iso(now - 7 * DAY);
    const since14d = iso(now - 14 * DAY);
    const since30d = iso(now - 30 * DAY);
    const monthStart = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());

    const head = (table: string, filter?: (q: any) => any) => {
      let q: any = sa.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      return q;
    };
    const oldest = (table: string, tsCol: string, filter?: (q: any) => any) => {
      let q: any = sa.from(table).select(tsCol).order(tsCol, { ascending: true }).limit(1);
      if (filter) q = filter(q);
      return q;
    };

    // Daily bucket helper. dateCol = timestamptz coloană.
    const dayBuckets = async (table: string, dateCol: string) => {
      // 7 head-count queries per metric. Rapid, indexuit pe created_at în majoritatea tabelelor.
      const days: { day: string; count: number }[] = [];
      const starts: number[] = [];
      const today = new Date();
      const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      for (let i = 6; i >= 0; i--) starts.push(midnight - i * DAY);
      const results = await Promise.all(
        starts.map(async (s) => {
          const from = new Date(s).toISOString();
          const to = new Date(s + DAY).toISOString();
          const { count } = await sa.from(table).select("*", { count: "exact", head: true })
            .gte(dateCol, from).lt(dateCol, to);
          return { day: from.slice(5, 10), count: count ?? 0 };
        }),
      );
      days.push(...results);
      return days;
    };

    const [
      // KPI base
      profilesAll, profiles24h, profiles48to24, profiles7d, profilesPrev7d,
      verified, banned, suspended,
      messages24h, messagesPrev24h,
      matches24h, matchesPrev24h,
      // Trends
      trendSignups, trendMessages, trendMatches,
      // Queues + oldest
      reportsPending, reportsOldest,
      appealsPending, appealsOldest,
      csamPending, csamOldest,
      dsaLast7d,
      breachOpen, breachOldest,
      supportOpen, supportOldest, supportUrgent,
      deletionPending, deletionOldest,
      bizPending, bizOldest,
      venuesPending, eventsPending, offersPending,
      gdprSar,
      // Content
      eventsAll, events24h,
      adsActive, adsPending,
      sos7d, sos24h,
      // Revenue
      subsActive, subsGrace, subsDowngraded,
      invoicesPaidMonth, invoicesOutstanding,
      // Kill-switches + flags
      flagsAll,
      // Moderators online
      activeClaims,
      // Recent critical
      recentAudit,
      // Funnel
      signup7d, ageVerified7d, birthdate7d, msgSenders7d,
      // Geography
      topCitiesRaw,
      // Risk
      riskHigh, riskQueue,
      // Suspended partners
      partnerSuspended,
    ] = await Promise.all([
      head("profiles"),
      head("profiles", (q) => q.gte("created_at", since24h)),
      head("profiles", (q) => q.gte("created_at", since48h).lt("created_at", since24h)),
      head("profiles", (q) => q.gte("created_at", since7d)),
      head("profiles", (q) => q.gte("created_at", since14d).lt("created_at", since7d)),
      head("profiles", (q) => q.eq("verified", true)),
      head("profiles", (q) => q.not("banned_at", "is", null)),
      head("profiles", (q) => q.gt("suspended_until", nowIso)),
      head("messages", (q) => q.gte("created_at", since24h)),
      head("messages", (q) => q.gte("created_at", since48h).lt("created_at", since24h)),
      head("matches", (q) => q.gte("created_at", since24h)),
      head("matches", (q) => q.gte("created_at", since48h).lt("created_at", since24h)),
      dayBuckets("profiles", "created_at"),
      dayBuckets("messages", "created_at"),
      dayBuckets("matches", "created_at"),
      head("reports", (q) => q.eq("status", "pending")),
      oldest("reports", "created_at", (q) => q.eq("status", "pending")),
      head("appeals", (q) => q.eq("status", "pending")),
      oldest("appeals", "created_at", (q) => q.eq("status", "pending")),
      head("csam_ncmec_queue", (q) => q.eq("status", "pending")),
      oldest("csam_ncmec_queue", "created_at", (q) => q.eq("status", "pending")),
      head("dsa_sor", (q) => q.gte("created_at", since7d)),
      head("breach_incidents", (q) => q.in("status", ["detected", "investigating", "notifying"])),
      oldest("breach_incidents", "discovered_at", (q) => q.in("status", ["detected", "investigating", "notifying"])),
      head("support_tickets", (q) => q.in("status", ["open", "pending", "waiting_user", "in_progress"])),
      oldest("support_tickets", "created_at", (q) => q.in("status", ["open", "pending", "waiting_user", "in_progress"])),
      head("support_tickets", (q) => q.in("status", ["open", "pending", "in_progress"]).eq("priority", "urgent")),
      head("deletion_requests", (q) => q.eq("status", "pending")),
      oldest("deletion_requests", "created_at", (q) => q.eq("status", "pending")),
      head("business_applications", (q) => q.in("status", ["pending", "reviewing"])),
      oldest("business_applications", "created_at", (q) => q.in("status", ["pending", "reviewing"])),
      head("venues", (q) => q.eq("moderation_status", "pending")),
      head("events", (q) => q.eq("moderation_status", "pending")),
      head("offers", (q) => q.eq("moderation_status", "pending")),
      head("deletion_requests", (q) => q.eq("status", "pending")),
      head("events"),
      head("events", (q) => q.gte("created_at", since24h)),
      head("ad_campaigns", (q) => q.eq("status", "active")),
      head("ad_campaigns", (q) => q.eq("status", "pending")),
      head("sos_events", (q) => q.gte("triggered_at", since7d)),
      head("sos_events", (q) => q.gte("triggered_at", since24h)),
      head("partner_subscriptions", (q) => q.eq("status", "active")),
      head("partner_subscriptions", (q) => q.eq("status", "grace")),
      head("partner_subscriptions", (q) => q.eq("status", "free_downgraded")),
      sa.from("partner_invoices").select("total_minor, currency").eq("status", "paid").gte("issued_at", monthStart),
      sa.from("partner_invoices").select("total_minor, currency, due_at").in("status", ["issued", "sent", "overdue"]),
      sa.from("feature_flags").select("key, enabled, updated_at"),
      sa.from("queue_claims").select("queue, claimed_by, expires_at").gt("expires_at", nowIso),
      sa.from("admin_audit_log").select("id, action, target_table, actor_id, severity, created_at, metadata")
        .in("severity", ["critical", "high"]).order("created_at", { ascending: false }).limit(10),
      // Funnel (last 7d)
      head("profiles", (q) => q.gte("created_at", since7d)),
      head("profiles", (q) => q.gte("created_at", since7d).eq("age_status", "verified")),
      head("profiles", (q) => q.gte("created_at", since7d).not("birthdate", "is", null)),
      sa.rpc("count_distinct_message_senders_since", { _since: since7d }).then((r: any) => r).catch(() => ({ data: null })),
      sa.from("profiles").select("city").gte("created_at", since24h).not("city", "is", null).limit(1000),
      head("risk_flags", (q) => q.gte("score", 70).gte("created_at", since7d)),
      head("risk_flags", (q) => q.eq("status", "pending")),
      head("profiles", (q) => q.not("partner_suspended_at", "is", null)),
    ]);

    // Aggregate invoices
    const currencyOf = (rows: any[] | null) => {
      const acc: Record<string, number> = {};
      (rows ?? []).forEach((r) => {
        const c = (r.currency ?? "RON").toUpperCase();
        acc[c] = (acc[c] ?? 0) + Number(r.total_minor ?? 0);
      });
      return acc;
    };
    const revenueMonth = currencyOf(invoicesPaidMonth.data);
    const outstandingRows: any[] = invoicesOutstanding.data ?? [];
    const outstanding = currencyOf(outstandingRows);
    const overdueCount = outstandingRows.filter((r) => r.due_at && new Date(r.due_at).getTime() < now).length;

    // Kill switches — flags critice care sunt OFF
    const CRITICAL_FLAGS = new Set([
      "age_verification", "csam_hash_blocking", "ai_moderation", "push_notifications",
      "signup", "chat", "discover", "matching", "proximity_notifications",
    ]);
    const flags = flagsAll.data ?? [];
    const killedCritical = flags.filter((f: any) => CRITICAL_FLAGS.has(f.key) && !f.enabled);

    // Moderatori online (queue_claims valide)
    const claims = activeClaims.data ?? [];
    const onlineOperators = new Set(claims.map((c: any) => c.claimed_by)).size;
    const claimsByQueue: Record<string, number> = {};
    claims.forEach((c: any) => { claimsByQueue[c.queue] = (claimsByQueue[c.queue] ?? 0) + 1; });

    // Top orașe 24h signups
    const cityCounts: Record<string, number> = {};
    (topCitiesRaw.data ?? []).forEach((r: any) => {
      const c = (r.city ?? "").trim();
      if (!c) return;
      cityCounts[c] = (cityCounts[c] ?? 0) + 1;
    });
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    // SLA helpers
    const ageMinutes = (row: any, col: string) => {
      const arr: any[] = row.data ?? [];
      if (!arr.length) return null;
      const t = new Date(arr[0][col]).getTime();
      return Math.max(0, Math.round((now - t) / 60000));
    };

    // Delta % helper
    const pct = (curr: number, prev: number) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      generatedAt: nowIso,
      profiles: {
        total: profilesAll.count ?? 0,
        last24h: profiles24h.count ?? 0,
        last7d: profiles7d.count ?? 0,
        verified: verified.count ?? 0,
        banned: banned.count ?? 0,
        suspended: suspended.count ?? 0,
        deltaDay: pct(profiles24h.count ?? 0, profiles48to24.count ?? 0),
        deltaWeek: pct(profiles7d.count ?? 0, profilesPrev7d.count ?? 0),
      },
      activity: {
        messages24h: messages24h.count ?? 0,
        messagesDelta: pct(messages24h.count ?? 0, messagesPrev24h.count ?? 0),
        matches24h: matches24h.count ?? 0,
        matchesDelta: pct(matches24h.count ?? 0, matchesPrev24h.count ?? 0),
        events: eventsAll.count ?? 0,
        events24h: events24h.count ?? 0,
        sos7d: sos7d.count ?? 0,
        sos24h: sos24h.count ?? 0,
      },
      trends: {
        signups: trendSignups,
        messages: trendMessages,
        matches: trendMatches,
      },
      queues: [
        { key: "reports", label: "Rapoarte users", pending: reportsPending.count ?? 0, oldestMin: ageMinutes(reportsOldest, "created_at"), route: "reports" },
        { key: "appeals", label: "Apeluri DSA", pending: appealsPending.count ?? 0, oldestMin: ageMinutes(appealsOldest, "created_at"), route: "appeals" },
        { key: "csam", label: "CSAM → NCMEC", pending: csamPending.count ?? 0, oldestMin: ageMinutes(csamOldest, "created_at"), route: "csam", sla: 24 * 60 },
        { key: "support", label: "Support tickets", pending: supportOpen.count ?? 0, oldestMin: ageMinutes(supportOldest, "created_at"), urgent: supportUrgent.count ?? 0, route: "support" },
        { key: "deletion", label: "Ștergere cont (GDPR)", pending: deletionPending.count ?? 0, oldestMin: ageMinutes(deletionOldest, "created_at"), route: "gdpr", sla: 30 * 24 * 60 },
        { key: "business", label: "Aplicații business", pending: bizPending.count ?? 0, oldestMin: ageMinutes(bizOldest, "created_at"), route: "biz" },
        { key: "partners_venues", label: "Venues pending", pending: venuesPending.count ?? 0, oldestMin: null, route: "partners" },
        { key: "partners_events", label: "Events pending", pending: eventsPending.count ?? 0, oldestMin: null, route: "partners" },
        { key: "partners_offers", label: "Oferte pending", pending: offersPending.count ?? 0, oldestMin: null, route: "partners" },
        { key: "breach", label: "Breșe active", pending: breachOpen.count ?? 0, oldestMin: ageMinutes(breachOldest, "discovered_at"), route: "breach", sla: 72 * 60 },
        { key: "risk", label: "Risc — cerere review", pending: riskQueue.count ?? 0, oldestMin: null, route: "riskqueue" },
        { key: "dsa_recent", label: "DSA SoR (7 zile)", pending: dsaLast7d.count ?? 0, oldestMin: null, route: "dsa" },
      ],
      moderation: {
        reportsPending: reportsPending.count ?? 0,
        adsActive: adsActive.count ?? 0,
        adsPending: adsPending.count ?? 0,
        bizPending: bizPending.count ?? 0,
        subsActive: subsActive.count ?? 0,
        gdprSar: gdprSar.count ?? 0,
        partnerSuspended: partnerSuspended.count ?? 0,
        riskHigh7d: riskHigh.count ?? 0,
      },
      revenue: {
        subsActive: subsActive.count ?? 0,
        subsGrace: subsGrace.count ?? 0,
        subsDowngraded: subsDowngraded.count ?? 0,
        revenueMonthMinor: revenueMonth,
        outstandingMinor: outstanding,
        overdueCount,
      },
      flags: {
        total: flags.length,
        disabled: flags.filter((f: any) => !f.enabled).length,
        killedCritical: killedCritical.map((f: any) => ({ key: f.key, updatedAt: f.updated_at })),
      },
      onCall: {
        operatorsOnline: onlineOperators,
        claimsByQueue,
        totalActiveClaims: claims.length,
      },
      recentAudit: (recentAudit.data ?? []).map((r: any) => ({
        id: r.id, action: r.action, targetTable: r.target_table,
        actorId: r.actor_id, severity: r.severity, createdAt: r.created_at,
      })),
      funnel: {
        signup7d: signup7d.count ?? 0,
        ageVerified7d: ageVerified7d.count ?? 0,
        birthdate7d: birthdate7d.count ?? 0,
        firstMessage7d: (msgSenders7d?.data as number | null) ?? null,
      },
      topCities,
      anomalies: buildAnomalies({
        deltaSignupsDay: pct(profiles24h.count ?? 0, profiles48to24.count ?? 0),
        deltaMessagesDay: pct(messages24h.count ?? 0, messagesPrev24h.count ?? 0),
        sos24h: sos24h.count ?? 0,
        csamPending: csamPending.count ?? 0,
        breachOpen: breachOpen.count ?? 0,
        overdueCount,
        killedCritical: killedCritical.length,
      }),
    };
  });

function buildAnomalies(x: {
  deltaSignupsDay: number; deltaMessagesDay: number; sos24h: number;
  csamPending: number; breachOpen: number; overdueCount: number; killedCritical: number;
}) {
  const out: { severity: "critical" | "warn" | "info"; text: string }[] = [];
  if (x.killedCritical > 0) out.push({ severity: "critical", text: `${x.killedCritical} kill-switch(uri) critice sunt OFF` });
  if (x.breachOpen > 0) out.push({ severity: "critical", text: `${x.breachOpen} breșă/breșe deschise (GDPR Art. 33 — 72h)` });
  if (x.csamPending > 0) out.push({ severity: "critical", text: `${x.csamPending} raport(uri) CSAM în așteptare — SLA 24h NCMEC` });
  if (x.sos24h > 0) out.push({ severity: "critical", text: `${x.sos24h} eveniment(e) SOS în ultimele 24h` });
  if (x.deltaSignupsDay <= -40) out.push({ severity: "warn", text: `Signups −${Math.abs(x.deltaSignupsDay)}% D/D` });
  else if (x.deltaSignupsDay >= 200) out.push({ severity: "warn", text: `Signups +${x.deltaSignupsDay}% D/D (posibil botnet)` });
  if (x.deltaMessagesDay <= -40) out.push({ severity: "warn", text: `Mesaje −${Math.abs(x.deltaMessagesDay)}% D/D` });
  if (x.overdueCount > 0) out.push({ severity: "warn", text: `${x.overdueCount} factură/facturi partener overdue` });
  return out;
}
