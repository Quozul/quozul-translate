import { Language } from '$lib/Language';
import { LLAMA_SERVER_URL, MODEL_NAME } from '$env/static/private';
import { z } from 'zod';

type LlamaCompletionRequest = {
	prompt:
		| string
		| {
				prompt_string: string;
				multimodal_data: string[];
		  };
	temperature?: number;
	n_predict?: number;
	stream?: boolean;
	cache_prompt?: boolean;
	model?: string; // This is only used when using llm-router
};

const llamaCompletionResponseSchema = z.object({
	content: z.string(),
	stop: z.boolean()
});

const SERVER_URL = LLAMA_SERVER_URL || 'http://127.0.0.1:8080/completion';

function buildPrompt(source: Language, target: Language, input: string): string {
	const sourceLang = source.getDisplayName(),
		sourceCode = source.code;
	const targetLang = target.getDisplayName(),
		targetCode = target.code;

	const content = `You are a professional ${sourceLang} (${sourceCode}) to ${targetLang} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceLang} text while adhering to ${targetLang} grammar, vocabulary, and cultural sensitivities.
Produce only the ${targetLang} translation, without any additional explanations or commentary. Please translate the following ${sourceLang} text into ${targetLang}:


${input}`;

	return `<start_of_turn>user\n${content}<end_of_turn>\n<start_of_turn>model\n`;
}

export async function translate(
	abortController: AbortController,
	source: Language,
	target: Language,
	input: string
): Promise<string> {
	const promptText = buildPrompt(source, target, input);

	const payload: LlamaCompletionRequest = {
		prompt: promptText,
		n_predict: -1,
		temperature: 0,
		cache_prompt: true,
		stream: false,
		model: MODEL_NAME
	};

	const response = await fetch(SERVER_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		signal: abortController.signal,
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${await response.text()}`);
	}

	const data = await response.json();
	const { content } = llamaCompletionResponseSchema.parse(data);
	return content;
}
