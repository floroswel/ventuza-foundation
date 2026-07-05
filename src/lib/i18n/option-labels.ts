// Dictionary for profile option labels.
// Key = canonical English value stored in DB. Value = { locale: label }.
// Fallback: if a locale is missing, we return the canonical English key.
// Add new locales by extending each entry.

import { useCallback } from "react";
import { useUiLocale, type UiLocale } from "./locale";

type LocaleMap = Partial<Record<UiLocale, string>>;

// Only RO + EN are guaranteed exhaustive. DE/FR/ES/IT/PT/NL/PL fall back
// to EN key when a translation is missing. Extend when copywriting is ready.
const DICT: Record<string, LocaleMap> = {
  // ----- Gender -----
  Woman: { ro: "Femeie", en: "Woman", de: "Frau", fr: "Femme", es: "Mujer", it: "Donna", pt: "Mulher", nl: "Vrouw", pl: "Kobieta" },
  Man: { ro: "Bărbat", en: "Man", de: "Mann", fr: "Homme", es: "Hombre", it: "Uomo", pt: "Homem", nl: "Man", pl: "Mężczyzna" },
  "Non-binary": { ro: "Non-binar", en: "Non-binary", de: "Non-binär", fr: "Non-binaire", es: "No binario", it: "Non-binario", pt: "Não binário", nl: "Non-binair", pl: "Niebinarny" },
  "Trans woman": { ro: "Femeie trans", en: "Trans woman", de: "Trans Frau", fr: "Femme trans", es: "Mujer trans", it: "Donna trans", pt: "Mulher trans", nl: "Trans vrouw", pl: "Kobieta trans" },
  "Trans man": { ro: "Bărbat trans", en: "Trans man", de: "Trans Mann", fr: "Homme trans", es: "Hombre trans", it: "Uomo trans", pt: "Homem trans", nl: "Trans man", pl: "Mężczyzna trans" },
  Genderfluid: { ro: "Genderfluid", en: "Genderfluid", de: "Genderfluid", fr: "Genderfluide", es: "Género fluido", it: "Genderfluid", pt: "Género fluido" },
  Genderqueer: { ro: "Genderqueer", en: "Genderqueer" },
  Agender: { ro: "Agender", en: "Agender" },
  "Two-spirit": { ro: "Două-spirite", en: "Two-spirit" },
  Intersex: { ro: "Intersex", en: "Intersex", de: "Intersexuell", fr: "Intersexe", es: "Intersexual", it: "Intersessuale" },

  // ----- Pronouns (păstrăm forma internațională) -----
  "she/her": { ro: "ea / a ei", en: "she/her", de: "sie/ihr", fr: "elle", es: "ella", it: "lei" },
  "he/him": { ro: "el / al lui", en: "he/him", de: "er/ihm", fr: "il", es: "él", it: "lui" },
  "they/them": { ro: "ei / lor (neutru)", en: "they/them", de: "they/them", fr: "iel", es: "elle", it: "loro" },
  "she/they": { ro: "ea / neutru", en: "she/they" },
  "he/they": { ro: "el / neutru", en: "he/they" },
  "xe/xem": { ro: "xe/xem", en: "xe/xem" },
  "any pronouns": { ro: "orice pronume", en: "any pronouns", de: "beliebige Pronomen", fr: "tous pronoms", es: "cualquier pronombre", it: "qualsiasi pronome" },

  // ----- Orientation -----
  Straight: { ro: "Heterosexual", en: "Straight", de: "Hetero", fr: "Hétéro", es: "Hetero", it: "Etero", pt: "Hétero" },
  Gay: { ro: "Gay", en: "Gay", de: "Schwul", fr: "Gay", es: "Gay", it: "Gay" },
  Lesbian: { ro: "Lesbiană", en: "Lesbian", de: "Lesbisch", fr: "Lesbienne", es: "Lesbiana", it: "Lesbica" },
  Bisexual: { ro: "Bisexual", en: "Bisexual", de: "Bisexuell", fr: "Bisexuel", es: "Bisexual", it: "Bisessuale" },
  Pansexual: { ro: "Pansexual", en: "Pansexual", de: "Pansexuell", fr: "Pansexuel", es: "Pansexual", it: "Pansessuale" },
  Queer: { ro: "Queer", en: "Queer" },
  Asexual: { ro: "Asexual", en: "Asexual", de: "Asexuell", fr: "Asexuel", es: "Asexual", it: "Asessuale" },
  Demisexual: { ro: "Demisexual", en: "Demisexual" },
  Questioning: { ro: "În explorare", en: "Questioning", de: "Unentschieden", fr: "En questionnement", es: "En cuestionamiento", it: "In esplorazione" },

  // ----- Looking for -----
  "Long-term relationship": { ro: "Relație de lungă durată", en: "Long-term relationship", de: "Langfristige Beziehung", fr: "Relation à long terme", es: "Relación seria", it: "Relazione seria" },
  "Short-term dating": { ro: "Întâlniri pe termen scurt", en: "Short-term dating", de: "Kurze Dates", fr: "Rencontres courtes", es: "Citas cortas", it: "Appuntamenti brevi" },
  Casual: { ro: "Casual", en: "Casual", de: "Locker", fr: "Décontracté", es: "Casual", it: "Casual" },
  Friendship: { ro: "Prietenie", en: "Friendship", de: "Freundschaft", fr: "Amitié", es: "Amistad", it: "Amicizia" },
  Networking: { ro: "Networking", en: "Networking" },
  "Right now": { ro: "Acum", en: "Right now", de: "Jetzt gerade", fr: "Maintenant", es: "Ahora mismo", it: "Adesso" },
  "Still figuring it out": { ro: "Încă mă gândesc", en: "Still figuring it out", de: "Weiß noch nicht", fr: "Je réfléchis encore", es: "Aún lo estoy pensando", it: "Sto ancora decidendo" },

  // ----- Interests -----
  Art: { ro: "Artă", en: "Art", de: "Kunst", fr: "Art", es: "Arte", it: "Arte" },
  Music: { ro: "Muzică", en: "Music", de: "Musik", fr: "Musique", es: "Música", it: "Musica" },
  Travel: { ro: "Călătorii", en: "Travel", de: "Reisen", fr: "Voyages", es: "Viajes", it: "Viaggi" },
  Wine: { ro: "Vin", en: "Wine", de: "Wein", fr: "Vin", es: "Vino", it: "Vino" },
  Cocktails: { ro: "Cocktailuri", en: "Cocktails", de: "Cocktails", fr: "Cocktails", es: "Cócteles", it: "Cocktail" },
  Coffee: { ro: "Cafea", en: "Coffee", de: "Kaffee", fr: "Café", es: "Café", it: "Caffè" },
  Cooking: { ro: "Gătit", en: "Cooking", de: "Kochen", fr: "Cuisine", es: "Cocina", it: "Cucina" },
  "Fine dining": { ro: "Restaurante fine", en: "Fine dining", de: "Feines Essen", fr: "Gastronomie", es: "Alta cocina", it: "Alta cucina" },
  Yoga: { ro: "Yoga", en: "Yoga" },
  Running: { ro: "Alergare", en: "Running", de: "Laufen", fr: "Course", es: "Correr", it: "Corsa" },
  Hiking: { ro: "Drumeții", en: "Hiking", de: "Wandern", fr: "Randonnée", es: "Senderismo", it: "Escursionismo" },
  Tennis: { ro: "Tenis", en: "Tennis" },
  Skiing: { ro: "Schi", en: "Skiing", de: "Skifahren", fr: "Ski", es: "Esquí", it: "Sci" },
  Sailing: { ro: "Navigație", en: "Sailing", de: "Segeln", fr: "Voile", es: "Navegación", it: "Vela" },
  Cinema: { ro: "Cinema", en: "Cinema", de: "Kino", fr: "Cinéma", es: "Cine", it: "Cinema" },
  Theatre: { ro: "Teatru", en: "Theatre", de: "Theater", fr: "Théâtre", es: "Teatro", it: "Teatro" },
  Opera: { ro: "Operă", en: "Opera", de: "Oper", fr: "Opéra", es: "Ópera", it: "Opera" },
  Photography: { ro: "Fotografie", en: "Photography", de: "Fotografie", fr: "Photographie", es: "Fotografía", it: "Fotografia" },
  Reading: { ro: "Lectură", en: "Reading", de: "Lesen", fr: "Lecture", es: "Lectura", it: "Lettura" },
  Poetry: { ro: "Poezie", en: "Poetry", de: "Poesie", fr: "Poésie", es: "Poesía", it: "Poesia" },
  Fashion: { ro: "Modă", en: "Fashion", de: "Mode", fr: "Mode", es: "Moda", it: "Moda" },
  Design: { ro: "Design", en: "Design" },
  Architecture: { ro: "Arhitectură", en: "Architecture", de: "Architektur", fr: "Architecture", es: "Arquitectura", it: "Architettura" },
  Startups: { ro: "Startup-uri", en: "Startups" },
  Languages: { ro: "Limbi străine", en: "Languages", de: "Sprachen", fr: "Langues", es: "Idiomas", it: "Lingue" },
  Volunteering: { ro: "Voluntariat", en: "Volunteering", de: "Ehrenamt", fr: "Bénévolat", es: "Voluntariado", it: "Volontariato" },
  Dogs: { ro: "Câini", en: "Dogs", de: "Hunde", fr: "Chiens", es: "Perros", it: "Cani" },
  Cats: { ro: "Pisici", en: "Cats", de: "Katzen", fr: "Chats", es: "Gatos", it: "Gatti" },
  Concerts: { ro: "Concerte", en: "Concerts", de: "Konzerte", fr: "Concerts", es: "Conciertos", it: "Concerti" },
  Festivals: { ro: "Festivaluri", en: "Festivals", de: "Festivals", fr: "Festivals", es: "Festivales", it: "Festival" },

  // ----- Prompts -----
  "The way to win me over is…": { ro: "Modul de a mă cuceri este…", en: "The way to win me over is…" },
  "A perfect Sunday looks like…": { ro: "O duminică perfectă arată așa…", en: "A perfect Sunday looks like…" },
  "I'm secretly really good at…": { ro: "În secret, sunt foarte bun/ă la…", en: "I'm secretly really good at…" },
  "The last book that changed me…": { ro: "Ultima carte care m-a schimbat…", en: "The last book that changed me…" },
  "My most controversial opinion…": { ro: "Cea mai controversată opinie a mea…", en: "My most controversial opinion…" },
  "I geek out on…": { ro: "Mă entuziasmează…", en: "I geek out on…" },
  "Together we could…": { ro: "Împreună am putea…", en: "Together we could…" },
  "My love language is…": { ro: "Limbajul meu al iubirii este…", en: "My love language is…" },
  "I'm looking for someone who…": { ro: "Caut pe cineva care…", en: "I'm looking for someone who…" },
  "The first thing you'll notice about me…": { ro: "Primul lucru pe care îl vei observa la mine…", en: "The first thing you'll notice about me…" },

  // ----- Tribes -----
  Bear: { ro: "Bear", en: "Bear" },
  Cub: { ro: "Cub", en: "Cub" },
  Daddy: { ro: "Daddy", en: "Daddy" },
  Otter: { ro: "Otter", en: "Otter" },
  Wolf: { ro: "Wolf", en: "Wolf" },
  Jock: { ro: "Jock", en: "Jock" },
  Twink: { ro: "Twink", en: "Twink" },
  Twunk: { ro: "Twunk", en: "Twunk" },
  Muscle: { ro: "Muscle", en: "Muscle" },
  Geek: { ro: "Geek", en: "Geek" },
  Leather: { ro: "Leather", en: "Leather" },
  Pup: { ro: "Pup", en: "Pup" },
  Rugged: { ro: "Aspru", en: "Rugged" },
  "Clean-cut": { ro: "Îngrijit", en: "Clean-cut" },
  Trans: { ro: "Trans", en: "Trans" },
  Bi: { ro: "Bi", en: "Bi" },
  Discreet: { ro: "Discret", en: "Discreet", de: "Diskret", fr: "Discret", es: "Discreto", it: "Discreto" },

  // ----- Body type -----
  Slim: { ro: "Zvelt", en: "Slim", de: "Schlank", fr: "Mince", es: "Delgado", it: "Snello" },
  Average: { ro: "Mediu", en: "Average", de: "Durchschnittlich", fr: "Moyen", es: "Promedio", it: "Medio" },
  Athletic: { ro: "Atletic", en: "Athletic", de: "Sportlich", fr: "Athlétique", es: "Atlético", it: "Atletico" },
  Muscular: { ro: "Musculos", en: "Muscular", de: "Muskulös", fr: "Musclé", es: "Musculoso", it: "Muscoloso" },
  Stocky: { ro: "Îndesat", en: "Stocky" },
  Husky: { ro: "Robust", en: "Husky" },
  Large: { ro: "Corpolent", en: "Large", de: "Stämmig", fr: "Grand", es: "Grande", it: "Corporatura grande" },

  // ----- Position -----
  Top: { ro: "Top", en: "Top" },
  "Vers Top": { ro: "Vers Top", en: "Vers Top" },
  Versatile: { ro: "Versatil", en: "Versatile", de: "Vielseitig", fr: "Versatile", es: "Versátil", it: "Versatile" },
  "Vers Bottom": { ro: "Vers Bottom", en: "Vers Bottom" },
  Bottom: { ro: "Bottom", en: "Bottom" },
  Side: { ro: "Side", en: "Side" },
  Oral: { ro: "Oral", en: "Oral" },
  "Not sure": { ro: "Nu sunt sigur", en: "Not sure", de: "Unsicher", fr: "Pas sûr", es: "No estoy seguro", it: "Non sono sicuro" },

  // ----- Relationship status -----
  Single: { ro: "Necăsătorit", en: "Single", de: "Single", fr: "Célibataire", es: "Soltero", it: "Single" },
  Dating: { ro: "Într-o relație casual", en: "Dating" },
  Exclusive: { ro: "Relație exclusivă", en: "Exclusive", de: "Exklusiv", fr: "Exclusif", es: "Exclusivo", it: "Esclusivo" },
  Partnered: { ro: "Într-un parteneriat", en: "Partnered" },
  "Open relationship": { ro: "Relație deschisă", en: "Open relationship", de: "Offene Beziehung", fr: "Relation ouverte", es: "Relación abierta", it: "Relazione aperta" },
  Married: { ro: "Căsătorit", en: "Married", de: "Verheiratet", fr: "Marié", es: "Casado", it: "Sposato" },
  Polyamorous: { ro: "Poliamoros", en: "Polyamorous", de: "Polyamor", fr: "Polyamoureux", es: "Poliamoroso", it: "Poliamoroso" },

  // ----- Ethnicity -----
  Asian: { ro: "Asiatic", en: "Asian", de: "Asiatisch", fr: "Asiatique", es: "Asiático", it: "Asiatico" },
  Black: { ro: "De culoare", en: "Black", de: "Schwarz", fr: "Noir", es: "Negro", it: "Nero" },
  "Latino / Hispanic": { ro: "Latino / Hispanic", en: "Latino / Hispanic" },
  "Middle Eastern": { ro: "Din Orientul Mijlociu", en: "Middle Eastern" },
  Mixed: { ro: "Mixt", en: "Mixed", de: "Gemischt", fr: "Métis", es: "Mixto", it: "Misto" },
  "Native American": { ro: "Nativ american", en: "Native American" },
  "Pacific Islander": { ro: "Din insulele Pacific", en: "Pacific Islander" },
  "South Asian": { ro: "Sud-asiatic", en: "South Asian" },
  White: { ro: "Alb", en: "White", de: "Weiß", fr: "Blanc", es: "Blanco", it: "Bianco" },
  Other: { ro: "Altul", en: "Other", de: "Andere", fr: "Autre", es: "Otro", it: "Altro" },

  // ----- Meet at -----
  "My place": { ro: "La mine", en: "My place", de: "Bei mir", fr: "Chez moi", es: "En mi casa", it: "Da me" },
  "Your place": { ro: "La tine", en: "Your place", de: "Bei dir", fr: "Chez toi", es: "En tu casa", it: "Da te" },
  "Bar / Café": { ro: "Bar / Cafenea", en: "Bar / Café", de: "Bar / Café", fr: "Bar / Café", es: "Bar / Café", it: "Bar / Caffè" },
  Public: { ro: "În public", en: "Public", de: "Öffentlich", fr: "En public", es: "En público", it: "In pubblico" },
  "Online first": { ro: "Întâi online", en: "Online first" },
  Hotel: { ro: "Hotel", en: "Hotel" },
  Outdoor: { ro: "Afară", en: "Outdoor", de: "Draußen", fr: "En plein air", es: "Al aire libre", it: "All'aperto" },

  // ----- Expectations -----
  Chat: { ro: "Chat", en: "Chat" },
  Dates: { ro: "Întâlniri", en: "Dates", de: "Dates", fr: "Rendez-vous", es: "Citas", it: "Appuntamenti" },
  Friends: { ro: "Prieteni", en: "Friends", de: "Freunde", fr: "Amis", es: "Amigos", it: "Amici" },
  Hookups: { ro: "Aventuri", en: "Hookups" },
  Relationship: { ro: "Relație", en: "Relationship", de: "Beziehung", fr: "Relation", es: "Relación", it: "Relazione" },

  // ----- Scenes -----
  Vanilla: { ro: "Vanilla", en: "Vanilla" },
  "Kink-friendly": { ro: "Deschis la kink", en: "Kink-friendly" },
  "Pup play": { ro: "Pup play", en: "Pup play" },
  Bondage: { ro: "Bondage", en: "Bondage" },
  "Role play": { ro: "Role play", en: "Role play" },
  Group: { ro: "Grup", en: "Group", de: "Gruppe", fr: "Groupe", es: "Grupo", it: "Gruppo" },
  Private: { ro: "Privat", en: "Private", de: "Privat", fr: "Privé", es: "Privado", it: "Privato" },

  // ----- Safety -----
  "Always safe": { ro: "Întotdeauna în siguranță", en: "Always safe" },
  Condoms: { ro: "Prezervative", en: "Condoms", de: "Kondome", fr: "Préservatifs", es: "Condones", it: "Preservativi" },
  PrEP: { ro: "PrEP", en: "PrEP" },
  DoxyPEP: { ro: "DoxyPEP", en: "DoxyPEP" },
  "Regular STI tests": { ro: "Teste STI regulate", en: "Regular STI tests" },
  Vaccinated: { ro: "Vaccinat", en: "Vaccinated", de: "Geimpft", fr: "Vacciné", es: "Vacunado", it: "Vaccinato" },
  "Discuss first": { ro: "Discutăm întâi", en: "Discuss first" },

  // ----- PrEP status -----
  "On PrEP": { ro: "Pe PrEP", en: "On PrEP" },
  "Not on PrEP": { ro: "Fără PrEP", en: "Not on PrEP" },
  "On-demand": { ro: "La cerere", en: "On-demand" },
  "Prefer not to say": { ro: "Prefer să nu spun", en: "Prefer not to say", de: "Möchte nicht sagen", fr: "Préfère ne pas dire", es: "Prefiero no decir", it: "Preferisco non dirlo" },

  // ----- Vaccinations -----
  MPox: { ro: "MPox", en: "MPox" },
  HepA: { ro: "Hepatita A", en: "HepA" },
  HepB: { ro: "Hepatita B", en: "HepB" },
  HPV: { ro: "HPV", en: "HPV" },
  COVID: { ro: "COVID", en: "COVID" },
  Meningitis: { ro: "Meningită", en: "Meningitis", de: "Meningitis", fr: "Méningite", es: "Meningitis", it: "Meningite" },
};

/** Resolve a canonical option value into a label for the given locale. */
export function optionLabel(value: string, locale: UiLocale): string {
  const entry = DICT[value];
  if (!entry) return value;
  return entry[locale] ?? entry.en ?? value;
}

/** Hook returning a translator function bound to the current UI locale. */
export function useOptionLabel(): (value: string) => string {
  const locale = useUiLocale();
  return useCallback((value: string) => optionLabel(value, locale), [locale]);
}
