import { z } from 'zod';
import type { Option } from '$lib/Option';

const SUPPORTED_LANGUAGE_TAGS = {
	aa: 'Afar',
	ab: 'Abkhazian',
	af: 'Afrikaans',
	ak: 'Akan',
	am: 'Amharic',
	an: 'Aragonese',
	ar: 'Arabic',
	as: 'Assamese',
	az: 'Azerbaijani',
	ba: 'Bashkir',
	be: 'Belarusian',
	bg: 'Bulgarian',
	bm: 'Bambara',
	bn: 'Bengali',
	bo: 'Tibetan',
	br: 'Breton',
	bs: 'Bosnian',
	ca: 'Catalan',
	ce: 'Chechen',
	co: 'Corsican',
	cs: 'Czech',
	cv: 'Chuvash',
	cy: 'Welsh',
	da: 'Danish',
	de: 'German',
	dv: 'Divehi',
	dz: 'Dzongkha',
	ee: 'Ewe',
	el: 'Greek',
	en: 'English',
	eo: 'Esperanto',
	es: 'Spanish',
	et: 'Estonian',
	eu: 'Basque',
	fa: 'Persian',
	ff: 'Fulah',
	fi: 'Finnish',
	'fi-FI': 'Finnish',
	fr: 'French',
	fy: 'Western Frisian',
	ga: 'Irish',
	gd: 'Scottish Gaelic',
	gl: 'Galician',
	gn: 'Guarani',
	gu: 'Gujarati',
	gv: 'Manx',
	ha: 'Hausa',
	he: 'Hebrew',
	hi: 'Hindi',
	hr: 'Croatian',
	ht: 'Haitian',
	hu: 'Hungarian',
	hy: 'Armenian',
	ia: 'Interlingua',
	id: 'Indonesian',
	ie: 'Interlingue',
	ig: 'Igbo',
	ii: 'Sichuan Yi',
	ik: 'Inupiaq',
	io: 'Ido',
	is: 'Icelandic',
	it: 'Italian',
	iu: 'Inuktitut',
	ja: 'Japanese',
	jv: 'Javanese',
	ka: 'Georgian',
	ki: 'Kikuyu',
	kk: 'Kazakh',
	kl: 'Kalaallisut',
	km: 'Central Khmer',
	kn: 'Kannada',
	ko: 'Korean',
	ks: 'Kashmiri',
	ku: 'Kurdish',
	kw: 'Cornish',
	ky: 'Kyrgyz',
	la: 'Latin',
	lb: 'Luxembourgish',
	lg: 'Ganda',
	ln: 'Lingala',
	lo: 'Lao',
	lt: 'Lithuanian',
	lu: 'Luba-Katanga',
	lv: 'Latvian',
	mg: 'Malagasy',
	mi: 'Maori',
	mk: 'Macedonian',
	ml: 'Malayalam',
	mn: 'Mongolian',
	mr: 'Marathi',
	ms: 'Malay',
	mt: 'Maltese',
	my: 'Burmese',
	nb: 'Norwegian Bokmål',
	nd: 'North Ndebele',
	ne: 'Nepali',
	nl: 'Dutch',
	nn: 'Norwegian Nynorsk',
	no: 'Norwegian',
	nr: 'South Ndebele',
	nv: 'Navajo',
	ny: 'Chichewa',
	oc: 'Occitan',
	om: 'Oromo',
	or: 'Oriya',
	os: 'Ossetian',
	pa: 'Punjabi',
	pl: 'Polish',
	ps: 'Pashto',
	pt: 'Portuguese',
	qu: 'Quechua',
	rm: 'Romansh',
	rn: 'Rundi',
	ro: 'Romanian',
	ru: 'Russian',
	rw: 'Kinyarwanda',
	sa: 'Sanskrit',
	sc: 'Sardinian',
	sd: 'Sindhi',
	se: 'Northern Sami',
	sg: 'Sango',
	si: 'Sinhala',
	sk: 'Slovak',
	sl: 'Slovenian',
	sn: 'Shona',
	so: 'Somali',
	sq: 'Albanian',
	sr: 'Serbian',
	ss: 'Swati',
	st: 'Southern Sotho',
	su: 'Sundanese',
	sv: 'Swedish',
	sw: 'Swahili',
	ta: 'Tamil',
	te: 'Telugu',
	tg: 'Tajik',
	th: 'Thai',
	ti: 'Tigrinya',
	tk: 'Turkmen',
	tl: 'Tagalog',
	tn: 'Tswana',
	to: 'Tonga',
	tr: 'Turkish',
	ts: 'Tsonga',
	tt: 'Tatar',
	ug: 'Uyghur',
	uk: 'Ukrainian',
	ur: 'Urdu',
	uz: 'Uzbek',
	ve: 'Venda',
	vi: 'Vietnamese',
	vo: 'Volapük',
	wa: 'Walloon',
	wo: 'Wolof',
	xh: 'Xhosa',
	yi: 'Yiddish',
	yo: 'Yoruba',
	za: 'Zhuang',
	zh: 'Chinese',
	'zh-Hans': 'Simplified Chinese',
	'zh-Hant': 'Traditional Chinese',
	zu: 'Zulu'
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGE_TAGS;

export const supportedLanguageSchema = z.enum(Object.keys(SUPPORTED_LANGUAGE_TAGS));

export class Language implements Option {
	private constructor(
		public readonly code: SupportedLanguageCode,
		private readonly defaultDisplayName: string
	) {}

	public static fromCode(code: string): Language {
		if (Language.isValid(code)) {
			return new Language(code, SUPPORTED_LANGUAGE_TAGS[code]);
		} else {
			throw new Error(`${code} is not a valid language`);
		}
	}

	public static default(): Language {
		return new Language('en', 'English');
	}

	public static getAllLanguages(): Language[] {
		return Array.from(Object.keys(SUPPORTED_LANGUAGE_TAGS)).map((code) => Language.fromCode(code));
	}

	/**
	 * Translates the language name into a readable string using Intl.DisplayNames.
	 *
	 * @param displayLocale The locale to display the name in (defaults to 'en').
	 * @returns The translated name (e.g., code 'es' -> 'Spanish' if locale is 'en').
	 */
	public getDisplayName(displayLocale: string = 'en'): string {
		try {
			const displayNames = new Intl.DisplayNames([displayLocale], { type: 'language' });
			return displayNames.of(this.code) ?? this.defaultDisplayName;
		} catch (error) {
			console.error(`Error translating language code ${this.code}:`, error);
			return this.defaultDisplayName;
		}
	}

	get label(): string {
		return this.getDisplayName(navigator.language);
	}

	get id(): string {
		return this.code;
	}

	/**
	 * Helper to check if the current instance code is strictly supported in the original list.
	 */
	public static isValid(code: string): code is SupportedLanguageCode {
		const result = supportedLanguageSchema.safeParse(code);
		return result.success;
	}
}
