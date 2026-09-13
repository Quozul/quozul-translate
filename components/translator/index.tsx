"use client";

import { cn } from "@/lib/utils";
import { LanguageBar } from "./language-bar";
import { SourceEditor } from "./source-editor";
import { TranslationOutput } from "./translation-output";
import { TranslatorProvider, useTranslatorState } from "./translator-context";

export function Translator() {
  return (
    <TranslatorProvider>
      <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col md:max-w-[1180px]">
        <LanguageBar />
        <TranslatorPanes />
      </main>
    </TranslatorProvider>
  );
}

/// Source text only while there is nothing to compare with; once a result is
/// on screen the panes sit side by side where the horizontal room is there and
/// stacked where it is not.
function TranslatorPanes() {
  const { phase, keyboardOpen } = useTranslatorState();
  // The keyboard takes the whole screen for the source text.
  const single = phase === "idle" || keyboardOpen;

  return (
    <div
      className={cn(
        "grid flex-1 p-3",
        single
          ? "grid-rows-[1fr]"
          : "grid-rows-[1fr_1fr] md:grid-cols-2 md:grid-rows-[1fr] md:gap-6 md:divide-x md:divide-border/60",
      )}
    >
      <SourceEditor />
      <TranslationOutput />
    </div>
  );
}
