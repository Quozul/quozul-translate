import "server-only";
import { createHash } from "node:crypto";

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

export interface CacheKey {
  text: string;
  source: string;
  target: string;
  model: string;
}

export interface TranslationCache {
  get(key: CacheKey, now: number): string | undefined;
  insert(key: CacheKey, translation: string, now: number): void;
}

interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  maxBytes?: number;
}

interface Entry {
  translation: string;
  created: number;
  bytes: number;
}

function keyToString(key: CacheKey): string {
  return createHash("sha256")
    .update(
      `${key.model}\u0000${key.source}\u0000${key.target}\u0000${key.text}`,
    )
    .digest("hex");
}

function entryBytes(key: CacheKey, translation: string): number {
  return (
    Buffer.byteLength(key.text) +
    Buffer.byteLength(key.source) +
    Buffer.byteLength(key.target) +
    Buffer.byteLength(key.model) +
    Buffer.byteLength(translation)
  );
}

function createTranslationCache(options: CacheOptions = {}): TranslationCache {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const entries = new Map<string, Entry>();
  let totalBytes = 0;

  function prune(now: number): void {
    for (const [key, entry] of entries) {
      if (now - entry.created >= ttlMs) {
        totalBytes -= entry.bytes;
        entries.delete(key);
      }
    }
  }

  return {
    get(key, now) {
      prune(now);
      return entries.get(keyToString(key))?.translation;
    },
    insert(key, translation, now) {
      prune(now);
      const bytes = entryBytes(key, translation);
      if (bytes > maxBytes) return;
      const id = keyToString(key);
      const existing = entries.get(id);
      if (existing) {
        totalBytes -= existing.bytes;
        entries.delete(id);
      }
      while (entries.size >= maxEntries || totalBytes + bytes > maxBytes) {
        const oldest = entries.entries().next();
        if (oldest.done) break;
        totalBytes -= oldest.value[1].bytes;
        entries.delete(oldest.value[0]);
      }
      entries.set(id, { translation, created: now, bytes });
      totalBytes += bytes;
    },
  };
}

declare global {
  var __qzlTranslationCache: TranslationCache | undefined;
}

export function translationCache(): TranslationCache {
  globalThis.__qzlTranslationCache ??= createTranslationCache();
  return globalThis.__qzlTranslationCache;
}

export { createTranslationCache };
