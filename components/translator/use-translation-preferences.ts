"use client";

import { useCallback, useMemo, useRef } from "react";
import { FREQUENT_LANGUAGE_LIMIT } from "@/lib/languages";
import {
  browserStorage,
  getFrequentLanguages,
  loadTranslationPreferences,
  saveTranslationPreferences,
  type Preferences,
} from "@/lib/preferences";
import type { TranslatorInputs } from "./translator-state";

export function usePreferenceStore() {
  const usageRef = useRef<Record<string, number>>({});

  const restore = useCallback((): Preferences => {
    const preferences = loadTranslationPreferences(browserStorage());
    usageRef.current = preferences.usage;
    return preferences;
  }, []);

  const persist = useCallback(
    (
      inputs: Pick<TranslatorInputs, "target" | "source" | "family" | "preset">,
    ): void => {
      saveTranslationPreferences(browserStorage(), {
        target: inputs.target,
        source: inputs.source,
        family: inputs.family,
        preset: inputs.preset,
        usage: usageRef.current,
      });
    },
    [],
  );

  const recordTranslation = useCallback((target: string): string[] => {
    usageRef.current = {
      ...usageRef.current,
      [target]: (usageRef.current[target] ?? 0) + 1,
    };
    return getFrequentLanguages(usageRef.current, FREQUENT_LANGUAGE_LIMIT);
  }, []);

  const frequent = useCallback(
    (): string[] =>
      getFrequentLanguages(usageRef.current, FREQUENT_LANGUAGE_LIMIT),
    [],
  );

  return useMemo(
    () => ({ restore, persist, recordTranslation, frequent }),
    [restore, persist, recordTranslation, frequent],
  );
}
