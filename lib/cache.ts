import { createHash } from "node:crypto";

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;

export interface CacheKey {
  text: string;
  /// Source language name; empty string for automatic detection.
  source: string;
  target: string;
  model: string;
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

class TranslationCache {
  private entries = new Map<string, Entry>();
  private totalBytes = 0;

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.created >= CACHE_TTL_MS) {
        this.totalBytes -= entry.bytes;
        this.entries.delete(key);
      }
    }
  }

  get(key: CacheKey, now: number): string | undefined {
    this.prune(now);
    return this.entries.get(keyToString(key))?.translation;
  }

  insert(key: CacheKey, translation: string, now: number): void {
    this.prune(now);
    const bytes =
      Buffer.byteLength(key.text) +
      Buffer.byteLength(key.source) +
      Buffer.byteLength(key.target) +
      Buffer.byteLength(key.model) +
      Buffer.byteLength(translation);
    if (bytes > MAX_CACHE_BYTES) {
      return;
    }
    const id = keyToString(key);
    const existing = this.entries.get(id);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entries.delete(id);
    }
    while (
      this.entries.size >= MAX_CACHE_ENTRIES ||
      this.totalBytes + bytes > MAX_CACHE_BYTES
    ) {
      const oldest = this.entries.entries().next();
      if (oldest.done) {
        break;
      }
      this.totalBytes -= oldest.value[1].bytes;
      this.entries.delete(oldest.value[0]);
    }
    this.entries.set(id, { translation, created: now, bytes });
    this.totalBytes += bytes;
  }
}

declare global {
  var __translationCache: TranslationCache | undefined;
}

export function translationCache(): TranslationCache {
  globalThis.__translationCache ??= new TranslationCache();
  return globalThis.__translationCache;
}
