import { languageByCode } from "@/lib/languages";
import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  DETECT_SOURCE,
  familyById,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";
import { DEFAULT_TARGET } from "@/lib/translation-contract";
import {
  normalizeTranslationText,
  validateTranslationInput,
} from "@/lib/translation-text";

export type SourceLanguage = string;

export interface TranslatorInputs {
  text: string;
  source: SourceLanguage;
  target: string;
  family: ModelFamilyId;
  preset: ModelPreset;
}

export interface TranslationAttribution {
  model: string;
  durationMs: number;
  cached: boolean;
}

export interface TranslationResult {
  translation: string;
  inputs: TranslatorInputs;
  attribution: TranslationAttribution | null;
}

export type PauseReason = "composition";

export type RequestState =
  | { status: "idle" }
  | { status: "paused"; reason: PauseReason }
  | { status: "waiting"; immediate?: boolean }
  | { status: "loading"; requestId: number }
  | { status: "ready" }
  | { status: "failed"; error: string; retryable: boolean };

export interface TranslatorState {
  inputs: TranslatorInputs;
  request: RequestState;
  lastSuccess: TranslationResult | null;
  composing: boolean;
  hydrated: boolean;
  frequent: string[];
}

export type TranslatorEvent =
  | { type: "textChanged"; text: string }
  | { type: "targetChanged"; target: string }
  | { type: "sourceChanged"; source: SourceLanguage }
  | { type: "languagesSwapped" }
  | { type: "textAppended"; text: string }
  | { type: "familyChanged"; family: ModelFamilyId }
  | { type: "presetChanged"; preset: ModelPreset }
  | { type: "compositionStarted" }
  | { type: "compositionEnded"; text: string }
  | {
      type: "preferencesRestored";
      target: string;
      source: SourceLanguage;
      family: ModelFamilyId;
      preset: ModelPreset;
      frequent: string[];
    }
  | { type: "usageUpdated"; frequent: string[] }
  | { type: "requestStarted"; requestId: number }
  | {
      type: "requestSucceeded";
      requestId: number;
      translation: string;
      inputs: TranslatorInputs;
      attribution?: TranslationAttribution | null;
    }
  | { type: "requestFailed"; requestId: number; error: string };

export function sameInputs(a: TranslatorInputs, b: TranslatorInputs): boolean {
  return (
    a.text === b.text &&
    a.source === b.source &&
    a.target === b.target &&
    a.family === b.family &&
    a.preset === b.preset
  );
}

export function canSwapLanguages(inputs: TranslatorInputs): boolean {
  return (
    inputs.source !== DETECT_SOURCE &&
    languageByCode(inputs.source) !== undefined &&
    languageByCode(inputs.target) !== undefined
  );
}

export function createInitialState(): TranslatorState {
  return {
    inputs: {
      text: "",
      source: DETECT_SOURCE,
      target: DEFAULT_TARGET,
      family: DEFAULT_FAMILY,
      preset: DEFAULT_PRESET,
    },
    request: { status: "idle" },
    lastSuccess: null,
    composing: false,
    hydrated: false,
    frequent: [],
  };
}

function pendingFor(
  inputs: TranslatorInputs,
  lastSuccess: TranslationResult | null,
  composing: boolean,
): RequestState {
  const normalized = normalizeTranslationText(inputs.text);
  if (normalized === "") return { status: "idle" };
  if (lastSuccess !== null && sameInputs(lastSuccess.inputs, inputs)) {
    return { status: "ready" };
  }
  const issue = validateTranslationInput(normalized);
  if (issue)
    return { status: "failed", error: issue.message, retryable: false };
  if (composing) return { status: "paused", reason: "composition" };
  return { status: "waiting" };
}

function edited(
  state: TranslatorState,
  inputs: TranslatorInputs,
): TranslatorState {
  if (sameInputs(state.inputs, inputs)) return state;
  const request = pendingFor(inputs, state.lastSuccess, state.composing);
  return {
    ...state,
    inputs,
    request,
    lastSuccess: request.status === "idle" ? null : state.lastSuccess,
  };
}

export function translatorReducer(
  state: TranslatorState,
  event: TranslatorEvent,
): TranslatorState {
  switch (event.type) {
    case "textChanged":
      return edited(state, { ...state.inputs, text: event.text });

    case "targetChanged":
      return edited(state, { ...state.inputs, target: event.target });

    case "sourceChanged":
      return edited(state, { ...state.inputs, source: event.source });

    case "languagesSwapped": {
      if (!canSwapLanguages(state.inputs)) return state;
      // The finished translation becomes the new draft so the reverse
      // direction starts from the text that was just produced. While a result
      // is still in flight (or failed) the draft the user typed is kept.
      const translated = state.lastSuccess?.translation ?? "";
      const text =
        state.request.status === "ready" && translated !== ""
          ? translated
          : state.inputs.text;
      const next = edited(state, {
        ...state.inputs,
        text,
        source: state.inputs.target,
        target: state.inputs.source,
      });
      // A swap is a deliberate action, not typing: translate without waiting.
      return next.request.status === "waiting"
        ? { ...next, request: { status: "waiting", immediate: true } }
        : next;
    }

    case "textAppended": {
      // Pasting never replaces a draft: the clipboard text is added below it.
      if (event.text === "") return state;
      const current = state.inputs.text;
      const separator = current === "" || current.endsWith("\n") ? "" : "\n";
      return edited(state, {
        ...state.inputs,
        text: `${current}${separator}${event.text}`,
      });
    }

    case "familyChanged": {
      if (!familyById(event.family)) return state;
      // The family is a preference; request resolution falls back to a family
      // that supports the current source mode, so the source stays untouched.
      return edited(state, { ...state.inputs, family: event.family });
    }

    case "presetChanged":
      return edited(state, { ...state.inputs, preset: event.preset });

    case "compositionStarted": {
      if (state.composing) return state;
      const next = { ...state, composing: true };
      return {
        ...next,
        request: pendingFor(next.inputs, next.lastSuccess, true),
      };
    }

    case "compositionEnded": {
      const next: TranslatorState = {
        ...state,
        composing: false,
        inputs: { ...state.inputs, text: event.text },
      };
      return {
        ...next,
        request: pendingFor(next.inputs, next.lastSuccess, false),
      };
    }

    case "preferencesRestored": {
      const next = edited(state, {
        ...state.inputs,
        target: event.target,
        source: event.source,
        family: event.family,
        preset: event.preset,
      });
      return { ...next, frequent: event.frequent, hydrated: true };
    }

    case "usageUpdated":
      return { ...state, frequent: event.frequent };

    case "requestStarted":
      return {
        ...state,
        request: { status: "loading", requestId: event.requestId },
      };

    case "requestSucceeded": {
      if (
        state.request.status !== "loading" ||
        state.request.requestId !== event.requestId
      ) {
        return state;
      }
      return {
        ...state,
        request: { status: "ready" },
        lastSuccess: {
          translation: event.translation,
          inputs: event.inputs,
          attribution: event.attribution ?? null,
        },
      };
    }

    case "requestFailed": {
      if (
        state.request.status !== "loading" ||
        state.request.requestId !== event.requestId
      ) {
        return state;
      }
      return {
        ...state,
        request: { status: "failed", error: event.error, retryable: true },
      };
    }
  }
}

export interface TranslationPresentation {
  busy: boolean;
  statusMessage: string;
  errorMessage: string;
  canRetry: boolean;
  isStale: boolean;
}

const READY_FALLBACK_MESSAGE = "Translation ready";

export function readyMessage(
  attribution: TranslationAttribution | null,
): string {
  if (attribution === null) return READY_FALLBACK_MESSAGE;
  const cachedSuffix = attribution.cached ? " (cached)" : "";
  return `Translated by ${attribution.model} in ${attribution.durationMs}ms${cachedSuffix}`;
}

export function getTranslationPresentation(
  request: RequestState,
  lastSuccess: TranslationResult | null,
): TranslationPresentation {
  const translated = lastSuccess?.translation ?? "";
  const busy = request.status === "waiting" || request.status === "loading";
  const stale = lastSuccess !== null && request.status !== "ready";

  let statusMessage = "";
  if (request.status === "ready") {
    statusMessage = readyMessage(lastSuccess?.attribution ?? null);
  } else if (
    translated !== "" &&
    (request.status === "failed" || request.status === "paused")
  ) {
    statusMessage = "Previous translation";
  }

  return {
    busy,
    statusMessage,
    errorMessage: request.status === "failed" ? request.error : "",
    canRetry: request.status === "failed" && request.retryable,
    isStale: stale,
  };
}
