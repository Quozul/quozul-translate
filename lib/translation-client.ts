import {
  translationResponseBodySchema,
  type TranslationRequestBody,
} from "./translation-contract";

// Client-only module: it is loaded from `"use client"` code paths and uses
// `fetch` against the app's own API. Next.js still evaluates Client
// Component modules during server prerendering, so this boundary is a
// convention (enforced by review and the build) rather than an import-time
// side effect — nothing at module scope may touch browser globals.

/// A request failure whose `message` is already user-facing copy.
export class TranslationFailure extends Error {}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/// Turn an HTTP status into copy the user can act on.
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

/// Perform one translation request end to end: fetch, parse, validate, and
/// return the completed translation. Consuming the response body is part of
/// the returned promise, so the caller's deadline covers it.
///
/// Throws `TranslationFailure` for user-presentable errors and propagates
/// `AbortError` when the signal aborts (including mid-body).
export async function requestTranslation(
  body: TranslationRequestBody,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
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
    // An abort while consuming the body is a cancellation, not a
    // malformed response; the caller's ownership rules handle it.
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
  return parsed.data.translation;
}
