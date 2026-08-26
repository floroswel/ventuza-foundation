import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BearerSupabaseContext = {
  supabase: SupabaseClient<Database>;
  user: User;
};

function envValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing on server env`);
  return value;
}

export async function getBearerSupabaseContext(
  request: Request,
): Promise<{ ok: true; context: BearerSupabaseContext } | { ok: false; response: Response }> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };

  const supabase = createClient<Database>(envValue("SUPABASE_URL"), envValue("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  return { ok: true, context: { supabase, user: data.user } };
}
