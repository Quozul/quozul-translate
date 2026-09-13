"use client";

import { useEffect, useState } from "react";

/// Smallest height covered by the visual viewport that counts as a keyboard.
/// Smaller differences are browser chrome (toolbars, find-in-page bars).
const MIN_KEYBOARD_HEIGHT = 140;

/// Whether a virtual keyboard is currently on screen.
///
/// The visual viewport shrinks below the layout viewport only while a virtual
/// keyboard covers the page. Desktop browsers and phones driven by a physical
/// keyboard keep both viewports the same size, so this stays `false` there and
/// those devices keep translating while typing.
export function useVirtualKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      setOpen(window.innerHeight - viewport.height > MIN_KEYBOARD_HEIGHT);
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
