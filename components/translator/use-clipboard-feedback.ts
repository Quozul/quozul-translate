"use client";

import { useCallback, useState } from "react";

export interface CopyFeedbackState {
  /// The exact text this feedback belongs to.
  text: string;
  message: string;
}

export interface CopyFeedback {
  feedback: CopyFeedbackState | null;
  copy: (text: string) => void;
}

/// Clipboard write plus feedback associated with the copied text itself:
/// a "Copied" message from an earlier result can never appear against a
/// newer translation, because callers show it only while
/// `feedback.text === translated`. No timers, no refs, no shared state.
export function useCopyFeedback(): CopyFeedback {
  const [feedback, setFeedback] = useState<CopyFeedbackState | null>(null);

  const copy = useCallback((text: string) => {
    if (text === "") return;
    const write =
      window.isSecureContext && navigator.clipboard
        ? navigator.clipboard.writeText(text)
        : Promise.reject();
    write
      .then(() => {
        setFeedback({ text, message: "Copied to clipboard." });
      })
      .catch(() => {
        setFeedback({
          text,
          message:
            "Could not copy. Select the translation and copy it manually (clipboard access needs HTTPS or localhost).",
        });
      });
  }, []);

  return { feedback, copy };
}
