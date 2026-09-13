"use client";

import { useRef, type ChangeEvent, type CompositionEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_LENGTH } from "@/lib/types";
import { XIcon } from "lucide-react";
import { useTranslatorActions, useTranslatorState } from "./translator-context";

/// Where the text to translate is typed, with its clear button and the
/// character counter that appears close to the limit.
export function SourceEditor() {
  const { text } = useTranslatorState();
  const { changeText, startComposition, endComposition, clearText } =
    useTranslatorActions();
  const input = useRef<HTMLTextAreaElement>(null);

  const charCount = [...text.trim()].length;
  const showCount = charCount > MAX_TEXT_LENGTH - 1000;

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    changeText(event.target.value);
  };

  const handleCompositionEnd = (
    event: CompositionEvent<HTMLTextAreaElement>,
  ) => {
    endComposition(event.currentTarget.value);
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
        className="min-h-40 flex-1 resize-none border-0 bg-transparent px-2 text-2xl focus-visible:ring-0"
        value={text}
        onChange={handleTextChange}
        onCompositionStart={startComposition}
        onCompositionEnd={handleCompositionEnd}
      />
      {showCount && (
        <span
          className={
            charCount > MAX_TEXT_LENGTH
              ? "self-end text-xs text-destructive"
              : "self-end text-xs text-muted-foreground"
          }
        >
          {charCount} / 20,000
        </span>
      )}
    </section>
  );
}
