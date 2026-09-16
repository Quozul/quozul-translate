"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { languageByName } from "@/lib/languages";
import {
  DETECT_SOURCE,
  modelDisplayName,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";
import type { TranslationMeta } from "@/lib/translation-client";
import {
  normalizeTranslationText,
  validateTranslationInput,
} from "@/lib/translation-text";
import type {
  RequestState,
  TranslationAttribution,
  TranslationPresentation,
  TranslationResult,
  TranslatorEvent,
  TranslatorInputs,
} from "./translator-state";
import {
  canSwapLanguages,
  createInitialState,
  getTranslationPresentation,
  translatorReducer,
} from "./translator-state";
import { useCopyFeedback } from "./use-clipboard-feedback";
import { usePreferenceStore } from "./use-translation-preferences";
import { useTranslationRequest } from "./use-translation-request";

const DEBOUNCE_MS = 400;

export interface TranslatorPreferencesSlice {
  target: string;
  source: string;
  family: ModelFamilyId;
  preset: ModelPreset;
  frequent: string[];
}

export interface TranslatorEditorSlice {
  text: string;
  /** False while the source is auto-detect: there is nothing to swap into the target. */
  canSwap: boolean;
}

export interface TranslatorSessionSlice {
  request: RequestState;
  lastSuccess: TranslationResult | null;
  presentation: TranslationPresentation;
}

export interface TranslatorActions {
  chooseLanguage: (name: string) => void;
  changeSource: (value: string) => void;
  changeFamily: (value: ModelFamilyId) => void;
  changePreset: (value: ModelPreset) => void;
  changeText: (value: string) => void;
  swapLanguages: () => void;
  startComposition: () => void;
  endComposition: (value: string) => void;
  clearText: () => void;
  retry: () => void;
}

/**
 * Provenance for a finished request. The server-reported family wins because
 * resolution may fall back to another family; the requested pair is the
 * fallback when the response carries no provenance.
 */
function attributionFor(
  meta: TranslationMeta,
  requestedFamily: ModelFamilyId,
  requestedPreset: ModelPreset,
): TranslationAttribution | null {
  const model = modelDisplayName(
    meta.family ?? requestedFamily,
    meta.preset ?? requestedPreset,
  );
  if (model === null) return null;
  return {
    model,
    durationMs: meta.durationMs ?? 0,
    cached: meta.cached,
  };
}

function bodyFor(inputs: TranslatorInputs) {
  return {
    text: inputs.text,
    source: inputs.source,
    target: inputs.target,
    family: inputs.family,
    preset: inputs.preset,
  };
}

export function useTranslatorController(): {
  preferencesSlice: TranslatorPreferencesSlice;
  editorSlice: TranslatorEditorSlice;
  sessionSlice: TranslatorSessionSlice;
  actions: TranslatorActions;
} {
  const [state, dispatch] = useReducer(
    translatorReducer,
    undefined,
    createInitialState,
  );
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });

  const preferences = usePreferenceStore();
  const requestSequence = useRef(0);

  const handleResult = useCallback(
    (id: number, body: ReturnType<typeof bodyFor>, meta: TranslationMeta) => {
      dispatch({
        type: "requestSucceeded",
        requestId: id,
        translation: meta.translation,
        attribution: attributionFor(meta, body.family, body.preset),
        inputs: {
          text: body.text,
          source: body.source,
          target: body.target,
          family: body.family,
          preset: body.preset,
        },
      });
      dispatch({
        type: "usageUpdated",
        frequent: preferences.recordTranslation(body.target),
      });
    },
    [preferences],
  );

  const handleFailure = useCallback(
    (id: number, _body: ReturnType<typeof bodyFor>, error: string) => {
      dispatch({ type: "requestFailed", requestId: id, error });
    },
    [],
  );

  const engine = useTranslationRequest(handleResult, handleFailure);

  const startNow = useCallback(
    (inputs: TranslatorInputs) => {
      const id = ++requestSequence.current;
      dispatch({ type: "requestStarted", requestId: id });
      engine.start(id, bodyFor(inputs));
    },
    [engine],
  );

  const applyInput = useCallback(
    (event: TranslatorEvent) => {
      engine.cancel();
      dispatch(event);
    },
    [engine],
  );

  useEffect(() => {
    const restored = preferences.restore();
    dispatch({
      type: "preferencesRestored",
      target: restored.target,
      source: restored.source,
      family: restored.family,
      preset: restored.preset,
      frequent: preferences.frequent(),
    });
  }, [preferences]);

  const { target, source, family, preset } = state.inputs;
  const storedFields = useMemo(
    () => ({ target, source, family, preset }),
    [target, source, family, preset],
  );
  const hydrated = state.hydrated;
  useEffect(() => {
    if (!hydrated) return;
    preferences.persist(storedFields);
  }, [preferences, hydrated, storedFields]);

  const request = state.request;
  const inputs = state.inputs;
  useEffect(() => {
    if (request.status !== "waiting") return;
    const scheduledFor = inputs;
    if (request.immediate) {
      startNow(scheduledFor);
      return;
    }
    const timer = setTimeout(() => {
      const current = latest.current;
      if (
        current.request.status !== "waiting" ||
        current.inputs !== scheduledFor
      ) {
        return;
      }
      startNow(scheduledFor);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [request, inputs, startNow]);

  const chooseLanguage = useCallback(
    (name: string) => {
      if (!languageByName(name)) return;
      applyInput({ type: "targetChanged", target: name });
    },
    [applyInput],
  );

  const changeSource = useCallback(
    (value: string) => {
      if (value !== DETECT_SOURCE && !languageByName(value)) return;
      applyInput({ type: "sourceChanged", source: value });
    },
    [applyInput],
  );

  const changeFamily = useCallback(
    (value: ModelFamilyId) =>
      applyInput({ type: "familyChanged", family: value }),
    [applyInput],
  );

  const changePreset = useCallback(
    (value: ModelPreset) =>
      applyInput({ type: "presetChanged", preset: value }),
    [applyInput],
  );

  const changeText = useCallback(
    (value: string) => applyInput({ type: "textChanged", text: value }),
    [applyInput],
  );

  const startComposition = useCallback(
    () => applyInput({ type: "compositionStarted" }),
    [applyInput],
  );

  const endComposition = useCallback(
    (value: string) => applyInput({ type: "compositionEnded", text: value }),
    [applyInput],
  );

  const clearText = useCallback(
    () => applyInput({ type: "textChanged", text: "" }),
    [applyInput],
  );

  const swapLanguages = useCallback(
    () => applyInput({ type: "languagesSwapped" }),
    [applyInput],
  );

  const retry = useCallback(() => {
    const current = latest.current;
    const trimmed = normalizeTranslationText(current.inputs.text);
    if (trimmed === "" || validateTranslationInput(trimmed) !== null) return;
    engine.cancel();
    startNow(current.inputs);
  }, [engine, startNow]);

  const { frequent } = state;
  const preferencesSlice = useMemo<TranslatorPreferencesSlice>(
    () => ({ target, source, family, preset, frequent }),
    [target, source, family, preset, frequent],
  );

  const canSwap = canSwapLanguages(inputs);
  const editorSlice = useMemo<TranslatorEditorSlice>(
    () => ({ text: inputs.text, canSwap }),
    [inputs.text, canSwap],
  );

  const presentation = useMemo(
    () => getTranslationPresentation(request, state.lastSuccess),
    [request, state.lastSuccess],
  );

  const sessionSlice = useMemo<TranslatorSessionSlice>(
    () => ({ request, lastSuccess: state.lastSuccess, presentation }),
    [request, state.lastSuccess, presentation],
  );

  const actions = useMemo<TranslatorActions>(
    () => ({
      chooseLanguage,
      changeSource,
      changeFamily,
      changePreset,
      changeText,
      swapLanguages,
      startComposition,
      endComposition,
      clearText,
      retry,
    }),
    [
      chooseLanguage,
      changeSource,
      changeFamily,
      changePreset,
      changeText,
      swapLanguages,
      startComposition,
      endComposition,
      clearText,
      retry,
    ],
  );

  return { preferencesSlice, editorSlice, sessionSlice, actions };
}

export { useCopyFeedback };
