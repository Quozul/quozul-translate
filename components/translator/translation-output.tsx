"use client";

import { Button } from "@/components/ui/button";
import { languageByCode } from "@/lib/languages";
import { CopyIcon } from "lucide-react";
import {
  useTranslatorActions,
  useTranslatorSession,
} from "./translator-context";
import { useCopyFeedback } from "./use-clipboard-feedback";

export function TranslationOutput() {
  const { lastSuccess, presentation } = useTranslatorSession();
  const { retry } = useTranslatorActions();
  const { copy } = useCopyFeedback();

  const translated = lastSuccess?.translation ?? "";
  const resultTarget = lastSuccess?.inputs.target ?? "";
  const resultLanguage = languageByCode(resultTarget);
  const resultLabel = resultLanguage?.name ?? resultTarget;
  const showPlaceholder = translated === "";

  return (
    <section
      className="min-h-0 overflow-y-auto pt-3 md:pt-0"
      aria-label="Translation"
      aria-busy={presentation.busy}
    >
      {translated !== "" && (
        <>
          <p
            dir="auto"
            lang={resultLanguage?.code}
            aria-label={`${resultLabel} translation`}
            className="text-2xl leading-normal wrap-break-word whitespace-pre-wrap"
          >
            {translated}
            {presentation.busy && <BouncingDots />}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copy"
              title="Copy"
              onClick={() => copy(translated)}
            >
              <CopyIcon />
            </Button>
          </div>
        </>
      )}

      {showPlaceholder && (
        <p className="text-2xl wrap-break-word text-muted-foreground">
          Translation
          {presentation.busy && <BouncingDots />}
        </p>
      )}

      {presentation.statusMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 text-sm text-muted-foreground empty:hidden"
        >
          {presentation.statusMessage}
        </div>
      )}

      {presentation.errorMessage !== "" && (
        <div className="mt-3 text-[0.9375rem] text-destructive" role="alert">
          <p>{presentation.errorMessage}</p>
          {presentation.canRetry && (
            <Button
              type="button"
              variant="link"
              className="-ml-2"
              onClick={retry}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function BouncingDots() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-flex items-center gap-1 align-middle"
    >
      <span className="size-1 animate-dot-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="size-1 animate-dot-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1 animate-dot-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}
