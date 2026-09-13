"use client";

import { useState } from "react";
import { SettingsSheet } from "@/components/settings-sheet";
import { useTranslatorActions, useTranslatorState } from "./translator-context";

/// Model family and size picker. Whether the sheet is open is local to this
/// trigger, nothing else in the translator cares about it.
export function TranslatorSettings() {
  const [open, setOpen] = useState(false);
  const { family, preset } = useTranslatorState();
  const { changeFamily, changePreset } = useTranslatorActions();

  return (
    <SettingsSheet
      open={open}
      onOpenChange={setOpen}
      family={family}
      preset={preset}
      onFamilyChange={changeFamily}
      onPresetChange={changePreset}
    />
  );
}
