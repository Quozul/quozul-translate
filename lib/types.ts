import { z } from "zod";

export const MAX_TEXT_LENGTH = 20_000;

export const translationRequestBodySchema = z.object({
  text: z.string(),
  target: z.string(),
  /// Public preset key; concrete model IDs are resolved only on the server.
  model: z.string(),
});

export const translationResponseBodySchema = z.object({
  translation: z.string(),
});

export type TranslationRequestBody = z.infer<typeof translationRequestBodySchema>;
export type TranslationResponseBody = z.infer<typeof translationResponseBodySchema>;
