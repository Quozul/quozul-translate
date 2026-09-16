"use client";

import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/language-picker";
import { DETECT_SOURCE } from "@/lib/models";
import {
  useTranslatorActions,
  useTranslatorEditor,
  useTranslatorPreferences,
} from "./translator-context";
import { TranslatorSettings } from "./translator-settings";
import { ArrowLeftRightIcon } from "lucide-react";

const DETECT_OPTION = { value: DETECT_SOURCE, label: "Detect language" };

export function LanguageBar() {
  const { source, target, frequent } = useTranslatorPreferences();
  const { keyboardOpen, canSwap } = useTranslatorEditor();
  const { changeSource, chooseLanguage, swapLanguages } =
    useTranslatorActions();

  return (
    <div
      hidden={keyboardOpen}
      className="flex items-center gap-2 border-b px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <LanguagePicker
          selected={source}
          frequent={[]}
          onSelect={changeSource}
          ariaLabel="Source language"
          detect={DETECT_OPTION}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground"
        aria-label="Swap languages"
        title={canSwap ? "Swap languages" : "Choose a source language to swap"}
        disabled={!canSwap}
        onClick={swapLanguages}
      >
        <ArrowLeftRightIcon />
      </Button>
      <div className="min-w-0 flex-1">
        <LanguagePicker
          selected={target}
          frequent={frequent}
          onSelect={chooseLanguage}
        />
      </div>
      <TranslatorSettings />
    </div>
  );
}
