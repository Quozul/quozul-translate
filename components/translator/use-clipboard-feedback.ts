"use client";

import { toast } from "@/components/ui/toast";
import { useCallback, useEffect, useRef } from "react";

export interface CopyFeedback {
  copy: (text: string) => void;
}

export interface PasteFeedback {
  paste: () => void;
}

export function useCopyFeedback(): CopyFeedback {
  const copy = useCallback((text: string) => {
    if (text === "") return;

    const write =
      window.isSecureContext && navigator.clipboard
        ? navigator.clipboard.writeText(text)
        : Promise.reject();

    write
      .then(() => {
        toast.add({ title: "Copied to clipboard", type: "success" });
      })
      .catch(() => {
        toast.add({
          title: "Could not copy",
          description: "Select the translation and copy it manually.",
          type: "error",
        });
      });
  }, []);

  return { copy };
}

function readClipboardText(): Promise<string> {
  if (!window.isSecureContext || navigator.clipboard?.readText === undefined) {
    return Promise.reject(new Error("Clipboard read is unavailable"));
  }
  return navigator.clipboard.readText();
}

/**
 * Reads the clipboard and hands the text to [onText]. A blocked or empty
 * clipboard reports itself instead of looking like a dead button.
 */
export function usePasteFeedback(
  onText: (text: string) => void,
): PasteFeedback {
  const apply = useRef(onText);
  useEffect(() => {
    apply.current = onText;
  });

  const paste = useCallback(() => {
    readClipboardText()
      .then((value) => {
        if (value.trim() === "") {
          toast.add({ title: "Clipboard is empty", type: "info" });
          return;
        }
        apply.current(value);
        toast.add({ title: "Pasted from clipboard", type: "success" });
      })
      .catch(() => {
        toast.add({
          title: "Could not paste",
          description: "Use Ctrl+V in the text box instead.",
          type: "error",
        });
      });
  }, []);

  return { paste };
}
