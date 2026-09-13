export interface Language {
  name: string;
  native: string;
  code: string;
}

/// English name (also used by the API), native name, and language code.
export const LANGUAGES: Language[] = [
  { name: "Arabic", native: "العربية", code: "ar" },
  { name: "Bengali", native: "বাংলা", code: "bn" },
  { name: "Burmese", native: "မြန်မာ", code: "my" },
  { name: "Cantonese", native: "粵語", code: "yue" },
  { name: "Chinese (Simplified)", native: "简体中文", code: "zh" },
  { name: "Chinese (Traditional)", native: "繁體中文", code: "zh-Hant" },
  { name: "Czech", native: "Čeština", code: "cs" },
  { name: "Dutch", native: "Nederlands", code: "nl" },
  { name: "English", native: "English", code: "en" },
  { name: "Filipino", native: "Filipino", code: "tl" },
  { name: "French", native: "Français", code: "fr" },
  { name: "German", native: "Deutsch", code: "de" },
  { name: "Gujarati", native: "ગુજરાતી", code: "gu" },
  { name: "Hebrew", native: "עברית", code: "he" },
  { name: "Hindi", native: "हिन्दी", code: "hi" },
  { name: "Indonesian", native: "Bahasa Indonesia", code: "id" },
  { name: "Italian", native: "Italiano", code: "it" },
  { name: "Japanese", native: "日本語", code: "ja" },
  { name: "Kazakh", native: "Қазақша", code: "kk" },
  { name: "Khmer", native: "ខ្មែរ", code: "km" },
  { name: "Korean", native: "한국어", code: "ko" },
  { name: "Malay", native: "Bahasa Melayu", code: "ms" },
  { name: "Marathi", native: "मराठी", code: "mr" },
  { name: "Mongolian", native: "Монгол", code: "mn" },
  { name: "Persian", native: "فارسی", code: "fa" },
  { name: "Polish", native: "Polski", code: "pl" },
  { name: "Portuguese", native: "Português", code: "pt" },
  { name: "Russian", native: "Русский", code: "ru" },
  { name: "Spanish", native: "Español", code: "es" },
  { name: "Tamil", native: "தமிழ்", code: "ta" },
  { name: "Telugu", native: "తెలుగు", code: "te" },
  { name: "Thai", native: "ไทย", code: "th" },
  { name: "Tibetan", native: "བོད་ཡིག", code: "bo" },
  { name: "Turkish", native: "Türkçe", code: "tr" },
  { name: "Ukrainian", native: "Українська", code: "uk" },
  { name: "Urdu", native: "اردو", code: "ur" },
  { name: "Uyghur", native: "ئۇيغۇرچە", code: "ug" },
  { name: "Vietnamese", native: "Tiếng Việt", code: "vi" },
];

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
