"use client";

import { LanguagePicker } from "@/components/language-picker";
import { DETECT_SOURCE, familyById } from "@/lib/models";
import {
  useTranslatorActions,
  useTranslatorEditor,
  useTranslatorPreferences,
} from "./translator-context";
import { TranslatorSettings } from "./translator-settings";
import { ArrowRightIcon } from "lucide-react";

const DETECT_OPTION = { value: DETECT_SOURCE, label: "Detect language" };

export function LanguageBar() {
  const { source, target, family, frequent } = useTranslatorPreferences();
  const { keyboardOpen } = useTranslatorEditor();
  const { changeSource, chooseLanguage } = useTranslatorActions();

  const sourceSelectable = familyById(family)?.sourcePolicy === "required";

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
          disabled={!sourceSelectable}
        />
      </div>
      <span aria-hidden="true" className="text-muted-foreground">
        <ArrowRightIcon />
      </span>
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
