import { UtensilsCrossed } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { LanguageSelector } from "./LanguageSelector";

type HeaderProps = {
  compact?: boolean;
};

export function Header({ compact = false }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className={compact ? "app-header compact-header" : "app-header"}>
      <div className="brand-mark" aria-hidden="true">
        <UtensilsCrossed size={22} />
      </div>
      <div className="brand-copy">
        {compact ? null : <p>{t("app.kicker")}</p>}
        <h1>{compact ? "TUSCOLO" : t("app.title")}</h1>
        {compact ? null : <span>{t("app.slogan")}</span>}
      </div>
      <LanguageSelector />
    </header>
  );
}
