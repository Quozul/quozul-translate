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

export interface TranslationResult {
  translation: string;
  inputs: TranslatorInputs;
}

export type PauseReason = "keyboard" | "composition";

export type RequestState =
  | { status: "idle" }
  | { status: "paused"; reason: PauseReason }
  | { status: "waiting" }
  | { status: "loading"; requestId: number }
  | { status: "ready" }
  | { status: "failed"; error: string };

export interface TranslatorState {
  inputs: TranslatorInputs;
  request: RequestState;
  lastSuccess: TranslationResult | null;
  keyboardOpen: boolean;
  composing: boolean;
  hydrated: boolean;
  frequent: string[];
}

export type TranslatorEvent =
  | { type: "textChanged"; text: string }
  | { type: "targetChanged"; target: string }
  | { type: "sourceChanged"; source: SourceLanguage }
  | { type: "familyChanged"; family: ModelFamilyId }
  | { type: "presetChanged"; preset: ModelPreset }
  | { type: "compositionStarted" }
  | { type: "compositionEnded"; text: string }
  | { type: "keyboardOpened" }
  | { type: "keyboardClosed" }
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
    keyboardOpen: false,
    composing: false,
    hydrated: false,
    frequent: [],
  };
}

function pendingFor(
  inputs: TranslatorInputs,
  lastSuccess: TranslationResult | null,
  pauses: { keyboardOpen: boolean; composing: boolean },
): RequestState {
  const normalized = normalizeTranslationText(inputs.text);
  if (normalized === "") return { status: "idle" };
  if (lastSuccess !== null && sameInputs(lastSuccess.inputs, inputs)) {
    return { status: "ready" };
  }
  const issue = validateTranslationInput(normalized);
  if (issue) return { status: "failed", error: issue.message };
  if (pauses.composing) return { status: "paused", reason: "composition" };
  if (pauses.keyboardOpen) return { status: "paused", reason: "keyboard" };
  return { status: "waiting" };
}

function edited(state: TranslatorState, inputs: TranslatorInputs): TranslatorState {
  if (sameInputs(state.inputs, inputs)) return state;
  const request = pendingFor(inputs, state.lastSuccess, state);
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
      return { ...next, request: pendingFor(next.inputs, next.lastSuccess, next) };
    }

    case "compositionEnded": {
      const next: TranslatorState = {
        ...state,
        composing: false,
        inputs: { ...state.inputs, text: event.text },
      };
      return { ...next, request: pendingFor(next.inputs, next.lastSuccess, next) };
    }

    case "keyboardOpened": {
      if (state.keyboardOpen) return state;
      const next = { ...state, keyboardOpen: true };
      if (state.request.status !== "waiting" && state.request.status !== "paused") {
        return next;
      }
      return {
        ...next,
        request: pendingFor(next.inputs, next.lastSuccess, next),
      };
    }

    case "keyboardClosed": {
      if (!state.keyboardOpen) return state;
      const next = { ...state, keyboardOpen: false };
      if (state.request.status !== "paused") return next;
      return {
        ...next,
        request: pendingFor(next.inputs, next.lastSuccess, next),
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
        lastSuccess: { translation: event.translation, inputs: event.inputs },
      };
    }

    case "requestFailed": {
      if (
        state.request.status !== "loading" ||
        state.request.requestId !== event.requestId
      ) {
        return state;
      }
      return { ...state, request: { status: "failed", error: event.error } };
    }
  }
}

export interface TranslationPresentation {
  showSkeleton: boolean;
  statusMessage: string;
  errorMessage: string;
  canRetry: boolean;
  isStale: boolean;
}

export function getTranslationPresentation(
  request: RequestState,
  lastSuccess: TranslationResult | null,
): TranslationPresentation {
  const translated = lastSuccess?.translation ?? "";
  const busy = request.status === "waiting" || request.status === "loading";
  const stale =
    lastSuccess !== null && request.status !== "ready";

  let statusMessage = "";
  if (busy) {
    statusMessage = translated === "" ? "Translating…" : "Updating translation…";
  } else if (request.status === "ready") {
    statusMessage = "Translation ready";
  } else if (
    translated !== "" &&
    (request.status === "failed" || request.status === "paused")
  ) {
    statusMessage = "Previous translation";
  }

  return {
    showSkeleton: busy && translated === "",
    statusMessage,
    errorMessage: request.status === "failed" ? request.error : "",
    canRetry: request.status === "failed",
    isStale: stale,
  };
}
