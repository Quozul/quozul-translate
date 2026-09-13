"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import {
  DEFAULT_FAMILY,
  DEFAULT_PRESET,
  DETECT_SOURCE,
  familyById,
  isModelPreset,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";
import {
  loadTranslationPreferences,
  saveTranslationPreferences,
} from "@/lib/preferences";
import {
  MAX_TEXT_LENGTH,
  translationResponseBodySchema,
  type TranslationRequestBody,
} from "@/lib/types";
import type { Phase } from "./types";

const DEFAULT_TARGET = "French";

/// Quiet period after the last input before a request is sent.
const DEBOUNCE_MS = 400;

/// Give up on a request that never answers.
const REQUEST_DEADLINE_MS = 90_000;

/// Request inputs with the model fields narrowed to their real types.
type RequestConfig = Omit<TranslationRequestBody, "family" | "preset"> & {
  family: ModelFamilyId;
  preset: ModelPreset;
};

export interface TranslatorState {
  /// Source text being translated.
  text: string;
  /// Newest completed translation, kept while a newer one is in flight.
  translated: string;
  /// Language `translated` was produced in.
  resultTarget: string;
  target: string;
  source: string;
  family: ModelFamilyId;
  preset: ModelPreset;
  /// Most used target languages, best first.
  frequent: string[];
  phase: Phase;
  error: string;
  /// Feedback for the last copy attempt.
  copyMessage: string;
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
  copy: () => void;
  /// Re-run the pipeline for the current inputs (the "Try again" button).
  retry: () => void;
}

/// Turn an HTTP status into copy the user can act on.
function statusMessage(status: number): string {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return "The request was rejected. Check the text length, languages, and model settings.";
    case 504:
      return "The model took too long to respond. Try again or choose another model in Settings.";
    default:
      return "Translation failed. Check that your local model server is running and the selected model is available.";
  }
}

function isKnownLanguage(name: string): boolean {
  return LANGUAGES.some((language) => language.name === name);
}

/// Owns every piece of translator state: the debounced request pipeline, the
/// language/model selection and its persistence. Exposed to sub-components
/// through `TranslatorProvider`.
export function useTranslatorController(): {
  state: TranslatorState;
  actions: TranslatorActions;
} {
  const [text, setText] = useState("");
  const [translated, setTranslated] = useState("");
  const [resultTarget, setResultTarget] = useState("");
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [source, setSource] = useState(DETECT_SOURCE);
  const [family, setFamily] = useState<ModelFamilyId>(DEFAULT_FAMILY);
  const [preset, setPreset] = useState<ModelPreset>(DEFAULT_PRESET);
  const [frequent, setFrequent] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const generation = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const composing = useRef(false);
  const usage = useRef<Record<string, number>>({});

  /// Mirror of the request inputs so async callbacks never read stale state.
  const config = useRef<RequestConfig>({
    text: "",
    source: DETECT_SOURCE,
    target: DEFAULT_TARGET,
    family: DEFAULT_FAMILY,
    preset: DEFAULT_PRESET,
  });
  /// Mirror of `translated` for the async clipboard callback.
  const translatedRef = useRef("");

  const clearTimers = useCallback(() => {
    if (debounce.current !== null) clearTimeout(debounce.current);
    if (deadline.current !== null) clearTimeout(deadline.current);
    debounce.current = null;
    deadline.current = null;
  }, []);

  const cancel = useCallback(() => {
    generation.current += 1;
    clearTimers();
    abort.current?.abort();
    abort.current = null;
  }, [clearTimers]);

  const updateFrequent = useCallback(() => {
    const languages = LANGUAGES.map((language) => language.name).filter(
      (name) => (usage.current[name] ?? 0) > 0,
    );
    languages.sort(
      (a, b) =>
        (usage.current[b] ?? 0) - (usage.current[a] ?? 0) ||
        a.localeCompare(b),
    );
    setFrequent(languages.slice(0, 3));
  }, []);

  const save = useCallback(() => {
    saveTranslationPreferences({
      target: config.current.target,
      source: config.current.source,
      family: config.current.family,
      preset: config.current.preset,
      usage: usage.current,
    });
    updateFrequent();
  }, [updateFrequent]);

  const fail = useCallback((message: string) => {
    setPhase("failed");
    setError(message);
  }, []);

  const start = useCallback(() => {
    const controller = new AbortController();
    const request: RequestConfig = { ...config.current };
    const current = generation.current;
    debounce.current = null;
    abort.current = controller;
    setPhase("loading");
    deadline.current = setTimeout(() => {
      if (generation.current === current) {
        cancel();
        fail(
          "The model took too long to respond. Try again or choose another model in Settings.",
        );
      }
    }, REQUEST_DEADLINE_MS);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (generation.current !== current) return;
        if (deadline.current !== null) clearTimeout(deadline.current);
        deadline.current = null;
        abort.current = null;
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          throw new Error(
            typeof body?.error === "string" && body.error !== ""
              ? body.error
              : statusMessage(response.status),
          );
        }
        const parsed = translationResponseBodySchema.safeParse(
          await response.json(),
        );
        if (!parsed.success) {
          throw new Error("Invalid translation response.");
        }
        if (parsed.data.translation.trim() === "") {
          throw new Error(
            "The model returned an empty translation. Please try again.",
          );
        }
        // Count completed translations, including cache hits, rather than
        // picker browsing.
        const hits = usage.current[request.target] ?? 0;
        usage.current[request.target] = hits + 1;
        save();
        translatedRef.current = parsed.data.translation;
        setTranslated(parsed.data.translation);
        setResultTarget(request.target);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (generation.current !== current) return;
        if (deadline.current !== null) clearTimeout(deadline.current);
        deadline.current = null;
        abort.current = null;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof TypeError) {
          fail(
            "Cannot reach the translation server. Check your connection and try again.",
          );
          return;
        }
        fail(
          err instanceof Error && err.message
            ? err.message
            : "Translation failed. Please try again.",
        );
      });
  }, [cancel, fail, save]);

  const schedule = useCallback(() => {
    // Abort on the input event itself, before starting the debounce timer.
    cancel();
    setError("");
    setCopyMessage("");
    const trimmed = config.current.text.trim();
    if (trimmed === "") {
      translatedRef.current = "";
      setTranslated("");
      setResultTarget("");
      setPhase("idle");
      return;
    }
    if ([...trimmed].length > MAX_TEXT_LENGTH) {
      fail("Please shorten your text to 20,000 characters or fewer.");
      return;
    }
    setPhase("waiting");
    // Composition is still assembling characters; wait for its end event.
    if (composing.current) return;
    debounce.current = setTimeout(start, DEBOUNCE_MS);
  }, [cancel, fail, start]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restore of persisted preferences on mount */
  useEffect(() => {
    const preferences = loadTranslationPreferences();
    if (isKnownLanguage(preferences.target)) {
      config.current.target = preferences.target;
      setTarget(preferences.target);
    }
    if (
      preferences.source === DETECT_SOURCE ||
      isKnownLanguage(preferences.source)
    ) {
      const restoredFamily = familyById(preferences.family);
      // Families without explicit source support always detect.
      const restoredSource =
        restoredFamily && !restoredFamily.requiresSource
          ? DETECT_SOURCE
          : preferences.source;
      config.current.source = restoredSource;
      setSource(restoredSource);
    }
    if (familyById(preferences.family)) {
      config.current.family = preferences.family as ModelFamilyId;
      setFamily(preferences.family as ModelFamilyId);
    }
    if (isModelPreset(preferences.preset)) {
      config.current.preset = preferences.preset;
      setPreset(preferences.preset);
    }
    usage.current = preferences.translation_usage;
    updateFrequent();
    // Rewrite legacy preferences in the current shape.
    save();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chooseLanguage = useCallback(
    (name: string) => {
      if (!isKnownLanguage(name)) return;
      if (config.current.target === name) return;
      config.current.target = name;
      setTarget(name);
      save();
      schedule();
    },
    [save, schedule],
  );

  const changeSource = useCallback(
    (value: string) => {
      if (value !== DETECT_SOURCE && !isKnownLanguage(value)) return;
      if (config.current.source === value) return;
      config.current.source = value;
      setSource(value);
      save();
      schedule();
    },
    [save, schedule],
  );

  const changeFamily = useCallback(
    (value: ModelFamilyId) => {
      if (config.current.family === value) return;
      config.current.family = value;
      setFamily(value);
      const next = familyById(value);
      // Families without explicit source support always detect.
      if (next && !next.requiresSource) {
        config.current.source = DETECT_SOURCE;
        setSource(DETECT_SOURCE);
      }
      save();
      schedule();
    },
    [save, schedule],
  );

  const changePreset = useCallback(
    (value: ModelPreset) => {
      if (config.current.preset === value) return;
      config.current.preset = value;
      setPreset(value);
      save();
      schedule();
    },
    [save, schedule],
  );

  const changeText = useCallback(
    (value: string) => {
      config.current.text = value;
      setText(value);
      schedule();
    },
    [schedule],
  );

  const startComposition = useCallback(() => {
    composing.current = true;
    schedule();
  }, [schedule]);

  const endComposition = useCallback(
    (value: string) => {
      config.current.text = value;
      setText(value);
      composing.current = false;
      schedule();
    },
    [schedule],
  );

  const clearText = useCallback(() => {
    config.current.text = "";
    setText("");
    schedule();
  }, [schedule]);

  const copy = useCallback(() => {
    const value = translatedRef.current;
    if (value === "") return;
    const write =
      window.isSecureContext && navigator.clipboard
        ? navigator.clipboard.writeText(value)
        : Promise.reject();
    write
      .then(() => {
        if (translatedRef.current !== value) return;
        setCopyMessage("Copied to clipboard.");
      })
      .catch(() => {
        if (translatedRef.current !== value) return;
        setCopyMessage(
          "Could not copy. Select the translation and copy it manually (clipboard access needs HTTPS or localhost).",
        );
      });
  }, []);

  // Actions only touch refs and setters, so this identity stays stable.
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
      copy,
      retry: schedule,
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
      copy,
      schedule,
    ],
  );

  const state: TranslatorState = {
    text,
    translated,
    resultTarget,
    target,
    source,
    family,
    preset,
    frequent,
    phase,
    error,
    copyMessage,
  };

  return { state, actions };
}
