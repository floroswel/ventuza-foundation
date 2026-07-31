import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("Realtime channel lifecycle", () => {
  it("înregistrează toate callback-urile înainte de subscribe", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      const channelStatements = source.split(".channel(").slice(1);

      for (const statement of channelStatements) {
        const subscribe = statement.indexOf(".subscribe(");
        if (subscribe < 0) continue;
        const terminator = statement.indexOf(";", subscribe);
        const subscribedStatement = statement.slice(
          subscribe,
          terminator < 0 ? statement.length : terminator,
        );
        if (subscribedStatement.includes(".on(")) violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("canalele critice de mesaje folosesc topicuri unice per lifecycle", () => {
    const unread = readFileSync(join(process.cwd(), "src/hooks/useUnreadMessages.ts"), "utf8");
    const thread = readFileSync(join(process.cwd(), "src/routes/messages.$id.tsx"), "utf8");

    expect(unread).toContain('uniqueRealtimeTopic(`conv-list:${userId}`)');
    expect(thread).toContain('uniqueRealtimeTopic(`thread-${id}`)');
  });
});