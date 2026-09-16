"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LanguagePicker } from "@/components/language-picker";
import { DETECT_SOURCE } from "@/lib/models";
import {
  useTranslatorActions,
  useTranslatorEditor,
  useTranslatorPreferences,
} from "./translator-context";
import { TranslatorSettings } from "./translator-settings";
import { ArrowLeftRightIcon } from "lucide-react";

const DETECT_OPTION = { value: DETECT_SOURCE, label: "Detect language" };
// Firefox restores a button's dynamic disabled state before React hydrates.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1847798
const DISABLE_BROWSER_STATE_RESTORATION = { autoComplete: "off" };

export function LanguageBar() {
  const { source, target, frequent } = useTranslatorPreferences();
  const { canSwap } = useTranslatorEditor();
  const { changeSource, chooseLanguage, swapLanguages } =
    useTranslatorActions();

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
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <div className="min-w-0 flex-1">
        <LanguagePicker
          selected={source}
          frequent={frequent}
          onSelect={changeSource}
          ariaLabel="Source language"
          detect={DETECT_OPTION}
        />
      </div>
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
      <div className="min-w-0 flex-1">
        <LanguagePicker
          selected={target}
          frequent={frequent}
          onSelect={chooseLanguage}
        />
      </div>
      <TranslatorSettings />
    </div>
  );
}
