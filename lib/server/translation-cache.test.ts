import { describe, expect, it } from "vitest";
import { createTranslationCache, type CacheKey } from "./translation-cache";

function key(overrides: Partial<CacheKey> = {}): CacheKey {
  return {
    text: "hello",
    source: "English",
    target: "French",
    model: "local/milmmt-46-4b",
    ...overrides,
  };
}

describe("translation cache", () => {
  it("stores and retrieves by full key", () => {
    const cache = createTranslationCache();
    cache.insert(key(), "bonjour", 0);
    expect(cache.get(key(), 0)).toBe("bonjour");
  });

  it("separates entries by source, target, and model", () => {
    const cache = createTranslationCache();
    cache.insert(key(), "a", 0);
    expect(cache.get(key({ source: "Spanish" }), 0)).toBeUndefined();
    expect(cache.get(key({ target: "German" }), 0)).toBeUndefined();
    expect(cache.get(key({ model: "other" }), 0)).toBeUndefined();
  });

  it("expires entries at the TTL boundary", () => {
    const cache = createTranslationCache({ ttlMs: 1000 });
    cache.insert(key(), "x", 0);
    expect(cache.get(key(), 999)).toBe("x");
    expect(cache.get(key(), 1000)).toBeUndefined();
  });

  it("evicts the oldest entry first when over the entry limit (FIFO)", () => {
    const cache = createTranslationCache({ maxEntries: 2, ttlMs: 10_000 });
    cache.insert(key({ text: "one" }), "1", 0);
    cache.insert(key({ text: "two" }), "2", 0);
    cache.insert(key({ text: "three" }), "3", 0);
    cache.get(key({ text: "two" }), 0);
    cache.insert(key({ text: "four" }), "4", 0);
    expect(cache.get(key({ text: "one" }), 0)).toBeUndefined();
    expect(cache.get(key({ text: "three" }), 0)).toBe("3");
    expect(cache.get(key({ text: "four" }), 0)).toBe("4");
  });

  it("replacing an entry updates it without growing past the limit", () => {
    const cache = createTranslationCache({ maxEntries: 1, ttlMs: 10_000 });
    cache.insert(key(), "old", 0);
    cache.insert(key(), "new", 1);
    expect(cache.get(key(), 1)).toBe("new");
  });

  it("skips entries larger than the whole byte budget", () => {
    const cache = createTranslationCache({ maxBytes: 4, ttlMs: 10_000 });
    cache.insert(key(), "way too large for four bytes", 0);
    expect(cache.get(key(), 0)).toBeUndefined();
  });

  it("recomputes byte accounting on replace (no ghost bytes)", () => {
    const cache = createTranslationCache({
      maxBytes: 36,
      maxEntries: 100,
      ttlMs: 10_000,
    });
    const k1 = key({ text: "one", source: "English", target: "French", model: "m" });
    const k2 = key({ text: "two", source: "English", target: "French", model: "m" });
    cache.insert(k1, "longer", 0);
    cache.insert(k1, "x", 1);
    cache.insert(k2, "z", 2);
    expect(cache.get(k1, 2)).toBe("x");
    expect(cache.get(k2, 2)).toBe("z");
  });
});
