/**
 * Regresie — nicio suprafață de notificări NU trebuie să scurgă conținut de mesaj
 * (text, caption, tip media, URL media) fără gate `show_preview`.
 *
 * Testul scanează sursele (TS + SQL) și blochează orice regresie viitoare.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (abs: string) => readFileSync(abs, "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/__tests__/.test(f));
const sqlFiles = walk(MIGRATIONS).filter((f) => f.endsWith(".sql"));

// ─────────────────────────────────────────────────────────────────────────────
// 1. sendPushToUser — niciun caller nu trimite conținut brut al mesajului
// ─────────────────────────────────────────────────────────────────────────────

type Callsite = { file: string; snippet: string };

function extractSendPushCalls(src: string, file: string): Callsite[] {
  const calls: Callsite[] = [];
  const re = /sendPushToUser\s*\(\s*\{[\s\S]*?\n\s*\}\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    calls.push({ file, snippet: m[0] });
  }
  return calls;
}

describe("Notificări push — regresie confidențialitate", () => {
  const callsites: Callsite[] = [];
  for (const f of srcFiles) {
    callsites.push(...extractSendPushCalls(read(f), f));
  }

  it("există cel puțin un callsite scanat (sanity check)", () => {
    expect(callsites.length).toBeGreaterThan(0);
  });

  it("niciun sendPushToUser nu injectează media_type / media_url / caption în payload", () => {
    for (const c of callsites) {
      expect(c.snippet, `în ${c.file}`).not.toMatch(/\b(media_type|media_url|caption)\b/);
    }
  });

  it("niciun sendPushToUser nu trimite body-ul mesajului direct (msg.body, message.body, insert.body etc.)", () => {
    for (const c of callsites) {
      // body poate fi doar: string literal, variabilă construită prin buildMessageNotificationBody,
      // sau un mesaj generic. Refuzăm accesul la .body al unui obiect de tip message.
      expect(c.snippet, `în ${c.file}`).not.toMatch(
        /body:\s*[a-zA-Z_$][\w$]*\.body\b/,
      );
      expect(c.snippet, `în ${c.file}`).not.toMatch(/body:\s*NEW\.body/i);
    }
  });

  it("clientul nu mai trimite deloc push de mesaj", () => {
    // Garanția s-a mutat în baza de date: trigger-ul `tg_notify_new_message`
    // programează notificarea cu un corp generic scris în SQL, în aceeași
    // tranzacție cu mesajul. `chat.ts` nu mai atinge stratul de push, deci
    // conținutul mesajului nu mai părăsește telefonul pentru notificări.
    const chatSrc = read(join(SRC, "lib/chat.ts"));
    expect(chatSrc).not.toMatch(/sendPushToUser|sendMessagePush|pushNewMessageNotification/);
    expect(chatSrc).not.toMatch(/body:\s*preview\.slice/);
    expect(chatSrc).not.toMatch(/body:\s*preview\s*[,}]/);

    // Corpul programat în SQL este constanta generică, nu NEW.body.
    const mig = read(
      join(process.cwd(), "supabase/migrations/20260828121000_push_outbox_server_side_dispatch.sql"),
    );
    const enqueue = /PERFORM public\.enqueue_push\(([\s\S]*?)\);/.exec(mig);
    expect(enqueue, "migrația trebuie să programeze push-ul").not.toBeNull();
    expect(enqueue![1]).toContain("'Ai un mesaj nou'");
    expect(enqueue![1]).not.toMatch(/NEW\.body|body_out/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Inserturi în `notifications` — body nu poate fi luat direct din mesaj
// ─────────────────────────────────────────────────────────────────────────────

describe("Notificări DB — inserts în public.notifications", () => {
  const forbidden = /\.from\(\s*["']notifications["']\s*\)\s*\.insert\([\s\S]{0,600}?\b(media_type|media_url|caption|msg\.body|message\.body)\b/;

  it("niciun client TS nu inserează câmpuri de conținut de mesaj în notifications", () => {
    for (const f of srcFiles) {
      const src = read(f);
      const match = src.match(forbidden);
      expect(match, `${f} conține insert cu conținut de mesaj: ${match?.[0]?.slice(0, 200)}`).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Trigger SQL `tg_notify_new_message` — preview doar sub show_preview
// ─────────────────────────────────────────────────────────────────────────────

describe("Trigger SQL — tg_notify_new_message", () => {
  // Cea mai recentă definiție a triggerului = ultima migrare care îl (re)creează.
  const defs = sqlFiles
    .filter((f) => {
      const src = read(f);
      return /CREATE OR REPLACE FUNCTION\s+public\.tg_notify_new_message\b/i.test(src);
    })
    .sort();
  const latest = defs.at(-1);

  it("există o definiție a triggerului", () => {
    expect(latest, "nu am găsit tg_notify_new_message în migrări").toBeDefined();
  });

  it("body-ul este mereu generic — nu apar NEW.body / media_type / caption niciunde", () => {
    if (!latest) return;
    const src = read(latest);
    const bodyMatch = src.match(
      /CREATE OR REPLACE FUNCTION\s+public\.tg_notify_new_message[\s\S]*?\$function\$([\s\S]*?)\$function\$/i,
    );
    expect(bodyMatch, "nu am extras corpul funcției").not.toBeNull();
    const fnBody = bodyMatch![1];

    // Fallback-ul fără opt-in e mereu generic
    expect(fnBody).toMatch(/'Ai un mesaj nou'/);

    // Preview-ul e permis DOAR în ramura `IF show_preview THEN`.
    const previewBranch = fnBody.match(/IF\s+show_preview\s+THEN([\s\S]*?)END IF;/i);
    expect(previewBranch, "lipsește gate-ul show_preview").not.toBeNull();
    const outsideGate = fnBody.replace(previewBranch![0], "");

    // În afara gate-ului nu apare niciun câmp de conținut.
    expect(outsideGate).not.toMatch(/NEW\.body/i);
    expect(outsideGate).not.toMatch(/NEW\.media_type/i);
    expect(outsideGate).not.toMatch(/NEW\.media_url/i);
    expect(outsideGate).not.toMatch(/caption/i);

    // Nici în interiorul gate-ului nu trimitem URL-uri media sau caption brut.
    expect(previewBranch![1]).not.toMatch(/NEW\.media_url/i);
    expect(previewBranch![1]).not.toMatch(/caption/i);
  });
});

