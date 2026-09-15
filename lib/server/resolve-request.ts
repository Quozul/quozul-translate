import { languageByName, type Language } from "../languages";
import {
  DETECT_SOURCE,
  familyById,
  resolveFamily,
  type ModelFamily,
} from "../models";
import {
  validateTranslationInput,
  normalizeTranslationText,
} from "../translation-text";
import type { TranslationRequestBody } from "../translation-contract";
import { ApiError } from "./errors";
import type { CacheKey } from "./translation-cache";

/// Validated request with every reference resolved to domain objects.
export interface SanitizedRequest {
  text: string;
  /// `null` means the source language is detected automatically.
  source: Language | null;
  target: Language;
  /// The family that will actually run; may differ from the requested one
  /// when the requested family does not support the language pair.
  family: ModelFamily;
  model: string;
}

/// Turn a schema-valid wire body into a `SanitizedRequest`, enforcing text
/// policy through the shared `validateTranslationInput`.
export function resolveRequest(body: TranslationRequestBody): SanitizedRequest {
  const text = normalizeTranslationText(body.text);
  const issue = validateTranslationInput(text);
  if (issue?.code === "too_long") {
    throw new ApiError("TEXT_TOO_LONG", 413, "Text exceeds the maximum length.");
  }
  if (issue) {
    throw new ApiError("INVALID_INPUT", 400, issue.message);
  }

  const target = languageByName(body.target.trim());
  if (!target) {
    throw new ApiError("INVALID_INPUT", 400, "Choose a supported target language.");
  }

  const rawSource = body.source.trim();
  let source: Language | null = null;
  if (rawSource !== "" && rawSource !== DETECT_SOURCE) {
    const resolved = languageByName(rawSource);
    if (!resolved) {
      throw new ApiError("INVALID_INPUT", 400, "Choose a supported source language.");
    }
    source = resolved;
  }

  const requested = familyById(body.family.trim());
  if (!requested) {
    throw new ApiError("INVALID_INPUT", 400, "Choose a supported model family.");
  }

  const family = resolveFamily(requested.id, source?.code ?? null, target.code);
  if (!family) {
    throw new ApiError(
      "UNSUPPORTED_LANGUAGE_PAIR",
      400,
      "No configured model supports this language pair.",
    );
  }

  // `body.preset` is a registry key per the shared contract schema.
  return { text, source, target, family, model: family.models[body.preset] };
}

/// The cache key for a resolved request, constructed beside resolution so
/// key fields can never drift from what the model actually saw.
export function cacheKeyFor(sanitized: SanitizedRequest): CacheKey {
  return {
    text: sanitized.text,
    source: sanitized.source?.name ?? "",
    target: sanitized.target.name,
    model: sanitized.model,
  };
}
