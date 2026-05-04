import { Eye, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Area, Branch, CleaningRecord, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTaskQuestion } from "../i18n/taskTranslations";

type RecordsViewProps = {
  records: CleaningRecord[];
  areas: Area[];
  employees: Employee[];
  branches?: Branch[];
  selectedBranchId?: string;
  onBranchChange?: (branchId: string) => void;
};

type SummaryPeriod = "week" | "month";

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

export function RecordsView({ records, areas, employees, branches = [], selectedBranchId, onBranchChange }: RecordsViewProps) {
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
        const fallbackBranchId = branches[0]?.id;
        if (selectedBranchId && (record.branchId ?? fallbackBranchId) !== selectedBranchId) {
          return false;
        }

        if (period === "month") {
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }

        const start = startOfWeek(now);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return date >= start && date < end;
      }),
    [branches, records, period, selectedBranchId],
  );

  const title = period === "month" ? formatter.format(now) : `${formatter.format(startOfWeek(now))} - ${formatter.format(new Date(startOfWeek(now).getTime() + 6 * 24 * 60 * 60 * 1000))}`;
  const findArea = (areaId: string) => areas.find((area) => area.id === areaId);
  const findEmployee = (employeeId: string) => employees.find((employee) => employee.id === employeeId);
  const findBranch = (branchId?: string) => branches.find((branch) => branch.id === branchId);
  const photoCount = (record: CleaningRecord) => {
    const taskPhotoCount = record.taskResults?.reduce((sum, result) => sum + (result.photoUrls?.length ?? 0), 0) ?? 0;
    const recordPhotoCount = record.photoUrls?.length ?? (record.photoUrl ? 1 : 0);
    return taskPhotoCount || recordPhotoCount;
  };
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
          {branches.length && selectedBranchId && onBranchChange ? (
            <select className="compact-select" value={selectedBranchId} onChange={(event) => onBranchChange(event.target.value)} aria-label={t("fields.branch")}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : null}
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
                {branches.length ? <th>{t("fields.branch")}</th> : null}
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
                  {branches.length ? <td>{findBranch(record.branchId ?? branches[0]?.id)?.name ?? t("common.noValue")}</td> : null}
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
  const taskResults: NonNullable<CleaningRecord["taskResults"]> = record.taskResults ?? [];
  const taskPhotoCount = taskResults.reduce((sum, result) => sum + (result.photoUrls?.length ?? 0), 0);
  const recordPhotoUrls = record.photoUrls?.length ? record.photoUrls : record.photoUrl ? [record.photoUrl] : [];
  const summaryPhotoUrls = record.recordType === "daily" || !taskPhotoCount ? recordPhotoUrls : [];

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
          {summaryPhotoUrls.length ? (
            <article className="record-task-detail">
              <div>
                <strong>{t("records.summaryPhotos")}</strong>
                <span>{summaryPhotoUrls.length} {t("records.photo")}</span>
              </div>
              <div className="record-photo-grid">
                {summaryPhotoUrls.map((photoUrl, index) => (
                  <a href={photoUrl} target="_blank" rel="noreferrer" key={`summary-${index}`}>
                    <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                  </a>
                ))}
              </div>
            </article>
          ) : null}

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
                ) : null}
              </article>
            ))
          ) : !summaryPhotoUrls.length ? (
            <p className="empty-state">{t("records.noPhoto")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
