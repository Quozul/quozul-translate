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

/// Preference restoration, persistence, and usage counting. All browser
/// storage access lives here; decoding and validation are delegated to the
/// pure layer in `lib/preferences.ts`.
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
  }, []);

  /// Count one completed translation (cache hits included, not picker
  /// browsing) and return the refreshed frequent list.
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

  // Stable identity so effects can depend on it safely.
  return useMemo(
    () => ({ restore, persist, recordTranslation, frequent }),
    [restore, persist, recordTranslation, frequent],
  );
}
