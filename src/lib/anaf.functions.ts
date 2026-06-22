import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * ANAF public TVA lookup (Romania).
 * Free, no key required. Returns legal name, address, VAT status.
 * Docs: https://static.anaf.ro/static/10/Anaf/Informatii_R/WebServices/doc_WS_V9.txt
 */
export const lookupAnafCui = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      cui: z
        .string()
        .trim()
        .regex(/^(RO)?\d{2,10}$/i, "CUI invalid (ex: RO12345678 sau 12345678)")
        .transform((v) => v.toUpperCase().replace(/^RO/, "")),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify([{ cui: Number(data.cui), data: today }]);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    let json: any;
    try {
      const res = await fetch(
        "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body,
          signal: ctrl.signal,
        },
      );
      if (!res.ok) throw new Error(`ANAF HTTP ${res.status}`);
      json = await res.json();
    } catch (e) {
      clearTimeout(t);
      throw new Error("Serviciul ANAF nu răspunde acum. Completează manual.");
    }
    clearTimeout(t);

    const found = json?.found?.[0];
    if (!found) throw new Error("CUI inexistent în registrul ANAF");

    const gen = found.date_generale ?? {};
    const tva = found.inregistrare_scop_Tva ?? {};
    const adr = found.adresa_sediu_social ?? {};

    return {
      cui: `RO${data.cui}`,
      legal_name: (gen.denumire ?? "").trim(),
      reg_com: (gen.nrRegCom ?? "").trim(),
      vat_payer: !!tva.scpTVA,
      vat_number: tva.scpTVA ? `RO${data.cui}` : "",
      city: (adr.sdenumire_Localitate ?? "").trim(),
      county: (adr.sdenumire_Judet ?? "").trim(),
      address: [
        adr.sdenumire_Strada,
        adr.snumar_Strada && `nr. ${adr.snumar_Strada}`,
        adr.sdetalii_Adresa,
      ]
        .filter(Boolean)
        .join(", "),
      phone: (gen.telefon ?? "").trim(),
      status: (gen.stare_inregistrare ?? "").trim(),
    };
  });
