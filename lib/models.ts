/// Source language value meaning "let the model detect the language".
export const DETECT_SOURCE = "detect";

/// Public preset keys, ordered from cheapest to best.
export const MODEL_PRESETS = ["turbo", "balanced", "quality"] as const;
export type ModelPreset = (typeof MODEL_PRESETS)[number];

/// Whether a family needs an explicit source language.
///
/// - `"required"` — the prompt names the source language; requests without
///   one are only served after falling back to an auto-detecting family.
/// - `"automatic"` — the family always detects the source itself, so the UI
///   locks the source picker on detection.
export type SourcePolicy = "required" | "automatic";

interface ModelFamilyDefinition {
  readonly id: string;
  /// Display name shown in the UI.
  readonly name: string;
  readonly sourcePolicy: SourcePolicy;
  /// Concrete model IDs, resolved on the server.
  readonly models: Readonly<Record<ModelPreset, string>>;
  /// Language codes supported by this family.
  readonly languages: readonly string[];
}

/// The registry: model-specific behavior (source policy, prompt capabilities,
/// model IDs) lives here as data, keyed by nothing the UI has to remember.
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

/// Entry of the family registry.
export type ModelFamily = (typeof FAMILIES)[number];

/// Model family identifiers, derived from the registry keys.
export type ModelFamilyId = ModelFamily["id"];

/// Ordered by preference: the selected family is tried first, then the
/// remaining families in this order when the current model does not support
/// the chosen languages.
export const MODEL_FAMILIES: readonly ModelFamily[] = FAMILIES;

export const DEFAULT_FAMILY: ModelFamilyId = "milmmt";
export const DEFAULT_PRESET: ModelPreset = "balanced";

export function familyById(id: string): ModelFamily | undefined {
  return MODEL_FAMILIES.find((family) => family.id === id);
}

export function isModelPreset(value: string): value is ModelPreset {
  return (MODEL_PRESETS as readonly string[]).includes(value);
}

/// Cross-field rule, applied in one place by both the reducer and the
/// preference parser: auto-detecting families never take an explicit source.
export function applyFamilySourcePolicy(
  source: string,
  family: ModelFamily,
): string {
  return family.sourcePolicy === "automatic" ? DETECT_SOURCE : source;
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
  // Auto-detecting families handle any source language.
  return true;
}

/// Returns the family that supports the language pair, trying the selected
/// family first and falling back by registry preference. `null` means no
/// model that can handle the request is configured.
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
