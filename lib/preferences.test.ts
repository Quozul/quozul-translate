import { describe, expect, it } from "vitest";
import {
  getFrequentLanguages,
  loadTranslationPreferences,
  parseTranslationPreferences,
  saveTranslationPreferences,
  type StorageReader,
  type StorageWriter,
} from "./preferences";

const PREFERENCES_KEY = "qzl.preferences.v1";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const reader: StorageReader = { getItem: (k) => data.get(k) ?? null };
  const writer: StorageWriter = { setItem: (k, v) => void data.set(k, v) };
  return { data, reader, writer };
}

describe("parseTranslationPreferences", () => {
  it("falls back to defaults for null, arrays, and scalars", () => {
    for (const value of [null, undefined, 42, "x", [], true]) {
      expect(parseTranslationPreferences(value).family).toBe("milmmt");
    }
  });

  it("preserves valid fields and defaults malformed ones individually", () => {
    const parsed = parseTranslationPreferences({
      target: "Japanese",
      source: "not-a-language",
      family: "hy-mt2",
      preset: "nonsense",
      translation_usage: {},
    });
    expect(parsed.target).toBe("Japanese");
    expect(parsed.source).toBe("detect");
    expect(parsed.family).toBe("hy-mt2");
    expect(parsed.preset).toBe("turbo");
  });

  it.each([
    ["fast", "hy-mt2", "turbo"],
    ["quality", "hy-mt2", "balanced"],
    ["turbo", "hy-mt2", "quality"],
  ] as const)("migrates legacy model %s to %s/%s", (legacy, family, preset) => {
    const parsed = parseTranslationPreferences({ model: legacy });
    expect(parsed.family).toBe(family);
    expect(parsed.preset).toBe(preset);
  });

  it("prefers explicit family/preset over legacy model", () => {
    const parsed = parseTranslationPreferences({
      family: "milmmt",
      preset: "quality",
      model: "fast",
    });
    expect(parsed.family).toBe("milmmt");
    expect(parsed.preset).toBe("quality");
  });

  it("keeps an explicit source for auto-detecting families (request-time fallback)", () => {
    const parsed = parseTranslationPreferences({
      family: "hy-mt2",
      source: "English",
    });
    expect(parsed.source).toBe("English");
  });

  it("keeps an explicit source for required-source families", () => {
    const parsed = parseTranslationPreferences({
      family: "milmmt",
      source: "English",
    });
    expect(parsed.source).toBe("English");
  });

  describe("usage counters", () => {
    it("drops arrays, non-numbers, negatives, fractions, NaN, and unknown languages", () => {
      const parsed = parseTranslationPreferences({
        translation_usage: {
          French: 3,
          German: "9",
          Spanish: -2,
          Italian: 1.5,
          Russian: Number.NaN,
          Klingon: 12,
        },
      });
      expect(parsed.usage).toEqual({ French: 3 });
    });

    it("rejects an array root for usage", () => {
      const parsed = parseTranslationPreferences({ translation_usage: [1, 2] });
      expect(parsed.usage).toEqual({});
    });
  });
});

describe("loadTranslationPreferences", () => {
  it("returns defaults when storage is null (SSR or blocked storage)", () => {
    expect(loadTranslationPreferences(null).target).toBe("English");
  });

  it("returns defaults when the key is missing", () => {
    const { reader } = memoryStorage();
    expect(loadTranslationPreferences(reader).preset).toBe("turbo");
  });

  it("returns defaults for invalid JSON", () => {
    const { reader } = memoryStorage({ [PREFERENCES_KEY]: "{oops" });
    expect(loadTranslationPreferences(reader).family).toBe("milmmt");
  });

  it("round-trips a saved record under the legacy wire name", () => {
    const { reader, writer, data } = memoryStorage();
    saveTranslationPreferences(writer, {
      target: "German",
      source: "detect",
      family: "hy-mt2",
      preset: "turbo",
      usage: { German: 4 },
    });
    const wire = JSON.parse(data.get(PREFERENCES_KEY) ?? "{}");
    expect(wire.translation_usage).toEqual({ German: 4 });
    const loaded = loadTranslationPreferences(reader);
    expect(loaded.target).toBe("German");
    expect(loaded.usage.German).toBe(4);
  });

  it("survives storage throwing on read or write", () => {
    const hostile = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceeded");
      },
    };
    expect(loadTranslationPreferences(hostile).family).toBe("milmmt");
    expect(() =>
      saveTranslationPreferences(hostile, {
        target: "French",
        source: "detect",
        family: "milmmt",
        preset: "balanced",
        usage: {},
      }),
    ).not.toThrow();
  });
});

describe("getFrequentLanguages", () => {
  it("orders by count, ties alphabetical, known languages only", () => {
    const frequent = getFrequentLanguages(
      { German: 5, French: 9, Spanish: 9, Klingon: 100, Italian: 0 },
      3,
    );
    expect(frequent).toEqual(["French", "Spanish", "German"]);
  });

  it("returns an empty list for empty usage", () => {
    expect(getFrequentLanguages({}, 3)).toEqual([]);
  });
});
