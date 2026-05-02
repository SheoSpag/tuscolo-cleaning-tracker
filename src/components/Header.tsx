import { Sparkles } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { LanguageSelector } from "./LanguageSelector";

export function Header() {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <div className="brand-copy">
        <p>{t("app.kicker")}</p>
        <h1>{t("app.title")}</h1>
        <span>{t("app.slogan")}</span>
      </div>
      <LanguageSelector />
    </header>
  );
}
