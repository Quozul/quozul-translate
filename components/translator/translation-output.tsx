"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { languageByName } from "@/lib/languages";
import { CopyIcon } from "lucide-react";
import { useTranslatorActions, useTranslatorSession } from "./translator-context";
import { useCopyFeedback } from "./use-clipboard-feedback";

export function TranslationOutput() {
  const { request, lastSuccess, presentation } = useTranslatorSession();
  const { retry } = useTranslatorActions();
  const { copy } = useCopyFeedback();

  const translated = lastSuccess?.translation ?? "";
  const resultTarget = lastSuccess?.inputs.target ?? "";
  const resultLanguage = languageByName(resultTarget);
  const showPlaceholder = translated === "" && !presentation.showSkeleton;

  return (
    <section
      className="min-h-0 overflow-y-auto pt-3 md:pt-0"
      aria-label="Translation"
      aria-busy={request.status === "loading"}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-3 text-sm text-muted-foreground empty:hidden"
      >
        {presentation.statusMessage}
      </div>

      {presentation.errorMessage !== "" && (
        <div className="mb-3 text-[0.9375rem] text-destructive" role="alert">
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

      {presentation.showSkeleton && (
        <div className="flex flex-col gap-3.5" aria-hidden="true">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[90%]" />
          <Skeleton className="h-3.5 w-[65%]" />
        </div>
      )}

      {translated !== "" && (
        <>
          <p
            dir="auto"
            lang={resultLanguage?.code}
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
              onClick={() => copy(translated)}
            >
              <CopyIcon />
            </Button>
          </div>
        </>
      )}

      {showPlaceholder && (
        <p className="text-2xl wrap-break-word text-muted-foreground">
          Translation appears here
        </p>
      )}

    </section>
  );
}
