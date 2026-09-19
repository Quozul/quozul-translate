import { type Language, languageByCode } from "../languages";
import {
  DETECT_SOURCE,
  familyById,
  type ModelFamily,
  type ModelPreset,
  resolveFamily,
} from "../models";
import type { TranslationRequestBody } from "../translation-contract";
import {
  normalizeTranslationText,
  validateTranslationInput,
} from "../translation-text";
import { ApiError } from "./errors";
import { modelIdFor } from "./model-ids";
import type { CacheKey } from "./translation-cache";

export interface SanitizedRequest {
  text: string;
  source: Language | null;
  target: Language;
  family: ModelFamily;
  preset: ModelPreset;
  model: string;
}

export function resolveRequest(body: TranslationRequestBody): SanitizedRequest {
  const text = normalizeTranslationText(body.text);
  const issue = validateTranslationInput(text);
  if (issue?.code === "too_long") {
    throw new ApiError(
      "TEXT_TOO_LONG",
      413,
      "Text exceeds the maximum length.",
    );
  }
  if (issue) {
    throw new ApiError("INVALID_INPUT", 400, issue.message);
  }

  const target = languageByCode(body.target);
  if (!target) {
    throw new ApiError(
      "INVALID_INPUT",
      400,
      "Choose a supported target language.",
    );
  }

  const rawSource = body.source.trim();
  let source: Language | null = null;
  if (rawSource !== "" && rawSource !== DETECT_SOURCE) {
    const resolved = languageByCode(rawSource);
    if (!resolved) {
      throw new ApiError(
        "INVALID_INPUT",
        400,
        "Choose a supported source language.",
      );
    }
    source = resolved;
  }

  const requested = familyById(body.family.trim());
  if (!requested) {
    throw new ApiError(
      "INVALID_INPUT",
      400,
      "Choose a supported model family.",
    );
  }

  const family = resolveFamily(requested.id, source?.code ?? null, target.code);
  if (!family) {
    throw new ApiError(
      "UNSUPPORTED_LANGUAGE_PAIR",
      400,
      "No configured model supports this language pair.",
    );
  }

  return {
    text,
    source,
    target,
    family,
    preset: body.preset,
    model: modelIdFor(family.id, body.preset),
  };
}

export function cacheKeyFor(sanitized: SanitizedRequest): CacheKey {
  return {
    text: sanitized.text,
    source: sanitized.source?.name ?? "",
    target: sanitized.target.name,
    model: sanitized.model,
  };
}
