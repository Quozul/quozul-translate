import { promptName } from "../languages";
import type { ModelFamilyId } from "../models";
import type { SanitizedRequest } from "./resolve-request";

export type PromptBuilder = (sanitized: SanitizedRequest) => string;

const buildAutoDetectPrompt: PromptBuilder = (sanitized) =>
  `Translate the following text into ${promptName(sanitized.target, sanitized.family.id)}. Note you should only output the translated result without any additional explanation:\n\n${sanitized.text}\n`;

const buildMilmmtPrompt: PromptBuilder = (sanitized) => {
  if (sanitized.family.sourcePolicy === "required" && sanitized.source !== null) {
    const sourceName = promptName(sanitized.source, sanitized.family.id);
    const targetName = promptName(sanitized.target, sanitized.family.id);
    return `Translate this from ${sourceName} to ${targetName}:\n${sourceName}: ${sanitized.text}\n${targetName}:`;
  }
  return buildAutoDetectPrompt(sanitized);
};

const promptBuilders = {
  milmmt: buildMilmmtPrompt,
  "hy-mt2": buildAutoDetectPrompt,
} satisfies Record<ModelFamilyId, PromptBuilder>;

export function buildPrompt(sanitized: SanitizedRequest): string {
  return promptBuilders[sanitized.family.id](sanitized);
}
