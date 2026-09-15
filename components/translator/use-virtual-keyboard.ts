"use client";

import { useEffect, useState } from "react";

/// Smallest visual-viewport shortfall counted as a keyboard. Smaller
/// differences come from browser chrome (toolbars, find-in-page bars).
export const MIN_KEYBOARD_HEIGHT = 140;

/// Heuristic: a virtual keyboard is the common reason the visual viewport
/// shrinks far below the layout viewport. It is not the only one — pinch
/// zoom and some browser UI transitions affect the measurements too — so
/// this predicate is deliberately small and testable, and the keyboard
/// condition additionally requires the source editor to have focus.
export function isKeyboardVisible(viewportGapPx: number): boolean {
  return viewportGapPx > MIN_KEYBOARD_HEIGHT;
}

/// Whether a virtual keyboard is currently on screen. Desktop browsers and
/// phones driven by a physical keyboard keep both viewports the same size,
/// so this stays `false` there and typing keeps translating on debounce.
/// Needs real-device verification; desktop emulation is not sufficient.
export function useVirtualKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setOpen(isKeyboardVisible(window.innerHeight - viewport.height));
    };
    update();
    viewport.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return open;
}
