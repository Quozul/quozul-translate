import { describe, expect, it } from "vitest";
import {
  getLanguageGroups,
  matchesLanguage,
  normalizeLanguageQuery,
} from "./languages";

const DETECT = { value: "detect", label: "Detect language" };

describe("normalizeLanguageQuery", () => {
  it("trims and lowercases once", () => {
    expect(normalizeLanguageQuery("  JA  ")).toBe("ja");
  });
});

describe("matchesLanguage", () => {
  it("exact full code selects only that language, not prefixes", () => {
    expect(
      matchesLanguage({ name: "Japanese", native: "日本語", code: "ja" }, "ja"),
    ).toBe(true);
    expect(
      matchesLanguage({ name: "Gujarati", native: "ગુજરાતી", code: "gu" }, "ja"),
    ).toBe(false);
  });

  it("matches English names, native names, and codes case-insensitively", () => {
    const korean = { name: "Korean", native: "한국어", code: "ko" };
    expect(matchesLanguage(korean, "korean")).toBe(true);
    expect(matchesLanguage(korean, "한")).toBe(true);
    expect(matchesLanguage(korean, " KO ")).toBe(true);
    expect(matchesLanguage(korean, "xyz")).toBe(false);
  });
});

describe("getLanguageGroups", () => {
  it("splits frequent from the rest and deduplicates", () => {
    const groups = getLanguageGroups({
      query: "",
      frequent: ["fr", "de"],
    });
    expect(groups.frequent.map((l) => l.name)).toEqual(["French", "German"]);
    expect(groups.others.map((l) => l.name)).not.toContain("French");
    expect(groups.others.length).toBeGreaterThan(0);
  });

  it("caps frequent entries at three", () => {
    const groups = getLanguageGroups({
      query: "",
      frequent: ["fr", "de", "es", "ja"],
    });
    expect(groups.frequent).toHaveLength(3);
  });

  it("keeps frequent ordering by usage, not catalog order", () => {
    const groups = getLanguageGroups({
      query: "",
      frequent: ["de", "fr"],
    });
    expect(groups.frequent.map((l) => l.name)).toEqual(["German", "French"]);
  });

  it("filters frequent and other groups by the query", () => {
    const groups = getLanguageGroups({
      query: "japan",
      frequent: ["de", "ja"],
    });
    expect(groups.frequent.map((l) => l.name)).toEqual(["Japanese"]);
    expect(groups.others.map((l) => l.name)).not.toContain("Japanese");
    expect(groups.others.map((l) => l.name)).not.toContain("French");
  });

  it("handles the detection option independently of real languages", () => {
    const groups = getLanguageGroups({
      query: "",
      frequent: [],
      detection: DETECT,
    });
    expect(groups.detection).toEqual(DETECT);

    const filtered = getLanguageGroups({
      query: "detect",
      frequent: [],
      detection: DETECT,
    });
    expect(filtered.detection).toEqual(DETECT);
    expect(filtered.others).toHaveLength(0);
  });

  it("drops detection when it does not match the query", () => {
    const groups = getLanguageGroups({
      query: "fran",
      frequent: [],
      detection: DETECT,
    });
    expect(groups.detection).toBeNull();
    expect(groups.others.map((l) => l.name)).toEqual(["French"]);
  });

  it("returns nothing matching for a nonsense query", () => {
    const groups = getLanguageGroups({ query: "zzzzz", frequent: ["fr"] });
    expect(groups.frequent).toHaveLength(0);
    expect(groups.others).toHaveLength(0);
  });
});
