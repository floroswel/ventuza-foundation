// Support Tickets — server functions
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

/* ---------------- USER: creează ticket ---------------- */
const CreateTicketIn = z.object({
  category: z.enum(["account", "billing", "abuse", "safety", "bug", "feature", "partner", "other"]),
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(8000),
  relatedType: z.string().max(20).optional(),
  relatedId: z.string().max(120).optional(),
});
export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTicketIn.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: t, error } = await sb.from("support_tickets").insert({
      user_id: context.userId,
      category: data.category,
      subject: data.subject,
      related_type: data.relatedType ?? null,
      related_id: data.relatedId ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await sb.from("support_ticket_messages").insert({
      ticket_id: t.id, author_id: context.userId, author_role: "user", body: data.body,
    });
    if (mErr) throw new Error(mErr.message);
    return { id: t.id };
  });

/* ---------------- USER: listează + citește thread propriu ---------------- */
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("support_tickets")
      .select("id, subject, category, status, priority, last_msg_at, created_at")
      .eq("user_id", context.userId).order("last_msg_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------------- STAFF: listează inbox ---------------- */
const InboxQuery = z.object({
  status: z.enum(["open", "pending", "waiting_user", "resolved", "closed", "all"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent", "all"]).default("all"),
  assignee: z.string().uuid().nullable().optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
export const adminListTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InboxQuery.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    let q = sa.from("support_tickets")
      .select("id, user_id, subject, category, status, priority, assignee_id, first_response_at, last_msg_at, created_at", { count: "exact" })
      .order("last_msg_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.priority !== "all") q = q.eq("priority", data.priority);
    if (data.assignee) q = q.eq("assignee_id", data.assignee);
    if (data.search) q = q.ilike("subject", `%${data.search}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    // Enrich with user display_name (bulk)
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: p } = await sa.from("profiles").select("id, display_name").in("id", ids);
      names = new Map((p ?? []).map((x: any) => [x.id, x.display_name ?? "—"]));
    }
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, display_name: names.get(r.user_id) ?? "—" })),
      count: count ?? 0,
    };
  });

/* ---------------- STAFF/USER: thread ticket ---------------- */
export const getTicketThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: t, error } = await sb.from("support_tickets")
      .select("*").eq("id", data.ticketId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Ticket inexistent");
    const { data: msgs, error: mErr } = await sb.from("support_ticket_messages")
      .select("id, author_id, author_role, body, internal_note, created_at")
      .eq("ticket_id", data.ticketId).order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return { ticket: t, messages: msgs ?? [] };
  });

/* ---------------- POST reply (user sau staff) ---------------- */
const ReplyIn = z.object({
  ticketId: z.string().uuid(),
  body: z.string().min(1).max(8000),
  internalNote: z.boolean().default(false),
});
export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReplyIn.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: role } = await sb.rpc("is_staff", { _user_id: context.userId });
    const isStaff = !!role;
    if (data.internalNote && !isStaff) throw new Error("Doar staff-ul poate adăuga note interne");
    const { error } = await sb.from("support_ticket_messages").insert({
      ticket_id: data.ticketId, author_id: context.userId,
      author_role: isStaff ? "staff" : "user",
      body: data.body, internal_note: data.internalNote,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- STAFF: acțiune (status/prio/assign) ---------------- */
const ActionIn = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "pending", "waiting_user", "resolved", "closed"]).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable().optional(),
  assignee: z.string().uuid().nullable().optional(),
});
export const adminTicketAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActionIn.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("admin_staff_ticket_action", {
      _ticket_id: data.ticketId,
      _new_status: data.status ?? null,
      _assignee: data.assignee ?? null,
      _priority: data.priority ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- STAFF: KPI inbox ---------------- */
export const adminTicketStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const [{ count: open }, { count: urgent }, { count: unassigned }, { count: waiting }] = await Promise.all([
      sa.from("support_tickets").select("id", { head: true, count: "exact" }).eq("status", "open"),
      sa.from("support_tickets").select("id", { head: true, count: "exact" }).eq("priority", "urgent").in("status", ["open", "pending", "waiting_user"]),
      sa.from("support_tickets").select("id", { head: true, count: "exact" }).is("assignee_id", null).in("status", ["open", "pending"]),
      sa.from("support_tickets").select("id", { head: true, count: "exact" }).eq("status", "waiting_user"),
    ]);
    return { open: open ?? 0, urgent: urgent ?? 0, unassigned: unassigned ?? 0, waiting: waiting ?? 0 };
  });
