import { MAX_TEXT_LENGTH } from "./translation-contract";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeTranslationText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function countTranslationCharacters(text: string): number {
  return [...text].length;
}

export type TranslationTextIssueCode = "too_long" | "control_characters";

export interface TranslationTextIssue {
  code: TranslationTextIssueCode;
  message: string;
}

export function validateTranslationInput(
  text: string,
): TranslationTextIssue | null {
  if (countTranslationCharacters(text) > MAX_TEXT_LENGTH) {
    return {
      code: "too_long",
      message: `Please shorten your text to ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters or fewer.`,
    };
  }
  if (CONTROL_CHARACTERS.test(text)) {
    return {
      code: "control_characters",
      message: "Text contains unsupported control characters.",
    };
  }
  return null;
}

export function displayedCharacterCount(raw: string): number {
  return countTranslationCharacters(normalizeTranslationText(raw));
}
