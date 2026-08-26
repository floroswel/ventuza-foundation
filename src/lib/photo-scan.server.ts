/**
 * Clasificator AI pentru pozele din aplicație (server-only).
 *
 * Politica este diferită pe suprafețe:
 *  - `profile` (poză publică de profil): fără nuditate, fără lenjerie explicită,
 *    fără minori, fără arme, fără sânge/violență.
 *  - `album` (album privat): nuditatea adultă este permisă, dar minorii, armele
 *    și sângele/violența sunt INTERZISE oriunde în aplicație.
 *
 * Nu returnează niciodată imaginea; doar etichete + motiv scurt.
 */
import { aiComplete } from "./ai.server";

export type PhotoSurface = "profile" | "album";

export type PhotoVerdict = {
  minor: boolean;
  weapon: boolean;
  blood: boolean;
  nudity: boolean;
  sexual_act: boolean;
  allowed: boolean;
  reason: string;
  severity: "normal" | "high" | "critical";
};

const SYSTEM = `Ești moderator de conținut pentru o aplicație de dating 18+.
Analizezi o imagine și răspunzi DOAR JSON valid, fără text în plus:
{"minor":bool,"weapon":bool,"blood":bool,"nudity":bool,"sexual_act":bool,"reason":"<max 120 caractere, română>"}

Definiții stricte:
- minor = apare orice persoană care pare sub 18 ani (inclusiv copii în fundal, poze de familie, fotografii de la școală, desene/AI cu aspect de copil). În orice dubiu → true.
- weapon = arme de foc, cuțite folosite amenințător, muniție, explozibil.
- blood = sânge, răni deschise, violență grafică, cadavre.
- nudity = genitalii, fese goale, sfârcuri expuse, lenjerie care conturează explicit genitalele.
- sexual_act = act sexual explicit.
Fii strict. Nu inventa. Nu descrie persoana.`;

export async function classifyPhoto(
  imageUrl: string,
  surface: PhotoSurface,
): Promise<PhotoVerdict> {
  const raw = await aiComplete({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Evaluează imaginea:" },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0,
    maxTokens: 200,
    json: true,
  });

  let j: Partial<PhotoVerdict> = {};
  try {
    j = JSON.parse(raw) as Partial<PhotoVerdict>;
  } catch {
    // fail-closed: trimitem la om
    return {
      minor: false,
      weapon: false,
      blood: false,
      nudity: false,
      sexual_act: false,
      allowed: false,
      reason: "Clasificare AI indisponibilă — necesită verificare umană.",
      severity: "normal",
    };
  }

  const minor = !!j.minor;
  const weapon = !!j.weapon;
  const blood = !!j.blood;
  const nudity = !!j.nudity;
  const sexual = !!j.sexual_act;

  // Interzis oriunde în aplicație
  const universalBan = minor || weapon || blood;
  const allowed = surface === "album" ? !universalBan : !(universalBan || nudity || sexual);

  const severity: PhotoVerdict["severity"] = minor
    ? "critical"
    : weapon || blood
      ? "high"
      : "normal";

  const reason =
    (typeof j.reason === "string" && j.reason.slice(0, 200)) ||
    (minor
      ? "Posibil minor în imagine."
      : weapon
        ? "Armă vizibilă."
        : blood
          ? "Sânge / violență."
          : nudity || sexual
            ? "Conținut sexual — permis doar în albumul privat."
            : "");

  return { minor, weapon, blood, nudity, sexual_act: sexual, allowed, reason, severity };
}
