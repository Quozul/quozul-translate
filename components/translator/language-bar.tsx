"use client";

import { LanguagePicker } from "@/components/language-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { DETECT_SOURCE, familyById } from "@/lib/models";
import { useTranslatorActions, useTranslatorState } from "./translator-context";
import { TranslatorSettings } from "./translator-settings";

/// Header row: source → target languages and the model settings trigger.
export function LanguageBar() {
  const { source, target, family, frequent } = useTranslatorState();
  const { changeSource, chooseLanguage } = useTranslatorActions();

  // Families that always auto-detect keep the source input locked on detection.
  const sourceSelectable = familyById(family)?.requiresSource ?? false;

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <div className="min-w-0 flex-1">
        <Select
          value={source}
          onValueChange={changeSource}
          disabled={!sourceSelectable}
        >
          <SelectTrigger
            aria-label="Source language"
            className="w-full border-transparent bg-transparent hover:bg-muted"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DETECT_SOURCE}>Detect language</SelectItem>
            {LANGUAGES.map((language) => (
              <SelectItem key={language.code} value={language.name}>
                {language.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span aria-hidden="true" className="text-muted-foreground">
        →
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
