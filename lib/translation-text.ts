import { MAX_TEXT_LENGTH } from "./translation-contract";

/// Control characters the model cannot handle. Newline and tab stay legal.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/// Canonical form of submitted text: Windows/legacy line endings become `\n`
/// and outer whitespace is stripped, while meaningful inner spacing is kept.
/// The client measures feedback on this same form the server enforces.
export function normalizeTranslationText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/// A "character" is a Unicode code point (spread of the string), not a
/// user-perceived grapheme cluster. Deliberately the lowest-risk definition;
/// switching to graphemes would be a product decision, not a refactor.
export function countTranslationCharacters(text: string): number {
  return [...text].length;
}

export type TranslationTextIssueCode = "too_long" | "control_characters";

export interface TranslationTextIssue {
  code: TranslationTextIssueCode;
  message: string;
}

/// Single validation policy for the text field. The client uses it for live
/// feedback and to decide what to send; the server re-checks authoritatively.
/// Pass normalized text (see `normalizeTranslationText`).
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

/// Character count the editor displays: normalized text, code points.
export function displayedCharacterCount(raw: string): number {
  return countTranslationCharacters(normalizeTranslationText(raw));
}
