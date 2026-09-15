import { describe, expect, it, vi } from "vitest";
import type { ModelCompletion } from "./openai-adapter";
import { translateRequest } from "./translation-service";
import { createTranslationCache } from "./translation-cache";
import { ApiError } from "./errors";
import type { TranslationRequestBody } from "../translation-contract";

function request(overrides: Partial<TranslationRequestBody> = {}): TranslationRequestBody {
  return {
    text: "hello",
    source: "English",
    target: "French",
    family: "milmmt",
    preset: "balanced",
    ...overrides,
  };
}

describe("translateRequest", () => {
  it("returns empty translation without calling the provider", async () => {
    const completion = vi.fn<ModelCompletion>();
    const outcome = await translateRequest(request({ text: "   " }), {
      completion,
      cache: createTranslationCache(),
    });
    expect(outcome.translation).toBe("");
    expect(completion).not.toHaveBeenCalled();
  });

  it("runs the provider once, trims the result, and reports the family", async () => {
    const completion = vi
      .fn<ModelCompletion>()
      .mockResolvedValue("  bonjour  ");
    const outcome = await translateRequest(request(), {
      completion,
      cache: createTranslationCache(),
    });
    expect(outcome.translation).toBe("bonjour");
    expect(outcome.family.id).toBe("milmmt");
    expect(outcome.preset).toBe("balanced");
    expect(outcome.fromCache).toBe(false);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    expect(completion).toHaveBeenCalledTimes(1);
    expect(completion.mock.calls[0]?.[0]).toMatchObject({
      model: "local/milmmt-46-4b",
    });
  });

  it("serves a repeat request from the cache", async () => {
    const completion = vi.fn<ModelCompletion>().mockResolvedValue("bonjour");
    const cache = createTranslationCache();
    const first = await translateRequest(request(), { completion, cache });
    const second = await translateRequest(request(), { completion, cache });
    expect(first.translation).toBe("bonjour");
    expect(second.fromCache).toBe(true);
    expect(second.translation).toBe("bonjour");
    expect(completion).toHaveBeenCalledTimes(1);
  });

  it("reports server-side duration, near zero for cache hits", async () => {
    let now = 500;
    const completion = vi.fn<ModelCompletion>().mockImplementation(async () => {
      now = 1_300;
      return "bonjour";
    });
    const cache = createTranslationCache();
    const first = await translateRequest(request(), {
      completion,
      cache,
      now: () => now,
    });
    expect(first.fromCache).toBe(false);
    expect(first.durationMs).toBe(800);

    const second = await translateRequest(request(), {
      completion,
      cache,
      now: () => now,
    });
    expect(second.fromCache).toBe(true);
    expect(second.durationMs).toBe(0);
    expect(completion).toHaveBeenCalledTimes(1);
  });

  it("expires cache entries per the injected clock", async () => {
    const completion = vi.fn<ModelCompletion>().mockResolvedValue("bonjour");
    const cache = createTranslationCache({ ttlMs: 1000 });
    let now = 0;
    await translateRequest(request(), { completion, cache, now: () => now });
    now = 1500;
    const second = await translateRequest(request(), {
      completion,
      cache,
      now: () => now,
    });
    expect(second.fromCache).toBe(false);
    expect(completion).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty provider result as INVALID_RESPONSE", async () => {
    const completion = vi.fn<ModelCompletion>().mockResolvedValue("   ");
    await expect(
      translateRequest(request(), {
        completion,
        cache: createTranslationCache(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  });

  it("surfaces provider errors unchanged", async () => {
    const completion = vi
      .fn<ModelCompletion>()
      .mockRejectedValue(
        new ApiError("TIMEOUT", 504, "Translation timed out."),
      );
    await expect(
      translateRequest(request(), {
        completion,
        cache: createTranslationCache(),
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
