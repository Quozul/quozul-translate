import { z } from "zod";
import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  MODEL_FAMILIES,
  MODEL_PRESETS,
  type ModelFamilyId,
  type ModelPreset,
} from "./models";

export const MAX_TEXT_LENGTH = 20_000;

export const DEFAULT_TARGET = "French";

function isFamilyId(value: string): value is ModelFamilyId {
  return MODEL_FAMILIES.some((family) => family.id === value);
}

function isPresetKey(value: string): value is ModelPreset {
  return (MODEL_PRESETS as readonly string[]).includes(value);
}

export const translationRequestBodySchema = z.object({
  text: z.string(),
  source: z.string(),
  target: z.string(),
  family: z.string().refine(isFamilyId),
  preset: z.string().refine(isPresetKey),
});

export const translationResponseBodySchema = z.object({
  translation: z.string(),
  family: z.string().optional(),
  cached: z.boolean().optional(),
});

export type TranslationRequestBody = z.infer<typeof translationRequestBodySchema>;
export type TranslationResponseBody = z.infer<typeof translationResponseBodySchema>;

export { DEFAULT_FAMILY, DEFAULT_PRESET };
