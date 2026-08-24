import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

export type WalletLedgerEntry = {
  amount_cents: number;
  kind: string;
  status: "available" | "pending";
  note: string | null;
  created_at: string;
};

export type WalletState = {
  balance_cents: number;
  pending_cents: number;
  lifetime_cents: number;
  currency: string;
  referrals_total: number;
  referrals_confirmed: number;
  ledger: WalletLedgerEntry[];
};

export type MerchItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
};

export type MerchOrder = {
  id: string;
  qty: number;
  total_cents: number;
  status: string;
  created_at: string;
  merch_items?: { name: string } | null;
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ledgerLabel(e: WalletLedgerEntry): string {
  if (e.note) return e.note;
  if (e.kind === "referral_bonus") return "Invitație acceptată";
  if (e.kind === "referral_welcome") return "Bonus bun venit";
  if (e.kind.startsWith("referral_milestone")) return "Bonus prag invitații";
  if (e.kind === "merch_order") return "Comandă produs Suzeta";
  return e.kind;
}

export async function fetchWallet(): Promise<WalletState | null> {
  const { data, error } = await db.rpc("get_my_wallet");
  if (error) return null;
  return data as WalletState;
}

export async function fetchMerch(): Promise<MerchItem[]> {
  const { data, error } = await db
    .from("merch_items")
    .select("id,slug,name,description,price_cents,image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as MerchItem[];
}

export async function fetchMyOrders(): Promise<MerchOrder[]> {
  const { data, error } = await db
    .from("merch_orders")
    .select("id,qty,total_cents,status,created_at,merch_items(name)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as MerchOrder[];
}

export type Shipping = { name: string; address: string; city: string; country: string; phone?: string };

export async function placeMerchOrder(
  slug: string,
  qty: number,
  shipping: Shipping,
): Promise<{ ok: boolean; error?: string; order_id?: string }> {
  const { data, error } = await db.rpc("place_merch_order", {
    _slug: slug,
    _qty: qty,
    _shipping: shipping,
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string; order_id?: string };
}

export const ORDER_ERRORS: Record<string, string> = {
  not_authenticated: "Trebuie să fii autentificat.",
  invalid_qty: "Cantitate invalidă (1–5).",
  invalid_item: "Produsul nu mai este disponibil.",
  shipping_incomplete: "Completează datele de livrare.",
  insufficient_funds: "Nu ai suficienți dolari în portofel.",
  below_min_redeem: "Ai nevoie de minim $25.00 în portofel ca să comanzi.",
  not_completed: "Misiunea nu e finalizată încă.",
  already_claimed: "Ai revendicat deja recompensa.",
  invalid_quest: "Misiune inexistentă.",
};

// ===== Misiuni cu credite =====
export type WalletQuest = {
  key: string;
  label: string;
  cents: number;
  done: boolean;
  claimed: boolean;
};

export async function fetchWalletQuests(): Promise<WalletQuest[]> {
  const { data, error } = await db.rpc("get_my_wallet_quests");
  if (error) return [];
  return (data ?? []) as WalletQuest[];
}

export async function claimWalletQuest(
  key: string,
): Promise<{ ok: boolean; cents?: number; error?: string }> {
  const { data, error } = await db.rpc("claim_wallet_quest", { _key: key });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; cents?: number; error?: string };
}

// ===== Leaderboard ambasadori =====
export type AmbassadorRow = {
  rank: number;
  invites: number;
  is_me: boolean;
  display_name: string;
  photo: string | null;
};

export async function fetchAmbassadors(
  limit = 20,
): Promise<{ rows: AmbassadorRow[]; me: { rank: number | null; invites: number } }> {
  const { data, error } = await db.rpc("get_ambassador_leaderboard", { _limit: limit });
  if (error) return { rows: [], me: { rank: null, invites: 0 } };
  return data as { rows: AmbassadorRow[]; me: { rank: number | null; invites: number } };
}

export const MIN_REDEEM_CENTS = 2500;

export function ambassadorTier(invites: number): { label: string; next: number | null } {
  if (invites >= 25) return { label: "Ambasador de oraș", next: null };
  if (invites >= 10) return { label: "Ambasador Gold", next: 25 };
  if (invites >= 5) return { label: "Ambasador", next: 10 };
  return { label: "Membru", next: 5 };
}
