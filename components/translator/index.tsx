"use client";

import { cn } from "@/lib/utils";
import { LanguageBar } from "./language-bar";
import { SourceEditor } from "./source-editor";
import { TranslationOutput } from "./translation-output";
import { TranslatorProvider, useTranslatorSession } from "./translator-context";

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

/// Source text only while there is nothing to compare with; once a result
/// is on screen the panes sit side by side where there is horizontal room
/// and stacked where there is not. Layout derives from the presentation
/// selector, never from an overloaded `idle` flag.
function TranslatorPanes() {
  const { presentation } = useTranslatorSession();
  return (
    <div
      className={cn(
        "grid flex-1 p-3",
        presentation.singlePane
          ? "grid-rows-[1fr]"
          : "grid-rows-[1fr_1fr] md:grid-cols-2 md:grid-rows-[1fr] md:gap-6 md:divide-x md:divide-border/60",
      )}
    >
      <SourceEditor />
      <TranslationOutput />
    </div>
  );
}
