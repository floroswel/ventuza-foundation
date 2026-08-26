/**
 * Overrides de traducere aplicate la runtime.
 *
 * Textele livrate în build rămân sursa de bază; peste ele se aplică patch-ul
 * salvat în `app_settings.i18n_overrides` (editat din panoul admin „Traduceri”
 * prin export/import de fișier). Astfel o corectură de copy nu are nevoie de
 * o nouă versiune de aplicație.
 *
 * Formatul valorii din DB:
 *   { "de": { "common.save": "Speichern", ... }, "hu": { ... } }
 * (chei plate „secțiune.cheie”, exact ca în fișierul exportat).
 */

import i18n from "@/lib/i18n";
import { APP_LANGUAGE_CODES } from "@/locales";
import { unflatten, type FlatDict } from "./dictionary-io";

const CACHE_KEY = "vz-i18n-overrides";
export const I18N_OVERRIDES_SETTING_KEY = "i18n_overrides";

export type OverridesMap = Record<string, FlatDict>;

function applyToI18n(map: OverridesMap) {
  for (const [code, flat] of Object.entries(map)) {
    if (!(APP_LANGUAGE_CODES as readonly string[]).includes(code)) continue;
    if (!flat || typeof flat !== "object") continue;
    i18n.addResourceBundle(code, "translation", unflatten(flat), true, true);
  }
  if (i18n.isInitialized) void i18n.reloadResources();
  i18n.emit("languageChanged", i18n.language);
}

function readCache(): OverridesMap | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as OverridesMap) : null;
  } catch {
    return null;
  }
}

/** Aplică imediat cache-ul local, apoi reîmprospătează din DB (non-blocant). */
export async function loadI18nOverrides(): Promise<void> {
  if (typeof window === "undefined") return;
  const cached = readCache();
  if (cached) {
    try {
      applyToI18n(cached);
    } catch {
      /* dicționar corupt local — îl vom rescrie din DB */
    }
  }
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", I18N_OVERRIDES_SETTING_KEY)
      .maybeSingle();
    const value = (data?.value ?? null) as OverridesMap | null;
    if (value && typeof value === "object") {
      applyToI18n(value);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(value));
      } catch {
        /* storage plin */
      }
    }
  } catch {
    /* offline → rămân textele din build + cache */
  }
}
