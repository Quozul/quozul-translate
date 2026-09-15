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

const buildTranslateGemmaPrompt: PromptBuilder = (sanitized) => {
  // TranslateGemma's own chat template names both languages and their
  // language codes in the user turn, so it has no detection mode.
  if (sanitized.source === null) return buildAutoDetectPrompt(sanitized);
  const sourceName = promptName(sanitized.source, sanitized.family.id);
  const targetName = promptName(sanitized.target, sanitized.family.id);
  return (
    `You are a professional ${sourceName} (${sanitized.source.code}) to ` +
    `${targetName} (${sanitized.target.code}) translator. Your goal is to accurately convey the ` +
    `meaning and nuances of the original ${sourceName} text while adhering to ${targetName} ` +
    `grammar, vocabulary, and cultural sensitivities.\n` +
    `Produce only the ${targetName} translation, without any additional explanations or ` +
    `commentary. Please translate the following ${sourceName} text into ${targetName}:\n\n\n` +
    `${sanitized.text}`
  );
};

const promptBuilders = {
  milmmt: buildMilmmtPrompt,
  "hy-mt2": buildAutoDetectPrompt,
  translategemma: buildTranslateGemmaPrompt,
} satisfies Record<ModelFamilyId, PromptBuilder>;

export function buildPrompt(sanitized: SanitizedRequest): string {
  return promptBuilders[sanitized.family.id](sanitized);
}
