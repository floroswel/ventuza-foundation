import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickVariant(variants: string[], weights: number[], seed: string): string {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const r = ((hashStr(seed) % 10000) / 10000) * total;
  let acc = 0;
  for (let i = 0; i < variants.length; i++) {
    acc += weights[i];
    if (r <= acc) return variants[i];
  }
  return variants[0];
}

export function useExperiment(key: string, fallback = "control"): string {
  const { user } = useAuth();
  const [variant, setVariant] = useState<string>(fallback);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: exp } = await supabase
        .from("experiments")
        .select("variants, weights, status")
        .eq("key", key)
        .maybeSingle();
      if (!exp || exp.status !== "running") return;
      const variants = (exp.variants as string[]) ?? ["control", "treatment"];
      const weights = (exp.weights as number[]) ?? [50, 50];

      const { data: existing } = await supabase
        .from("experiment_assignments")
        .select("variant")
        .eq("experiment_key", key)
        .eq("user_id", user.id)
        .maybeSingle();

      let v = existing?.variant;
      if (!v) {
        v = pickVariant(variants, weights, `${key}:${user.id}`);
        await supabase
          .from("experiment_assignments")
          .insert({ experiment_key: key, user_id: user.id, variant: v });
      }
      if (!cancelled) setVariant(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, user]);

  return variant;
}

export async function trackExperiment(key: string, event: string, value?: number) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: assignment } = await supabase
    .from("experiment_assignments")
    .select("variant")
    .eq("experiment_key", key)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!assignment) return;
  await supabase.from("experiment_events").insert({
    experiment_key: key,
    variant: assignment.variant,
    user_id: u.user.id,
    event,
    value: value ?? null,
  });
}
