"use client";

import { useEffect, useState } from "react";

export const MIN_KEYBOARD_HEIGHT = 140;

export function isKeyboardVisible(viewportGapPx: number): boolean {
  return viewportGapPx > MIN_KEYBOARD_HEIGHT;
}

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
