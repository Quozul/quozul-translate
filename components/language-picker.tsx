"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { LANGUAGES, matchesLanguage } from "@/lib/languages";

interface LanguagePickerProps {
  selected: string;
  frequent: string[];
  onSelect: (name: string) => void;
}

/// A modal dropdown: native dialog focus trapping, with custom searchable language rows.
export function LanguagePicker({
  selected,
  frequent,
  onSelect,
}: LanguagePickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const topFrequent = useMemo(() => frequent.slice(0, 3), [frequent]);
  const results = useMemo(() => {
    const filtered = LANGUAGES.filter((language) =>
      matchesLanguage(language, query),
    );
    return filtered
      .map((language, index) => ({ language, index }))
      .sort(
        (a, b) =>
          (topFrequent.indexOf(a.language.name) === -1
            ? Number.MAX_SAFE_INTEGER
            : topFrequent.indexOf(a.language.name)) -
            (topFrequent.indexOf(b.language.name) === -1
              ? Number.MAX_SAFE_INTEGER
              : topFrequent.indexOf(b.language.name)) ||
          a.index - b.index,
      )
      .map(({ language }) => language);
  }, [query, topFrequent]);

  const close = () => {
    if (dialog.current?.open) {
      dialog.current.close();
    }
    setOpen(false);
  };

  const choose = (name: string) => {
    onSelect(name);
    close();
  };

  const focusRow = (index: number) => {
    document.getElementById(`language-option-${index}`)?.focus();
  };

  const frequentCount = useMemo(() => {
    let count = 0;
    for (const language of results) {
      if (!topFrequent.includes(language.name)) break;
      count++;
    }
    return count;
  }, [results, topFrequent]);

  return (
    <>
      <button
        id="target"
        className="language-trigger"
        type="button"
        aria-label="Target language"
        aria-haspopup="dialog"
        aria-controls="language-picker"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          if (!dialog.current) return;
          dialog.current.showModal();
          setOpen(true);
          search.current?.focus();
        }}
      >
        <span>{selected}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <dialog
        id="language-picker"
        className="language-picker"
        ref={dialog}
        aria-label="Target language"
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            close();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
      >
        <div className="picker-content">
          <div className="picker-search">
            <input
              ref={search}
              id="language-search"
              type="search"
              autoFocus
              aria-label="Search languages"
              placeholder="Search languages"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusRow(0);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const first = results[0];
                  if (first) choose(first.name);
                }
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Close languages"
              onClick={close}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </div>
          <div
            className="picker-results"
            onKeyDown={(event) => {
              const key = event.key;
              if (
                !["ArrowDown", "ArrowUp", "Home", "End"].includes(key)
              ) {
                return;
              }
              const row = (
                event.target as HTMLElement
              ).closest<HTMLElement>("[data-index]");
              if (!row) return;
              const index = Number(row.dataset.index);
              if (Number.isNaN(index)) return;
              event.preventDefault();
              const last = results.length - 1;
              if (key === "ArrowUp" && index === 0) {
                search.current?.focus();
              } else if (key === "ArrowUp") {
                focusRow(index - 1);
              } else if (key === "ArrowDown") {
                focusRow(Math.min(index + 1, last));
              } else if (key === "Home") {
                focusRow(0);
              } else if (key === "End") {
                focusRow(last);
              }
            }}
          >
            {results.map((language, index) => (
              <Fragment key={language.code}>
                {index === 0 && frequentCount > 0 && (
                  <p className="picker-group">Frequently used</p>
                )}
                {index === frequentCount && (
                  <p className="picker-group">All languages</p>
                )}
                <button
                  type="button"
                  className="language-option"
                  id={`language-option-${index}`}
                  data-index={index}
                  aria-pressed={selected === language.name}
                  onClick={() => choose(language.name)}
                >
                  <span className="language-names">
                    <span>{language.name}</span>
                    <small dir="auto">{language.native}</small>
                  </span>
                  <span className="language-code">{language.code}</span>
                  <span className="language-check" aria-hidden="true">
                    {selected === language.name ? "✓" : ""}
                  </span>
                </button>
              </Fragment>
            ))}
            {results.length === 0 && (
              <p className="picker-empty" role="status">
                No languages found
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
