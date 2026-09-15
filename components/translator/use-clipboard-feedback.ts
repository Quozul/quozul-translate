"use client";

import { useCallback, useState } from "react";

export interface CopyFeedbackState {
  text: string;
  message: string;
}

export interface CopyFeedback {
  feedback: CopyFeedbackState | null;
  copy: (text: string) => void;
}

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
