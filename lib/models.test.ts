import { describe, expect, it } from "vitest";
import { MODEL_FAMILIES, modelDisplayName } from "./models";

describe("modelDisplayName", () => {
  it("combines the family name with the quality preset", () => {
    expect(modelDisplayName("milmmt", "balanced")).toBe("MiLMMT (Balanced)");
    expect(modelDisplayName("hy-mt2", "turbo")).toBe("Hy-MT2 (Turbo)");
    expect(modelDisplayName("milmmt", "quality")).toBe("MiLMMT (Quality)");
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
