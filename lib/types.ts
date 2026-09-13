import { z } from "zod";

export const MAX_TEXT_LENGTH = 20_000;

export const translationRequestBodySchema = z.object({
  text: z.string(),
  /// Source language name, or DETECT_SOURCE for automatic detection.
  source: z.string(),
  target: z.string(),
  /// Model family ID and public preset key; concrete model IDs are resolved
  /// only on the server.
  family: z.string(),
  preset: z.string(),
});

export const translationResponseBodySchema = z.object({
  translation: z.string(),
});

export type TranslationRequestBody = z.infer<typeof translationRequestBodySchema>;
export type TranslationResponseBody = z.infer<typeof translationResponseBodySchema>;
