import { z } from 'zod';
import { supportedLanguageSchema } from '$lib/Language';

export const translationRequestSchema = z.object({
	text: z.string().trim(),
	source_language: supportedLanguageSchema,
	target_language: supportedLanguageSchema
});

export type TranslationRequest = z.infer<typeof translationRequestSchema>;

export const translationResponseSchema = z.object({
	text: z.string(),
	source_language: supportedLanguageSchema,
	target_language: supportedLanguageSchema,
	cached: z.boolean()
});

export type TranslationResponse = z.infer<typeof translationResponseSchema>;
