"use client";

import { SettingsSheet } from "@/components/settings-sheet";
import {
  useTranslatorActions,
  useTranslatorPreferences,
} from "./translator-context";

/// Model family and size picker. Whether the sheet is open is none of the
/// translator's business, so the sheet manages that itself — uncontrolled.
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
