import OpenAI, { APIConnectionTimeoutError } from "openai";
import {
  languageByName,
  promptName,
  type Language,
} from "./languages";
import {
  DETECT_SOURCE,
  familyById,
  isModelPreset,
  resolveFamily,
  type ModelFamily,
} from "./models";
import { MAX_TEXT_LENGTH, type TranslationRequestBody } from "./types";

export const DEFAULT_BASE_URL = "http://127.0.0.1:9931/v1";

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
  /// `null` means the source language is detected automatically.
  source: Language | null;
  target: Language;
  /// Family that will actually run; may differ from the requested one when
  /// the requested family does not support the language pair.
  family: ModelFamily;
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
  const target = languageByName(request.target.trim());
  if (!target) {
    throw new ApiError(400, "Choose a supported target language.");
  }
  const rawSource = request.source.trim();
  let source: Language | null = null;
  if (rawSource !== "" && rawSource !== DETECT_SOURCE) {
    const resolved = languageByName(rawSource);
    if (!resolved) {
      throw new ApiError(400, "Choose a supported source language.");
    }
    source = resolved;
  }
  const requested = familyById(request.family.trim());
  if (!requested) {
    throw new ApiError(400, "Choose a supported model family.");
  }
  const preset = request.preset.trim();
  if (!isModelPreset(preset)) {
    throw new ApiError(400, "Choose a supported model preset.");
  }
  const family = resolveFamily(requested.id, source?.code ?? null, target.code);
  if (!family) {
    throw new ApiError(
      400,
      "No model supports this language pair. Choose a source language or another model family.",
    );
  }
  return { text, source, target, family, model: family.models[preset] };
}

function buildPrompt(sanitized: SanitizedRequest): string {
  const targetName = promptName(sanitized.target, sanitized.family.id);
  if (sanitized.family.requiresSource && sanitized.source !== null) {
    const sourceName = promptName(sanitized.source, sanitized.family.id);
    return `Translate this from ${sourceName} to ${targetName}:\n${sourceName}: ${sanitized.text}\n${targetName}:`;
  }
  return `Translate the following text into ${targetName}. Note that you should only output the translated result without any additional explanation:\n\n${sanitized.text}\n`;
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
  const prompt = buildPrompt(sanitized);
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
