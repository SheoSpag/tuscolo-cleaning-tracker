import { Printer } from "lucide-react";
import type { Area, CleaningRecord, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTaskQuestion } from "../i18n/taskTranslations";

type RecordsViewProps = {
  records: CleaningRecord[];
  areas: Area[];
  employees: Employee[];
};

export function RecordsView({ records, areas, employees }: RecordsViewProps) {
  const { language, t } = useI18n();
  const localeByLanguage = {
    es: "es-ES",
    de: "de-DE",
    en: "en-US",
    it: "it-IT",
  };
  const locale = localeByLanguage[language];
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });

  const currentMonthRecords = records.filter((record) => {
    const date = new Date(record.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const findArea = (areaId: string) => areas.find((area) => area.id === areaId);
  const findEmployee = (employeeId: string) => employees.find((employee) => employee.id === employeeId);
  const findTaskQuestion = (record: CleaningRecord) => {
    if (record.failedTaskReasons?.length) {
      return record.failedTaskReasons
        .map((item) => `${translateTaskQuestion(item.label, language)}: ${item.reason || t("common.noValue")}`)
        .join("; ");
    }

    if (record.failedTaskLabels?.length) {
      return record.failedTaskLabels.map((label) => `${translateTaskQuestion(label, language)}: ${t("common.noValue")}`).join("; ");
    }

    if (record.failedTaskLabel) {
      return `${translateTaskQuestion(record.failedTaskLabel, language)}: ${t("common.noValue")}`;
    }

    const area = findArea(record.areaId);
    const taskIds = record.failedTaskIds?.length ? record.failedTaskIds : record.failedTaskId ? [record.failedTaskId] : [];
    const failedTasks = taskIds
      .map((taskId) => area?.tasks.find((item) => item.id === taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task));

    return failedTasks.map((task) => `${translateTaskQuestion(task.question, language)}: ${t("common.noValue")}`).join("; ");
  };

  return (
    <section className="records-section">
      <div className="records-toolbar">
        <div>
          <p>{t("actions.records")}</p>
          <h2>{monthFormatter.format(new Date())}</h2>
        </div>
        <button className="secondary-action print-hidden" type="button" onClick={() => window.print()}>
          <Printer size={18} />
          {t("actions.print")}
        </button>
      </div>

      {currentMonthRecords.length === 0 ? (
        <p className="empty-state">{t("records.empty")}</p>
      ) : (
        <div className="records-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("fields.area")}</th>
                <th>{t("fields.employee")}</th>
                <th>{t("fields.status")}</th>
                <th>{t("fields.comment")}</th>
                <th>{t("records.failedTask")}</th>
                <th>{t("records.photo")}</th>
                <th>{t("fields.date")}</th>
              </tr>
            </thead>
            <tbody>
              {currentMonthRecords.map((record) => {
                const photoUrls = record.photoUrls?.length ? record.photoUrls : record.photoUrl ? [record.photoUrl] : [];

                return (
                  <tr key={record.id}>
                    <td>{t(findArea(record.areaId)?.nameKey ?? record.areaId)}</td>
                    <td>{findEmployee(record.employeeId)?.name ?? record.employeeId}</td>
                    <td>
                      <span className={`table-status ${record.status}`}>{t(`states.${record.status}`)}</span>
                    </td>
                    <td>{record.comment || t("common.noValue")}</td>
                    <td>{findTaskQuestion(record) || t("common.noValue")}</td>
                    <td>
                      {photoUrls.length ? (
                        <div className="photo-evidence-list">
                          {photoUrls.map((photoUrl, index) => (
                            <a className="photo-evidence" href={photoUrl} target="_blank" rel="noreferrer" key={`${record.id}-photo-${index}`}>
                              <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                              <span>
                                {t("records.photo")} {index + 1}
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        t("records.noPhoto")
                      )}
                    </td>
                    <td>{new Date(record.createdAt).toLocaleString(locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
