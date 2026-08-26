/**
 * Moderare umană pentru pozele de profil.
 *
 * Fluxul: upload → moderare AI (blocking) → rând `photo_reviews` status
 * `pending`. Poza NU intră în `profiles.photos` (deci nu e publică) până
 * când un membru staff o aprobă din /admin#photoqueue.
 *
 * Respectă REGULĂ ADMIN: rol verificat server-side, audit pe fiecare decizie.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

async function logAudit(sa: any, row: Record<string, unknown>) {
  await sa.from("admin_audit_log").insert(row);
}

/* ---------------- LIST (staff) ---------------- */
const ListInput = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  surface: z.enum(["profile", "album", "all"]).default("all"),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(60),
});

export const adminListPhotoReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    let q = sa
      .from("photo_reviews")
      .select(
        "id,user_id,storage_path,status,surface,source,severity,ai_allowed,ai_reason,ai_labels,reason,created_at,reviewed_at",
      )
      .eq("status", data.status);
    if (data.surface !== "all") q = q.eq("surface", data.surface);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q
      .order("severity", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const names: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await sa
        .from("profiles")
        .select("id,display_name,username,age_status,verified,created_at,report_count")
        .in("id", ids);
      (profs ?? []).forEach((p: any) => (names[p.id] = p));
    }

    const urlByKey: Record<string, string> = {};
    for (const bucket of ["profile-photos", "private-albums"] as const) {
      const paths = (rows ?? [])
        .filter((r: any) => (bucket === "private-albums") === (r.surface === "album"))
        .map((r: any) => r.storage_path);
      if (!paths.length) continue;
      const { data: signed } = await sa.storage.from(bucket).createSignedUrls(paths, 900);
      (signed ?? []).forEach((s: any, i: number) => {
        if (s?.signedUrl) urlByKey[`${bucket}:${paths[i]}`] = s.signedUrl;
      });
    }

    const { count: pendingCount } = await sa
      .from("photo_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        url:
          urlByKey[
            `${r.surface === "album" ? "private-albums" : "profile-photos"}:${r.storage_path}`
          ] ?? null,
        profile: names[r.user_id] ?? null,
      })),
      pendingCount: pendingCount ?? 0,
    };
  });


/* ---------------- DECIDE (bulk, staff) ---------------- */
const DecideInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(300).optional(),
});

export const adminReviewPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const { data: rows, error } = await sa
      .from("photo_reviews")
      .select("id,user_id,storage_path,status,surface")
      .in("id", data.ids)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    let ok = 0;
    for (const r of rows ?? []) {
      const isAlbum = r.surface === "album";
      if (data.decision === "approve") {
        if (isAlbum) {
          const { data: alb } = await sa
            .from("private_albums")
            .select("photos")
            .eq("owner_id", r.user_id)
            .maybeSingle();
          const cur: string[] = Array.isArray(alb?.photos) ? alb.photos : [];
          if (!cur.includes(r.storage_path)) {
            await sa
              .from("private_albums")
              .upsert(
                { owner_id: r.user_id, photos: [...cur, r.storage_path] },
                { onConflict: "owner_id" },
              );
          }
        } else {
          const { data: prof } = await sa
            .from("profiles")
            .select("photos")
            .eq("id", r.user_id)
            .maybeSingle();
          const current: string[] = Array.isArray(prof?.photos) ? prof.photos : [];
          if (!current.includes(r.storage_path) && current.length < 6) {
            await sa
              .from("profiles")
              .update({ photos: [...current, r.storage_path] })
              .eq("id", r.user_id);
          }
        }
      } else if (isAlbum) {
        const { data: alb } = await sa
          .from("private_albums")
          .select("photos")
          .eq("owner_id", r.user_id)
          .maybeSingle();
        const cur: string[] = Array.isArray(alb?.photos) ? alb.photos : [];
        if (cur.includes(r.storage_path)) {
          await sa
            .from("private_albums")
            .update({ photos: cur.filter((p) => p !== r.storage_path) })
            .eq("owner_id", r.user_id);
        }
        await sa.storage.from("private-albums").remove([r.storage_path]);
      } else {
        const { data: prof } = await sa
          .from("profiles")
          .select("photos")
          .eq("id", r.user_id)
          .maybeSingle();
        const current: string[] = Array.isArray(prof?.photos) ? prof.photos : [];
        if (current.includes(r.storage_path)) {
          await sa
            .from("profiles")
            .update({ photos: current.filter((p) => p !== r.storage_path) })
            .eq("id", r.user_id);
        }
        await sa.storage.from("profile-photos").remove([r.storage_path]);
      }

      await sa
        .from("photo_reviews")
        .update({
          status: data.decision === "approve" ? "approved" : "rejected",
          reason: data.reason ?? null,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", r.id);

      await sa.from("notifications").insert({
        user_id: r.user_id,
        type: "admin_message",
        title: data.decision === "approve" ? "Poză aprobată" : "Poză respinsă",
        body:
          data.decision === "approve"
            ? isAlbum
              ? "Poza ta din albumul privat a trecut de verificare."
              : "Poza ta a trecut de verificare și este acum vizibilă pe profil."
            : `Poza ta nu respectă regulile comunității${data.reason ? `: ${data.reason}` : "."}`,
        link: "/profile",
      });

      ok++;
    }


    await logAudit(sa, {
      actor_id: context.userId,
      action: data.decision === "approve" ? "photo.approve" : "photo.reject",
      target_table: "photo_reviews",
      target_id: null,
      after_data: { ids: data.ids, count: ok },
      justification: data.reason ?? null,
      severity: data.decision === "approve" ? "info" : "warning",
    });

    return { ok, total: data.ids.length };
  });

/* ---------------- INVITAȚII LA VERIFICARE (bulk sau per user) ---------------- */
const InviteInput = z.object({
  userIds: z.array(z.string().uuid()).max(500).optional(),
  allUnverified: z.boolean().optional(),
  message: z.string().max(300).optional(),
});

export const adminInviteVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    let targets: string[] = data.userIds ?? [];
    if (data.allUnverified) {
      const { data: rows, error } = await sa
        .from("profiles")
        .select("id")
        .is("deleted_at", null)
        .neq("age_status", "verified")
        .limit(500);
      if (error) throw new Error(error.message);
      targets = Array.from(new Set([...targets, ...(rows ?? []).map((r: any) => r.id)]));
    }
    if (!targets.length) return { sent: 0 };

    const body =
      data.message ??
      "Verifică-ți vârsta (18+) ca să poți trimite mesaje, tap-uri și să fii vizibil complet în aplicație. Durează sub un minut.";

    const chunks: string[][] = [];
    for (let i = 0; i < targets.length; i += 100) chunks.push(targets.slice(i, i + 100));
    let sent = 0;
    for (const chunk of chunks) {
      const { error } = await sa.from("notifications").insert(
        chunk.map((id) => ({
          user_id: id,
          type: "admin_message",
          title: "Invitație la verificare 18+",
          body,
          link: "/verify",
        })),
      );
      if (!error) sent += chunk.length;
    }

    await logAudit(sa, {
      actor_id: context.userId,
      action: "verification.invite",
      target_table: "profiles",
      after_data: { count: sent, all_unverified: !!data.allUnverified },
      severity: "info",
    });

    return { sent };
  });

/* ---------------- SCAN AI (staff) ----------------
 * Re-verifică pozele deja existente (profil + album privat) cu clasificatorul AI.
 * Orice suspiciune de minor / armă / sânge este scoasă IMEDIAT din vizibilitate
 * și trimisă la verificare umană. Nuditatea contează doar pe poza de profil.
 */
const ScanInput = z.object({
  scope: z.enum(["profile", "album", "both"]).default("both"),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(120).default(40),
  rescan: z.boolean().default(false),
});

export const adminScanPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScanInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifyPhoto } = await import("./photo-scan.server");
    const sa = supabaseAdmin as any;

    // paths deja trecute prin coadă (ca să nu re-plătim AI pe fiecare rulare)
    const seen = new Set<string>();
    if (!data.rescan) {
      let q = sa.from("photo_reviews").select("storage_path");
      if (data.userId) q = q.eq("user_id", data.userId);
      const { data: done } = await q.limit(5000);
      (done ?? []).forEach((r: any) => seen.add(r.storage_path));
    }

    type Target = { user_id: string; path: string; surface: "profile" | "album" };
    const targets: Target[] = [];

    if (data.scope !== "album") {
      let q = sa.from("profiles").select("id,photos").is("deleted_at", null);
      if (data.userId) q = q.eq("id", data.userId);
      const { data: profs, error } = await q.limit(2000);
      if (error) throw new Error(error.message);
      for (const p of profs ?? []) {
        for (const path of (Array.isArray(p.photos) ? p.photos : []) as string[]) {
          if (!seen.has(path)) targets.push({ user_id: p.id, path, surface: "profile" });
        }
      }
    }
    if (data.scope !== "profile") {
      let q = sa.from("private_albums").select("owner_id,photos");
      if (data.userId) q = q.eq("owner_id", data.userId);
      const { data: albs, error } = await q.limit(2000);
      if (error) throw new Error(error.message);
      for (const a of albs ?? []) {
        for (const path of (Array.isArray(a.photos) ? a.photos : []) as string[]) {
          if (!seen.has(path)) targets.push({ user_id: a.owner_id, path, surface: "album" });
        }
      }
    }

    const batch = targets.slice(0, data.limit);
    let scanned = 0;
    let flagged = 0;
    let critical = 0;
    const errors: string[] = [];

    for (const t of batch) {
      const bucket = t.surface === "album" ? "private-albums" : "profile-photos";
      const { data: signed } = await sa.storage.from(bucket).createSignedUrl(t.path, 600);
      if (!signed?.signedUrl) {
        errors.push(t.path);
        continue;
      }
      let verdict;
      try {
        verdict = await classifyPhoto(signed.signedUrl, t.surface);
      } catch (e) {
        errors.push((e as Error).message);
        continue;
      }
      scanned++;
      if (verdict.allowed) {
        // marcăm ca verificată automat, ca să nu re-scanăm la infinit
        await sa.from("photo_reviews").upsert(
          {
            user_id: t.user_id,
            storage_path: t.path,
            surface: t.surface,
            source: "scan",
            status: "approved",
            ai_allowed: true,
            ai_labels: verdict as any,
            severity: "normal",
            scanned_at: new Date().toISOString(),
            reviewed_by: null,
          },
          { onConflict: "storage_path" },
        );
        continue;
      }

      // scoate din vizibilitate imediat
      if (t.surface === "album") {
        const { data: alb } = await sa
          .from("private_albums")
          .select("photos")
          .eq("owner_id", t.user_id)
          .maybeSingle();
        const cur: string[] = Array.isArray(alb?.photos) ? alb.photos : [];
        if (cur.includes(t.path)) {
          await sa
            .from("private_albums")
            .update({ photos: cur.filter((p) => p !== t.path) })
            .eq("owner_id", t.user_id);
        }
      } else {
        const { data: prof } = await sa
          .from("profiles")
          .select("photos")
          .eq("id", t.user_id)
          .maybeSingle();
        const cur: string[] = Array.isArray(prof?.photos) ? prof.photos : [];
        if (cur.includes(t.path)) {
          await sa
            .from("profiles")
            .update({ photos: cur.filter((p) => p !== t.path) })
            .eq("id", t.user_id);
        }
      }

      await sa.from("photo_reviews").upsert(
        {
          user_id: t.user_id,
          storage_path: t.path,
          surface: t.surface,
          source: "scan",
          status: "pending",
          ai_allowed: false,
          ai_reason: verdict.reason,
          ai_labels: verdict as any,
          severity: verdict.severity,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "storage_path" },
      );
      flagged++;
      if (verdict.severity === "critical") critical++;
    }

    await logAudit(sa, {
      actor_id: context.userId,
      action: "photo.scan",
      target_table: "photo_reviews",
      after_data: {
        scope: data.scope,
        user_id: data.userId ?? null,
        scanned,
        flagged,
        critical,
        remaining: Math.max(0, targets.length - batch.length),
      },
      severity: critical > 0 ? "critical" : "info",
    });

    return {
      scanned,
      flagged,
      critical,
      remaining: Math.max(0, targets.length - batch.length),
      errors: errors.slice(0, 5),
    };
  });

/* ---------------- MODERARE UPLOAD ALBUM PRIVAT (user) ----------------
 * Albumul privat permite nuditate adultă, dar NU minori, arme sau sânge.
 * Poza încărcată e clasificată înainte de a intra în album; la refuz e ștearsă
 * din storage și rămâne urmă în coada de moderare.
 */
const AlbumCheckInput = z.object({ path: z.string().min(3).max(300) });

export const moderateAlbumUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AlbumCheckInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Poza trebuie să fie a ta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifyPhoto } = await import("./photo-scan.server");
    const sa = supabaseAdmin as any;

    const { data: signed } = await sa.storage
      .from("private-albums")
      .createSignedUrl(data.path, 600);
    if (!signed?.signedUrl) throw new Error("Poza nu a putut fi citită.");

    let verdict;
    try {
      verdict = await classifyPhoto(signed.signedUrl, "album");
    } catch {
      // fail-closed → trimitem la verificare umană
      await sa.from("photo_reviews").upsert(
        {
          user_id: context.userId,
          storage_path: data.path,
          surface: "album",
          source: "upload",
          status: "pending",
          ai_allowed: null,
          ai_reason: "Clasificare AI indisponibilă",
        },
        { onConflict: "storage_path" },
      );
      return { allowed: false, pending: true, reason: "Poza a fost trimisă la verificare umană." };
    }

    if (verdict.allowed) {
      await sa.from("photo_reviews").upsert(
        {
          user_id: context.userId,
          storage_path: data.path,
          surface: "album",
          source: "upload",
          status: "approved",
          ai_allowed: true,
          ai_labels: verdict as any,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "storage_path" },
      );
      return { allowed: true, pending: false, reason: "" };
    }

    await sa.storage.from("private-albums").remove([data.path]);
    await sa.from("photo_reviews").upsert(
      {
        user_id: context.userId,
        storage_path: data.path,
        surface: "album",
        source: "upload",
        status: "rejected",
        ai_allowed: false,
        ai_reason: verdict.reason,
        ai_labels: verdict as any,
        severity: verdict.severity,
        scanned_at: new Date().toISOString(),
      },
      { onConflict: "storage_path" },
    );
    await logAudit(sa, {
      actor_id: context.userId,
      action: "album.photo.blocked",
      target_table: "private_albums",
      target_id: context.userId,
      after_data: { labels: verdict, surface: "album" },
      severity: verdict.severity === "critical" ? "critical" : "warning",
    });
    return { allowed: false, pending: false, reason: verdict.reason };
  });

/* ---------------- MODERARE UPLOAD POZĂ DE PROFIL (user) ----------------
 * Politica: profilul public nu acceptă nuditate. Dacă poza este doar
 * "prea sexy" (nud adult, fără minori / arme / sânge), nu o aruncăm —
 * o mutăm automat în albumul privat al userului și îl anunțăm prietenos.
 */
const ProfileCheckInput = z.object({ path: z.string().min(3).max(300) });

export const moderateProfileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileCheckInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Poza trebuie să fie a ta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifyPhoto } = await import("./photo-scan.server");
    const sa = supabaseAdmin as any;

    const { data: signed } = await sa.storage
      .from("profile-photos")
      .createSignedUrl(data.path, 600);
    if (!signed?.signedUrl) throw new Error("Poza nu a putut fi citită.");

    let verdict: any = null;
    try {
      verdict = await classifyPhoto(signed.signedUrl, "profile");
    } catch {
      verdict = null;
    }

    // AI indisponibil → verificare umană
    if (!verdict) {
      await sa.from("photo_reviews").upsert(
        {
          user_id: context.userId,
          storage_path: data.path,
          surface: "profile",
          source: "upload",
          status: "pending",
          ai_allowed: null,
          ai_reason: "Clasificare AI indisponibilă",
        },
        { onConflict: "storage_path" },
      );
      return { outcome: "pending" as const, reason: "" };
    }

    // Interzis oriunde: minori, arme, sânge → ștergem
    if (verdict.minor || verdict.weapon || verdict.blood) {
      await sa.storage.from("profile-photos").remove([data.path]);
      await sa.from("photo_reviews").upsert(
        {
          user_id: context.userId,
          storage_path: data.path,
          surface: "profile",
          source: "upload",
          status: "rejected",
          ai_allowed: false,
          ai_reason: verdict.reason,
          ai_labels: verdict,
          severity: verdict.severity,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "storage_path" },
      );
      await logAudit(sa, {
        actor_id: context.userId,
        action: "profile.photo.blocked",
        target_table: "profiles",
        target_id: context.userId,
        after_data: { labels: verdict, surface: "profile" },
        severity: verdict.severity === "critical" ? "critical" : "warning",
      });
      return { outcome: "rejected" as const, reason: verdict.reason };
    }

    // Nud adult → mutăm în albumul privat
    if (verdict.nudity || verdict.sexual_act) {
      const dl = await sa.storage.from("profile-photos").download(data.path);
      if (dl.error || !dl.data) {
        await sa.storage.from("profile-photos").remove([data.path]);
        return { outcome: "rejected" as const, reason: "Poza nu a putut fi mutată." };
      }
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      const up = await sa.storage
        .from("private-albums")
        .upload(data.path, buf, { contentType: dl.data.type || "image/jpeg", upsert: true });
      await sa.storage.from("profile-photos").remove([data.path]);
      if (up.error) {
        return { outcome: "rejected" as const, reason: "Poza nu a putut fi mutată." };
      }

      const { data: alb } = await sa
        .from("private_albums")
        .select("photos")
        .eq("owner_id", context.userId)
        .maybeSingle();
      const cur: string[] = Array.isArray(alb?.photos) ? alb.photos : [];
      if (!cur.includes(data.path)) {
        await sa
          .from("private_albums")
          .upsert(
            { owner_id: context.userId, photos: [...cur, data.path] },
            { onConflict: "owner_id" },
          );
      }

      await sa.from("photo_reviews").upsert(
        {
          user_id: context.userId,
          storage_path: data.path,
          surface: "album",
          source: "upload",
          status: "approved",
          ai_allowed: true,
          ai_reason: "Mutată automat din profil în albumul privat (nud adult).",
          ai_labels: verdict,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "storage_path" },
      );

      return {
        outcome: "moved_to_album" as const,
        reason: verdict.reason || "Conținut pentru adulți.",
      };
    }

    // OK → coadă de verificare umană
    await sa.from("photo_reviews").upsert(
      {
        user_id: context.userId,
        storage_path: data.path,
        surface: "profile",
        source: "upload",
        status: "pending",
        ai_allowed: true,
        ai_labels: verdict,
        scanned_at: new Date().toISOString(),
      },
      { onConflict: "storage_path" },
    );
    return { outcome: "pending" as const, reason: "" };
  });
