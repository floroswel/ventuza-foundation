// Completări de traducere pentru listele din onboarding (gen, pronume,
// orientare, „ce caut”, interese, triburi).
//
// Trăiesc separat de `option-labels.ts` ca dicționarul principal să rămână
// lizibil: aici sunt DOAR limbile care lipseau (pt/nl/pl/hu și golurile
// de/fr/es/it). Se face merge peste DICT la import, cheie cu cheie — valorile
// existente NU sunt suprascrise.

type LocaleMap = Record<string, string>;

export const OPTION_LABELS_EXTRA: Record<string, LocaleMap> = {
  // ----- Gen -----
  Woman: { pt: "Mulher", nl: "Vrouw", pl: "Kobieta", hu: "Nő" },
  Man: { pt: "Homem", nl: "Man", pl: "Mężczyzna", hu: "Férfi" },
  "Non-binary": { hu: "Nem bináris" },
  "Trans woman": { hu: "Transz nő" },
  "Trans man": { hu: "Transz férfi" },
  Genderfluid: { nl: "Genderfluïde", pl: "Genderfluid", hu: "Genderfluid" },
  Genderqueer: { de: "Genderqueer", fr: "Genderqueer", es: "Genderqueer", it: "Genderqueer", pt: "Genderqueer", nl: "Genderqueer", pl: "Genderqueer", hu: "Genderqueer" },
  Agender: { de: "Agender", fr: "Agenre", es: "Agénero", it: "Agender", pt: "Agénero", nl: "Agender", pl: "Agender", hu: "Agender" },
  "Two-spirit": { de: "Two-Spirit", fr: "Bispirituel", es: "Dos espíritus", it: "Two-spirit", pt: "Dois espíritos", nl: "Two-spirit", pl: "Two-spirit", hu: "Two-spirit" },
  Intersex: { pt: "Intersexo", nl: "Intersekse", pl: "Interpłciowy", hu: "Interszexuális" },

  // ----- Pronume -----
  "she/her": { pt: "ela", nl: "zij/haar", pl: "ona", hu: "ő (nő)" },
  "he/him": { pt: "ele", nl: "hij/hem", pl: "on", hu: "ő (férfi)" },
  "they/them": { pt: "elu", nl: "hen/hun", pl: "onu", hu: "ő (semleges)" },
  "she/they": { de: "sie/they", fr: "elle/iel", es: "ella/elle", it: "lei/loro", pt: "ela/elu", nl: "zij/hen", pl: "ona/onu", hu: "ő (nő/semleges)" },
  "he/they": { de: "er/they", fr: "il/iel", es: "él/elle", it: "lui/loro", pt: "ele/elu", nl: "hij/hen", pl: "on/onu", hu: "ő (férfi/semleges)" },
  "xe/xem": { de: "xe/xem", fr: "xe/xem", es: "xe/xem", it: "xe/xem", pt: "xe/xem", nl: "xe/xem", pl: "xe/xem", hu: "xe/xem" },
  "any pronouns": { pt: "qualquer pronome", nl: "elk voornaamwoord", pl: "dowolne zaimki", hu: "bármilyen névmás" },

  // ----- Orientare -----
  Straight: { nl: "Hetero", pl: "Hetero", hu: "Heteroszexuális" },
  Gay: { pt: "Gay", nl: "Homo", pl: "Gej", hu: "Meleg" },
  Lesbian: { pt: "Lésbica", nl: "Lesbisch", pl: "Lesbijka", hu: "Leszbikus" },
  Bisexual: { pt: "Bissexual", nl: "Biseksueel", pl: "Biseksualny", hu: "Biszexuális" },
  Pansexual: { pt: "Pansexual", nl: "Panseksueel", pl: "Panseksualny", hu: "Panszexuális" },
  Queer: { de: "Queer", fr: "Queer", es: "Queer", it: "Queer", pt: "Queer", nl: "Queer", pl: "Queer", hu: "Queer" },
  Asexual: { pt: "Assexual", nl: "Aseksueel", pl: "Aseksualny", hu: "Aszexuális" },
  Demisexual: { de: "Demisexuell", fr: "Demisexuel", es: "Demisexual", it: "Demisessuale", pt: "Demissexual", nl: "Demiseksueel", pl: "Demiseksualny", hu: "Demiszexuális" },
  Questioning: { pt: "Em questionamento", nl: "Zoekende", pl: "W poszukiwaniu", hu: "Kereső" },

  // ----- Ce caut -----
  "Long-term relationship": { pt: "Relação séria", nl: "Langdurige relatie", pl: "Poważny związek", hu: "Hosszú távú kapcsolat" },
  "Short-term dating": { pt: "Encontros casuais", nl: "Kortdurend daten", pl: "Krótkie randki", hu: "Rövid távú randizás" },
  Casual: { pt: "Casual", nl: "Casual", pl: "Bez zobowiązań", hu: "Kötetlen" },
  Friendship: { pt: "Amizade", nl: "Vriendschap", pl: "Przyjaźń", hu: "Barátság" },
  Networking: { de: "Networking", fr: "Réseautage", es: "Networking", it: "Networking", pt: "Networking", nl: "Netwerken", pl: "Networking", hu: "Kapcsolatépítés" },
  "Right now": { pt: "Agora", nl: "Nu meteen", pl: "Teraz", hu: "Most azonnal" },
  "Still figuring it out": { pt: "Ainda a decidir", nl: "Nog aan het uitzoeken", pl: "Jeszcze się zastanawiam", hu: "Még gondolkodom" },

  // ----- Interese -----
  Art: { pt: "Arte", nl: "Kunst", pl: "Sztuka", hu: "Művészet" },
  Music: { pt: "Música", nl: "Muziek", pl: "Muzyka", hu: "Zene" },
  Travel: { pt: "Viagens", nl: "Reizen", pl: "Podróże", hu: "Utazás" },
  Wine: { pt: "Vinho", nl: "Wijn", pl: "Wino", hu: "Bor" },
  Cocktails: { pt: "Cocktails", nl: "Cocktails", pl: "Koktajle", hu: "Koktélok" },
  Coffee: { pt: "Café", nl: "Koffie", pl: "Kawa", hu: "Kávé" },
  Cooking: { pt: "Cozinhar", nl: "Koken", pl: "Gotowanie", hu: "Főzés" },
  "Fine dining": { pt: "Alta gastronomia", nl: "Fijn dineren", pl: "Wykwintna kuchnia", hu: "Fine dining" },
  Yoga: { de: "Yoga", fr: "Yoga", es: "Yoga", it: "Yoga", pt: "Ioga", nl: "Yoga", pl: "Joga", hu: "Jóga" },
  Running: { pt: "Corrida", nl: "Hardlopen", pl: "Bieganie", hu: "Futás" },
  Hiking: { pt: "Caminhadas", nl: "Wandelen", pl: "Wędrówki", hu: "Túrázás" },
  Tennis: { de: "Tennis", fr: "Tennis", es: "Tenis", it: "Tennis", pt: "Ténis", nl: "Tennis", pl: "Tenis", hu: "Tenisz" },
  Skiing: { pt: "Esqui", nl: "Skiën", pl: "Narciarstwo", hu: "Síelés" },
  Sailing: { pt: "Vela", nl: "Zeilen", pl: "Żeglarstwo", hu: "Vitorlázás" },
  Cinema: { pt: "Cinema", nl: "Film", pl: "Kino", hu: "Mozi" },
  Theatre: { pt: "Teatro", nl: "Theater", pl: "Teatr", hu: "Színház" },
  Opera: { pt: "Ópera", nl: "Opera", pl: "Opera", hu: "Opera" },
  Photography: { pt: "Fotografia", nl: "Fotografie", pl: "Fotografia", hu: "Fotózás" },
  Reading: { pt: "Leitura", nl: "Lezen", pl: "Czytanie", hu: "Olvasás" },
  Poetry: { pt: "Poesia", nl: "Poëzie", pl: "Poezja", hu: "Költészet" },
  Fashion: { pt: "Moda", nl: "Mode", pl: "Moda", hu: "Divat" },
  Design: { de: "Design", fr: "Design", es: "Diseño", it: "Design", pt: "Design", nl: "Design", pl: "Design", hu: "Dizájn" },
  Architecture: { pt: "Arquitetura", nl: "Architectuur", pl: "Architektura", hu: "Építészet" },
  Startups: { de: "Startups", fr: "Startups", es: "Startups", it: "Startup", pt: "Startups", nl: "Startups", pl: "Startupy", hu: "Startupok" },
  Languages: { pt: "Idiomas", nl: "Talen", pl: "Języki", hu: "Nyelvek" },
  Volunteering: { pt: "Voluntariado", nl: "Vrijwilligerswerk", pl: "Wolontariat", hu: "Önkéntesség" },
  Dogs: { pt: "Cães", nl: "Honden", pl: "Psy", hu: "Kutyák" },
  Cats: { pt: "Gatos", nl: "Katten", pl: "Koty", hu: "Macskák" },
  Concerts: { pt: "Concertos", nl: "Concerten", pl: "Koncerty", hu: "Koncertek" },
  Festivals: { pt: "Festivais", nl: "Festivals", pl: "Festiwale", hu: "Fesztiválok" },

  // ----- Triburi (termeni internaționali, se păstrează) -----
  Rugged: { de: "Rau", fr: "Robuste", es: "Rudo", it: "Ruvido", pt: "Rústico", nl: "Ruig", pl: "Surowy", hu: "Nyers" },
  "Clean-cut": { de: "Gepflegt", fr: "Soigné", es: "Pulcro", it: "Curato", pt: "Cuidado", nl: "Verzorgd", pl: "Zadbany", hu: "Ápolt" },
  Discreet: { pt: "Discreto", nl: "Discreet", pl: "Dyskretny", hu: "Diszkrét" },
};
