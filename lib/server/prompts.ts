import { promptName } from "../languages";
import type { ModelFamilyId } from "../models";
import type { SanitizedRequest } from "./resolve-request";

export type PromptBuilder = (sanitized: SanitizedRequest) => string;

/// Hy-MT2 (and any auto-detecting family): plain instruct template.
const buildAutoDetectPrompt: PromptBuilder = (sanitized) =>
  `Translate the following text into ${promptName(sanitized.target, sanitized.family.id)}. Note you should only output the translated result without any additional explanation:\n\n${sanitized.text}\n`;

/// MiLMMT names the source language in its template. Without an explicit
/// source it can only be served after a fallback, in which case the
/// auto-detect template is the documented behavior.
const buildMilmmtPrompt: PromptBuilder = (sanitized) => {
  if (sanitized.family.sourcePolicy === "required" && sanitized.source !== null) {
    const sourceName = promptName(sanitized.source, sanitized.family.id);
    const targetName = promptName(sanitized.target, sanitized.family.id);
    return `Translate this from ${sourceName} to ${targetName}:\n${sourceName}: ${sanitized.text}\n${targetName}:`;
  }
  return buildAutoDetectPrompt(sanitized);
};

/// The strategy map: one builder per family, enforced by the type. Adding a
/// family means adding a builder here — nowhere else is prompt-specific.
const promptBuilders = {
  milmmt: buildMilmmtPrompt,
  "hy-mt2": buildAutoDetectPrompt,
} satisfies Record<ModelFamilyId, PromptBuilder>;

export function buildPrompt(sanitized: SanitizedRequest): string {
  return promptBuilders[sanitized.family.id](sanitized);
}
