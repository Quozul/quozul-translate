import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  DETECT_SOURCE,
  familyById,
  isModelPreset,
  type ModelFamilyId,
  type ModelPreset,
} from "./models";

const PREFERENCES_KEY = "qzl.preferences.v1";

/// Shape stored in localStorage. `family` and `preset` are stored as plain
/// strings and validated again on read.
export interface TranslationPreferences {
  target: string;
  source: string;
  family: string;
  preset: string;
  translation_usage: Record<string, number>;
}

/// Earlier preferences stored a single `model` key naming Hy-MT2 sizes.
const LEGACY_MODELS: Record<
  string,
  { family: ModelFamilyId; preset: ModelPreset }
> = {
  fast: { family: "hy-mt2", preset: "turbo" },
  quality: { family: "hy-mt2", preset: "balanced" },
  turbo: { family: "hy-mt2", preset: "quality" },
};

function fallbackPreferences(): TranslationPreferences {
  return {
    target: "",
    source: DETECT_SOURCE,
    family: DEFAULT_FAMILY,
    preset: DEFAULT_PRESET,
    translation_usage: {},
  };
}

/// Read persisted preferences, migrating legacy keys. Never throws: unreadable
/// or malformed storage falls back to defaults.
export function loadTranslationPreferences(): TranslationPreferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return fallbackPreferences();
    const parsed = JSON.parse(stored) as Partial<TranslationPreferences> & {
      model?: unknown;
    };
    let family = familyById(
      typeof parsed.family === "string" ? parsed.family : "",
    )?.id;
    let preset: ModelPreset | undefined;
    if (typeof parsed.preset === "string" && isModelPreset(parsed.preset)) {
      preset = parsed.preset;
    }
    if (!family) {
      const legacy =
        typeof parsed.model === "string" ? LEGACY_MODELS[parsed.model] : undefined;
      if (legacy) {
        family = legacy.family;
        preset = legacy.preset;
      }
    }
    return {
      target: typeof parsed.target === "string" ? parsed.target : "",
      source:
        typeof parsed.source === "string" ? parsed.source : DETECT_SOURCE,
      family: family ?? DEFAULT_FAMILY,
      preset: preset ?? DEFAULT_PRESET,
      translation_usage:
        parsed.translation_usage &&
        typeof parsed.translation_usage === "object"
          ? parsed.translation_usage
          : {},
    };
  } catch {
    return fallbackPreferences();
  }
}

/// Persist the current selection. Storage errors are ignored: preferences
/// simply will not survive the session.
export function saveTranslationPreferences(input: {
  target: string;
  source: string;
  family: ModelFamilyId;
  preset: ModelPreset;
  usage: Record<string, number>;
}): void {
  const preferences: TranslationPreferences = {
    target: input.target,
    source: input.source,
    family: input.family,
    preset: input.preset,
    translation_usage: input.usage,
  };
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be unavailable; preferences simply will not persist.
  }
}
