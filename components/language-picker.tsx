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
  /// Accessible name of the field.
  ariaLabel?: string;
  /// Pseudo-language offered before the real languages, such as "Detect
  /// language" in the source picker. A `selected` equal to its value shows its
  /// label instead.
  detect?: { value: string; label: string };
  /// Locks the picker, for models that detect the source on their own.
  disabled?: boolean;
}

/// `matchesLanguage` for the entry that is not a real language.
function matchesLabel(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle === "" || label.toLowerCase().includes(needle);
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
  ariaLabel = "Target language",
  detect,
  disabled = false,
}: LanguagePickerProps) {
  // `null` means "no active query": the input displays the selected language.
  const [query, setQuery] = useState<string | null>(null);
  const detectValue = detect?.value;
  const detectLabel = detect?.label ?? "";
  const selectedLabel =
    detectValue !== undefined && selected === detectValue
      ? detectLabel
      : selected;
  const inputValue = query ?? selectedLabel;

  const { detectMatch, frequentMatches, otherMatches } = useMemo(() => {
    const top = frequent.slice(0, 3);
    const topSet = new Set(top);
    const search = query ?? "";
    return {
      detectMatch:
        detectValue === undefined || !matchesLabel(detectLabel, search)
          ? null
          : { value: detectValue, label: detectLabel },
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
  }, [query, frequent, detectValue, detectLabel]);

  return (
    <Combobox
      disabled={disabled}
      items={
        detectValue === undefined
          ? LANGUAGES.map((language) => language.name)
          : [detectValue, ...LANGUAGES.map((language) => language.name)]
      }
      filter={(item, search) => {
        if (detectValue !== undefined && item === detectValue) {
          return matchesLabel(detectLabel, search);
        }
        const language = LANGUAGES.find((entry) => entry.name === item);
        return language ? matchesLanguage(language, search) : true;
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
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        className="w-auto border-transparent bg-transparent hover:bg-muted"
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>No languages found.</ComboboxEmpty>
          {detectMatch !== null && (
            <ComboboxGroup>
              <ComboboxItem value={detectMatch.value}>
                {detectMatch.label}
              </ComboboxItem>
            </ComboboxGroup>
          )}
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
