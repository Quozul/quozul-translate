import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { Language, type SupportedLanguageCode } from '$lib/Language';
import { isDefined } from '$lib/isDefined';

const getInitialTargetLanguageCode = (): SupportedLanguageCode => {
	if (browser) {
		const code = localStorage.getItem('targetLanguage');
		if (isDefined(code) && Language.isValid(code)) {
			return code;
		}
	}
	for (const language of navigator.languages) {
		if (Language.isValid(language)) {
			return language;
		}
	}
	return 'en';
};

export const targetLanguage = writable(getInitialTargetLanguageCode());

targetLanguage.subscribe((val) => {
	if (browser) {
		return localStorage.setItem('targetLanguage', val);
	}
});

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
	'ar',
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

const shuffle = <T>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);

const getInitialSourceLanguageCode = (): SupportedLanguageCode => {
	if (browser) {
		const code = localStorage.getItem('sourceLanguage');
		if (isDefined(code) && Language.isValid(code)) {
			return code;
		}
	}
	const targetLanguageCode = getInitialTargetLanguageCode();
	for (const language of shuffle(POPULAR_LANGUAGE_CODES)) {
		if (!navigator.languages.includes(language) && targetLanguageCode !== language) {
			return language;
		}
	}
	return 'fr';
};

export const sourceLanguage = writable(getInitialSourceLanguageCode());

sourceLanguage.subscribe((val) => {
	if (browser) {
		return localStorage.setItem('sourceLanguage', val);
	}
});
