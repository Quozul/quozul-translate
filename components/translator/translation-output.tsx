"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { languageByName } from "@/lib/languages";
import { CopyIcon } from "lucide-react";
import { useTranslatorActions, useTranslatorSession } from "./translator-context";
import { useCopyFeedback } from "./use-clipboard-feedback";

/// Translation pane: live status line, failures with a retry, the translated
/// text with its copy button, and a skeleton while there is nothing yet.
/// Presentation comes from the session selector; copy feedback is owned
/// here, associated with the copied text so it cannot stick to a newer one.
export function TranslationOutput() {
  const { request, lastSuccess, presentation } = useTranslatorSession();
  const { retry } = useTranslatorActions();
  const { feedback, copy } = useCopyFeedback();

  const translated = lastSuccess?.translation ?? "";
  const resultTarget = lastSuccess?.inputs.target ?? "";
  const resultLanguage = languageByName(resultTarget);
  const copyMessage =
    feedback !== null && feedback.text === translated ? feedback.message : "";

  return (
    <section
      // Off screen while the keyboard is up: the source text keeps it all.
      className="min-h-0 overflow-y-auto pt-3 md:pt-0"
      aria-label="Translation"
      hidden={presentation.outputHidden}
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
      {translated !== "" ? (
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
      ) : (
        presentation.showSkeleton && (
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
  );
}
