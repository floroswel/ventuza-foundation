import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { APP_LANGUAGE_CODES } from "@/locales";
import { pickFromAcceptLanguage } from "./accept-language";

/**
 * Limba preferată a vizitatorului, dedusă din `Accept-Language`.
 * Rulează la SSR ca `<html lang>` și prima randare să fie deja corecte.
 */
export const getPreferredLanguage = createServerFn({ method: "GET" }).handler(async () => {
  let header: string | null = null;
  try {
    header = getRequestHeader("accept-language") ?? null;
  } catch {
    /* prerender fără request */
  }
  return { language: pickFromAcceptLanguage(header, APP_LANGUAGE_CODES, "en") };
});
