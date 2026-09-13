/// Lifecycle of the translation for the current text and language pair.
///
/// - `idle` — nothing to translate, output pane is hidden
/// - `waiting` — debouncing input, no request in flight yet
/// - `loading` — request in flight
/// - `ready` — `translated` holds the newest result
/// - `failed` — `error` explains the failure; `translated` may hold an older one
export type Phase = "idle" | "waiting" | "loading" | "ready" | "failed";
