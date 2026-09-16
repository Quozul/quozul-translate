"use client";

import { cn } from "@/lib/utils";
import { LanguageBar } from "./language-bar";
import { SourceEditor } from "./source-editor";
import { TranslationOutput } from "./translation-output";
import { TranslatorProvider, useTranslatorSession } from "./translator-context";

export function Translator() {
  return (
    <TranslatorProvider>
      <div className="flex min-h-dvh flex-col justify-center md:px-6 md:py-8">
        <main className="mx-auto flex min-h-dvh w-full max-w-190 flex-col-reverse md:flex-col md:h-136 md:max-h-[calc(100dvh-4rem)] md:min-h-0 md:max-w-295 md:overflow-hidden md:rounded-2xl md:border">
          <LanguageBar />
          <TranslatorPanes />
        </main>
      </div>
    </TranslatorProvider>
  );
}

function TranslatorPanes() {
  const { lastSuccess, request } = useTranslatorSession();
  const translation = lastSuccess?.translation ?? "";
  const hasTranslation = request.status === "idle" && translation === "";
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-rows-[1fr_1fr] p-3 md:grid-cols-2 md:grid-rows-[1fr] md:gap-6",
        hasTranslation && "grid-rows-[1fr]",
      )}
    >
      <SourceEditor />
      <div
        className={cn("overflow-hidden", hasTranslation && "hidden md:block")}
      >
        <TranslationOutput />
      </div>
    </div>
  );
}
