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
import { SettingsSheet } from "./settings-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { MAX_TEXT_LENGTH, translationResponseBodySchema } from "@/lib/types";
import { CopyIcon, XIcon } from "lucide-react";

type Phase = "idle" | "waiting" | "loading" | "ready" | "failed";

const PREFERENCES_KEY = "qzl.preferences.v1";

interface Preferences {
  target: string;
  source: string;
  family: string;
  preset: string;
  translation_usage: Record<string, number>;
}

/// Earlier preferences stored a single `model` key naming Hy-MT2 sizes.
const LEGACY_MODELS: Record<
  string,
  { family: ModelFamilyId; preset: ModelPreset }
> = {
  fast: { family: "hy-mt2", preset: "turbo" },
  quality: { family: "hy-mt2", preset: "balanced" },
  turbo: { family: "hy-mt2", preset: "quality" },
};

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

function loadPreferences(): Preferences {
  const fallback: Preferences = {
    target: "",
    source: DETECT_SOURCE,
    family: DEFAULT_FAMILY,
    preset: DEFAULT_PRESET,
    translation_usage: {},
  };
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<Preferences> & {
      model?: unknown;
    };
    let family = familyById(
      typeof parsed.family === "string" ? parsed.family : "",
    )?.id;
    let preset: ModelPreset | undefined;
    if (typeof parsed.preset === "string" && isModelPreset(parsed.preset)) {
      preset = parsed.preset;
    }
    if (!family) {
      const legacy =
        typeof parsed.model === "string" ? LEGACY_MODELS[parsed.model] : undefined;
      if (legacy) {
        family = legacy.family;
        preset = legacy.preset;
      }
    }
    return {
      target: typeof parsed.target === "string" ? parsed.target : "",
      source: typeof parsed.source === "string" ? parsed.source : DETECT_SOURCE,
      family: family ?? DEFAULT_FAMILY,
      preset: preset ?? DEFAULT_PRESET,
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
  const [source, setSource] = useState(DETECT_SOURCE);
  const [family, setFamily] = useState<ModelFamilyId>(DEFAULT_FAMILY);
  const [preset, setPreset] = useState<ModelPreset>(DEFAULT_PRESET);
  const [frequent, setFrequent] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sourceInput = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const composing = useRef(false);
  const usage = useRef<Record<string, number>>({});
  const textRef = useRef("");
  const targetRef = useRef("French");
  const sourceRef = useRef(DETECT_SOURCE);
  const familyRef = useRef<ModelFamilyId>(DEFAULT_FAMILY);
  const presetRef = useRef<ModelPreset>(DEFAULT_PRESET);
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
        source: sourceRef.current,
        family: familyRef.current,
        preset: presetRef.current,
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
      source: sourceRef.current,
      target: targetRef.current,
      family: familyRef.current,
      preset: presetRef.current,
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
          const body = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          throw new Error(
            typeof body?.error === "string" && body.error !== ""
              ? body.error
              : statusMessage(response.status),
          );
        }
        const result = translationResponseBodySchema.safeParse(await response.json());
        if (!result.success) {
          throw new Error("Invalid translation response.");
        }
        if (result.data.translation.trim() === "") {
          throw new Error(
            "The model returned an empty translation. Please try again.",
          );
        }
        // Count completed translations, including cache hits, rather than picker browsing.
        usage.current[request.target] = (usage.current[request.target] ?? 0) + 1;
        save();
        translatedRef.current = result.data.translation;
        setTranslated(result.data.translation);
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
      preferences.source === DETECT_SOURCE ||
      LANGUAGES.some((language) => language.name === preferences.source)
    ) {
      const restoredFamily = familyById(preferences.family);
      // Families without explicit source support always detect.
      const restoredSource =
        restoredFamily && !restoredFamily.requiresSource
          ? DETECT_SOURCE
          : preferences.source;
      sourceRef.current = restoredSource;
      setSource(restoredSource);
    }
    if (familyById(preferences.family)) {
      familyRef.current = preferences.family as ModelFamilyId;
      setFamily(preferences.family as ModelFamilyId);
    }
    if (isModelPreset(preferences.preset)) {
      presetRef.current = preferences.preset;
      setPreset(preferences.preset);
    }
    usage.current = preferences.translation_usage;
    updateFrequent();
    // Rewrite legacy preferences in the current shape.
    save();
    sourceInput.current?.focus();
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

  const changeSource = (value: string) => {
    if (value !== DETECT_SOURCE) {
      if (!LANGUAGES.some((language) => language.name === value)) return;
    }
    if (sourceRef.current === value) return;
    sourceRef.current = value;
    setSource(value);
    save();
    schedule();
  };

  const changeFamily = (value: ModelFamilyId) => {
    if (familyRef.current === value) return;
    familyRef.current = value;
    setFamily(value);
    const next = familyById(value);
    // Families without explicit source support always detect.
    if (next && !next.requiresSource) {
      sourceRef.current = DETECT_SOURCE;
      setSource(DETECT_SOURCE);
    }
    save();
    schedule();
  };

  const changePreset = (value: ModelPreset) => {
    if (presetRef.current === value) return;
    presetRef.current = value;
    setPreset(value);
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
    sourceInput.current?.focus();
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
  // Families that always auto-detect keep the source input locked on detection.
  const sourceSelectable = familyById(family)?.requiresSource ?? false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <Select
            value={source}
            onValueChange={changeSource}
            disabled={!sourceSelectable}
          >
            <SelectTrigger
              aria-label="Source language"
              className="w-full border-transparent bg-transparent hover:bg-muted"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DETECT_SOURCE}>Detect language</SelectItem>
              {LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.name}>
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span aria-hidden="true" className="text-muted-foreground">
          →
        </span>
        <div className="min-w-0 flex-1">
          <LanguagePicker selected={target} frequent={frequent} onSelect={chooseLanguage} />
        </div>
        <SettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          family={family}
          preset={preset}
          onFamilyChange={changeFamily}
          onPresetChange={changePreset}
        />
      </div>

      <div
        className={
          phase === "idle"
            ? "grid flex-1 grid-rows-[1fr] p-3"
            : "grid flex-1 grid-rows-[1fr_1fr] p-3"
        }
      >
        <section className="relative flex min-h-0 flex-col" aria-label="Source text">
          {text !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 z-10 text-muted-foreground"
              aria-label="Clear"
              title="Clear"
              onClick={clearText}
            >
              <XIcon />
            </Button>
          )}
          <Textarea
            id="source"
            ref={sourceInput}
            autoFocus
            dir="auto"
            placeholder="Enter text"
            aria-label="Text to translate"
            className="min-h-40 flex-1 resize-none border-0 bg-transparent px-2 text-2xl focus-visible:ring-0"
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
              className={
                charCount > MAX_TEXT_LENGTH
                  ? "self-end text-xs text-destructive"
                  : "self-end text-xs text-muted-foreground"
              }
            >
              {charCount} / 20,000
            </span>
          )}
        </section>

        <section
          className="min-h-0 overflow-y-auto pt-3"
          aria-label="Translation"
          hidden={phase === "idle"}
          aria-busy={phase === "loading"}
        >
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-3 text-sm text-muted-foreground empty:hidden"
          >
            {status}
          </div>
          {error !== "" && (
            <div className="mb-3 text-[0.9375rem] text-destructive" role="alert">
              <p>{error}</p>
              <Button type="button" variant="link" className="-ml-2" onClick={schedule}>
                Try again
              </Button>
            </div>
          )}
          {translated !== "" ? (
            <>
              <p
                dir="auto"
                aria-label={`${resultTarget} translation`}
                className="text-2xl leading-normal wrap-break-word whitespace-pre-wrap"
              >
                {translated}
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Copy"
                  title="Copy"
                  onClick={copy}
                >
                  <CopyIcon />
                </Button>
              </div>
            </>
          ) : (
            showSkeleton && (
              <div className="flex flex-col gap-3.5" aria-hidden="true">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[90%]" />
                <Skeleton className="h-3.5 w-[65%]" />
              </div>
            )
          )}
          <p role="status" className="mt-3 text-xs text-muted-foreground empty:hidden">
            {copyMessage}
          </p>
        </section>
      </div>
    </main>
  );
}
