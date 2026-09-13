"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from "react";
import { LanguagePicker } from "./language-picker";
import { LANGUAGES } from "@/lib/languages";
import { MAX_TEXT_LENGTH } from "@/lib/types";

type Phase = "idle" | "waiting" | "loading" | "ready" | "failed";

const PREFERENCES_KEY = "qzl.preferences.v1";

interface Preferences {
  target: string;
  model: string;
  translation_usage: Record<string, number>;
}

function statusMessage(status: number): string {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return "The request was rejected. Check the text length, language, and model setting.";
    case 504:
      return "The model took too long to respond. Try again or choose another model in Settings.";
    default:
      return "Translation failed. Check that your local model server is running and the selected model is available.";
  }
}

function loadPreferences(): Preferences {
  const fallback: Preferences = { target: "", model: "", translation_usage: {} };
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return {
      target: typeof parsed.target === "string" ? parsed.target : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      translation_usage:
        parsed.translation_usage && typeof parsed.translation_usage === "object"
          ? parsed.translation_usage
          : {},
    };
  } catch {
    return fallback;
  }
}

export function Translator() {
  const [text, setText] = useState("");
  const [translated, setTranslated] = useState("");
  const [resultTarget, setResultTarget] = useState("");
  const [target, setTarget] = useState("French");
  const [model, setModel] = useState("fast");
  const [frequent, setFrequent] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const source = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const composing = useRef(false);
  const usage = useRef<Record<string, number>>({});
  const textRef = useRef("");
  const targetRef = useRef("French");
  const modelRef = useRef("fast");
  const translatedRef = useRef("");

  const clearTimers = () => {
    if (debounce.current !== null) clearTimeout(debounce.current);
    if (deadline.current !== null) clearTimeout(deadline.current);
    debounce.current = null;
    deadline.current = null;
  };

  const cancel = useCallback(() => {
    generation.current += 1;
    clearTimers();
    abort.current?.abort();
    abort.current = null;
  }, []);

  const updateFrequent = useCallback(() => {
    const languages = LANGUAGES.map((language) => language.name).filter(
      (name) => (usage.current[name] ?? 0) > 0,
    );
    languages.sort(
      (a, b) => (usage.current[b] ?? 0) - (usage.current[a] ?? 0) || a.localeCompare(b),
    );
    setFrequent(languages.slice(0, 3));
  }, []);

  const save = useCallback(() => {
    try {
      const preferences: Preferences = {
        target: targetRef.current,
        model: modelRef.current,
        translation_usage: usage.current,
      };
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Storage may be unavailable; preferences simply will not persist.
    }
    updateFrequent();
  }, [updateFrequent]);

  const fail = useCallback((message: string) => {
    setPhase("failed");
    setError(message);
  }, []);

  const start = useCallback(() => {
    const controller = new AbortController();
    const request = {
      text: textRef.current,
      target: targetRef.current,
      model: modelRef.current,
    };
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
    }, 90_000);
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
          throw new Error(statusMessage(response.status));
        }
        const result = (await response.json()) as { translation?: unknown };
        if (typeof result.translation !== "string") {
          throw new Error("Invalid translation response.");
        }
        if (result.translation.trim() === "") {
          throw new Error(
            "The model returned an empty translation. Please try again.",
          );
        }
        // Count completed translations, including cache hits, rather than picker browsing.
        usage.current[request.target] = (usage.current[request.target] ?? 0) + 1;
        save();
        translatedRef.current = result.translation;
        setTranslated(result.translation);
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
          fail("Cannot reach the translation server. Check your connection and try again.");
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
    const trimmed = textRef.current.trim();
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
    if (composing.current) return;
    debounce.current = setTimeout(start, 400);
  }, [cancel, fail, start]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restore of persisted preferences on mount */
  useEffect(() => {
    const preferences = loadPreferences();
    if (LANGUAGES.some((language) => language.name === preferences.target)) {
      targetRef.current = preferences.target;
      setTarget(preferences.target);
    }
    if (
      preferences.model === "fast" ||
      preferences.model === "quality" ||
      preferences.model === "turbo"
    ) {
      modelRef.current = preferences.model;
      setModel(preferences.model);
    }
    usage.current = preferences.translation_usage;
    updateFrequent();
    // Replace legacy raw model preferences with the public preset key.
    save();
    source.current?.focus();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chooseLanguage = (name: string) => {
    if (!LANGUAGES.some((language) => language.name === name)) return;
    if (targetRef.current === name) return;
    targetRef.current = name;
    setTarget(name);
    save();
    schedule();
  };

  const changeModel = (event: ChangeEvent<HTMLSelectElement>) => {
    modelRef.current = event.target.value;
    setModel(event.target.value);
    save();
    schedule();
  };

  const changeText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    textRef.current = event.target.value;
    setText(event.target.value);
    schedule();
  };

  const endComposition = (event: CompositionEvent<HTMLTextAreaElement>) => {
    textRef.current = event.currentTarget.value;
    setText(event.currentTarget.value);
    composing.current = false;
    schedule();
  };

  const clearText = () => {
    textRef.current = "";
    setText("");
    schedule();
    source.current?.focus();
  };

  const copy = () => {
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
  };

  const charCount = [...text.trim()].length;
  const showCount = charCount > MAX_TEXT_LENGTH - 1000;
  const showSkeleton =
    (phase === "loading" || phase === "waiting") && translated === "";
  const status =
    (phase === "waiting" || phase === "loading") && translated !== ""
      ? ""
      : phase === "waiting" || phase === "loading"
        ? "Translating…"
        : phase === "failed" && translated !== ""
          ? "Previous translation"
          : "";

  return (
    <main>
      <div className="language-bar">
        <span className="source-language" aria-label="Automatically detect source language">
          Detect language
        </span>
        <span aria-hidden="true" className="arrow">
          →
        </span>
        <div className="target-language">
          <LanguagePicker selected={target} frequent={frequent} onSelect={chooseLanguage} />
        </div>
        <details className="settings">
          <summary aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </summary>
          <div className="model-settings">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={model}
              aria-describedby="model-detail"
              onChange={changeModel}
            >
              <option value="fast">Fast</option>
              <option value="quality">Quality</option>
              <option value="turbo">Turbo</option>
            </select>
            <p id="model-detail">
              {model === "quality"
                ? "Higher quality · moderate memory"
                : model === "turbo"
                  ? "High speed & quality · high memory"
                  : "Quick translations · low memory"}
            </p>
          </div>
        </details>
      </div>

      <div className="panels">
        <section className="panel source-panel" aria-label="Source text">
          {text !== "" && (
            <button
              type="button"
              className="icon-button clear"
              aria-label="Clear"
              title="Clear"
              onClick={clearText}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          )}
          <textarea
            id="source"
            ref={source}
            autoFocus
            dir="auto"
            placeholder="Enter text"
            aria-label="Text to translate"
            value={text}
            onChange={changeText}
            onCompositionStart={() => {
              composing.current = true;
              schedule();
            }}
            onCompositionEnd={endComposition}
          />
          {showCount && (
            <span
              className={`character-count${charCount > MAX_TEXT_LENGTH ? " over-limit" : ""}`}
            >
              {charCount} / 20,000
            </span>
          )}
        </section>

        <section
          className="panel result-panel"
          aria-label="Translation"
          hidden={phase === "idle"}
          aria-busy={phase === "loading"}
        >
          <div className="status" role="status" aria-live="polite" aria-atomic="true">
            {status}
          </div>
          {error !== "" && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={schedule}>
                Try again
              </button>
            </div>
          )}
          {translated !== "" ? (
            <>
              <p className="translation" dir="auto" aria-label={`${resultTarget} translation`}>
                {translated}
              </p>
              <div className="result-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Copy"
                  title="Copy"
                  onClick={copy}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="8" y="8" width="12" height="13" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            showSkeleton && (
              <div className="skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )
          )}
          <p className="copy-status" role="status">
            {copyMessage}
          </p>
        </section>
      </div>
    </main>
  );
}
