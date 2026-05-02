import type { Language } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { languageLabels } from "../i18n/translations";

const languages: Language[] = ["es", "de", "en", "it"];

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="field compact">
      <span>{t("fields.language")}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {languages.map((item) => (
          <option key={item} value={item}>
            {languageLabels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
