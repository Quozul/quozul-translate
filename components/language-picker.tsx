"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { LANGUAGES, matchesLanguage, type Language } from "@/lib/languages";

interface LanguagePickerProps {
  selected: string;
  frequent: string[];
  onSelect: (name: string) => void;
}

function LanguageOption({ language }: { language: Language }) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span>{language.name}</span>
      <small dir="auto" className="truncate text-xs text-muted-foreground">
        {language.native}
      </small>
      <span className="ml-auto text-xs text-muted-foreground">
        {language.code}
      </span>
    </span>
  );
}

export function LanguagePicker({
  selected,
  frequent,
  onSelect,
}: LanguagePickerProps) {
  // `null` means "no active query": the input displays the selected language.
  const [query, setQuery] = useState<string | null>(null);
  const inputValue = query ?? selected;

  const { frequentMatches, otherMatches } = useMemo(() => {
    const top = frequent.slice(0, 3);
    const topSet = new Set(top);
    const search = query ?? "";
    return {
      frequentMatches: LANGUAGES.filter(
        (language) =>
          topSet.has(language.name) && matchesLanguage(language, search),
      ).sort(
        (a, b) => top.indexOf(a.name) - top.indexOf(b.name),
      ),
      otherMatches: LANGUAGES.filter(
        (language) =>
          !topSet.has(language.name) && matchesLanguage(language, search),
      ),
    };
  }, [query, frequent]);

  return (
    <Combobox
      items={LANGUAGES.map((language) => language.name)}
      filter={(item, query) => {
        const language = LANGUAGES.find((entry) => entry.name === item);
        return language ? matchesLanguage(language, query) : true;
      }}
      value={selected}
      onValueChange={(value) => {
        if (typeof value === "string" && value !== "") onSelect(value);
      }}
      inputValue={inputValue}
      onInputValueChange={(value) => setQuery(value)}
      onOpenChange={(open) => {
        setQuery(open ? "" : null);
      }}
    >
      <ComboboxInput
        aria-label="Target language"
        autoComplete="off"
        className="w-auto border-transparent bg-transparent hover:bg-muted"
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>No languages found.</ComboboxEmpty>
          {frequentMatches.length > 0 && (
            <ComboboxGroup>
              <ComboboxLabel>Frequently used</ComboboxLabel>
              {frequentMatches.map((language) => (
                <ComboboxItem key={language.code} value={language.name}>
                  <LanguageOption language={language} />
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
          <ComboboxGroup>
            <ComboboxLabel>All languages</ComboboxLabel>
            {otherMatches.map((language) => (
              <ComboboxItem key={language.code} value={language.name}>
                <LanguageOption language={language} />
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
