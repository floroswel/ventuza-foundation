// Sprint A — Queue claim/lock + SLA server functions
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QueueName = z.enum([
  "reports", "appeals", "csam", "dsa", "gdpr",
  "partners", "support", "riskqueue", "breach", "ncmec",
]);

export const claimQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ queue: QueueName, itemId: z.string().min(1).max(120), ttlSeconds: z.number().int().min(60).max(3600).default(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("claim_queue_item", {
      _queue: data.queue, _item_id: data.itemId, _ttl_seconds: data.ttlSeconds,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      actorId: row?.actor_id as string | null,
      claimedAt: row?.claimed_at as string | null,
      expiresAt: row?.expires_at as string | null,
      mine: row?.actor_id === context.userId,
    };
  });

export const heartbeatQueueClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ queue: QueueName, itemId: z.string().min(1).max(120), ttlSeconds: z.number().int().min(60).max(3600).default(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: exp, error } = await context.supabase.rpc("heartbeat_queue_claim", {
      _queue: data.queue, _item_id: data.itemId, _ttl_seconds: data.ttlSeconds,
    });
    if (error) throw new Error(error.message);
    return { expiresAt: exp as string | null };
  });

export const releaseQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ queue: QueueName, itemId: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("release_queue_item", {
      _queue: data.queue, _item_id: data.itemId,
    });
    if (error) throw new Error(error.message);
    return { released: !!ok };
  });

export const listQueueClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ queue: QueueName }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("list_queue_claims", { _queue: data.queue });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      item_id: string; actor_id: string; display_name: string;
      claimed_at: string; expires_at: string;
    }>;
  });

export const getSlaThresholds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings").select("value").eq("key", "sla_thresholds").maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.value ?? {}) as Record<string, { warn_minutes: number; breach_minutes: number }>;
  });
