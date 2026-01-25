import { error, json, type RequestHandler } from '@sveltejs/kit';
import { translationRequestSchema, type TranslationResponse } from '$lib/translationRequestSchema';
import { Language } from '$lib/Language';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';
import { LRUCache } from 'lru-cache';
import { translate } from '$lib/translation';

const cache = new LRUCache<string, TranslationResponse>({
	max: 500,

	// for use with tracking overall storage size
	maxSize: 5000,
	sizeCalculation: () => {
		return 1;
	},

	// how long to live in ms
	ttl: 1_000 * 3_600 * 24, // 24 hours

	// return stale items before removing from cache?
	allowStale: false,

	updateAgeOnGet: false,
	updateAgeOnHas: false
});

const limiter = new RetryAfterRateLimiter({
	IP: [1, '2s']
});

export const POST: RequestHandler = async (event): Promise<Response> => {
	const { request } = event;
	const jsonRequest = await request.json();

	const translationRequest = translationRequestSchema.parse(jsonRequest);

	const cacheKey = JSON.stringify(translationRequest);
	const cachedTranslation = cache.get(cacheKey);
	if (cachedTranslation) {
		const translationResponse: TranslationResponse = {
			...cachedTranslation,
			cached: true
		};
		return json(translationResponse);
	}

	const status = await limiter.check(event);
	if (status.limited) {
		event.setHeaders({
			'Retry-After': status.retryAfter.toString()
		});
		return error(429);
	}

	const source = Language.fromCode(translationRequest.source_language);
	const target = Language.fromCode(translationRequest.target_language);
	const translatedText = await translate(source, target, translationRequest.text);

	const translationResponse: TranslationResponse = {
		...translationRequest,
		text: translatedText,
		cached: false
	};

	cache.set(cacheKey, translationResponse);
	return json(translationResponse);
};
