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
import {
  getLanguageGroups,
  type DetectionOption,
  type Language,
} from "@/lib/languages";

interface LanguagePickerProps {
  selected: string;
  frequent: string[];
  onSelect: (name: string) => void;
  /// Accessible name of the field.
  ariaLabel?: string;
  /// Pseudo-language offered before the real languages, such as "Detect
  /// language" in the source picker. A `selected` equal to its value shows
  /// its label instead.
  detect?: DetectionOption;
  /// Locks the picker, for models that detect the source on their own.
  disabled?: boolean;
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

  // One owner for grouping and matching (see `getLanguageGroups`): the
  // rendered groups are the filtered collection, so the primitive's
  // keyboard navigation, selection, and empty state can never drift from
  // what is displayed.
  const groups = useMemo(
    () => getLanguageGroups({ query: query ?? "", frequent, detection: detect }),
    [query, frequent, detect],
  );

  const items = useMemo(() => {
    const values: string[] = [];
    if (groups.detection !== null) values.push(groups.detection.value);
    for (const language of groups.frequent) values.push(language.name);
    for (const language of groups.others) values.push(language.name);
    return values;
  }, [groups]);

  return (
    <Combobox
      disabled={disabled}
      items={items}
      // The groups already applied the single filtering policy; a second
      // filter here would duplicate that reasoning.
      filter={() => true}
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
          {groups.detection !== null && (
            <ComboboxGroup>
              <ComboboxItem value={groups.detection.value}>
                {groups.detection.label}
              </ComboboxItem>
            </ComboboxGroup>
          )}
          {groups.frequent.length > 0 && (
            <ComboboxGroup>
              <ComboboxLabel>Frequently used</ComboboxLabel>
              {groups.frequent.map((language) => (
                <ComboboxItem key={language.code} value={language.name}>
                  <LanguageOption language={language} />
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
          {groups.others.length > 0 && (
            <ComboboxGroup>
              <ComboboxLabel>All languages</ComboboxLabel>
              {groups.others.map((language) => (
                <ComboboxItem key={language.code} value={language.name}>
                  <LanguageOption language={language} />
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
