"use client";

import { SettingsSheet } from "@/components/settings-sheet";
import {
  useTranslatorActions,
  useTranslatorPreferences,
} from "./translator-context";

export function TranslatorSettings() {
  const { family, preset } = useTranslatorPreferences();
  const { changeFamily, changePreset } = useTranslatorActions();

  return (
    <SettingsSheet
      family={family}
      preset={preset}
      onFamilyChange={changeFamily}
      onPresetChange={changePreset}
    />
  );
}
