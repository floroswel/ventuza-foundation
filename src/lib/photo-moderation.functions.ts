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
  limit: z.number().int().min(1).max(200).default(60),
});

export const adminListPhotoReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const { data: rows, error } = await sa
      .from("photo_reviews")
      .select("id,user_id,storage_path,status,ai_allowed,ai_reason,reason,created_at,reviewed_at")
      .eq("status", data.status)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const names: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await sa
        .from("profiles")
        .select("id,display_name,age_status,verified,created_at,report_count")
        .in("id", ids);
      (profs ?? []).forEach((p: any) => (names[p.id] = p));
    }

    const paths = (rows ?? []).map((r: any) => r.storage_path);
    const urlByPath: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await sa.storage
        .from("profile-photos")
        .createSignedUrls(paths, 900);
      (signed ?? []).forEach((s: any, i: number) => {
        if (s?.signedUrl) urlByPath[paths[i]] = s.signedUrl;
      });
    }

    const { count: pendingCount } = await sa
      .from("photo_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        url: urlByPath[r.storage_path] ?? null,
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
      .select("id,user_id,storage_path,status")
      .in("id", data.ids)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    let ok = 0;
    for (const r of rows ?? []) {
      if (data.decision === "approve") {
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
      } else {
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
            ? "Poza ta a trecut de verificare și este acum vizibilă pe profil."
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
