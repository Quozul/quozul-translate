/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTranslationEngine,
  type TranslationEngine,
} from "./use-translation-request";
import { TranslationFailure } from "@/lib/translation-client";
import type { TranslationRequestBody } from "@/lib/translation-contract";

function bodyFor(text: string, target = "French"): TranslationRequestBody {
  return {
    text,
    source: "detect",
    target,
    family: "hy-mt2",
    preset: "balanced",
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Sent {
  body: TranslationRequestBody;
  signal: AbortSignal;
  completion: Deferred<string>;
}

function makeHarness(deadlineMs = 90_000) {
  const sent: Sent[] = [];
  const results: Array<{ id: number; target: string; translation: string }> =
    [];
  const failures: Array<{ id: number; error: string }> = [];

  const engine: TranslationEngine = createTranslationEngine({
    deadlineMs,
    send: (body, signal) => {
      const completion = deferred<string>();
      sent.push({ body, signal, completion });
      return completion.promise;
    },
    onResult: (id, body, translation) => {
      results.push({ id, target: body.target, translation });
    },
    onFailure: (id, _body, error) => {
      failures.push({ id, error });
    },
  });

  return { engine, sent, results, failures };
}

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

describe("translation engine request ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores an older response whose body resolves after newer input (the stale-JSON race)", async () => {
    const { engine, sent, results } = makeHarness();

    engine.start(1, bodyFor("old", "French"));
    engine.start(2, bodyFor("new", "German"));
    expect(sent).toHaveLength(2);

    sent[1].completion.resolve("NEU");
    await flush();
    expect(results).toEqual([{ id: 2, target: "German", translation: "NEU" }]);

    sent[0].completion.resolve("OLD");
    await flush();
    expect(results).toHaveLength(1);
  });

  it("drops results of cancelled requests entirely", async () => {
    const { engine, sent, results, failures } = makeHarness();
    engine.start(1, bodyFor("x"));
    engine.cancel();
    sent[0].completion.resolve("late");
    await flush();
    expect(results).toHaveLength(0);
    expect(failures).toHaveLength(0);
  });

  it("aborts the superseded request's signal", () => {
    const { engine, sent } = makeHarness();
    engine.start(1, bodyFor("first"));
    const first = sent[0];
    engine.start(2, bodyFor("second"));
    expect(first.signal.aborted).toBe(true);
    expect(sent[1].signal.aborted).toBe(false);
  });

  it("keeps the deadline armed through body consumption", async () => {
    const { engine, sent, results, failures } = makeHarness(100);
    engine.start(1, bodyFor("slow body"));
    vi.advanceTimersByTime(100);
    await flush();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.error).toMatch(/took too long/);
    sent[0].completion.resolve("too slow");
    await flush();
    expect(results).toHaveLength(0);
    expect(failures).toHaveLength(1);
  });

  it("reports the deadline once and aborts the stalled fetch", async () => {
    const { engine, sent, failures } = makeHarness(100);
    engine.start(1, bodyFor("never answers"));
    vi.advanceTimersByTime(100);
    await flush();
    expect(failures).toHaveLength(1);
    expect(sent[0].signal.aborted).toBe(true);
    vi.advanceTimersByTime(1000);
    await flush();
    expect(failures).toHaveLength(1);
  });

  it("translates user-facing failures through verbatim", async () => {
    const { engine, sent, failures } = makeHarness();
    engine.start(1, bodyFor("bad"));
    sent[0].completion.reject(new TranslationFailure("Choose a language."));
    await flush();
    expect(failures).toEqual([{ id: 1, error: "Choose a language." }]);
  });

  it("maps unexpected errors to generic copy", async () => {
    const { engine, sent, failures } = makeHarness();
    engine.start(1, bodyFor("boom"));
    sent[0].completion.reject(new Error("impl details"));
    await flush();
    expect(failures[0]?.error).toMatch(/Translation failed/);
  });

  it("stays silent on intentional cancellation errors from transport", async () => {
    const { engine, sent, failures } = makeHarness();
    engine.start(1, bodyFor("gone"));
    sent[0].completion.reject(new DOMException("aborted", "AbortError"));
    await flush();
    expect(failures).toHaveLength(0);
  });

  it("an old request's completion cannot clear or affect the new request", async () => {
    const { engine, sent, results } = makeHarness();
    engine.start(1, bodyFor("A"));
    engine.start(2, bodyFor("B"));
    sent[0].completion.reject(new TranslationFailure("old failed"));
    sent[1].completion.resolve("B!");
    await flush();
    expect(results).toEqual([
      { id: 2, target: "French", translation: "B!" },
    ]);
  });
});
