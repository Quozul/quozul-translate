/// Small translation-specific error contract. The client maps codes
/// consistently instead of relying on server wording alone.
export type TranslationErrorCode =
  | "INVALID_INPUT"
  | "TEXT_TOO_LONG"
  | "UNSUPPORTED_LANGUAGE_PAIR"
  | "TIMEOUT"
  | "MODEL_UNAVAILABLE"
  | "INVALID_RESPONSE";

export class ApiError extends Error {
  constructor(
    readonly code: TranslationErrorCode,
    readonly status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
