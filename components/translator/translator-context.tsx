"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useTranslatorController,
  type TranslatorActions,
  type TranslatorState,
} from "./use-translator";

/// State changes with every keystroke; actions keep a stable identity, so
/// components that only dispatch (settings, buttons) can subscribe to one or
/// the other.
const TranslatorStateContext = createContext<TranslatorState | null>(null);
const TranslatorActionsContext =
  createContext<TranslatorActions | null>(null);

export function TranslatorProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useTranslatorController();
  return (
    <TranslatorStateContext.Provider value={state}>
      <TranslatorActionsContext.Provider value={actions}>
        {children}
      </TranslatorActionsContext.Provider>
    </TranslatorStateContext.Provider>
  );
}

export function useTranslatorState(): TranslatorState {
  const state = useContext(TranslatorStateContext);
  if (!state) {
    throw new Error("useTranslatorState must be used inside TranslatorProvider");
  }
  return state;
}

export function useTranslatorActions(): TranslatorActions {
  const actions = useContext(TranslatorActionsContext);
  if (!actions) {
    throw new Error(
      "useTranslatorActions must be used inside TranslatorProvider",
    );
  }
  return actions;
}
