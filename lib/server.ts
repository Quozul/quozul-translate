import OpenAI, { APIConnectionTimeoutError } from "openai";
import { LANGUAGES } from "./languages";
import { MAX_TEXT_LENGTH, type TranslationRequestBody } from "./types";

export const DEFAULT_BASE_URL = "http://127.0.0.1:9931/v1";
const MODEL_PRESETS: Record<string, string> = {
  fast: "Hy-MT2-1.8B",
  quality: "Hy-MT2-7B",
  turbo: "Hy-MT2-30B-A3B",
};

export const REQUEST_TIMEOUT_MS = 85_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface SanitizedRequest {
  text: string;
  target: string;
  model: string;
}

export function sanitize(request: TranslationRequestBody): SanitizedRequest {
  // Normalize line endings and outer whitespace while preserving meaningful inner spacing.
  const text = request.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if ([...text].length > MAX_TEXT_LENGTH) {
    throw new ApiError(413, "Text exceeds 20,000 characters.");
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new ApiError(400, "Text contains unsupported control characters.");
  }
  const target = request.target.trim();
  if (!LANGUAGES.some((language) => language.name === target)) {
    throw new ApiError(400, "Choose a supported target language.");
  }
  const model = MODEL_PRESETS[request.model.trim()];
  if (request.model.trim() !== "" && model === undefined) {
    throw new ApiError(400, "Choose a supported model preset.");
  }
  return { text, target, model: model ?? MODEL_PRESETS.fast };
}

export async function translateText(
  sanitized: SanitizedRequest,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "Translation server is not configured.");
  }
  const client = new OpenAI({
    baseURL: process.env.TRANSLATION_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });
  const prompt = `Translate the following text into ${sanitized.target}. Note that you should only output the translated result without any additional explanation:\n\n${sanitized.text}\n`;
  let translated: string | undefined;
  try {
    const response = await client.chat.completions.create(
      {
        model: sanitized.model,
        messages: [{ role: "user", content: prompt }],
      },
      { signal },
    );
    translated = response.choices[0]?.message?.content ?? undefined;
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) {
      throw new ApiError(504, "Translation timed out.");
    }
    if (signal?.aborted) {
      throw error;
    }
    throw new ApiError(502, "The model could not translate this text.");
  }
  if (translated === undefined) {
    throw new ApiError(502, "The model could not translate this text.");
  }
  return translated;
}
