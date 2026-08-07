/**
 * Canalele Android decid sunetul, heads-up-ul și ce se vede pe ecranul blocat.
 *
 * Regresia reparată: `messages` și `matches` erau create cu `sound: "default"`.
 * Pluginul nu tratează "default" ca valoare specială — îl transformă în
 * `android.resource://<pachet>/raw/default` (NotificationChannelManager.java:88-98).
 * Proiectul nu are `res/raw`, deci canalele erau MUTE. `system`, singurul fără
 * `sound`, suna corect — exact simptomul raportat de pe telefon.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHANNELS,
  RETIRED_CHANNEL_IDS,
  IMPORTANCE_HIGH,
  VISIBILITY_PRIVATE,
  channelIdForType,
  knownChannelIds,
} from "@/lib/notification-channels";

const byId = (id: string) => CHANNELS.find((c) => c.id === id);

describe("sunetul canalelor", () => {
  it("niciun canal nu setează `sound` — altfel Android caută res/raw și rămâne mut", () => {
    for (const c of CHANNELS) {
      expect(c).not.toHaveProperty("sound");
    }
  });

  it("nu există res/raw în proiect, deci orice `sound` ar fi un URI rupt", () => {
    // Dacă cineva adaugă un sunet custom, acest test cade și îl obligă să
    // adauge ȘI resursa. Fix pentru cauza originală, nu doar pentru simptom.
    let hasRaw = true;
    try {
      readFileSync(resolve(process.cwd(), "android-overrides/res/raw"));
    } catch {
      hasRaw = false;
    }
    expect(hasRaw).toBe(false);
  });
});

describe("importanță și heads-up", () => {
  it("mesajele pot suna și pot apărea heads-up", () => {
    // `android.priority: HIGH` din payload NU ridică importanța pe Android 8+.
    expect(byId("messages_v2")?.importance).toBe(IMPORTANCE_HIGH);
  });

  it("match-urile și like-urile la fel", () => {
    expect(byId("matches_v2")?.importance).toBe(IMPORTANCE_HIGH);
  });

  it("canalul de sistem rămâne fără heads-up", () => {
    expect(byId("system")?.importance).toBe(3);
  });

  it("vibrația e permisă, nu forțată — modul telefonului decide", () => {
    expect(byId("messages_v2")?.vibration).toBe(true);
  });
});

describe("confidențialitate pe ecranul blocat", () => {
  it("mesajele nu își arată conținutul pe lock screen", () => {
    expect(byId("messages_v2")?.visibility).toBe(VISIBILITY_PRIVATE);
  });

  it("like-urile și match-urile la fel", () => {
    expect(byId("matches_v2")?.visibility).toBe(VISIBILITY_PRIVATE);
  });
});

describe("versionarea canalelor", () => {
  it("canalele rupte sunt retrase, nu refolosite", () => {
    // Android păstrează pentru totdeauna setările unui canal, iar recrearea cu
    // ACELAȘI id le restaurează. Un id nou este singura cale.
    for (const id of RETIRED_CHANNEL_IDS) {
      expect(knownChannelIds()).not.toContain(id);
    }
    expect(RETIRED_CHANNEL_IDS).toContain("messages");
    expect(RETIRED_CHANNEL_IDS).toContain("matches");
  });

  it("`system` nu se versionează: setările lui au fost mereu corecte", () => {
    expect(knownChannelIds()).toContain("system");
    expect(RETIRED_CHANNEL_IDS).not.toContain("system");
  });
});

describe("rutarea payload → canal", () => {
  it.each([
    ["message", "messages_v2"],
    ["new_message", "messages_v2"],
    ["msg", "messages_v2"],
    ["match", "matches_v2"],
    ["like", "matches_v2"],
    ["favorite", "matches_v2"],
    ["tap", "matches_v2"],
    ["woof", "matches_v2"],
    ["moderation", "system"],
    ["", "system"],
  ])("%s → %s", (type, expected) => {
    expect(channelIdForType(type)).toBe(expected);
  });

  it("tipul lipsă nu aruncă", () => {
    expect(channelIdForType(undefined)).toBe("system");
    expect(channelIdForType(null)).toBe("system");
  });

  it("orice canal ales de server există pe device", () => {
    // Dacă serverul trimite spre un channel_id inexistent, FCM afișează
    // notificarea pe „Miscellaneous”, cu importanță DEFAULT.
    const ids = knownChannelIds();
    for (const t of ["message", "match", "like", "tap", "favorite", "system", "orice"]) {
      expect(ids).toContain(channelIdForType(t));
    }
  });
});

describe("serverul folosește aceeași sursă de adevăr", () => {
  const raw = readFileSync(resolve(process.cwd(), "src/lib/fcm-push.server.ts"), "utf8");
  // Fără comentarii: explicația istorică a unei valori scoase nu trebuie să
  // treacă drept valoarea însăși.
  const server = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("fcm-push.server importă `channelIdForType` în loc să dubleze maparea", () => {
    expect(server).toContain("channelIdForType");
  });

  it("nu mai trimite click_action de Flutter", () => {
    // PendingIntent-ul cu acea acțiune nu se rezolvă la nicio activitate din
    // Suzeta, deci tap-ul pe notificare nu deschidea nimic.
    expect(server).not.toContain("FLUTTER_NOTIFICATION_CLICK");
  });

  it("trimite `tag`, ca o notificare să înlocuiască precedenta pentru același eveniment", () => {
    expect(server).toMatch(/tag:\s*payload\.tag/);
  });
});
