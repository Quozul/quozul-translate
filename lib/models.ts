export type ModelFamilyId = "milmmt" | "hy-mt2";

export type ModelPreset = "turbo" | "balanced" | "quality";

/// Source language value meaning "let the model detect the language".
export const DETECT_SOURCE = "detect";

export const MODEL_PRESETS: ModelPreset[] = ["turbo", "balanced", "quality"];

export const DEFAULT_FAMILY: ModelFamilyId = "milmmt";
export const DEFAULT_PRESET: ModelPreset = "balanced";

export interface ModelFamily {
  id: ModelFamilyId;
  /// Display name shown in the UI.
  name: string;
  /// MiLMMT requires the source language to be named explicitly in its prompt;
  /// Hy-MT2 always detects it.
  requiresSource: boolean;
  /// Concrete model IDs resolved on the server.
  models: Record<ModelPreset, string>;
  /// Language codes supported by this family.
  languages: string[];
}

/// Ordered by preference: the selected family is tried first, then the
/// remaining families in this order when the current model does not support
/// the chosen languages.
export const MODEL_FAMILIES: ModelFamily[] = [
  {
    id: "milmmt",
    name: "MiLMMT",
    requiresSource: true,
    models: {
      turbo: "local/milmmt-46-1b",
      balanced: "local/milmmt-46-4b",
      quality: "local/milmmt-46-12b",
    },
    languages: [
      "ar",
      "az",
      "bg",
      "bn",
      "ca",
      "cs",
      "da",
      "de",
      "el",
      "en",
      "es",
      "fa",
      "fi",
      "fr",
      "he",
      "hi",
      "hr",
      "hu",
      "id",
      "it",
      "ja",
      "kk",
      "km",
      "ko",
      "lo",
      "ms",
      "my",
      "no",
      "nl",
      "pl",
      "pt",
      "ro",
      "ru",
      "sk",
      "sl",
      "sv",
      "ta",
      "th",
      "tl",
      "tr",
      "ur",
      "uz",
      "vi",
      "yue",
      "zh",
      "zh-Hant",
    ],
  },
  {
    id: "hy-mt2",
    name: "Hy-MT2",
    requiresSource: false,
    models: {
      turbo: "local/hy-mt2-1.8b",
      balanced: "local/hy-mt2-7b",
      quality: "local/hy-mt2-30b-a3b",
    },
    languages: [
      "ar",
      "bn",
      "bo",
      "cs",
      "de",
      "en",
      "es",
      "fa",
      "fr",
      "gu",
      "he",
      "hi",
      "id",
      "it",
      "ja",
      "kk",
      "km",
      "ko",
      "mn",
      "mr",
      "ms",
      "my",
      "nl",
      "pl",
      "pt",
      "ru",
      "ta",
      "te",
      "th",
      "tl",
      "tr",
      "uk",
      "ur",
      "ug",
      "vi",
      "yue",
      "zh",
      "zh-Hant",
    ],
  },
];

export function familyById(id: string): ModelFamily | undefined {
  return MODEL_FAMILIES.find((family) => family.id === id);
}

export function isModelPreset(value: string): value is ModelPreset {
  return (MODEL_PRESETS as string[]).includes(value);
}

export function familySupports(
  family: ModelFamily,
  source: string | null,
  target: string,
): boolean {
  if (!family.languages.includes(target)) return false;
  if (family.requiresSource) {
    return source !== null && family.languages.includes(source);
  }
  // Auto-detecting families handle any source language.
  return true;
}

/// Returns the first family that supports the language pair, trying the
/// selected family first and then falling back by preference. `null` means no
/// model can handle the request as configured.
export function resolveFamily(
  selected: ModelFamilyId,
  source: string | null,
  target: string,
): ModelFamily | null {
  const current = familyById(selected);
  const ordered = current
    ? [current, ...MODEL_FAMILIES.filter((family) => family.id !== current.id)]
    : MODEL_FAMILIES;
  return (
    ordered.find((family) => familySupports(family, source, target)) ?? null
  );
}
