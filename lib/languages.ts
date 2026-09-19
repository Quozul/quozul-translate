import type { ModelFamilyId } from "./models";

export interface Language {
  name: string;
  native: string;
  code: string;
  promptNames?: Partial<Record<ModelFamilyId, string>>;
}

export const LANGUAGES: Language[] = [
  { name: "Arabic", native: "العربية", code: "ar" },
  { name: "Azerbaijani", native: "Azərbaycan dili", code: "az" },
  { name: "Bengali", native: "বাংলা", code: "bn" },
  { name: "Bulgarian", native: "Български", code: "bg" },
  { name: "Burmese", native: "မြန်မာ", code: "my" },
  { name: "Cantonese", native: "粵語", code: "yue" },
  { name: "Catalan", native: "Català", code: "ca" },
  {
    name: "Chinese (Simplified)",
    native: "简体中文",
    code: "zh",
    promptNames: { translategemma: "Chinese" },
  },
  {
    name: "Chinese (Traditional)",
    native: "繁體中文",
    code: "zh-Hant",
    promptNames: { translategemma: "Chinese" },
  },
  { name: "Croatian", native: "Hrvatski", code: "hr" },
  { name: "Czech", native: "Čeština", code: "cs" },
  { name: "Danish", native: "Dansk", code: "da" },
  { name: "Dutch", native: "Nederlands", code: "nl" },
  { name: "English", native: "English", code: "en" },
  {
    name: "Filipino",
    native: "Filipino",
    code: "tl",
    promptNames: { milmmt: "Tagalog", translategemma: "Tagalog" },
  },
  { name: "Finnish", native: "Suomi", code: "fi" },
  { name: "French", native: "Français", code: "fr" },
  { name: "German", native: "Deutsch", code: "de" },
  { name: "Greek", native: "Ελληνικά", code: "el" },
  { name: "Gujarati", native: "ગુજરાતી", code: "gu" },
  { name: "Hebrew", native: "עברית", code: "he" },
  { name: "Hindi", native: "हिन्दी", code: "hi" },
  { name: "Hungarian", native: "Magyar", code: "hu" },
  { name: "Indonesian", native: "Bahasa Indonesia", code: "id" },
  { name: "Italian", native: "Italiano", code: "it" },
  { name: "Japanese", native: "日本語", code: "ja" },
  { name: "Kazakh", native: "Қазақша", code: "kk" },
  {
    name: "Khmer",
    native: "ខ្មែរ",
    code: "km",
    promptNames: { translategemma: "Central Khmer" },
  },
  { name: "Korean", native: "한국어", code: "ko" },
  { name: "Lao", native: "ລາວ", code: "lo" },
  { name: "Malay", native: "Bahasa Melayu", code: "ms" },
  { name: "Marathi", native: "मराठी", code: "mr" },
  { name: "Mongolian", native: "Монгол", code: "mn" },
  { name: "Norwegian", native: "Norsk", code: "no" },
  { name: "Persian", native: "فارسی", code: "fa" },
  { name: "Polish", native: "Polski", code: "pl" },
  { name: "Portuguese", native: "Português", code: "pt" },
  { name: "Romanian", native: "Română", code: "ro" },
  { name: "Russian", native: "Русский", code: "ru" },
  { name: "Slovak", native: "Slovenčina", code: "sk" },
  { name: "Slovenian", native: "Slovenščina", code: "sl" },
  { name: "Spanish", native: "Español", code: "es" },
  { name: "Swedish", native: "Svenska", code: "sv" },
  { name: "Tamil", native: "தமிழ்", code: "ta" },
  { name: "Telugu", native: "తెలుగు", code: "te" },
  { name: "Thai", native: "ไทย", code: "th" },
  { name: "Tibetan", native: "བོད་ཡིག", code: "bo" },
  { name: "Turkish", native: "Türkçe", code: "tr" },
  { name: "Ukrainian", native: "Українська", code: "uk" },
  { name: "Urdu", native: "اردو", code: "ur" },
  { name: "Uyghur", native: "ئۇيغۇرچە", code: "ug" },
  { name: "Uzbek", native: "Oʻzbekcha", code: "uz" },
  { name: "Vietnamese", native: "Tiếng Việt", code: "vi" },
];

const LANGUAGE_BY_CODE = new Map(
  LANGUAGES.map((language) => [language.code.toLowerCase(), language]),
);

/**
 * Resolves a language from its code (e.g. "fr", "zh-Hant"). Codes are the
 * canonical identity shared by the client, the API request body, and the model
 * family tables; display names are derived from the returned record.
 */
export function languageByCode(code: string): Language | undefined {
  return LANGUAGE_BY_CODE.get(code.trim().toLowerCase());
}

export function normalizeLanguageQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesNormalizedLanguage(
  language: Language,
  normalizedQuery: string,
): boolean {
  if (LANGUAGE_BY_CODE.has(normalizedQuery)) {
    return language.code.toLowerCase() === normalizedQuery;
  }
  return [language.name, language.native, language.code].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

export function matchesLanguage(language: Language, query: string): boolean {
  return matchesNormalizedLanguage(language, normalizeLanguageQuery(query));
}

export function promptName(language: Language, family: ModelFamilyId): string {
  return language.promptNames?.[family] ?? language.name;
}

export const FREQUENT_LANGUAGE_LIMIT = 3;

export interface DetectionOption {
  value: string;
  label: string;
}

export interface LanguageGroups {
  detection: DetectionOption | null;
  frequent: Language[];
  others: Language[];
}

export function getLanguageGroups(options: {
  query: string;
  frequent: readonly string[];
  detection?: DetectionOption;
}): LanguageGroups {
  const normalized = normalizeLanguageQuery(options.query);
  const topCodes = options.frequent.slice(0, FREQUENT_LANGUAGE_LIMIT);
  const topSet = new Set(topCodes);

  const matches = LANGUAGES.filter((language) =>
    matchesNormalizedLanguage(language, normalized),
  );

  return {
    detection: options.detection?.label.toLowerCase().includes(normalized)
      ? options.detection
      : null,
    frequent: topCodes
      .map((code) => languageByCode(code))
      .filter(
        (language): language is Language =>
          language !== undefined &&
          matchesNormalizedLanguage(language, normalized),
      ),
    others: matches.filter((language) => !topSet.has(language.code)),
  };
}
