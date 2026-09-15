import { describe, expect, it } from "vitest";
import type { TranslationRequestBody } from "../translation-contract";
import { ApiError } from "./errors";
import { cacheKeyFor, resolveRequest } from "./resolve-request";
import { buildPrompt } from "./prompts";

function request(overrides: Partial<TranslationRequestBody> = {}): TranslationRequestBody {
  return {
    text: "hello world",
    source: "detect",
    target: "French",
    family: "milmmt",
    preset: "balanced",
    ...overrides,
  };
}

describe("resolveRequest", () => {
  it("normalizes text and falls back to an auto-detect family for detection", () => {
    const resolved = resolveRequest(request({ source: "detect" }));
    // MiLMMT needs an explicit source; with none, Hy-MT2 must serve.
    expect(resolved.family.id).toBe("hy-mt2");
    expect(resolved.source).toBeNull();
  });

  it("keeps the requested family when it supports the pair", () => {
    const resolved = resolveRequest(
      request({ source: "English", target: "French" }),
    );
    expect(resolved.family.id).toBe("milmmt");
    expect(resolved.source?.name).toBe("English");
  });

  it("normalizes CRLF and trims outer whitespace", () => {
    const resolved = resolveRequest(request({ text: "  a\r\nb  " }));
    expect(resolved.text).toBe("a\nb");
  });

  it("rejects over-length text with 413", () => {
    const error = (() => {
      try {
        resolveRequest(request({ text: "a".repeat(20_001) }));
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(413);
    expect((error as ApiError).code).toBe("TEXT_TOO_LONG");
  });

  it("rejects control characters with 400", () => {
    expect(() => resolveRequest(request({ text: "bad\u0000text" }))).toThrow(
      ApiError,
    );
  });

  it("rejects unknown target, source, and family", () => {
    expect(() => resolveRequest(request({ target: "Klingon" }))).toThrow(
      ApiError,
    );
    expect(() =>
      resolveRequest(request({ source: "Klingon", target: "French" })),
    ).toThrow(ApiError);
  });

  it("reports an unsupported pair when no family can serve", () => {
    let caught: unknown;
    try {
      // Bulgarian is only served by the required-source family, and
      // detection provides no source to qualify for it.
      resolveRequest(request({ source: "detect", target: "Bulgarian" }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("UNSUPPORTED_LANGUAGE_PAIR");
  });

  it("builds a cache key that includes source, target, and model", () => {
    const key = cacheKeyFor(
      resolveRequest(request({ source: "English", target: "French" })),
    );
    expect(key).toEqual({
      text: "hello world",
      source: "English",
      target: "French",
      model: "local/milmmt-46-4b",
    });
  });
});

describe("buildPrompt", () => {
  it("names the source language for required-source families", () => {
    const sanitized = resolveRequest(
      request({ source: "English", target: "French" }),
    );
    const prompt = buildPrompt(sanitized);
    expect(prompt).toContain("Translate this from English to French:");
    expect(prompt).toContain("English: hello world");
  });

  it("uses the auto-detect template for auto-detecting families", () => {
    const sanitized = resolveRequest(request({ source: "detect" }));
    const prompt = buildPrompt(sanitized);
    expect(prompt).toContain("Translate the following text into French");
    expect(prompt).toContain("hello world");
  });

  it("applies per-family prompt name overrides", () => {
    // Filipino is "Tagalog" for MiLMMT prompt construction.
    const sanitized = resolveRequest(
      request({ source: "English", target: "Filipino", family: "milmmt" }),
    );
    expect(buildPrompt(sanitized)).toContain("to Tagalog:");
  });
});

describe("ApiError", () => {
  it("carries code, status, message, and cause", () => {
    const cause = new Error("socket hang up");
    const error = new ApiError("TIMEOUT", 504, "Translation timed out.", {
      cause,
    });
    expect(error.code).toBe("TIMEOUT");
    expect(error.status).toBe(504);
    expect(error.cause).toBe(cause);
  });
});
