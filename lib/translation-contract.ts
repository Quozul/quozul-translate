import { z } from "zod";
import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  MODEL_FAMILIES,
  MODEL_PRESETS,
  type ModelFamilyId,
  type ModelPreset,
} from "./models";

/// Maximum number of characters (Unicode code points, as counted by
/// `countTranslationCharacters`) a single translation request may carry.
export const MAX_TEXT_LENGTH = 20_000;

/// Target language selected when no stored preference exists.
export const DEFAULT_TARGET = "French";

function isFamilyId(value: string): value is ModelFamilyId {
  return MODEL_FAMILIES.some((family) => family.id === value);
}

function isPresetKey(value: string): value is ModelPreset {
  return (MODEL_PRESETS as readonly string[]).includes(value);
}

/// The one request schema shared by the browser and the route handler.
/// Family and preset are validated here so both sides can trust the
/// narrowed types instead of re-checking strings.
export const translationRequestBodySchema = z.object({
  text: z.string(),
  /// Source language name, or `DETECT_SOURCE` for automatic detection.
  source: z.string(),
  target: z.string(),
  /// Model family ID and public preset key; concrete model IDs are resolved
  /// only on the server.
  family: z.string().refine(isFamilyId),
  preset: z.string().refine(isPresetKey),
});

export const translationResponseBodySchema = z.object({
  translation: z.string(),
  /// Family that actually ran; may differ from the requested one when a
  /// fallback happened. Present on successful responses.
  family: z.string().optional(),
  /// True when the translation came from the server-side cache.
  cached: z.boolean().optional(),
});

export type TranslationRequestBody = z.infer<typeof translationRequestBodySchema>;
export type TranslationResponseBody = z.infer<typeof translationResponseBodySchema>;

export { DEFAULT_FAMILY, DEFAULT_PRESET };
