"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { languageByName } from "@/lib/languages";
import {
  DETECT_SOURCE,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";
import {
  normalizeTranslationText,
  validateTranslationInput,
} from "@/lib/translation-text";
import type {
  RequestState,
  TranslationPresentation,
  TranslationResult,
  TranslatorEvent,
  TranslatorInputs,
} from "./translator-state";
import {
  createInitialState,
  getTranslationPresentation,
  translatorReducer,
} from "./translator-state";
import { useCopyFeedback } from "./use-clipboard-feedback";
import { usePreferenceStore } from "./use-translation-preferences";
import { useTranslationRequest } from "./use-translation-request";
import { useVirtualKeyboard } from "./use-virtual-keyboard";

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
  keyboardOpen: boolean;
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
  startComposition: () => void;
  endComposition: (value: string) => void;
  clearText: () => void;
  submit: () => void;
  retry: () => void;
  focusSource: () => void;
  blurSource: () => void;
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
  const [sourceFocused, setSourceFocused] = useState(false);
  const viewportKeyboard = useVirtualKeyboard();
  const keyboardOpen = viewportKeyboard && sourceFocused;
  const requestSequence = useRef(0);

  const handleResult = useCallback(
    (id: number, body: ReturnType<typeof bodyFor>, translation: string) => {
      dispatch({
        type: "requestSucceeded",
        requestId: id,
        translation,
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

  const previousKeyboardOpen = useRef(keyboardOpen);
  useEffect(() => {
    if (previousKeyboardOpen.current === keyboardOpen) return;
    previousKeyboardOpen.current = keyboardOpen;
    dispatch({ type: keyboardOpen ? "keyboardOpened" : "keyboardClosed" });
  }, [keyboardOpen]);

  const request = state.request;
  const inputs = state.inputs;
  useEffect(() => {
    if (request.status !== "waiting") return;
    const scheduledFor = inputs;
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
    (value: ModelFamilyId) => applyInput({ type: "familyChanged", family: value }),
    [applyInput],
  );

  const changePreset = useCallback(
    (value: ModelPreset) => applyInput({ type: "presetChanged", preset: value }),
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

  const submit = useCallback(() => {
    const current = latest.current;
    if (current.composing) return;
    const trimmed = normalizeTranslationText(current.inputs.text);
    if (trimmed === "" || validateTranslationInput(trimmed) !== null) return;
    startNow(current.inputs);
  }, [startNow]);

  const retry = useCallback(() => {
    const current = latest.current;
    const trimmed = normalizeTranslationText(current.inputs.text);
    if (trimmed === "" || validateTranslationInput(trimmed) !== null) return;
    engine.cancel();
    startNow(current.inputs);
  }, [engine, startNow]);

  const focusSource = useCallback(() => setSourceFocused(true), []);
  const blurSource = useCallback(() => setSourceFocused(false), []);

  const { frequent } = state;
  const preferencesSlice = useMemo<TranslatorPreferencesSlice>(
    () => ({ target, source, family, preset, frequent }),
    [target, source, family, preset, frequent],
  );

  const editorSlice = useMemo<TranslatorEditorSlice>(
    () => ({ text: inputs.text, keyboardOpen }),
    [inputs.text, keyboardOpen],
  );

  const presentation = useMemo(
    () => getTranslationPresentation(request, state.lastSuccess, keyboardOpen),
    [request, state.lastSuccess, keyboardOpen],
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
      startComposition,
      endComposition,
      clearText,
      submit,
      retry,
      focusSource,
      blurSource,
    }),
    [
      chooseLanguage,
      changeSource,
      changeFamily,
      changePreset,
      changeText,
      startComposition,
      endComposition,
      clearText,
      submit,
      retry,
      focusSource,
      blurSource,
    ],
  );

  return { preferencesSlice, editorSlice, sessionSlice, actions };
}

export { useCopyFeedback };
