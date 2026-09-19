import { describe, expect, it } from "vitest";
import { DETECT_SOURCE } from "@/lib/models";
import {
  canSwapLanguages,
  createInitialState,
  getTranslationPresentation,
  type TranslationAttribution,
  type TranslationResult,
  type TranslatorInputs,
  type TranslatorState,
  translatorReducer,
} from "./translator-state";

const BASE_INPUTS: TranslatorInputs = {
  text: "",
  source: "detect",
  target: "fr",
  family: "milmmt",
  preset: "balanced",
};

function type(state: TranslatorState, text: string): TranslatorState {
  return translatorReducer(state, { type: "textChanged", text });
}

function succeed(
  state: TranslatorState,
  requestId: number,
  translation: string,
  inputs: Partial<TranslatorInputs> = {},
  attribution: TranslationAttribution | null = null,
): TranslatorState {
  if (state.request.status !== "loading") {
    state = translatorReducer(state, { type: "requestStarted", requestId });
  }
  return translatorReducer(state, {
    type: "requestSucceeded",
    requestId,
    translation,
    attribution,
    inputs: { ...state.inputs, ...inputs },
  });
}

describe("translator reducer — invariants", () => {
  it("starts idle with nothing to show", () => {
    const state = createInitialState();
    expect(state.request).toEqual({ status: "idle" });
    expect(state.lastSuccess).toBeNull();
  });

  it("typing valid text schedules by moving to waiting", () => {
    const state = type(createInitialState(), "hello");
    expect(state.request).toEqual({ status: "waiting" });
  });

  it("clearing input returns to idle and clears the previous output", () => {
    let state = succeed(type(createInitialState(), "hello"), 1, "bonjour");
    state = type(state, "");
    expect(state.request).toEqual({ status: "idle" });
    expect(state.lastSuccess).toBeNull();
  });

  it("distinguishes empty input from a deferred one", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "compositionStarted" });
    expect(state.request).toEqual({ status: "paused", reason: "composition" });

    const empty = type(createInitialState(), "");
    expect(empty.request).toEqual({ status: "idle" });
  });

  it("text longer than the limit fails with the shared message", () => {
    const state = type(createInitialState(), "a".repeat(4_097));
    expect(state.request).toMatchObject({ status: "failed" });
    if (state.request.status === "failed") {
      expect(state.request.error).toMatch(/4,096 characters/);
      expect(state.request.retryable).toBe(false);
    }
  });

  it("control character failures are not retryable", () => {
    const state = type(createInitialState(), "hello\u0000world");
    expect(state.request).toMatchObject({
      status: "failed",
      retryable: false,
    });
  });

  it("ready sessions always carry a successful result", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "requestStarted", requestId: 7 });
    state = translatorReducer(state, {
      type: "requestSucceeded",
      requestId: 7,
      translation: "bonjour",
      inputs: state.inputs,
    });
    expect(state.request).toEqual({ status: "ready" });
    expect(state.lastSuccess?.translation).toBe("bonjour");
    expect(state.lastSuccess?.inputs.text).toBe("hello");
  });

  it("stores model provenance and clears it when a newer result lacks one", () => {
    let state = type(createInitialState(), "hello");
    state = succeed(
      state,
      1,
      "bonjour",
      {},
      {
        model: "MiLMMT (Balanced)",
        durationMs: 812,
        cached: true,
      },
    );
    expect(state.lastSuccess?.attribution).toEqual({
      model: "MiLMMT (Balanced)",
      durationMs: 812,
      cached: true,
    });

    state = succeed(state, 2, "bonjour!", {});
    expect(state.lastSuccess?.attribution).toBeNull();
  });

  it("ignores results for stale request IDs", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "requestStarted", requestId: 2 });
    const before = state;
    state = translatorReducer(state, {
      type: "requestSucceeded",
      requestId: 1,
      translation: "ancient",
      inputs: BASE_INPUTS,
    });
    expect(state).toBe(before);
    state = translatorReducer(state, {
      type: "requestFailed",
      requestId: 1,
      error: "ancient failure",
    });
    expect(state).toBe(before);
  });
});

describe("translator reducer — composition scheduling", () => {
  it("composition defers work until it ends", () => {
    let state = type(createInitialState(), "ひ");
    state = translatorReducer(state, { type: "compositionStarted" });
    expect(state.request).toEqual({ status: "paused", reason: "composition" });
    state = translatorReducer(state, {
      type: "compositionEnded",
      text: "日本語",
    });
    expect(state.request).toEqual({ status: "waiting" });
    expect(state.inputs.text).toBe("日本語");
  });

  it("editing text replaces the pending lifecycle immediately", () => {
    let state = type(createInitialState(), "one");
    state = translatorReducer(state, { type: "requestStarted", requestId: 1 });
    state = type(state, "two");
    expect(state.request).toEqual({ status: "waiting" });
  });
});

describe("translator reducer — cross-field rules", () => {
  it("keeps the explicit source when switching to an auto-detect family", () => {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source: "en",
    });
    expect(state.inputs.source).toBe("en");
    state = translatorReducer(state, {
      type: "familyChanged",
      family: "hy-mt2",
    });
    expect(state.inputs.source).toBe("en");
  });

  it("keeps an explicit source for required-source families", () => {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source: "en",
    });
    state = translatorReducer(state, {
      type: "familyChanged",
      family: "milmmt",
    });
    expect(state.inputs.source).toBe("en");
  });

  it("keeps the chosen family when a source choice requires a fallback family", () => {
    let state = translatorReducer(createInitialState(), {
      type: "familyChanged",
      family: "hy-mt2",
    });
    state = translatorReducer(state, {
      type: "sourceChanged",
      source: "en",
    });
    expect(state.inputs.family).toBe("hy-mt2");
    expect(state.inputs.source).toBe("en");
  });

  it("keeps the chosen family when detection requires a fallback family", () => {
    let state = translatorReducer(createInitialState(), {
      type: "familyChanged",
      family: "milmmt",
    });
    state = translatorReducer(state, {
      type: "sourceChanged",
      source: "detect",
    });
    expect(state.inputs.family).toBe("milmmt");
    expect(state.inputs.source).toBe("detect");
  });

  it("no-ops identical input changes", () => {
    const state = type(createInitialState(), "same");
    expect(type(state, "same")).toBe(state);
  });
});

describe("translator reducer — swapping languages", () => {
  function swap(state: TranslatorState): TranslatorState {
    return translatorReducer(state, { type: "languagesSwapped" });
  }

  function translatedTo(
    source: string,
    target: string,
    text: string,
    translation: string,
  ): TranslatorState {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source,
    });
    state = translatorReducer(state, { type: "targetChanged", target });
    return succeed(type(state, text), 1, translation);
  }

  it("trades languages and moves the translation into the editor", () => {
    const state = swap(translatedTo("en", "fr", "hello", "bonjour"));
    expect(state.inputs.source).toBe("fr");
    expect(state.inputs.target).toBe("en");
    expect(state.inputs.text).toBe("bonjour");
    // The reverse direction has to be translated, so a request is scheduled
    // immediately: a swap is deliberate and must not wait out the debounce.
    expect(state.request).toEqual({ status: "waiting", immediate: true });
  });

  it("is offered only for an explicit source language", () => {
    expect(
      canSwapLanguages({ ...BASE_INPUTS, source: "en", target: "fr" }),
    ).toBe(true);
    expect(canSwapLanguages({ ...BASE_INPUTS, source: DETECT_SOURCE })).toBe(
      false,
    );
    expect(
      canSwapLanguages({ ...BASE_INPUTS, source: "klingon", target: "fr" }),
    ).toBe(false);
  });

  it("refuses to swap auto-detect away", () => {
    const before = translatedTo(DETECT_SOURCE, "fr", "hello", "bonjour");
    expect(swap(before)).toBe(before);
    expect(before.inputs.source).toBe(DETECT_SOURCE);
  });

  it("keeps the draft when no finished translation exists yet", () => {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source: "en",
    });
    state = translatorReducer(state, {
      type: "targetChanged",
      target: "fr",
    });
    const swappedState = swap(type(state, "hello"));
    expect(swappedState.inputs.source).toBe("fr");
    expect(swappedState.inputs.target).toBe("en");
    expect(swappedState.inputs.text).toBe("hello");
  });

  it("keeps a draft whose translation is no longer current", () => {
    const stale = type(translatedTo("en", "fr", "hello", "bonjour"), "hi");
    expect(swap(stale).inputs.text).toBe("hi");
  });
});

describe("translator reducer — pasting", () => {
  function append(state: TranslatorState, text: string): TranslatorState {
    return translatorReducer(state, { type: "textAppended", text });
  }

  it("fills an empty editor", () => {
    const state = append(createInitialState(), "hello");
    expect(state.inputs.text).toBe("hello");
    expect(state.request).toEqual({ status: "waiting" });
  });

  it("adds clipboard text below an existing draft", () => {
    const state = append(type(createInitialState(), "hello"), "bonjour");
    expect(state.inputs.text).toBe("hello\nbonjour");
  });

  it("does not stack blank lines after a trailing newline", () => {
    const state = append(type(createInitialState(), "hello\n"), "bonjour");
    expect(state.inputs.text).toBe("hello\nbonjour");
  });

  it("ignores an empty clipboard", () => {
    const state = type(createInitialState(), "hello");
    expect(append(state, "")).toBe(state);
  });
});

describe("preferencesRestored", () => {
  it("gates persistence behind the hydration flag", () => {
    expect(createInitialState().hydrated).toBe(false);
    const restored = translatorReducer(createInitialState(), {
      type: "preferencesRestored",
      target: "fr",
      source: "detect",
      family: "milmmt",
      preset: "balanced",
      frequent: [],
    });
    expect(restored.hydrated).toBe(true);
    const afterUsage = translatorReducer(restored, {
      type: "usageUpdated",
      frequent: ["fr"],
    });
    expect(afterUsage.hydrated).toBe(true);
  });

  it("hydrates inputs, applying nothing new (parser already validated)", () => {
    const state = translatorReducer(createInitialState(), {
      type: "preferencesRestored",
      target: "ja",
      source: "detect",
      family: "hy-mt2",
      preset: "turbo",
      frequent: ["de"],
    });
    expect(state.inputs.target).toBe("ja");
    expect(state.inputs.preset).toBe("turbo");
    expect(state.frequent).toEqual(["de"]);
  });
});

describe("presentation selector", () => {
  const success = {
    translation: "bonjour",
    inputs: BASE_INPUTS,
    attribution: null,
  };
  const attributed = (
    attribution: TranslationResult["attribution"],
  ): TranslationResult => ({ ...success, attribution });

  it("stays quiet when idle", () => {
    const p = getTranslationPresentation({ status: "idle" }, null);
    expect(p.busy).toBe(false);
    expect(p.statusMessage).toBe("");
    expect(p.errorMessage).toBe("");
  });

  it("is busy while waiting or loading", () => {
    const loading = { status: "loading", requestId: 1 } as const;
    expect(getTranslationPresentation(loading, null).busy).toBe(true);
    expect(getTranslationPresentation(loading, success).busy).toBe(true);
    expect(getTranslationPresentation({ status: "waiting" }, null).busy).toBe(
      true,
    );
  });

  it("leaves the status line empty while a new request runs", () => {
    const p = getTranslationPresentation(
      { status: "loading", requestId: 2 },
      success,
    );
    expect(p.statusMessage).toBe("");
    expect(p.isStale).toBe(true);
  });

  it("labels previous output after a failure", () => {
    const p = getTranslationPresentation(
      { status: "failed", error: "boom", retryable: true },
      success,
    );
    expect(p.statusMessage).toBe("Previous translation");
    expect(p.errorMessage).toBe("boom");
    expect(p.canRetry).toBe(true);
  });

  it("hides retry after a non-retryable validation failure", () => {
    const p = getTranslationPresentation(
      {
        status: "failed",
        error: "Please shorten your text.",
        retryable: false,
      },
      success,
    );
    expect(p.errorMessage).toBe("Please shorten your text.");
    expect(p.canRetry).toBe(false);
  });

  it("announces completion without reading the whole text aloud", () => {
    const p = getTranslationPresentation({ status: "ready" }, success);
    expect(p.statusMessage).toBe("Translation ready");
    expect(p.isStale).toBe(false);
  });

  it("names the model, duration, and cache state once ready", () => {
    const p = getTranslationPresentation(
      { status: "ready" },
      attributed({
        model: "MiLMMT (Balanced)",
        durationMs: 812,
        cached: false,
      }),
    );
    expect(p.statusMessage).toBe("Translated by MiLMMT (Balanced) in 812ms");
  });

  it("marks cached completions in the ready message", () => {
    const p = getTranslationPresentation(
      { status: "ready" },
      attributed({ model: "Hy-MT2 (Turbo)", durationMs: 3, cached: true }),
    );
    expect(p.statusMessage).toBe(
      "Translated by Hy-MT2 (Turbo) in 3ms (cached)",
    );
  });

  it("leaves the status line empty while a new request runs over attributed output", () => {
    const p = getTranslationPresentation(
      { status: "loading", requestId: 3 },
      attributed({
        model: "MiLMMT (Balanced)",
        durationMs: 812,
        cached: false,
      }),
    );
    expect(p.statusMessage).toBe("");
  });
});
