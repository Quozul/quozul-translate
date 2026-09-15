import { describe, expect, it } from "vitest";
import {
  isAbortError,
  requestTranslation,
  TranslationFailure,
} from "./translation-client";
import type { TranslationRequestBody } from "./translation-contract";

const body: TranslationRequestBody = {
  text: "hello",
  source: "detect",
  target: "French",
  family: "hy-mt2",
  preset: "balanced",
};

function jsonResponse(
  status: number,
  payload: unknown,
): {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function fakeFetch(response: unknown) {
  return async () => response as Response;
}

describe("requestTranslation", () => {
  it("returns the validated translation", async () => {
    const translation = await requestTranslation(
      body,
      new AbortController().signal,
      fakeFetch(jsonResponse(200, { translation: "bonjour" })),
    );
    expect(translation).toBe("bonjour");
  });

  it("surfaces the server's error message on failure responses", async () => {
    await expect(
      requestTranslation(
        body,
        new AbortController().signal,
        fakeFetch(jsonResponse(400, { error: "Choose a language." })),
      ),
    ).rejects.toThrow("Choose a language.");
  });

  it("maps unknown failure statuses to actionable copy", async () => {
    await expect(
      requestTranslation(
        body,
        new AbortController().signal,
        fakeFetch(jsonResponse(503, null)),
      ),
    ).rejects.toThrow(/local model server/);
  });

  it("rejects malformed success bodies", async () => {
    await expect(
      requestTranslation(
        body,
        new AbortController().signal,
        fakeFetch(jsonResponse(200, { notTranslation: true })),
      ),
    ).rejects.toThrow(TranslationFailure);
  });

  it("treats a whitespace-only translation as failure", async () => {
    await expect(
      requestTranslation(
        body,
        new AbortController().signal,
        fakeFetch(jsonResponse(200, { translation: "   " })),
      ),
    ).rejects.toThrow(/empty translation/);
  });

  it("maps network TypeErrors to the connection message", async () => {
    const down = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(
      requestTranslation(body, new AbortController().signal, down),
    ).rejects.toThrow(/Cannot reach the translation server/);
  });

  it("propagates AbortError raised while consuming the body", async () => {
    const stalledBody = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new DOMException("aborted", "AbortError");
        reject(error);
      }, 5);
    });
    const stalled = {
      ok: true,
      status: 200,
      json: () => stalledBody,
    } as unknown as Response;
    await expect(
      requestTranslation(
        body,
        new AbortController().signal,
        fakeFetch(stalled),
      ),
    ).rejects.toSatisfy(isAbortError);
  });
});
