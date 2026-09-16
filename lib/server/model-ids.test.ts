import { describe, expect, it } from "vitest";
import { MODEL_FAMILIES, MODEL_PRESETS } from "../models";
import { modelIdFor } from "./model-ids";

describe("modelIdFor", () => {
  it("maps each family and preset to its provider checkpoint", () => {
    expect(modelIdFor("milmmt", "turbo")).toBe("local/milmmt-46-1b");
    expect(modelIdFor("milmmt", "balanced")).toBe("local/milmmt-46-4b");
    expect(modelIdFor("milmmt", "quality")).toBe("local/milmmt-46-12b");
    expect(modelIdFor("hy-mt2", "turbo")).toBe("local/hy-mt2-1.8b");
    expect(modelIdFor("hy-mt2", "balanced")).toBe("local/hy-mt2-7b");
    expect(modelIdFor("hy-mt2", "quality")).toBe("local/hy-mt2-30b-a3b");
    expect(modelIdFor("translategemma", "turbo")).toBe(
      "local/translategemma-4b-it",
    );
    expect(modelIdFor("translategemma", "balanced")).toBe(
      "local/translategemma-12b-it",
    );
    expect(modelIdFor("translategemma", "quality")).toBe(
      "local/translategemma-27b-it",
    );
  });

  it("covers every configured family and preset without holes", () => {
    for (const family of MODEL_FAMILIES) {
      for (const preset of MODEL_PRESETS) {
        expect(modelIdFor(family.id, preset)).toMatch(/^local\//);
      }
    }
  });
});
