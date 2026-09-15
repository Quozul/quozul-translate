export const DETECT_SOURCE = "detect";

export const MODEL_PRESETS = ["turbo", "balanced", "quality"] as const;
export type ModelPreset = (typeof MODEL_PRESETS)[number];

export type SourcePolicy = "required" | "automatic";

interface ModelFamilyDefinition {
  readonly id: string;
  readonly name: string;
  readonly sourcePolicy: SourcePolicy;
  readonly models: Readonly<Record<ModelPreset, string>>;
  readonly languages: readonly string[];
}

const FAMILIES = [
  {
    id: "milmmt",
    name: "MiLMMT",
    sourcePolicy: "required",
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
    sourcePolicy: "automatic",
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
] as const satisfies readonly ModelFamilyDefinition[];

export type ModelFamily = (typeof FAMILIES)[number];

export type ModelFamilyId = ModelFamily["id"];

export const MODEL_FAMILIES: readonly ModelFamily[] = FAMILIES;

export const DEFAULT_FAMILY: ModelFamilyId = "milmmt";
export const DEFAULT_PRESET: ModelPreset = "balanced";

export function familyById(id: string): ModelFamily | undefined {
  return MODEL_FAMILIES.find((family) => family.id === id);
}

export function isModelPreset(value: string): value is ModelPreset {
  return (MODEL_PRESETS as readonly string[]).includes(value);
}

export function familySupports(
  family: ModelFamily,
  source: string | null,
  target: string,
): boolean {
  const languages: readonly string[] = family.languages;
  if (!languages.includes(target)) return false;
  if (family.sourcePolicy === "required") {
    return source !== null && languages.includes(source);
  }
  // "automatic" families detect the language themselves and cannot honour an
  // explicit source language, so explicit sources fall back to other families.
  return source === null;
}

/**
 * Picks the family that will serve a request. Fallback priority is the
 * user-selected family first, then the remaining families in declaration
 * order (MiLMMT, then Hy-MT2).
 */
export function resolveFamily(
  selected: ModelFamilyId,
  source: string | null,
  target: string,
): ModelFamily | null {
  const current = familyById(selected);
  const ordered: ModelFamily[] = current
    ? [current, ...MODEL_FAMILIES.filter((family) => family.id !== current.id)]
    : [...MODEL_FAMILIES];
  return (
    ordered.find((family) => familySupports(family, source, target)) ?? null
  );
}
