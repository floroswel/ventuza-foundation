import { describe, expect, it } from "vitest";

import {
  parseAcceptLanguage,
  pickFromAcceptLanguage,
  pickSupportedLanguage,
} from "@/lib/i18n/accept-language";
import { flatten, unflatten, parseBundle, bundleToOverrides } from "@/lib/i18n/dictionary-io";

const SUPPORTED = ["ro", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "hu"];

describe("accept-language", () => {
  it("sortează după q", () => {
    const p = parseAcceptLanguage("de;q=0.5,hu,en;q=0.8");
    expect(p.map((x) => x.code)).toEqual(["hu", "en", "de"]);
  });

  it("alege limba suportată, cu fallback pe limba de bază", () => {
    expect(pickFromAcceptLanguage("de-AT,de;q=0.9", SUPPORTED)).toBe("de");
    expect(pickFromAcceptLanguage("ro-MD", SUPPORTED)).toBe("ro");
    expect(pickFromAcceptLanguage("ja-JP", SUPPORTED)).toBe("en");
    expect(pickFromAcceptLanguage(null, SUPPORTED)).toBe("en");
    expect(pickSupportedLanguage(["pt-BR"], SUPPORTED)).toBe("pt");
  });
});

describe("dictionary io", () => {
  it("flatten/unflatten sunt reciproce", () => {
    const nested = { a: { b: "x" }, c: "y" };
    expect(flatten(nested)).toEqual({ "a.b": "x", c: "y" });
    expect(unflatten(flatten(nested))).toEqual(nested);
  });

  it("importul păstrează doar diferențele față de build", () => {
    const bundle = parseBundle({ languages: { de: { "a.b": "neu", "c": "same" } } }, SUPPORTED);
    const diff = bundleToOverrides(bundle, { de: { a: { b: "alt" }, c: "same" } });
    expect(diff).toEqual({ de: { "a.b": "neu" } });
  });

  it("refuză limbi necunoscute", () => {
    expect(() => parseBundle({ languages: { xx: {} } }, SUPPORTED)).toThrow();
  });
});
