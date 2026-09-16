"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTranslatorActions,
  useTranslatorEditor,
} from "./translator-context";
import { ArrowLeftRightIcon } from "lucide-react";

// Firefox restores a button's dynamic disabled state before React hydrates.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1847798
const DISABLE_BROWSER_STATE_RESTORATION = { autoComplete: "off" };

export function SwapLanguages() {
  const { canSwap } = useTranslatorEditor();
  const { swapLanguages } = useTranslatorActions();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        if (!canSwap) return;
        event.preventDefault();
        swapLanguages();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSwap, swapLanguages]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label="Swap languages"
            {...DISABLE_BROWSER_STATE_RESTORATION}
            disabled={!canSwap}
            onClick={swapLanguages}
          />
        }
      >
        <ArrowLeftRightIcon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Swap languages
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
