"use client";

import { useRef, type ChangeEvent, type CompositionEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_LENGTH } from "@/lib/translation-contract";
import { displayedCharacterCount } from "@/lib/translation-text";
import { XIcon } from "lucide-react";
import {
  useTranslatorActions,
  useTranslatorEditor,
} from "./translator-context";

const LIMIT_LABEL = MAX_TEXT_LENGTH.toLocaleString("en-US");

export function SourceEditor() {
  const { text, keyboardOpen } = useTranslatorEditor();
  const {
    changeText,
    startComposition,
    endComposition,
    clearText,
    submit,
    focusSource,
    blurSource,
  } = useTranslatorActions();
  const input = useRef<HTMLTextAreaElement>(null);

  const charCount = displayedCharacterCount(text);
  const tooLong = charCount > MAX_TEXT_LENGTH;
  const showCount = charCount > MAX_TEXT_LENGTH - 1000;

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    changeText(event.target.value);
  };

  const handleCompositionEnd = (
    event: CompositionEvent<HTMLTextAreaElement>,
  ) => {
    endComposition(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!keyboardOpen || event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
    input.current?.blur();
  };

  const handleClear = () => {
    clearText();
    input.current?.focus();
  };

  return (
    <section className="relative flex min-h-0 flex-col" aria-label="Source text">
      {text !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 z-10 text-muted-foreground"
          aria-label="Clear"
          title="Clear"
          onClick={handleClear}
        >
          <XIcon />
        </Button>
      )}
      <Textarea
        id="source"
        ref={input}
        autoFocus
        dir="auto"
        placeholder="Enter text"
        aria-label="Text to translate"
        aria-invalid={tooLong || undefined}
        aria-describedby={showCount ? "source-limit" : undefined}
        enterKeyHint={keyboardOpen ? "go" : "enter"}
        className="min-h-40 flex-1 resize-none rounded-lg border-0 bg-transparent px-2 text-2xl focus-visible:ring-3 focus-visible:ring-inset"
        value={text}
        onChange={handleTextChange}
        onCompositionStart={startComposition}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        onFocus={focusSource}
        onBlur={blurSource}
      />
      {showCount && (
        <span
          id="source-limit"
          className={
            tooLong
              ? "self-end text-xs text-destructive"
              : "self-end text-xs text-muted-foreground"
          }
        >
          {charCount} / {LIMIT_LABEL}
        </span>
      )}
    </section>
  );
}
