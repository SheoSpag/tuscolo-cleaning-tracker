import { CheckCircle2 } from "lucide-react";
import type { CleaningRecord } from "../types";
import { useI18n } from "../i18n/I18nContext";

type FinalScreenProps = {
  record: CleaningRecord;
  onRestart: () => void;
};

export function FinalScreen({ record, onRestart }: FinalScreenProps) {
  const { t } = useI18n();

  return (
    <section className="final-panel">
      <CheckCircle2 size={42} />
      <h2>{t("final.title")}</h2>
      <p>{record.status === "completed" ? t("final.completed") : t("final.incomplete")}</p>
      <button className="primary-action" type="button" onClick={onRestart}>
        {t("actions.restart")}
      </button>
    </section>
  );
}
