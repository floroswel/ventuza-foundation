/**
 * Source of truth for partner posting UI: field schema, hints, placeholders,
 * min/max, examples. Mirrors the zod validators in `partner.functions.ts`
 * (server-side validation is the real gate; this drives the wizard UX).
 *
 * AGENTS.md — REGULĂ WIZARD PARTENER.
 */

export type PartnerFieldType =
  | "text"
  | "textarea"
  | "number"
  | "datetime-local"
  | "url"
  | "phone"
  | "select"
  | "image";

export interface PartnerField {
  key: string;
  label: string;
  type: PartnerFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  example?: string | number;
}

export interface PartnerTemplate {
  kind: "venue" | "event" | "offer";
  label: string;
  emoji: string;
  shortDescription: string;
  whenToUse: string;
  fields: PartnerField[];
  /** A full example partners can preview / pre-fill. */
  example: Record<string, string | number>;
}

export const VENUE_TEMPLATE: PartnerTemplate = {
  kind: "venue",
  label: "Local (permanent)",
  emoji: "🏠",
  shortDescription:
    "Un loc fizic care există tot timpul: bar, club, cafenea, restaurant, sală de evenimente.",
  whenToUse:
    "Folosește dacă ai un spațiu deschis în mod regulat, cu adresă fixă. Pentru promoții temporare folosește Ofertă; pentru o seară anume, Eveniment.",
  fields: [
    {
      key: "name",
      label: "Nume loc",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 120,
      placeholder: "Ex: Queens Club București",
      hint: "Numele așa cum vrei să apară pe hartă și în Nearby.",
    },
    {
      key: "category",
      label: "Categorie",
      type: "select",
      required: true,
      hint: "Cea mai bună potrivire — userii filtrează după asta.",
      options: [
        { value: "bar", label: "Bar" },
        { value: "club", label: "Club" },
        { value: "cafe", label: "Cafenea" },
        { value: "restaurant", label: "Restaurant" },
        { value: "sauna", label: "Saună / spa" },
        { value: "shop", label: "Magazin" },
        { value: "community", label: "Spațiu comunitar" },
        { value: "other", label: "Altceva" },
      ],
    },
    {
      key: "city",
      label: "Oraș",
      type: "text",
      required: true,
      maxLength: 120,
      placeholder: "București",
    },
    {
      key: "address",
      label: "Adresă",
      type: "text",
      maxLength: 300,
      placeholder: "Str. Lipscani 25, Sector 3",
      hint: "Vizibilă doar după ce userul deschide cardul.",
    },
    {
      key: "description",
      label: "Descriere",
      type: "textarea",
      required: true,
      minLength: 50,
      maxLength: 1500,
      hint: "Ce face localul special? Atmosfera, publicul, ce găsești acolo. Minim 50 caractere.",
      placeholder:
        "Bar prietenos LGBTQ+, deschis din 2018, cu program de drag în fiecare vineri. Cocktailuri craft, terasă deschisă vara, eveniment Pride lunar...",
    },
    {
      key: "website",
      label: "Website",
      type: "url",
      placeholder: "https://...",
    },
    {
      key: "phone_e164",
      label: "Telefon",
      type: "phone",
      placeholder: "+40712345678",
      hint: "Format internațional (+40...).",
    },
    {
      key: "cover_url",
      label: "Imagine de copertă",
      type: "image",
      required: true,
      hint: "Recomandat 1200×800, peisaj. JPG/PNG/WebP, max 5 MB. Fără logo gigantic — arată locul.",
    },
  ],
  example: {
    name: "Queens Club București",
    category: "club",
    city: "București",
    address: "Str. Lipscani 25, Sector 3",
    description:
      "Club LGBTQ+ deschis din 2018, cu spațiu generos pe două etaje. Program de drag în fiecare vineri, vineri Disco anii '80, sâmbătă seară techno. Terasă deschisă vara, cocktailuri craft, ringuri separate. Eveniment Pride lunar, weekend tematic la sfârșit de lună.",
    website: "https://queensclub.ro",
    phone_e164: "+40212345678",
  },
};

export const EVENT_TEMPLATE: PartnerTemplate = {
  kind: "event",
  label: "Eveniment (cu dată)",
  emoji: "🎉",
  shortDescription:
    "O întâmplare cu început și sfârșit clar: petrecere, lansare, atelier, marș Pride, screening.",
  whenToUse:
    "Folosește dacă are dată și oră. Userii primesc notificare în Nearby în ziua respectivă, dacă sunt în rază.",
  fields: [
    {
      key: "title",
      label: "Titlu eveniment",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 160,
      placeholder: "Ex: Drag Night vol. 12 — tematică „90s Pop”",
      hint: "Scurt, clar, cu atracția principală.",
    },
    {
      key: "event_type",
      label: "Tip",
      type: "select",
      required: true,
      options: [
        { value: "party", label: "Petrecere / club" },
        { value: "drag", label: "Drag show" },
        { value: "pride", label: "Pride / marș" },
        { value: "workshop", label: "Atelier" },
        { value: "talk", label: "Discuție / panel" },
        { value: "screening", label: "Film / proiecție" },
        { value: "support", label: "Grup de sprijin" },
        { value: "other", label: "Altceva" },
      ],
    },
    {
      key: "starts_at",
      label: "Început",
      type: "datetime-local",
      required: true,
      hint: "Data și ora de start.",
    },
    {
      key: "ends_at",
      label: "Sfârșit",
      type: "datetime-local",
      hint: "Opțional. Ajută userii să-și planifice.",
    },
    {
      key: "venue",
      label: "Loc",
      type: "text",
      maxLength: 200,
      placeholder: "Queens Club, etajul 1",
    },
    {
      key: "city",
      label: "Oraș",
      type: "text",
      required: true,
      maxLength: 120,
      placeholder: "București",
    },
    {
      key: "description",
      label: "Descriere",
      type: "textarea",
      required: true,
      minLength: 80,
      maxLength: 2000,
      hint: "Structură sugerată: CE • PENTRU CINE • DE CE SĂ VII. Minim 80 caractere.",
      placeholder:
        "Ce: Drag show cu 5 performeri locali + DJ set techno după.\nPentru cine: comunitate LGBTQ+ și prieteni 18+, primitor pentru începători.\nDe ce să vii: line-up exclusiv, premii din partea sponsorilor, after până la 5 dimineața.",
    },
    {
      key: "max_attendees",
      label: "Capacitate",
      type: "number",
      min: 1,
      max: 100000,
      placeholder: "200",
      hint: "Opțional — limită maximă. Folosit doar pentru afișare, nu blochează intrarea.",
    },
    {
      key: "cover_url",
      label: "Imagine afiș",
      type: "image",
      required: true,
      hint: "Afișul evenimentului. Text pe imagine permis (titlu, dată).",
    },
  ],
  example: {
    title: "Drag Night vol. 12 — tematică „90s Pop”",
    event_type: "drag",
    starts_at: "",
    venue: "Queens Club, etajul 1",
    city: "București",
    description:
      "Ce: 5 performeri locali (Lola Vavoom, Mister X, Anastasia Glam și surprize), urmat de DJ set techno până la 5 dimineața.\nPentru cine: comunitate LGBTQ+ 18+, prieteni allies, primitor pentru începători.\nDe ce să vii: line-up exclusiv București, premii (cocktailuri + invitații), after până dimineața. Intrare 30 lei la ușă, gratuit cu costum tematic.",
    max_attendees: 200,
  },
};

export const OFFER_TEMPLATE: PartnerTemplate = {
  kind: "offer",
  label: "Ofertă (promoție)",
  emoji: "🎁",
  shortDescription:
    "O promoție pe care utilizatorii o revendică în aplicație și o folosesc la tine în loc.",
  whenToUse:
    "Folosește pentru discount-uri, drink gratuit la prezentare, happy hour, vouchere. Trebuie atașată unui Loc al tău.",
  fields: [
    {
      key: "venue_id",
      label: "Loc",
      type: "select",
      required: true,
      hint: "Trebuie să fie un loc al tău, aprobat.",
    },
    {
      key: "title",
      label: "Titlu ofertă",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 160,
      placeholder: "Ex: Primul cocktail GRATIS la prezentare",
      hint: "Beneficiul direct, scurt.",
    },
    {
      key: "description",
      label: "Ce primește userul",
      type: "textarea",
      required: true,
      minLength: 30,
      maxLength: 800,
      hint: "Exact ce câștigă userul. Min 30 caractere.",
      placeholder:
        "Un cocktail signature (la alegere din meniul Pride) GRATUIT la prima vizită. Valabil o singură dată per persoană.",
    },
    {
      key: "terms",
      label: "Condiții",
      type: "textarea",
      required: true,
      minLength: 20,
      maxLength: 800,
      hint: "Cum se revendică, ce nu acoperă, limitări. Min 20 caractere.",
      placeholder:
        "Arată codul din aplicație barmanului ÎNAINTE de comandă. Doar miercuri-duminică, 19:00-23:00. Nu se cumulează cu alte oferte. 18+, ID la cerere.",
    },
    {
      key: "valid_from",
      label: "Valabil de la",
      type: "datetime-local",
      required: true,
    },
    {
      key: "valid_to",
      label: "Valabil până la",
      type: "datetime-local",
      required: true,
      hint: "Oferta dispare automat după această dată.",
    },
    {
      key: "max_claims_per_user",
      label: "Max revendicări per user",
      type: "number",
      min: 1,
      max: 100,
      placeholder: "1",
      hint: "Cât poate revendica același user. Default 1.",
    },
  ],
  example: {
    title: "Primul cocktail GRATIS la prezentare",
    description:
      "Un cocktail signature (la alegere din meniul Pride) GRATUIT la prima vizită. Valabil o singură dată per persoană.",
    terms:
      "Arată codul din aplicație barmanului ÎNAINTE de comandă. Doar miercuri-duminică, 19:00-23:00. Nu se cumulează cu alte oferte. 18+, ID la cerere.",
    max_claims_per_user: 1,
  },
};

export const PARTNER_TEMPLATES = {
  venue: VENUE_TEMPLATE,
  event: EVENT_TEMPLATE,
  offer: OFFER_TEMPLATE,
} as const;

export type PartnerKind = keyof typeof PARTNER_TEMPLATES;

/** Validate a form value object against a template. Returns array of issues. */
export function validateTemplate(
  template: PartnerTemplate,
  values: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  for (const f of template.fields) {
    const v = values[f.key];
    const empty = v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
    if (f.required && empty) {
      issues.push(`${f.label}: obligatoriu`);
      continue;
    }
    if (empty) continue;
    if (typeof v === "string") {
      if (f.minLength && v.trim().length < f.minLength)
        issues.push(`${f.label}: minim ${f.minLength} caractere`);
      if (f.maxLength && v.length > f.maxLength)
        issues.push(`${f.label}: maxim ${f.maxLength} caractere`);
      if (f.type === "url" && !/^https?:\/\//i.test(v))
        issues.push(`${f.label}: URL invalid (începe cu https://)`);
      if (f.type === "phone" && !/^\+?[1-9]\d{6,14}$/.test(v))
        issues.push(`${f.label}: telefon invalid (format +40...)`);
    }
    if (typeof v === "number") {
      if (f.min != null && v < f.min) issues.push(`${f.label}: min ${f.min}`);
      if (f.max != null && v > f.max) issues.push(`${f.label}: max ${f.max}`);
    }
  }
  return issues;
}
