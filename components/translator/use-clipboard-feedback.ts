"use client";

import { toast } from "@/components/ui/toast";
import { useCallback } from "react";

export interface CopyFeedback {
  copy: (text: string) => void;
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
          description:
            "Select the translation and copy it manually.",
          type: "error",
        });
      });
  }, []);

  return { copy };
}
