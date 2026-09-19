"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  familyById,
  isModelPreset,
  MODEL_FAMILIES,
  MODEL_PRESET_LABELS,
  MODEL_PRESETS,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: ModelFamilyId;
  preset: ModelPreset;
  onFamilyChange: (family: ModelFamilyId) => void;
  onPresetChange: (preset: ModelPreset) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  family,
  preset,
  onFamilyChange,
  onPresetChange,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Choose the model family and size used for translations.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">
              <label htmlFor="model-family">Model family</label>
            </p>
            <Select
              value={family}
              items={Object.fromEntries(
                MODEL_FAMILIES.map((entry) => [entry.id, entry.name]),
              )}
              onValueChange={(value) => {
                if (value === null) return;
                const matched = familyById(value);
                if (matched) onFamilyChange(matched.id);
              }}
            >
              <SelectTrigger id="model-family" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_FAMILIES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">
              <label htmlFor="model-preset">Model</label>
            </p>
            <Select
              value={preset}
              items={Object.fromEntries(
                MODEL_PRESETS.map((entry) => [
                  entry,
                  MODEL_PRESET_LABELS[entry],
                ]),
              )}
              onValueChange={(value) => {
                if (value !== null && isModelPreset(value))
                  onPresetChange(value);
              }}
            >
              <SelectTrigger
                id="model-preset"
                className="w-full"
                aria-describedby="model-preset-detail"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_PRESETS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {MODEL_PRESET_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
