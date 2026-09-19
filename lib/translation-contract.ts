import { z } from "zod";
import { languageByCode } from "@/lib/languages";
import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  MODEL_FAMILIES,
  MODEL_PRESETS,
  type ModelFamilyId,
  type ModelPreset,
} from "./models";

export const MAX_TEXT_LENGTH = 4_096;

const FALLBACK_LANGUAGE_CODE = "en";

/**
 * The browser's UI language resolved to a supported code, falling back to
 * English. Codes are the canonical language identity sent to the API.
 */
export const DEFAULT_TARGET =
  languageByCode(navigator.language)?.code ?? FALLBACK_LANGUAGE_CODE;

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
  /** Id of the family that actually served the text (may differ from the request). */
  family: z.string().optional(),
  /** Quality preset of the model that served the text. */
  preset: z.string().optional(),
  /** True when the translation came from the in-memory cache. */
  cached: z.boolean().optional(),
  /**
   * Server-side wall time for the translation, in milliseconds. Deliberately
   * lax: bogus metadata must never invalidate an otherwise good translation.
   */
  durationMs: z.number().optional(),
});

export type TranslationRequestBody = z.infer<
  typeof translationRequestBodySchema
>;
export type TranslationResponseBody = z.infer<
  typeof translationResponseBodySchema
>;

export { DEFAULT_FAMILY, DEFAULT_PRESET };
