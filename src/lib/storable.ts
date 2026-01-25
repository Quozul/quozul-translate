import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { Language, type SupportedLanguageCode } from '$lib/Language';
import { isDefined } from '$lib/isDefined';

const POPULAR_LANGUAGE_CODES: SupportedLanguageCode[] = [
	'en',
	'zh',
	'hi',
	'es',
	'ar',
	'fr',
	'bn',
	'pt',
	'ru',
	'id',
	'ur',
	'de',
	'ja',
	'mr',
	'vi',
	'te',
	'ha',
	'tr',
	'pa',
	'sw',
	'tl',
	'ta',
	'ko',
	'th',
	'jv',
	'it',
	'gu',
	'am',
	'kn'
] as const;

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const getInitialSourceLanguageCode = (): SupportedLanguageCode => {
	if (browser) {
		const code = localStorage.getItem('sourceLanguage');
		if (isDefined(code) && Language.isValid(code)) {
			return code;
		}
	}

	if (typeof navigator !== 'undefined') {
		for (const language of navigator.languages) {
			if (Language.isValid(language)) {
				return language as SupportedLanguageCode;
			}
		}
	}
	return 'en';
};

export const sourceLanguage = writable(getInitialSourceLanguageCode());

sourceLanguage.subscribe((val) => {
	if (browser) {
		localStorage.setItem('sourceLanguage', val);
	}
});

const getInitialTargetLanguageCode = (): SupportedLanguageCode => {
	if (browser) {
		const code = localStorage.getItem('targetLanguage');
		if (isDefined(code) && Language.isValid(code)) {
			return code;
		}
	}

	const sourceLanguageCode = getInitialSourceLanguageCode();
	const navLangs = typeof navigator !== 'undefined' ? navigator.languages : [];

	// Filter for popular languages the user likely does not know
	for (const language of shuffle(POPULAR_LANGUAGE_CODES)) {
		if (!navLangs.includes(language) && language !== sourceLanguageCode) {
			return language;
		}
	}

	return 'fr';
};

export const targetLanguage = writable(getInitialTargetLanguageCode());

targetLanguage.subscribe((val) => {
	if (browser) {
		localStorage.setItem('targetLanguage', val);
	}
});
