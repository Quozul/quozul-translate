import "server-only";
import OpenAI, { APIConnectionTimeoutError } from "openai";
import { ApiError } from "./errors";

export const DEFAULT_BASE_URL = "http://127.0.0.1:9931/v1";
export const REQUEST_TIMEOUT_MS = 85_000;

/// The one dependency seam to the external model provider. Application
/// policy is tested against a fake completion function and never needs the
/// OpenAI SDK. Real and fake adapters must obey the same contract: resolve
/// with text, reject with an error, and honor the abort signal.
export interface ModelCompletionInput {
  model: string;
  prompt: string;
}

export type ModelCompletion = (
  input: ModelCompletionInput,
  signal?: AbortSignal,
) => Promise<string>;

/// Build the production adapter from environment configuration. Throws an
/// `ApiError` (503) when the server is not configured.
export function createCompletionFromEnvironment(): ModelCompletion {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError("MODEL_UNAVAILABLE", 503, "Translation server is not configured.");
  }
  const client = new OpenAI({
    baseURL: process.env.TRANSLATION_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });

  return async ({ model, prompt }, signal) => {
    let translated: string | undefined;
    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      );
      translated = response.choices[0]?.message?.content ?? undefined;
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        throw new ApiError("TIMEOUT", 504, "Translation timed out.", {
          cause: error,
        });
      }
      if (signal?.aborted) {
        // Cancellation is not a failure of the request itself.
        throw error;
      }
      throw new ApiError("MODEL_UNAVAILABLE", 502, "The model could not translate this text.", {
        cause: error,
      });
    }
    if (translated === undefined) {
      throw new ApiError("INVALID_RESPONSE", 502, "The model could not translate this text.");
    }
    return translated;
  };
}
