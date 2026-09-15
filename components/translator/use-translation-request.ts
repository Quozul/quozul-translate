"use client";

import { useEffect, useMemo } from "react";
import {
  isAbortError,
  requestTranslation,
  TranslationFailure,
} from "@/lib/translation-client";
import type { TranslationRequestBody } from "@/lib/translation-contract";

/// Give up on a request that never answers. The deadline stays armed until
/// the response body is fully read and validated.
export const REQUEST_DEADLINE_MS = 90_000;

const TIMEOUT_MESSAGE =
  "The model took too long to respond. Try again or choose another model in Settings.";
const UNKNOWN_MESSAGE = "Translation failed. Please try again.";

export interface TranslationEngine {
  /// Aborts any active request and starts a new one from an immutable
  /// input snapshot.
  start: (requestId: number, body: TranslationRequestBody) => void;
  /// Aborts the active request without starting another one.
  cancel: () => void;
}

export interface EngineHandlers {
  /// Called only while the request is still the current one — checked
  /// synchronously after the body settles — so a late response can never
  /// overwrite newer state, track usage, or clear under a newer request.
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
  /// Transport seam; tests inject a fake whose body resolves on demand.
  send?: (body: TranslationRequestBody, signal: AbortSignal) => Promise<string>;
  deadlineMs?: number;
}

/// Owns one request's lifecycle resources — ownership token, abort
/// controller, deadline — with no React in sight, so the race behavior is
/// directly testable.
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
      // Invalidate the request as well as reporting it, so nothing late
      // from this fetch can commit.
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
        // The vulnerable boundary: a response whose body resolved after
        // newer input arrived is dropped here, before any mutation.
        if (!isCurrent()) return;
        active = null;
        options.onResult(requestId, body, translation);
      },
      (error: unknown) => {
        clearDeadline();
        if (!isCurrent()) return;
        // Intentional cancellation is silent, not a failure.
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

/// React wrapper around the engine. Handlers must keep a stable identity
/// (they do in the coordinator: memoized callbacks over stable deps) —
/// swapping them mid-request would orphan the in-flight ownership chain.
/// Even then, the reducer's request-ID guard ignores results from a
/// superseded engine, so stale data can never commit.
export function useTranslationRequest(
  onResult: EngineHandlers["onResult"],
  onFailure: EngineHandlers["onFailure"],
): TranslationEngine {
  const engine = useMemo(
    () => createTranslationEngine({ onResult, onFailure }),
    [onResult, onFailure],
  );

  // No in-flight request outlives the component.
  useEffect(() => () => engine.cancel(), [engine]);

  return engine;
}
