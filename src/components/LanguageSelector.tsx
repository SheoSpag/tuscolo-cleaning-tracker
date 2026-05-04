import type { Language } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { languageLabels } from "../i18n/translations";

const languages: Language[] = ["es", "de", "en", "it"];
const languageFlags: Record<Language, string> = {
  es: "🇪🇸",
  de: "🇩🇪",
  en: "🇬🇧",
  it: "🇮🇹",
};

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t("fields.language")}>
      {languages.map((item) => (
        <button
          className={language === item ? "active" : ""}
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          aria-label={languageLabels[item]}
          title={languageLabels[item]}
        >
          {languageFlags[item]}
        </button>
      ))}
    </div>
  );
}
