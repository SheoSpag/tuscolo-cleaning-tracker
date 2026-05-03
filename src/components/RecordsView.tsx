import { Eye, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Area, CleaningRecord, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTaskQuestion } from "../i18n/taskTranslations";

type RecordsViewProps = {
  records: CleaningRecord[];
  areas: Area[];
  employees: Employee[];
};

type SummaryPeriod = "week" | "month";

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

export function RecordsView({ records, areas, employees }: RecordsViewProps) {
  const { language, t } = useI18n();
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [selectedRecord, setSelectedRecord] = useState<CleaningRecord | null>(null);
  const localeByLanguage = {
    es: "es-ES",
    de: "de-DE",
    en: "en-US",
    it: "it-IT",
  };
  const locale = localeByLanguage[language];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(locale, period === "month" ? { month: "long", year: "numeric" } : { day: "2-digit", month: "short", year: "numeric" });

  const currentRecords = useMemo(
    () =>
      records.filter((record) => {
        const date = new Date(record.createdAt);
        if (period === "month") {
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }

        const start = startOfWeek(now);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return date >= start && date < end;
      }),
    [records, period],
  );

  const title = period === "month" ? formatter.format(now) : `${formatter.format(startOfWeek(now))} - ${formatter.format(new Date(startOfWeek(now).getTime() + 6 * 24 * 60 * 60 * 1000))}`;
  const findArea = (areaId: string) => areas.find((area) => area.id === areaId);
  const findEmployee = (employeeId: string) => employees.find((employee) => employee.id === employeeId);
  const photoCount = (record: CleaningRecord) => record.taskResults?.reduce((sum, result) => sum + (result.photoUrls?.length ?? 0), 0) ?? record.photoUrls?.length ?? (record.photoUrl ? 1 : 0);
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

    return "";
  };

  return (
    <section className="records-section">
      <div className="records-toolbar">
        <div>
          <p>{period === "month" ? t("records.monthly") : t("records.weekly")}</p>
          <h2>{title}</h2>
        </div>
        <div className="records-actions print-hidden">
          <div className="segmented-control" role="tablist" aria-label={t("records.period")}>
            <button className={period === "week" ? "active" : ""} type="button" onClick={() => setPeriod("week")}>
              {t("records.weekly")}
            </button>
            <button className={period === "month" ? "active" : ""} type="button" onClick={() => setPeriod("month")}>
              {t("records.monthly")}
            </button>
          </div>
          <button className="secondary-action" type="button" onClick={() => window.print()}>
            <Printer size={18} />
            {t("actions.print")}
          </button>
        </div>
      </div>

      {currentRecords.length === 0 ? (
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
                <th className="print-hidden">{t("records.details")}</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((record) => (
                <tr key={record.id}>
                  <td>{t(findArea(record.areaId)?.nameKey ?? record.areaId)}</td>
                  <td>{findEmployee(record.employeeId)?.name ?? record.employeeId}</td>
                  <td>
                    <span className={`table-status ${record.status}`}>{t(`states.${record.status}`)}</span>
                  </td>
                  <td>{record.comment || t("common.noValue")}</td>
                  <td>{findTaskQuestion(record) || t("common.noValue")}</td>
                  <td>{photoCount(record) ? `${photoCount(record)} ${t("records.photo")}` : t("records.noPhoto")}</td>
                  <td>{new Date(record.createdAt).toLocaleString(locale)}</td>
                  <td className="print-hidden">
                    <button className="icon-action" type="button" onClick={() => setSelectedRecord(record)} aria-label={t("records.details")}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRecord ? (
        <RecordDetailModal
          record={selectedRecord}
          area={findArea(selectedRecord.areaId)}
          employee={findEmployee(selectedRecord.employeeId)}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}
    </section>
  );
}

type RecordDetailModalProps = {
  record: CleaningRecord;
  area?: Area;
  employee?: Employee;
  onClose: () => void;
};

function RecordDetailModal({ record, area, employee, onClose }: RecordDetailModalProps) {
  const { language, t } = useI18n();
  const taskResults: NonNullable<CleaningRecord["taskResults"]> = record.taskResults?.length
    ? record.taskResults
    : (record.photoUrls ?? []).length
      ? [{ taskId: "photos", label: t("records.photo"), status: "done", reason: null, photoUrls: record.photoUrls ?? [] }]
      : [];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="record-detail-title">
      <div className="record-detail-modal">
        <div className="record-detail-header">
          <div>
            <p>{area ? t(area.nameKey) : record.areaId}</p>
            <h3 id="record-detail-title">{employee?.name ?? record.employeeId}</h3>
            <span>{new Date(record.createdAt).toLocaleString()}</span>
          </div>
          <button className="icon-action" type="button" onClick={onClose} aria-label={t("actions.cancel")}>
            <X size={18} />
          </button>
        </div>

        <div className="record-detail-list">
          {taskResults.length ? (
            taskResults.map((result) => (
              <article className="record-task-detail" key={result.taskId}>
                <div>
                  <strong>{translateTaskQuestion(result.label, language)}</strong>
                  <span>{result.status === "done" ? t("actions.yes") : t("actions.no")}</span>
                  {result.reason ? <p>{result.reason}</p> : null}
                </div>
                {result.photoUrls?.length ? (
                  <div className="record-photo-grid">
                    {result.photoUrls.map((photoUrl, index) => (
                      <a href={photoUrl} target="_blank" rel="noreferrer" key={`${result.taskId}-${index}`}>
                        <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="muted">{t("records.noPhoto")}</p>
                )}
              </article>
            ))
          ) : (
            <p className="empty-state">{t("records.noPhoto")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
