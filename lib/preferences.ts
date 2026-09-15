import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  DETECT_SOURCE,
  familyById,
  isModelPreset,
  type ModelFamilyId,
  type ModelPreset,
} from "./models";
import { DEFAULT_TARGET } from "./translation-contract";
import { languageByName, LANGUAGES } from "./languages";

const PREFERENCES_KEY = "qzl.preferences.v1";

export interface Preferences {
  target: string;
  source: string;
  family: ModelFamilyId;
  preset: ModelPreset;
  usage: Record<string, number>;
}

export interface StorageReader {
  getItem(key: string): string | null;
}

export interface StorageWriter {
  setItem(key: string, value: string): void;
}

interface StoredPreferences {
  target?: unknown;
  source?: unknown;
  family?: unknown;
  preset?: unknown;
  translation_usage?: unknown;
  model?: unknown;
}

const LEGACY_MODELS: Record<string, { family: ModelFamilyId; preset: ModelPreset }> =
  {
    fast: { family: "hy-mt2", preset: "turbo" },
    quality: { family: "hy-mt2", preset: "balanced" },
    turbo: { family: "hy-mt2", preset: "quality" },
  };

function fallbackPreferences(): Preferences {
  return {
    target: DEFAULT_TARGET,
    source: DETECT_SOURCE,
    family: DEFAULT_FAMILY,
    preset: DEFAULT_PRESET,
    usage: {},
  };
}

function parseUsage(value: unknown): Record<string, number> {
  const usage: Record<string, number> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return usage;
  }
  for (const [name, count] of Object.entries(value)) {
    if (!languageByName(name)) continue;
    if (typeof count !== "number") continue;
    if (!Number.isSafeInteger(count) || count < 0) continue;
    usage[name] = count;
  }
  return usage;
}

export function parseTranslationPreferences(value: unknown): Preferences {
  const fallback = fallbackPreferences();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }
  const stored = value as StoredPreferences;

  let family: ModelFamilyId | undefined;
  let preset: ModelPreset | undefined;
  if (typeof stored.family === "string" && familyById(stored.family)) {
    family = stored.family as ModelFamilyId;
    if (typeof stored.preset === "string" && isModelPreset(stored.preset)) {
      preset = stored.preset;
    }
  }
  if (!family) {
    const legacy =
      typeof stored.model === "string" ? LEGACY_MODELS[stored.model] : undefined;
    if (legacy) {
      family = legacy.family;
      preset = legacy.preset;
      if (typeof stored.preset === "string" && isModelPreset(stored.preset)) {
        preset = stored.preset;
      }
    }
  }

  const target =
    typeof stored.target === "string" && languageByName(stored.target)
      ? stored.target
      : fallback.target;

  const source =
    typeof stored.source === "string" &&
    (stored.source === DETECT_SOURCE || languageByName(stored.source))
      ? stored.source
      : fallback.source;

  family = family ?? fallback.family;
  preset = preset ?? fallback.preset;

  return { target, source, family, preset, usage: parseUsage(stored.translation_usage) };
}

export function loadTranslationPreferences(
  storage: StorageReader | null,
): Preferences {
  if (!storage) return fallbackPreferences();
  try {
    const stored = storage.getItem(PREFERENCES_KEY);
    if (!stored) return fallbackPreferences();
    return parseTranslationPreferences(JSON.parse(stored));
  } catch {
    return fallbackPreferences();
  }
}

export function saveTranslationPreferences(
  storage: StorageWriter | null,
  preferences: Preferences,
): void {
  if (!storage) return;
  const stored: StoredPreferences & Record<string, unknown> = {
    target: preferences.target,
    source: preferences.source,
    family: preferences.family,
    preset: preferences.preset,
    translation_usage: preferences.usage,
  };
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(stored));
  } catch {
  }
}

export function getFrequentLanguages(
  usage: Readonly<Record<string, number>>,
  limit: number,
): string[] {
  const languages = LANGUAGES.map((language) => language.name).filter(
    (name) => (usage[name] ?? 0) > 0,
  );
  languages.sort(
    (a, b) => (usage[b] ?? 0) - (usage[a] ?? 0) || a.localeCompare(b),
  );
  return languages.slice(0, limit);
}

export function browserStorage(): (StorageReader & StorageWriter) | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
