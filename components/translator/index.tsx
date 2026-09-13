"use client";

import { LanguageBar } from "./language-bar";
import { SourceEditor } from "./source-editor";
import { TranslationOutput } from "./translation-output";
import { TranslatorProvider, useTranslatorState } from "./translator-context";

export function Translator() {
  return (
    <TranslatorProvider>
      <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col">
        <LanguageBar />
        <TranslatorPanes />
      </main>
    </TranslatorProvider>
  );
}

/// Source text only while idle, source and translation stacked once there is
/// a result to show.
function TranslatorPanes() {
  const { phase } = useTranslatorState();

  return (
    <div
      className={
        phase === "idle"
          ? "grid flex-1 grid-rows-[1fr] p-3"
          : "grid flex-1 grid-rows-[1fr_1fr] p-3"
      }
    >
      <SourceEditor />
      <TranslationOutput />
    </div>
  );
}
