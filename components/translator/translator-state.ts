import {
  applyFamilySourcePolicy,
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

/// Source language name, or `DETECT_SOURCE`. Values come only from the
/// language picker or the validated preferences parser, so this module can
/// trust them.
export type SourceLanguage = string;

/// The authoritative representation of everything the user can change that
/// a translation depends on. There is no parallel ref copy.
export interface TranslatorInputs {
  text: string;
  source: SourceLanguage;
  target: string;
  family: ModelFamilyId;
  preset: ModelPreset;
}

/// A completed translation together with the exact input snapshot that
/// produced it, so output always stays tied to its request.
export interface TranslationResult {
  translation: string;
  inputs: TranslatorInputs;
}

export type PauseReason = "keyboard" | "composition";

/// One request lifecycle as a discriminated union — no combination of
/// independent values can claim "ready" without a result or confuse an
/// empty input with a deferred one.
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
  /// The last successful translation, deliberately kept while a newer
  /// request is in flight or after a failure.
  lastSuccess: TranslationResult | null;
  keyboardOpen: boolean;
  composing: boolean;
  /// True once stored preferences have been hydrated into this state.
  /// Persistence waits for it so pre-hydration defaults are never written
  /// back over stored values.
  hydrated: boolean;
  /// Most used target languages, best first; derived from usage counts,
  /// which live in the preference store.
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
      /// Frequent languages derived from persisted usage counts.
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

/// What the request lifecycle should be for a text, given pauses and the
/// last success. Pure; used by every transition that re-derives the
/// lifecycle so the scheduling policy exists in exactly one place.
function pendingFor(
  inputs: TranslatorInputs,
  lastSuccess: TranslationResult | null,
  pauses: { keyboardOpen: boolean; composing: boolean },
): RequestState {
  const normalized = normalizeTranslationText(inputs.text);
  if (normalized === "") return { status: "idle" };
  // Text already translated exactly as it stands: nothing to schedule.
  if (lastSuccess !== null && sameInputs(lastSuccess.inputs, inputs)) {
    return { status: "ready" };
  }
  const issue = validateTranslationInput(normalized);
  if (issue) return { status: "failed", error: issue.message };
  // Composition takes priority: its text is not safe to submit yet.
  if (pauses.composing) return { status: "paused", reason: "composition" };
  if (pauses.keyboardOpen) return { status: "paused", reason: "keyboard" };
  return { status: "waiting" };
}

/// Any input edit replaces the pending lifecycle (an in-flight request is
/// invalidated by the caller cancelling it) and clears output when the text
/// becomes empty.
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

/// The pure reducer: cross-field rules and lifecycle transitions, no I/O,
/// no timers, no fetches.
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
      const familyEntry = familyById(event.family);
      if (!familyEntry) return state;
      // The one place the family/source rule is applied for edits.
      return edited(state, {
        ...state.inputs,
        family: event.family,
        source: applyFamilySourcePolicy(state.inputs.source, familyEntry),
      });
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
      // A running request may finish — only a debounce that has not fired
      // yet gets paused.
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
      // Unsubmitted edits resume the debounce; everything else is left
      // alone (a failure must not silently turn into a retry).
      if (state.request.status !== "paused") return next;
      return {
        ...next,
        request: pendingFor(next.inputs, next.lastSuccess, next),
      };
    }

    case "preferencesRestored": {
      // Trustworthy values from the preference parser; the family/source
      // rule was applied there.
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

/// Presentation derived from the session: components never inspect the
/// lifecycle union directly for layout or copy decisions.
export interface TranslationPresentation {
  /// Output pane has nothing to show.
  outputHidden: boolean;
  /// Source pane takes the whole viewport.
  singlePane: boolean;
  /// Skeleton stands in for a first translation.
  showSkeleton: boolean;
  /// Concise status for the live region.
  statusMessage: string;
  /// Active error message, empty when none.
  errorMessage: string;
  canRetry: boolean;
  /// The visible output is older than the current input.
  isStale: boolean;
}

export function getTranslationPresentation(
  request: RequestState,
  lastSuccess: TranslationResult | null,
  keyboardOpen: boolean,
): TranslationPresentation {
  const translated = lastSuccess?.translation ?? "";
  const busy = request.status === "waiting" || request.status === "loading";
  const stale =
    lastSuccess !== null && request.status !== "ready";

  let statusMessage = "";
  if (busy) {
    statusMessage = translated === "" ? "Translating…" : "Updating translation…";
  } else if (request.status === "ready") {
    // Short completion notice so the live region announces the finished
    // translation without reading the whole text aloud.
    statusMessage = "Translation ready";
  } else if (
    translated !== "" &&
    (request.status === "failed" || request.status === "paused")
  ) {
    statusMessage = "Previous translation";
  }

  return {
    outputHidden: request.status === "idle",
    singlePane: request.status === "idle" || keyboardOpen,
    showSkeleton: busy && translated === "",
    statusMessage,
    errorMessage: request.status === "failed" ? request.error : "",
    canRetry: request.status === "failed",
    isStale: stale,
  };
}
