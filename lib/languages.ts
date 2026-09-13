import type { ModelFamilyId } from "./models";

export interface Language {
  name: string;
  native: string;
  code: string;
  /// Name sent to a specific model family when it differs from the display
  /// name (e.g. MiLMMT expects "Tagalog" while Hy-MT2 expects "Filipino").
  promptNames?: Partial<Record<ModelFamilyId, string>>;
}

/// English name (also used by the API), native name, and language code.
/// The union of all model family languages (see lib/models.ts).
export const LANGUAGES: Language[] = [
  { name: "Arabic", native: "العربية", code: "ar" },
  { name: "Azerbaijani", native: "Azərbaycan dili", code: "az" },
  { name: "Bengali", native: "বাংলা", code: "bn" },
  { name: "Bulgarian", native: "Български", code: "bg" },
  { name: "Burmese", native: "မြန်မာ", code: "my" },
  { name: "Cantonese", native: "粵語", code: "yue" },
  { name: "Catalan", native: "Català", code: "ca" },
  { name: "Chinese (Simplified)", native: "简体中文", code: "zh" },
  { name: "Chinese (Traditional)", native: "繁體中文", code: "zh-Hant" },
  { name: "Croatian", native: "Hrvatski", code: "hr" },
  { name: "Czech", native: "Čeština", code: "cs" },
  { name: "Danish", native: "Dansk", code: "da" },
  { name: "Dutch", native: "Nederlands", code: "nl" },
  { name: "English", native: "English", code: "en" },
  {
    name: "Filipino",
    native: "Filipino",
    code: "tl",
    promptNames: { milmmt: "Tagalog" },
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
  { name: "Khmer", native: "ខ្មែរ", code: "km" },
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

export function languageByName(name: string): Language | undefined {
  return LANGUAGES.find((language) => language.name === name);
}

/// Name to use for this language when prompting the given model family.
export function promptName(language: Language, family: ModelFamilyId): string {
  return language.promptNames?.[family] ?? language.name;
}

export function matchesLanguage(language: Language, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  // A complete code is unambiguous ("ja" should not also match "Gujarati").
  if (LANGUAGES.some((entry) => entry.code.toLowerCase() === normalized)) {
    return language.code.toLowerCase() === normalized;
  }
  return [language.name, language.native, language.code].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}
