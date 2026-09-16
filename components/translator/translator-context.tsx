"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useTranslatorController,
  type TranslatorActions,
  type TranslatorEditorSlice,
  type TranslatorPreferencesSlice,
  type TranslatorSessionSlice,
} from "./use-translator";

const TranslatorPreferencesContext =
  createContext<TranslatorPreferencesSlice | null>(null);
const TranslatorEditorContext = createContext<TranslatorEditorSlice | null>(
  null,
);
const TranslatorSessionContext = createContext<TranslatorSessionSlice | null>(
  null,
);
const TranslatorActionsContext = createContext<TranslatorActions | null>(null);

export function TranslatorProvider({ children }: { children: ReactNode }) {
  const { preferencesSlice, editorSlice, sessionSlice, actions } =
    useTranslatorController();
  return (
    <TranslatorPreferencesContext.Provider value={preferencesSlice}>
      <TranslatorEditorContext.Provider value={editorSlice}>
        <TranslatorSessionContext.Provider value={sessionSlice}>
          <TranslatorActionsContext.Provider value={actions}>
            {children}
          </TranslatorActionsContext.Provider>
        </TranslatorSessionContext.Provider>
      </TranslatorEditorContext.Provider>
    </TranslatorPreferencesContext.Provider>
  );
}

function useSlice<T>(context: React.Context<T | null>, hookName: string): T {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used inside TranslatorProvider`);
  }
  return value;
}

export function useTranslatorPreferences(): TranslatorPreferencesSlice {
  return useSlice(TranslatorPreferencesContext, "useTranslatorPreferences");
}

export function useTranslatorEditor(): TranslatorEditorSlice {
  return useSlice(TranslatorEditorContext, "useTranslatorEditor");
}

export function useTranslatorSession(): TranslatorSessionSlice {
  return useSlice(TranslatorSessionContext, "useTranslatorSession");
}

export function useTranslatorActions(): TranslatorActions {
  return useSlice(TranslatorActionsContext, "useTranslatorActions");
}
