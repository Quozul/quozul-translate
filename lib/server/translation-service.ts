import type { TranslationRequestBody } from "../translation-contract";
import { ApiError } from "./errors";
import { buildPrompt } from "./prompts";
import {
  cacheKeyFor,
  resolveRequest,
  type SanitizedRequest,
} from "./resolve-request";
import type { ModelCompletion } from "./openai-adapter";
import { translationCache, type TranslationCache } from "./translation-cache";

export interface TranslateOutcome {
  translation: string;
  family: SanitizedRequest["family"];
  preset: SanitizedRequest["preset"];
  fromCache: boolean;
  /** Wall time spent serving the request, in milliseconds. */
  durationMs: number;
}

export interface TranslateOptions {
  completion: ModelCompletion;
  signal?: AbortSignal;
  now?: () => number;
  cache?: TranslationCache;
}

export async function translateRequest(
  body: TranslationRequestBody,
  options: TranslateOptions,
): Promise<TranslateOutcome> {
  const sanitized = resolveRequest(body);
  const now = options.now ?? Date.now;
  const startedAt = now();
  const finish = (
    translation: string,
    fromCache: boolean,
  ): TranslateOutcome => ({
    translation,
    family: sanitized.family,
    preset: sanitized.preset,
    fromCache,
    durationMs: Math.max(0, now() - startedAt),
  });

  if (sanitized.text === "") {
    return finish("", false);
  }

  const cache = options.cache ?? translationCache();
  const key = cacheKeyFor(sanitized);
  const cached = cache.get(key, now());
  if (cached !== undefined) {
    return finish(cached, true);
  }

  const result = await options.completion(
    { model: sanitized.model, prompt: buildPrompt(sanitized) },
    options.signal,
  );
  const translation = result.trim();
  if (translation === "") {
    throw new ApiError(
      "INVALID_RESPONSE",
      502,
      "The model returned an empty translation.",
    );
  }
  cache.insert(key, translation, now());
  return finish(translation, false);
}
