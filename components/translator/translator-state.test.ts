import { describe, expect, it } from "vitest";
import {
  createInitialState,
  getTranslationPresentation,
  translatorReducer,
  type TranslatorState,
  type TranslatorInputs,
} from "./translator-state";

const BASE_INPUTS: TranslatorInputs = {
  text: "",
  source: "detect",
  target: "French",
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
): TranslatorState {
  if (state.request.status !== "loading") {
    state = translatorReducer(state, { type: "requestStarted", requestId });
  }
  return translatorReducer(state, {
    type: "requestSucceeded",
    requestId,
    translation,
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
    let state = succeed(
      type(createInitialState(), "hello"),
      1,
      "bonjour",
    );
    state = type(state, "");
    expect(state.request).toEqual({ status: "idle" });
    expect(state.lastSuccess).toBeNull();
  });

  it("distinguishes empty input from a deferred one", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "keyboardOpened" });
    expect(state.request).toEqual({ status: "paused", reason: "keyboard" });

    const empty = type(createInitialState(), "");
    expect(empty.request).toEqual({ status: "idle" });
  });

  it("text longer than the limit fails with the shared message", () => {
    const state = type(createInitialState(), "a".repeat(20_001));
    expect(state.request).toMatchObject({ status: "failed" });
    if (state.request.status === "failed") {
      expect(state.request.error).toMatch(/20,000 characters/);
    }
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

describe("translator reducer — keyboard and composition scheduling", () => {
  it("opening the keyboard pauses a pending debounce", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "keyboardOpened" });
    expect(state.request).toEqual({ status: "paused", reason: "keyboard" });
  });

  it("opening the keyboard does NOT disturb a running request", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "requestStarted", requestId: 1 });
    state = translatorReducer(state, { type: "keyboardOpened" });
    expect(state.request).toEqual({ status: "loading", requestId: 1 });
  });

  it("closing the keyboard resumes the debounce for unsubmitted edits", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "keyboardOpened" });
    state = translatorReducer(state, { type: "keyboardClosed" });
    expect(state.request).toEqual({ status: "waiting" });
  });

  it("closing the keyboard does not re-request already-translated text", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "requestStarted", requestId: 1 });
    state = translatorReducer(state, {
      type: "requestSucceeded",
      requestId: 1,
      translation: "bonjour",
      inputs: state.inputs,
    });
    state = translatorReducer(state, { type: "keyboardOpened" });
    state = translatorReducer(state, { type: "keyboardClosed" });
    expect(state.request).toEqual({ status: "ready" });
  });

  it("a failure does not silently turn into a retry when the keyboard closes", () => {
    let state = type(createInitialState(), "hello");
    state = translatorReducer(state, { type: "keyboardOpened" });
    state = translatorReducer(state, { type: "keyboardClosed" });
    state = translatorReducer(state, { type: "requestStarted", requestId: 1 });
    state = translatorReducer(state, {
      type: "requestFailed",
      requestId: 1,
      error: "boom",
    });
    state = translatorReducer(state, { type: "keyboardOpened" });
    state = translatorReducer(state, { type: "keyboardClosed" });
    expect(state.request).toEqual({ status: "failed", error: "boom" });
  });

  it("composition takes priority over the keyboard and defers work", () => {
    let state = type(createInitialState(), "ひ");
    state = translatorReducer(state, { type: "compositionStarted" });
    expect(state.request).toEqual({ status: "paused", reason: "composition" });
    state = translatorReducer(state, { type: "compositionEnded", text: "日本語" });
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
  it("switching to an auto-detect family forces source detection", () => {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source: "English",
    });
    expect(state.inputs.source).toBe("English");
    state = translatorReducer(state, { type: "familyChanged", family: "hy-mt2" });
    expect(state.inputs.source).toBe("detect");
  });

  it("keeps an explicit source for required-source families", () => {
    let state = translatorReducer(createInitialState(), {
      type: "sourceChanged",
      source: "English",
    });
    state = translatorReducer(state, { type: "familyChanged", family: "milmmt" });
    expect(state.inputs.source).toBe("English");
  });

  it("no-ops identical input changes", () => {
    const state = type(createInitialState(), "same");
    expect(type(state, "same")).toBe(state);
  });
});

describe("preferencesRestored", () => {
  it("gates persistence behind the hydration flag", () => {
    expect(createInitialState().hydrated).toBe(false);
    const restored = translatorReducer(createInitialState(), {
      type: "preferencesRestored",
      target: "French",
      source: "detect",
      family: "milmmt",
      preset: "balanced",
      frequent: [],
    });
    expect(restored.hydrated).toBe(true);
    const afterUsage = translatorReducer(restored, {
      type: "usageUpdated",
      frequent: ["French"],
    });
    expect(afterUsage.hydrated).toBe(true);
  });

  it("hydrates inputs, applying nothing new (parser already validated)", () => {
    const state = translatorReducer(createInitialState(), {
      type: "preferencesRestored",
      target: "Japanese",
      source: "detect",
      family: "hy-mt2",
      preset: "turbo",
      frequent: ["German"],
    });
    expect(state.inputs.target).toBe("Japanese");
    expect(state.inputs.preset).toBe("turbo");
    expect(state.frequent).toEqual(["German"]);
  });
});

describe("presentation selector", () => {
  const success = { translation: "bonjour", inputs: BASE_INPUTS };

  it("hides the output when idle", () => {
    const p = getTranslationPresentation({ status: "idle" }, null, false);
    expect(p.outputHidden).toBe(true);
    expect(p.singlePane).toBe(true);
  });

  it("shows a skeleton only while busy without output", () => {
    const loading = { status: "loading", requestId: 1 } as const;
    expect(
      getTranslationPresentation(loading, null, false).showSkeleton,
    ).toBe(true);
    expect(
      getTranslationPresentation(loading, success, false).showSkeleton,
    ).toBe(false);
  });

  it("labels retained output while a new request runs", () => {
    const p = getTranslationPresentation(
      { status: "loading", requestId: 2 },
      success,
      false,
    );
    expect(p.statusMessage).toBe("Updating translation…");
    expect(p.isStale).toBe(true);
  });

  it("labels previous output after a failure", () => {
    const p = getTranslationPresentation(
      { status: "failed", error: "boom" },
      success,
      false,
    );
    expect(p.statusMessage).toBe("Previous translation");
    expect(p.errorMessage).toBe("boom");
    expect(p.canRetry).toBe(true);
  });

  it("announces completion without reading the whole text aloud", () => {
    const p = getTranslationPresentation({ status: "ready" }, success, false);
    expect(p.statusMessage).toBe("Translation ready");
    expect(p.isStale).toBe(false);
  });
});
