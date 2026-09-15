"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  MODEL_FAMILIES,
  MODEL_PRESETS,
  familyById,
  isModelPreset,
  type ModelFamilyId,
  type ModelPreset,
} from "@/lib/models";
import { EllipsisVerticalIcon } from "lucide-react";

const PRESET_LABELS: Record<ModelPreset, string> = {
  turbo: "Turbo",
  balanced: "Balanced",
  quality: "Quality",
};

const PRESET_DETAILS: Record<ModelPreset, string> = {
  turbo: "Fastest responses · low memory",
  balanced: "High quality · moderate memory",
  quality: "Highest quality · high memory",
};

interface SettingsSheetProps {
  /// Optional for external control; uncontrolled (primitive-managed) by
  /// default so callers that only toggle via the trigger need no state.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  family: ModelFamilyId;
  preset: ModelPreset;
  onFamilyChange: (family: ModelFamilyId) => void;
  onPresetChange: (preset: ModelPreset) => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  family,
  preset,
  onFamilyChange,
  onPresetChange,
}: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Settings"
          title="Settings"
        >
          <EllipsisVerticalIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80dvh]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Choose the model family and size used for translations.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <div>
            <p className="mb-2 text-sm font-medium">
              <label htmlFor="model-family">Model family</label>
            </p>
            <Select
              value={family}
              onValueChange={(value) => {
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
              onValueChange={(value) => {
                if (isModelPreset(value)) onPresetChange(value);
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
                    {PRESET_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p
              id="model-preset-detail"
              className="mt-2 text-sm text-muted-foreground"
            >
              {PRESET_DETAILS[preset]}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
