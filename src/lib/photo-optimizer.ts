/**
 * Reprocesarea pozelor deja urcate.
 *
 * Pozele vechi au fost urcate direct din cameră (3–6 MB, 4000px) și se
 * descarcă integral la fiecare afișare. Aici le recomprimăm la maxim 1440px
 * JPEG 80% și le rescriem PESTE aceeași cale din storage, deci:
 *   - `profiles.photos` rămâne neschimbat (zero migrare de date),
 *   - UX-ul rămâne identic (nimic vizibil pentru user),
 *   - se rulează doar pe device-ul proprietarului, în idle, o singură dată
 *     per poză (marcaj în localStorage).
 *
 * Rulare strict client-side: Worker-ul nu are `sharp`, iar canvas-ul din
 * browser face exact aceeași treabă gratis.
 */

import { supabase } from "@/integrations/supabase/client";
import { compressImageForChat } from "@/lib/image-compress";
import { getSignedUrl } from "@/lib/signed-url-cache";

const DONE_KEY = "suzeta:photos-optimized:v1";
const MAX_DIM = 1440;
const QUALITY = 0.8;
/** Sub acest prag nu are rost să reprocesăm. */
const SIZE_THRESHOLD = 350 * 1024;

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDone(set: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* noop */
  }
}

async function optimizeOne(path: string): Promise<"skipped" | "optimized" | "failed"> {
  const url = await getSignedUrl("profile-photos", path, 600);
  if (!url) return "failed";

  const res = await fetch(url);
  if (!res.ok) return "failed";
  const original = await res.blob();
  if (original.size < SIZE_THRESHOLD) return "skipped";

  const compressed = await compressImageForChat(original, {
    maxDim: MAX_DIM,
    quality: QUALITY,
    forceJpeg: true,
  });
  if (!compressed || compressed.size === 0 || compressed.size >= original.size) return "skipped";

  const { error } = await supabase.storage.from("profile-photos").upload(path, compressed, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) return "failed";
  return "optimized";
}

/**
 * Reprocesează pozele proprii care încă sunt prea mari.
 * Rulează secvențial și lent intenționat, ca să nu concureze cu boot-ul.
 */
export async function optimizeExistingPhotos(
  photos: string[] | null | undefined,
  opts: { max?: number } = {},
): Promise<{ optimized: number; skipped: number; failed: number }> {
  const stats = { optimized: 0, skipped: 0, failed: 0 };
  if (typeof window === "undefined" || !photos?.length) return stats;

  const done = loadDone();
  const todo = photos.filter((p) => p && !done.has(p)).slice(0, opts.max ?? 3);
  if (!todo.length) return stats;

  for (const path of todo) {
    try {
      const result = await optimizeOne(path);
      stats[result === "optimized" ? "optimized" : result === "skipped" ? "skipped" : "failed"]++;
      if (result !== "failed") done.add(path);
    } catch {
      stats.failed++;
    }
  }
  saveDone(done);
  return stats;
}

/** Pornește reprocesarea când firul principal e liber. */
export function schedulephotoOptimization(photos: string[] | null | undefined) {
  if (typeof window === "undefined" || !photos?.length) return;
  const run = () => void optimizeExistingPhotos(photos);
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 10_000 });
  else window.setTimeout(run, 5_000);
}
