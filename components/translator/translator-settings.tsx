"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsDialog } from "@/components/settings-dialog";
import {
  useTranslatorActions,
  useTranslatorPreferences,
} from "./translator-context";
import { EllipsisVerticalIcon } from "lucide-react";

export function TranslatorSettings() {
  const { family, preset } = useTranslatorPreferences();
  const { changeFamily, changePreset } = useTranslatorActions();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Settings"
              onClick={() => setOpen(true)}
            />
          }
        >
          <EllipsisVerticalIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Settings
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>,</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
      <SettingsDialog
        open={open}
        onOpenChange={setOpen}
        family={family}
        preset={preset}
        onFamilyChange={changeFamily}
        onPresetChange={changePreset}
      />
    </>
  );
}
