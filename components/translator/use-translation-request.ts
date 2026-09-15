"use client";

import { useEffect, useMemo } from "react";
import {
  isAbortError,
  requestTranslation,
  TranslationFailure,
} from "@/lib/translation-client";
import type { TranslationRequestBody } from "@/lib/translation-contract";

export const REQUEST_DEADLINE_MS = 90_000;

const TIMEOUT_MESSAGE =
  "The model took too long to respond. Try again or choose another model in Settings.";
const UNKNOWN_MESSAGE = "Translation failed. Please try again.";

export interface TranslationEngine {
  start: (requestId: number, body: TranslationRequestBody) => void;
  cancel: () => void;
}

export interface EngineHandlers {
  onResult: (
    requestId: number,
    body: TranslationRequestBody,
    translation: string,
  ) => void;
  onFailure: (
    requestId: number,
    body: TranslationRequestBody,
    error: string,
  ) => void;
}

export interface EngineOptions extends Partial<EngineHandlers> {
  send?: (body: TranslationRequestBody, signal: AbortSignal) => Promise<string>;
  deadlineMs?: number;
}

export function createTranslationEngine(
  options: Required<Pick<EngineHandlers, "onResult" | "onFailure">> &
    EngineOptions,
): TranslationEngine {
  const send =
    options.send ?? ((body, signal) => requestTranslation(body, signal));
  const deadlineMs = options.deadlineMs ?? REQUEST_DEADLINE_MS;

  type Active = { id: number; controller: AbortController };
  let active: Active | null = null;

  function cancel(): void {
    const current = active;
    active = null;
    current?.controller.abort();
  }

  function start(requestId: number, body: TranslationRequestBody): void {
    cancel();
    const controller = new AbortController();
    const request: Active = { id: requestId, controller };
    active = request;
    const isCurrent = () => active === request;

    let deadline: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      controller.abort();
      fail(TIMEOUT_MESSAGE);
    }, deadlineMs);

    const clearDeadline = () => {
      if (deadline !== null) clearTimeout(deadline);
      deadline = null;
    };
    function fail(message: string): void {
      clearDeadline();
      if (!isCurrent()) return;
      active = null;
      options.onFailure(requestId, body, message);
    }

    send(body, controller.signal).then(
      (translation) => {
        clearDeadline();
        if (!isCurrent()) return;
        active = null;
        options.onResult(requestId, body, translation);
      },
      (error: unknown) => {
        clearDeadline();
        if (!isCurrent()) return;
        if (isAbortError(error)) return;
        if (error instanceof TranslationFailure) {
          fail(error.message);
          return;
        }
        fail(UNKNOWN_MESSAGE);
      },
    );
  }

  return { start, cancel };
}

export function useTranslationRequest(
  onResult: EngineHandlers["onResult"],
  onFailure: EngineHandlers["onFailure"],
): TranslationEngine {
  const engine = useMemo(
    () => createTranslationEngine({ onResult, onFailure }),
    [onResult, onFailure],
  );

  useEffect(() => () => engine.cancel(), [engine]);

  return engine;
}
