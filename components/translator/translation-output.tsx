"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyIcon } from "lucide-react";
import { useTranslatorActions, useTranslatorState } from "./translator-context";

/// Translation pane: live status line, failures with a retry, the translated
/// text with its copy button, and a skeleton while there is nothing yet.
export function TranslationOutput() {
  const { translated, resultTarget, phase, error, copyMessage, keyboardOpen } =
    useTranslatorState();
  const { copy, retry } = useTranslatorActions();

  const busy = phase === "waiting" || phase === "loading";
  const showSkeleton = busy && translated === "";
  const status = busy
    ? translated === ""
      ? "Translating…"
      : ""
    : phase === "failed" && translated !== ""
      ? "Previous translation"
      : "";

  return (
    <section
      // Off screen while the keyboard is up: the source text keeps it all.
      className="min-h-0 overflow-y-auto pt-3 md:pt-0"
      aria-label="Translation"
      hidden={phase === "idle" || keyboardOpen}
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
          <Button
            type="button"
            variant="link"
            className="-ml-2"
            onClick={retry}
          >
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
      <p
        role="status"
        className="mt-3 text-xs text-muted-foreground empty:hidden"
      >
        {copyMessage}
      </p>
    </section>
  );
}
