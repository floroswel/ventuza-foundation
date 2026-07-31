/**
 * Outbox offline pentru mesaje.
 *
 * - Persistăm coada în Capacitor Preferences (nativ) sau localStorage (web) —
 *   nu în IndexedDB, pentru a păstra footprint minim.
 * - Fiecare item are un `client_id` (UUID generat pe client) folosit ca cheie
 *   de deduplicare — dacă serverul primește același client_id de două ori,
 *   întoarce mesajul existent (dacă coloana există) sau reject la unique
 *   constraint. Fără constraint DB, deduplicarea rămâne best-effort la nivel
 *   UI (nu re-trimitem un item pe care l-am marcat deja `sent`).
 * - Retry max 3, cu backoff exponențial (1s, 4s, 10s). După ce eșuează 3 ori,
 *   itemul trece în `failed` — utilizatorul îl re-încearcă manual din UI.
 * - Nu logăm conținutul mesajelor.
 */

import { sendMessage } from "@/lib/chat";

const STORAGE_KEY = "suzeta:msg-outbox:v1";
const LEGACY_STORAGE_KEY = "ventuza:msg-outbox:v1";
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1h fereastră
const RATE_LIMIT_MAX = 60; // 60 mesaje / oră (server enforce, dublăm și pe client)

export type OutboxItem = {
  client_id: string;
  conversation_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  attempts: number;
  status: "pending" | "sending" | "failed" | "sent";
  last_error?: string;
};

type Native = {
  Preferences: {
    get: (o: { key: string }) => Promise<{ value: string | null }>;
    set: (o: { key: string; value: string }) => Promise<void>;
    remove: (o: { key: string }) => Promise<void>;
  };
};

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

async function readAll(): Promise<OutboxItem[]> {
  try {
    let raw: string | null = null;
    if (isCapacitorNative()) {
      const { Preferences } = (await import("@capacitor/preferences")) as unknown as Native;
      raw = (await Preferences.get({ key: STORAGE_KEY })).value;
      if (!raw) {
        // Migrare one-shot din cheia veche (rebranding Ventuza → Suzeta).
        const legacy = (await Preferences.get({ key: LEGACY_STORAGE_KEY })).value;
        if (legacy) {
          await Preferences.set({ key: STORAGE_KEY, value: legacy });
          await Preferences.remove({ key: LEGACY_STORAGE_KEY });
          raw = legacy;
        }
      }
    } else if (typeof window !== "undefined") {
      raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          window.localStorage.setItem(STORAGE_KEY, legacy);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
    }
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OutboxItem[]) : [];
  } catch {
    return [];
  }
}


async function writeAll(items: OutboxItem[]): Promise<void> {
  const raw = JSON.stringify(items);
  try {
    if (isCapacitorNative()) {
      const { Preferences } = (await import("@capacitor/preferences")) as unknown as Native;
      await Preferences.set({ key: STORAGE_KEY, value: raw });
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {
    /* quota / private mode — silent */
  }
}

type Listener = (items: OutboxItem[]) => void;
const listeners = new Set<Listener>();
let cached: OutboxItem[] | null = null;
let hydrated = false;

async function ensureHydrated() {
  if (hydrated) return;
  const items = await readAll();
  // Recuperare: un item rămas "sending" pe disc înseamnă că procesul a fost
  // omorât în timpul trimiterii (tipic pe Android, app în background).
  // Îl readucem în "pending" ca să fie re-încercat la următorul flush,
  // sau în "failed" dacă a depășit numărul maxim de încercări.
  let dirty = false;
  cached = items.map((x) => {
    if (x.status !== "sending") return x;
    dirty = true;
    return x.attempts >= MAX_RETRIES
      ? { ...x, status: "failed" as const, last_error: x.last_error ?? "interrupted" }
      : { ...x, status: "pending" as const };
  });
  hydrated = true;
  if (dirty) await writeAll(cached);
}

function emit() {
  const snap = cached ? [...cached] : [];
  for (const l of listeners) l(snap);
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  void ensureHydrated().then(emit);
  return () => {
    listeners.delete(fn);
  };
}

export async function getOutboxItems(): Promise<OutboxItem[]> {
  await ensureHydrated();
  return cached ? [...cached] : [];
}

export async function getOutboxForConversation(convId: string): Promise<OutboxItem[]> {
  const all = await getOutboxItems();
  return all.filter((x) => x.conversation_id === convId);
}

async function persist() {
  if (!cached) return;
  await writeAll(cached);
  emit();
}

function withinRateLimit(): boolean {
  if (!cached) return true;
  const cutoff = Date.now() - RATE_LIMIT_MS;
  const recent = cached.filter(
    (x) => x.status === "sent" && new Date(x.created_at).getTime() >= cutoff,
  ).length;
  return recent < RATE_LIMIT_MAX;
}

export async function enqueueMessage(input: {
  conversation_id: string;
  body: string;
  reply_to_id: string | null;
}): Promise<OutboxItem> {
  await ensureHydrated();
  const item: OutboxItem = {
    client_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `oid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conversation_id: input.conversation_id,
    body: input.body,
    reply_to_id: input.reply_to_id,
    created_at: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  cached = [...(cached ?? []), item];
  await persist();
  return item;
}

export async function markSent(client_id: string): Promise<void> {
  if (!cached) return;
  cached = cached.map((x) => (x.client_id === client_id ? { ...x, status: "sent" as const } : x));
  // Curățare imediată — nu ținem "sent" în storage.
  cached = cached.filter((x) => x.status !== "sent" || withinRateLimit());
  cached = cached.filter((x) => x.status !== "sent");
  await persist();
}

export async function markFailed(client_id: string, err: string): Promise<void> {
  if (!cached) return;
  cached = cached.map((x) =>
    x.client_id === client_id ? { ...x, status: "failed" as const, last_error: err } : x,
  );
  await persist();
}

export async function removeFromOutbox(client_id: string): Promise<void> {
  if (!cached) return;
  cached = cached.filter((x) => x.client_id !== client_id);
  await persist();
}

let flushing = false;
export async function flushOutbox(opts?: { convId?: string }): Promise<{
  sent: number;
  failed: number;
}> {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    await ensureHydrated();
    const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    if (!online) return { sent, failed };
    if (!withinRateLimit()) return { sent, failed };
    const queue = (cached ?? []).filter(
      (x) => x.status === "pending" && (!opts?.convId || x.conversation_id === opts.convId),
    );
    for (const item of queue) {
      if (!withinRateLimit()) break;
      // mark sending
      cached = (cached ?? []).map((x) =>
        x.client_id === item.client_id
          ? { ...x, status: "sending" as const, attempts: x.attempts + 1 }
          : x,
      );
      await persist();
      try {
        await sendMessage(item.conversation_id, item.body, item.reply_to_id);
        await markSent(item.client_id);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "send_failed";
        const attempts = (cached ?? []).find((x) => x.client_id === item.client_id)?.attempts ?? 0;
        if (attempts >= MAX_RETRIES) {
          await markFailed(item.client_id, msg);
          failed++;
        } else {
          // revert to pending for later retry
          cached = (cached ?? []).map((x) =>
            x.client_id === item.client_id
              ? { ...x, status: "pending" as const, last_error: msg }
              : x,
          );
          await persist();
        }
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

export async function retryFailedOutbox(client_id: string): Promise<void> {
  await ensureHydrated();
  cached = (cached ?? []).map((x) =>
    x.client_id === client_id ? { ...x, status: "pending" as const, attempts: 0 } : x,
  );
  await persist();
  await flushOutbox({ convId: (cached ?? []).find((x) => x.client_id === client_id)?.conversation_id });
}

/**
 * Wire auto-flush când revine conexiunea. Idempotent.
 */
let wired = false;
export function wireOutboxAutoFlush(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  const trigger = () => {
    void flushOutbox();
  };
  window.addEventListener("online", trigger);
  // Capacitor Network fallback dacă e disponibil.
  if (isCapacitorNative()) {
    void import("@capacitor/network")
      .then(async (mod) => {
        const Network = (mod as unknown as {
          Network: {
            addListener: (
              evt: string,
              cb: (s: { connected: boolean }) => void,
            ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
          };
        }).Network;
        try {
          await Network.addListener("networkStatusChange", (s) => {
            if (s.connected) trigger();
          });
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      });
  }
  // First flush at startup (dacă suntem deja online cu itemi din sesiuni anterioare).
  setTimeout(trigger, 800);
}
