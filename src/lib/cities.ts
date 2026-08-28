/**
 * Listă locală de orașe pentru modul Explorer.
 *
 * Deliberat NU folosim un serviciu extern de geocodare:
 *  - nu trimitem ce caută userul către un terț (fără procesator nou),
 *  - precizia rămâne la nivel de oraș, niciodată adresă sau stradă.
 * Coordonatele sunt centre de oraș rotunjite la 2 zecimale (~1 km).
 */
export type City = {
  name: string;
  country: string;
  cc: string; // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
};

export const CITIES: City[] = [
  // România
  { name: "București", country: "România", cc: "RO", lat: 44.43, lng: 26.1 },
  { name: "Cluj-Napoca", country: "România", cc: "RO", lat: 46.77, lng: 23.6 },
  { name: "Timișoara", country: "România", cc: "RO", lat: 45.75, lng: 21.23 },
  { name: "Iași", country: "România", cc: "RO", lat: 47.16, lng: 27.59 },
  { name: "Constanța", country: "România", cc: "RO", lat: 44.18, lng: 28.63 },
  { name: "Brașov", country: "România", cc: "RO", lat: 45.66, lng: 25.61 },
  { name: "Sibiu", country: "România", cc: "RO", lat: 45.79, lng: 24.15 },
  { name: "Craiova", country: "România", cc: "RO", lat: 44.32, lng: 23.8 },
  { name: "Oradea", country: "România", cc: "RO", lat: 47.06, lng: 21.93 },
  { name: "Galați", country: "România", cc: "RO", lat: 45.44, lng: 28.05 },
  // Europa
  { name: "Barcelona", country: "Spania", cc: "ES", lat: 41.39, lng: 2.17 },
  { name: "Madrid", country: "Spania", cc: "ES", lat: 40.42, lng: -3.7 },
  { name: "Valencia", country: "Spania", cc: "ES", lat: 39.47, lng: -0.38 },
  { name: "Sitges", country: "Spania", cc: "ES", lat: 41.24, lng: 1.81 },
  { name: "Lisabona", country: "Portugalia", cc: "PT", lat: 38.72, lng: -9.14 },
  { name: "Porto", country: "Portugalia", cc: "PT", lat: 41.15, lng: -8.61 },
  { name: "Paris", country: "Franța", cc: "FR", lat: 48.86, lng: 2.35 },
  { name: "Marsilia", country: "Franța", cc: "FR", lat: 43.3, lng: 5.37 },
  { name: "Lyon", country: "Franța", cc: "FR", lat: 45.76, lng: 4.84 },
  { name: "Nisa", country: "Franța", cc: "FR", lat: 43.7, lng: 7.27 },
  { name: "Londra", country: "Regatul Unit", cc: "GB", lat: 51.51, lng: -0.13 },
  { name: "Manchester", country: "Regatul Unit", cc: "GB", lat: 53.48, lng: -2.24 },
  { name: "Brighton", country: "Regatul Unit", cc: "GB", lat: 50.82, lng: -0.14 },
  { name: "Edinburgh", country: "Regatul Unit", cc: "GB", lat: 55.95, lng: -3.19 },
  { name: "Dublin", country: "Irlanda", cc: "IE", lat: 53.35, lng: -6.26 },
  { name: "Berlin", country: "Germania", cc: "DE", lat: 52.52, lng: 13.41 },
  { name: "München", country: "Germania", cc: "DE", lat: 48.14, lng: 11.58 },
  { name: "Hamburg", country: "Germania", cc: "DE", lat: 53.55, lng: 9.99 },
  { name: "Köln", country: "Germania", cc: "DE", lat: 50.94, lng: 6.96 },
  { name: "Frankfurt", country: "Germania", cc: "DE", lat: 50.11, lng: 8.68 },
  { name: "Viena", country: "Austria", cc: "AT", lat: 48.21, lng: 16.37 },
  { name: "Zürich", country: "Elveția", cc: "CH", lat: 47.38, lng: 8.54 },
  { name: "Geneva", country: "Elveția", cc: "CH", lat: 46.2, lng: 6.14 },
  { name: "Amsterdam", country: "Țările de Jos", cc: "NL", lat: 52.37, lng: 4.9 },
  { name: "Rotterdam", country: "Țările de Jos", cc: "NL", lat: 51.92, lng: 4.48 },
  { name: "Bruxelles", country: "Belgia", cc: "BE", lat: 50.85, lng: 4.35 },
  { name: "Antwerpen", country: "Belgia", cc: "BE", lat: 51.22, lng: 4.4 },
  { name: "Copenhaga", country: "Danemarca", cc: "DK", lat: 55.68, lng: 12.57 },
  { name: "Stockholm", country: "Suedia", cc: "SE", lat: 59.33, lng: 18.07 },
  { name: "Göteborg", country: "Suedia", cc: "SE", lat: 57.71, lng: 11.97 },
  { name: "Oslo", country: "Norvegia", cc: "NO", lat: 59.91, lng: 10.75 },
  { name: "Helsinki", country: "Finlanda", cc: "FI", lat: 60.17, lng: 24.94 },
  { name: "Reykjavík", country: "Islanda", cc: "IS", lat: 64.15, lng: -21.94 },
  { name: "Roma", country: "Italia", cc: "IT", lat: 41.9, lng: 12.5 },
  { name: "Milano", country: "Italia", cc: "IT", lat: 45.46, lng: 9.19 },
  { name: "Napoli", country: "Italia", cc: "IT", lat: 40.85, lng: 14.27 },
  { name: "Torino", country: "Italia", cc: "IT", lat: 45.07, lng: 7.69 },
  { name: "Bologna", country: "Italia", cc: "IT", lat: 44.49, lng: 11.34 },
  { name: "Atena", country: "Grecia", cc: "GR", lat: 37.98, lng: 23.73 },
  { name: "Salonic", country: "Grecia", cc: "GR", lat: 40.64, lng: 22.94 },
  { name: "Mykonos", country: "Grecia", cc: "GR", lat: 37.45, lng: 25.33 },
  { name: "Praga", country: "Cehia", cc: "CZ", lat: 50.08, lng: 14.44 },
  { name: "Budapesta", country: "Ungaria", cc: "HU", lat: 47.5, lng: 19.04 },
  { name: "Varșovia", country: "Polonia", cc: "PL", lat: 52.23, lng: 21.01 },
  { name: "Cracovia", country: "Polonia", cc: "PL", lat: 50.06, lng: 19.94 },
  { name: "Bratislava", country: "Slovacia", cc: "SK", lat: 48.15, lng: 17.11 },
  { name: "Ljubljana", country: "Slovenia", cc: "SI", lat: 46.06, lng: 14.51 },
  { name: "Zagreb", country: "Croația", cc: "HR", lat: 45.81, lng: 15.98 },
  { name: "Split", country: "Croația", cc: "HR", lat: 43.51, lng: 16.44 },
  { name: "Belgrad", country: "Serbia", cc: "RS", lat: 44.79, lng: 20.45 },
  { name: "Sofia", country: "Bulgaria", cc: "BG", lat: 42.7, lng: 23.32 },
  { name: "Chișinău", country: "Moldova", cc: "MD", lat: 47.01, lng: 28.86 },
  { name: "Kiev", country: "Ucraina", cc: "UA", lat: 50.45, lng: 30.52 },
  { name: "Tallinn", country: "Estonia", cc: "EE", lat: 59.44, lng: 24.75 },
  { name: "Riga", country: "Letonia", cc: "LV", lat: 56.95, lng: 24.11 },
  { name: "Vilnius", country: "Lituania", cc: "LT", lat: 54.69, lng: 25.28 },
  { name: "Istanbul", country: "Turcia", cc: "TR", lat: 41.01, lng: 28.98 },
  { name: "Valletta", country: "Malta", cc: "MT", lat: 35.9, lng: 14.51 },
  { name: "Nicosia", country: "Cipru", cc: "CY", lat: 35.17, lng: 33.36 },
  { name: "Luxemburg", country: "Luxemburg", cc: "LU", lat: 49.61, lng: 6.13 },
  { name: "Tel Aviv", country: "Israel", cc: "IL", lat: 32.08, lng: 34.78 },
  // America de Nord
  { name: "New York", country: "SUA", cc: "US", lat: 40.71, lng: -74.01 },
  { name: "Los Angeles", country: "SUA", cc: "US", lat: 34.05, lng: -118.24 },
  { name: "San Francisco", country: "SUA", cc: "US", lat: 37.77, lng: -122.42 },
  { name: "Chicago", country: "SUA", cc: "US", lat: 41.88, lng: -87.63 },
  { name: "Miami", country: "SUA", cc: "US", lat: 25.76, lng: -80.19 },
  { name: "Atlanta", country: "SUA", cc: "US", lat: 33.75, lng: -84.39 },
  { name: "Seattle", country: "SUA", cc: "US", lat: 47.61, lng: -122.33 },
  { name: "Austin", country: "SUA", cc: "US", lat: 30.27, lng: -97.74 },
  { name: "Las Vegas", country: "SUA", cc: "US", lat: 36.17, lng: -115.14 },
  { name: "Boston", country: "SUA", cc: "US", lat: 42.36, lng: -71.06 },
  { name: "Washington DC", country: "SUA", cc: "US", lat: 38.91, lng: -77.04 },
  { name: "Toronto", country: "Canada", cc: "CA", lat: 43.65, lng: -79.38 },
  { name: "Montréal", country: "Canada", cc: "CA", lat: 45.5, lng: -73.57 },
  { name: "Vancouver", country: "Canada", cc: "CA", lat: 49.28, lng: -123.12 },
  { name: "Ciudad de México", country: "Mexic", cc: "MX", lat: 19.43, lng: -99.13 },
  { name: "Guadalajara", country: "Mexic", cc: "MX", lat: 20.67, lng: -103.35 },
  { name: "Cancún", country: "Mexic", cc: "MX", lat: 21.16, lng: -86.85 },
  // America de Sud
  { name: "São Paulo", country: "Brazilia", cc: "BR", lat: -23.55, lng: -46.63 },
  { name: "Rio de Janeiro", country: "Brazilia", cc: "BR", lat: -22.91, lng: -43.17 },
  { name: "Buenos Aires", country: "Argentina", cc: "AR", lat: -34.6, lng: -58.38 },
  { name: "Santiago", country: "Chile", cc: "CL", lat: -33.45, lng: -70.67 },
  { name: "Bogotá", country: "Columbia", cc: "CO", lat: 4.71, lng: -74.07 },
  { name: "Lima", country: "Peru", cc: "PE", lat: -12.05, lng: -77.04 },
  { name: "Montevideo", country: "Uruguay", cc: "UY", lat: -34.9, lng: -56.16 },
  // Asia / Oceania
  { name: "Tokyo", country: "Japonia", cc: "JP", lat: 35.68, lng: 139.69 },
  { name: "Osaka", country: "Japonia", cc: "JP", lat: 34.69, lng: 135.5 },
  { name: "Seul", country: "Coreea de Sud", cc: "KR", lat: 37.57, lng: 126.98 },
  { name: "Taipei", country: "Taiwan", cc: "TW", lat: 25.03, lng: 121.57 },
  { name: "Hong Kong", country: "Hong Kong", cc: "HK", lat: 22.32, lng: 114.17 },
  { name: "Bangkok", country: "Thailanda", cc: "TH", lat: 13.76, lng: 100.5 },
  { name: "Singapore", country: "Singapore", cc: "SG", lat: 1.35, lng: 103.82 },
  { name: "Bali (Denpasar)", country: "Indonezia", cc: "ID", lat: -8.65, lng: 115.22 },
  { name: "Manila", country: "Filipine", cc: "PH", lat: 14.6, lng: 120.98 },
  { name: "Dubai", country: "Emiratele Arabe Unite", cc: "AE", lat: 25.2, lng: 55.27 },
  { name: "Delhi", country: "India", cc: "IN", lat: 28.61, lng: 77.21 },
  { name: "Mumbai", country: "India", cc: "IN", lat: 19.08, lng: 72.88 },
  { name: "Sydney", country: "Australia", cc: "AU", lat: -33.87, lng: 151.21 },
  { name: "Melbourne", country: "Australia", cc: "AU", lat: -37.81, lng: 144.96 },
  { name: "Auckland", country: "Noua Zeelandă", cc: "NZ", lat: -36.85, lng: 174.76 },
  // Africa
  { name: "Cape Town", country: "Africa de Sud", cc: "ZA", lat: -33.92, lng: 18.42 },
  { name: "Johannesburg", country: "Africa de Sud", cc: "ZA", lat: -26.2, lng: 28.05 },
  { name: "Marrakech", country: "Maroc", cc: "MA", lat: 31.63, lng: -7.99 },
  { name: "Cairo", country: "Egipt", cc: "EG", lat: 30.04, lng: 31.24 },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Căutare simplă după oraș sau țară. Fără rețea, fără terți. */
export function searchCities(query: string, limit = 25): City[] {
  const q = normalize(query.trim());
  if (!q) return CITIES.slice(0, limit);
  const scored = CITIES.map((c) => {
    const name = normalize(c.name);
    const country = normalize(c.country);
    let score = -1;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (country.startsWith(q) || country.includes(q)) score = 1;
    return { c, score };
  })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((r) => r.c);
}
