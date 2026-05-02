import { createContext, useContext } from "react";
import type { Language } from "../types";
import { translate } from "./translations";

export type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

export const I18nContext = createContext<I18nContextValue>({
  language: "es",
  setLanguage: () => undefined,
  t: (key) => translate("es", key),
});

export function useI18n() {
  return useContext(I18nContext);
}
