import { describe, expect, it } from "vitest";
import {
  countTranslationCharacters,
  displayedCharacterCount,
  normalizeTranslationText,
  validateTranslationInput,
} from "./translation-text";
import { MAX_TEXT_LENGTH } from "./translation-contract";

describe("normalizeTranslationText", () => {
  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeTranslationText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("strips outer whitespace but keeps inner spacing", () => {
    expect(normalizeTranslationText("  hi  there \n\n ")).toBe("hi  there");
  });

  it("maps whitespace-only input to empty string", () => {
    expect(normalizeTranslationText(" \r\n \t ")).toBe("");
  });
});

describe("countTranslationCharacters", () => {
  it("counts Unicode code points, not UTF-16 units", () => {
    expect(countTranslationCharacters("😀")).toBe(1);
    expect("😀".length).toBe(2);
  });

  it("counts combining sequences as base + marks (documented behavior)", () => {
    expect(countTranslationCharacters("e\u0301")).toBe(2);
  });

  it("counts CJK characters individually", () => {
    expect(countTranslationCharacters("你好世界")).toBe(4);
  });
});

describe("validateTranslationInput", () => {
  it("accepts empty input (nothing to translate is not invalid)", () => {
    expect(validateTranslationInput("")).toBeNull();
  });

  it("accepts text at exactly the boundary length", () => {
    expect(validateTranslationInput("a".repeat(MAX_TEXT_LENGTH))).toBeNull();
  });

  it("rejects text one code point over the boundary", () => {
    const issue = validateTranslationInput("a".repeat(MAX_TEXT_LENGTH + 1));
    expect(issue?.code).toBe("too_long");
  });

  it("counts code points, not UTF-16 units, against the limit", () => {
    const emoji = "😀".repeat(2_048);
    expect(validateTranslationInput(emoji)).toBeNull();
  });

  it("rejects control characters but allows newline and tab", () => {
    expect(validateTranslationInput("beep\u0007")).toMatchObject({
      code: "control_characters",
    });
    expect(validateTranslationInput("fine\n\tvalues")).toBeNull();
  });
});

describe("displayedCharacterCount", () => {
  it("matches the server-side normalization before counting", () => {
    expect(displayedCharacterCount("  a\r\nb  ")).toBe(3);
  });
});
