import "server-only";
import type { ModelFamilyId, ModelPreset } from "../models";

/**
 * Concrete provider model IDs, keyed by family and quality preset. Server-only:
 * these names reveal the exact checkpoints served by our provider and must never
 * be imported by client code. The shared `lib/models.ts` registry only carries
 * the family identity and preset so the browser can display "MiLMMT (Balanced)"
 * without learning the underlying model name.
 */
const MODEL_IDS = {
  milmmt: {
    turbo: "local/milmmt-46-1b",
    balanced: "local/milmmt-46-4b",
    quality: "local/milmmt-46-12b",
  },
  "hy-mt2": {
    turbo: "local/hy-mt2-1.8b",
    balanced: "local/hy-mt2-7b",
    quality: "local/hy-mt2-30b-a3b",
  },
  translategemma: {
    turbo: "local/translategemma-4b-it",
    balanced: "local/translategemma-12b-it",
    quality: "local/translategemma-27b-it",
  },
} as const satisfies Record<ModelFamilyId, Record<ModelPreset, string>>;

export function modelIdFor(
  familyId: ModelFamilyId,
  preset: ModelPreset,
): string {
  return MODEL_IDS[familyId][preset];
}
