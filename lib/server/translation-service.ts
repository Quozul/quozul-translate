import type { TranslationRequestBody } from "../translation-contract";
import { ApiError } from "./errors";
import { buildPrompt } from "./prompts";
import { cacheKeyFor, resolveRequest, type SanitizedRequest } from "./resolve-request";
import type { ModelCompletion } from "./openai-adapter";
import { translationCache, type TranslationCache } from "./translation-cache";

export interface TranslateOutcome {
  translation: string;
  /// Family that actually ran; surfaced so clients can show what was used
  /// even on cache hits.
  family: SanitizedRequest["family"];
  fromCache: boolean;
}

export interface TranslateOptions {
  completion: ModelCompletion;
  signal?: AbortSignal;
  /// Injectable clock so TTL behavior is testable.
  now?: () => number;
  /// Injectable cache; defaults to the process-wide instance.
  cache?: TranslationCache;
}

/// Full request pipeline: resolve policy, consult cache, prompt, run,
/// validate, cache. Provider interaction is the injected `completion` seam,
/// so this module runs in tests without the OpenAI SDK or a network.
export async function translateRequest(
  body: TranslationRequestBody,
  options: TranslateOptions,
): Promise<TranslateOutcome> {
  const sanitized = resolveRequest(body);
  const now = options.now ?? Date.now;

  if (sanitized.text === "") {
    return { translation: "", family: sanitized.family, fromCache: false };
  }

  const cache = options.cache ?? translationCache();
  const key = cacheKeyFor(sanitized);
  const cached = cache.get(key, now());
  if (cached !== undefined) {
    return { translation: cached, family: sanitized.family, fromCache: true };
  }

  const result = await options.completion(
    { model: sanitized.model, prompt: buildPrompt(sanitized) },
    options.signal,
  );
  const translation = result.trim();
  if (translation === "") {
    throw new ApiError("INVALID_RESPONSE", 502, "The model returned an empty translation.");
  }
  cache.insert(key, translation, now());
  return { translation, family: sanitized.family, fromCache: false };
}
