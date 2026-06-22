import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  note: z.string().max(500).optional(),
});

/** Logs an SOS event. Contacts are read from the user's profile and recorded with the event. */
export const triggerSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("sos_contacts, display_name")
      .eq("id", userId)
      .maybeSingle();

    const contacts = (profile?.sos_contacts as Array<{ name?: string; phone?: string; email?: string }> | null) ?? [];

    const { data: row, error } = await supabase
      .from("sos_events")
      .insert({
        user_id: userId,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        city: data.city ?? null,
        note: data.note ?? null,
        contacts_notified: contacts,
      })
      .select("id, triggered_at")
      .single();
    if (error) throw error;

    // Build pre-filled SMS/email links so the *client* can open them with native handlers.
    const loc =
      data.latitude != null && data.longitude != null
        ? `https://maps.google.com/?q=${data.latitude},${data.longitude}`
        : "(locație indisponibilă)";
    const who = profile?.display_name ?? "Un prieten";
    const body = `${who} a apăsat SOS pe Ventuza.${data.note ? " Mesaj: " + data.note : ""} Locație: ${loc} • Apel-te imediat.`;

    return { id: row.id, triggered_at: row.triggered_at, contacts, message: body };
  });
