import {
  translationResponseBodySchema,
  type TranslationRequestBody,
  type TranslationResponseBody,
} from "./translation-contract";
import { isModelPreset, type ModelPreset } from "./models";

export class TranslationFailure extends Error {}

/**
 * What served a translation: the family id and quality preset that produced the
 * text, whether it came from cache, and how long it took. Fields the server did
 * not report are null so callers can fall back.
 */
export interface TranslationMeta {
  translation: string;
  family: string | null;
  preset: ModelPreset | null;
  cached: boolean;
  durationMs: number | null;
}

function toFiniteDuration(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

export function toTranslationMeta(
  data: TranslationResponseBody,
): TranslationMeta {
  return {
    translation: data.translation,
    family:
      typeof data.family === "string" && data.family !== ""
        ? data.family
        : null,
    preset:
      typeof data.preset === "string" && isModelPreset(data.preset)
        ? data.preset
        : null,
    cached: data.cached === true,
    durationMs: toFiniteDuration(data.durationMs),
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function statusMessage(status: number): string {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return "The request was rejected. Check text length, languages, and model settings.";
    case 504:
      return "The model took too long to respond. Try again or choose another model in Settings.";
    default:
      return "Translation failed. Check your local model server is running and the selected model is available.";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestTranslation(
  body: TranslationRequestBody,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<TranslationMeta> {
  let response: Response;
  try {
    response = await fetchImpl("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof TypeError) {
      throw new TranslationFailure(
        "Cannot reach the translation server. Check your connection and try again.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    const failureBody = (await readJson(response)) as { error?: unknown } | null;
    throw new TranslationFailure(
      typeof failureBody?.error === "string" && failureBody.error !== ""
        ? failureBody.error
        : statusMessage(response.status),
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new TranslationFailure("Invalid translation response.");
  }
  const parsed = translationResponseBodySchema.safeParse(json);
  if (!parsed.success) {
    throw new TranslationFailure("Invalid translation response.");
  }
  if (parsed.data.translation.trim() === "") {
    throw new TranslationFailure(
      "The model returned an empty translation. Please try again.",
    );
  }
  return toTranslationMeta(parsed.data);
}
