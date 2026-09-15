import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./languages";
import {
  familySupports,
  MODEL_FAMILIES,
  modelDisplayName,
  resolveFamily,
} from "./models";

describe("modelDisplayName", () => {
  it("combines the family name with the quality preset", () => {
    expect(modelDisplayName("milmmt", "balanced")).toBe("MiLMMT (Balanced)");
    expect(modelDisplayName("hy-mt2", "turbo")).toBe("Hy-MT2 (Turbo)");
    expect(modelDisplayName("milmmt", "quality")).toBe("MiLMMT (Quality)");
    expect(modelDisplayName("translategemma", "quality")).toBe(
      "TranslateGemma (Quality)",
    );
  });

  it("falls back to the family name when the preset is unknown", () => {
    expect(modelDisplayName("milmmt")).toBe("MiLMMT");
    expect(modelDisplayName("milmmt", null)).toBe("MiLMMT");
  });

  it("returns null for families this build does not know", () => {
    expect(modelDisplayName(null)).toBeNull();
    expect(modelDisplayName("", "balanced")).toBeNull();
    expect(modelDisplayName("gpt-9", "balanced")).toBeNull();
  });

  it("covers every configured family and preset", () => {
    for (const family of MODEL_FAMILIES) {
      expect(modelDisplayName(family.id, "balanced")).toBe(
        `${family.name} (Balanced)`,
      );
    }
  });
});

describe("TranslateGemma family", () => {
  const found = MODEL_FAMILIES.find((entry) => entry.id === "translategemma");

  function translategemma() {
    if (!found) throw new Error("TranslateGemma family is missing");
    return found;
  }

  it("serves the three TranslateGemma checkpoints", () => {
    expect(translategemma().sourcePolicy).toBe("required");
    expect(translategemma().models.turbo).toBe("local/translategemma-4b-it");
    expect(translategemma().models.balanced).toBe("local/translategemma-12b-it");
    expect(translategemma().models.quality).toBe("local/translategemma-27b-it");
  });

  it("names an explicit source and covers the catalog except Cantonese", () => {
    expect(familySupports(translategemma(), "en", "uk")).toBe(true);
    expect(familySupports(translategemma(), null, "uk")).toBe(false);
    const unsupported = LANGUAGES.map((language) => language.code).filter(
      (code) => !familySupports(translategemma(), "en", code),
    );
    expect(unsupported).toEqual(["yue"]);
  });

  it("only serves pairs that no earlier family can", () => {
    expect(resolveFamily("translategemma", "uk", "fr")?.id).toBe(
      "translategemma",
    );
    expect(resolveFamily("translategemma", "en", "yue")?.id).toBe("milmmt");
    expect(resolveFamily("translategemma", null, "uk")?.id).toBe("hy-mt2");
  });
});
