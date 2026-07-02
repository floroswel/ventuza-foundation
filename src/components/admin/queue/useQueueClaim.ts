// Sprint A — claim/heartbeat/release hook (auto-heartbeat cât timp componenta e montată)
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { claimQueueItem, heartbeatQueueClaim, releaseQueueItem } from "@/lib/admin-queue.functions";

type QueueName =
  | "reports"
  | "appeals"
  | "csam"
  | "dsa"
  | "gdpr"
  | "partners"
  | "support"
  | "riskqueue"
  | "breach"
  | "ncmec";

export type ClaimState = {
  loading: boolean;
  mine: boolean;
  actorId: string | null;
  expiresAt: string | null;
  claim: () => Promise<void>;
  release: () => Promise<void>;
};

/**
 * Auto-claim on mount, heartbeat la 2 min, release on unmount.
 * Dacă itemul e revendicat de altul, `mine=false` și heartbeat-ul e oprit.
 */
export function useQueueClaim(
  queue: QueueName,
  itemId: string | null,
  opts?: { autoClaim?: boolean; ttlSeconds?: number },
): ClaimState {
  const { autoClaim = true, ttlSeconds = 600 } = opts ?? {};
  const claimFn = useServerFn(claimQueueItem);
  const hbFn = useServerFn(heartbeatQueueClaim);
  const relFn = useServerFn(releaseQueueItem);

  const [state, setState] = useState<{
    mine: boolean;
    actorId: string | null;
    expiresAt: string | null;
    loading: boolean;
  }>({
    mine: false,
    actorId: null,
    expiresAt: null,
    loading: false,
  });
  const mineRef = useRef(false);

  const doClaim = useCallback(async () => {
    if (!itemId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await claimFn({ data: { queue, itemId, ttlSeconds } });
      mineRef.current = r.mine;
      setState({ mine: r.mine, actorId: r.actorId, expiresAt: r.expiresAt, loading: false });
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false }));
      toast.error(e?.message ?? "Nu am putut revendica itemul");
    }
  }, [claimFn, queue, itemId, ttlSeconds]);

  const doRelease = useCallback(async () => {
    if (!itemId || !mineRef.current) return;
    try {
      await relFn({ data: { queue, itemId } });
      mineRef.current = false;
      setState({ mine: false, actorId: null, expiresAt: null, loading: false });
    } catch {
      /* swallow */
    }
  }, [relFn, queue, itemId]);

  useEffect(() => {
    if (!itemId || !autoClaim) return;
    void doClaim();
    return () => {
      void doRelease();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, autoClaim]);

  // heartbeat la 2 min
  useEffect(() => {
    if (!itemId) return;
    const t = setInterval(() => {
      if (!mineRef.current) return;
      hbFn({ data: { queue, itemId, ttlSeconds } })
        .then((r) => r.expiresAt && setState((s) => ({ ...s, expiresAt: r.expiresAt })))
        .catch(() => {
          /* silent */
        });
    }, 120_000);
    return () => clearInterval(t);
  }, [hbFn, queue, itemId, ttlSeconds]);

  return { ...state, claim: doClaim, release: doRelease };
}
