export const MAX_TEXT_LENGTH = 20_000;

export interface TranslationRequestBody {
  text: string;
  target: string;
  /// Public preset key; concrete model IDs are resolved only on the server.
  model: string;
}

export interface TranslationResponseBody {
  translation: string;
}
