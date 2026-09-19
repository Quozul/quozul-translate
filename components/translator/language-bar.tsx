"use client";

import { LanguagePicker } from "@/components/language-picker";
import { SwapLanguages } from "@/components/translator/swap-languages";
import { DETECT_SOURCE } from "@/lib/models";
import {
  useTranslatorActions,
  useTranslatorPreferences,
} from "./translator-context";
import { TranslatorSettings } from "./translator-settings";

const DETECT_OPTION = { value: DETECT_SOURCE, label: "Detect language" };

export function LanguageBar() {
  const { source, target, frequent } = useTranslatorPreferences();
  const { changeSource, chooseLanguage } = useTranslatorActions();

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <div className="min-w-0 flex-1">
        <LanguagePicker
          selected={source}
          frequent={frequent}
          onSelect={changeSource}
          ariaLabel="Source language"
          detect={DETECT_OPTION}
        />
      </div>
      <SwapLanguages />
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
