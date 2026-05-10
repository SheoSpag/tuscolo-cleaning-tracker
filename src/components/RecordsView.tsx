import { Eye, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { Area, Branch, CleaningRecord, CleaningRecordType, Employee, RecordStatus } from "../types";
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
type RecordFilter = "all";
type StatusFilter = RecordFilter | RecordStatus;
type TypeFilter = RecordFilter | CleaningRecordType;

const dayInMs = 24 * 60 * 60 * 1000;

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

function getPeriodRange(period: SummaryPeriod, date: Date) {
  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
  }

  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function collectPhotoUrls(record: CleaningRecord) {
  const taskPhotos = record.taskResults?.flatMap((result) => result.photoUrls ?? []) ?? [];
  const recordPhotos = record.photoUrls?.length ? record.photoUrls : record.photoUrl ? [record.photoUrl] : [];
  return [...recordPhotos, ...taskPhotos];
}

export function RecordsView({ records, areas, employees, branches = [], selectedBranchId, onBranchChange }: RecordsViewProps) {
  const { language, t } = useI18n();
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedRecord, setSelectedRecord] = useState<CleaningRecord | null>(null);
  const localeByLanguage = {
    es: "es-ES",
    de: "de-DE",
    en: "en-US",
    it: "it-IT",
  };
  const locale = localeByLanguage[language];
  const now = new Date();
  const formatReportTitle = (targetPeriod: SummaryPeriod) => {
    const formatter = new Intl.DateTimeFormat(locale, targetPeriod === "month" ? { month: "long", year: "numeric" } : { day: "2-digit", month: "short", year: "numeric" });
    if (targetPeriod === "month") {
      return formatter.format(now);
    }

    const range = getPeriodRange("week", now);
    return `${formatter.format(range.start)} - ${formatter.format(new Date(range.end.getTime() - dayInMs))}`;
  };
  const matchesRecordFilters = (record: CleaningRecord, targetPeriod: SummaryPeriod) => {
    const date = new Date(record.createdAt);
    const fallbackBranchId = branches[0]?.id;
    if (selectedBranchId && (record.branchId ?? fallbackBranchId) !== selectedBranchId) {
      return false;
    }
    if (employeeFilter !== "all" && record.employeeId !== employeeFilter) {
      return false;
    }
    if (areaFilter !== "all" && record.areaId !== areaFilter) {
      return false;
    }
    if (statusFilter !== "all" && record.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== "all" && (record.recordType ?? "daily") !== typeFilter) {
      return false;
    }

    const range = getPeriodRange(targetPeriod, now);
    return date >= range.start && date < range.end;
  };
  const getRecordsForPeriod = (targetPeriod: SummaryPeriod) => records.filter((record) => matchesRecordFilters(record, targetPeriod));

  const currentRecords = useMemo(
    () => getRecordsForPeriod(period),
    [areaFilter, branches, employeeFilter, records, period, selectedBranchId, statusFilter, typeFilter],
  );

  const title = formatReportTitle(period);
  const findArea = (areaId: string) => areas.find((area) => area.id === areaId);
  const findEmployee = (employeeId: string) => employees.find((employee) => employee.id === employeeId);
  const findBranch = (branchId?: string) => branches.find((branch) => branch.id === branchId);
  const typeLabel = (recordType?: CleaningRecordType) =>
    recordType === "weekly"
      ? t("records.type.weekly")
      : recordType === "weekly-review"
        ? t("records.type.weeklyReview")
        : t("records.type.daily");
  const photoCount = (record: CleaningRecord) => collectPhotoUrls(record).length;
  const reportSummary = useMemo(
    () => ({
      total: currentRecords.length,
      completed: currentRecords.filter((record) => record.status === "completed").length,
      incomplete: currentRecords.filter((record) => record.status === "incomplete").length,
      daily: currentRecords.filter((record) => (record.recordType ?? "daily") === "daily").length,
      weekly: currentRecords.filter((record) => record.recordType === "weekly").length,
      photos: currentRecords.reduce((sum, record) => sum + photoCount(record), 0),
    }),
    [currentRecords],
  );
  const activeFilterLabels = [
    selectedBranchId ? findBranch(selectedBranchId)?.name ?? selectedBranchId : t("admin.allBranches"),
    employeeFilter !== "all" ? findEmployee(employeeFilter)?.name ?? employeeFilter : t("records.allEmployees"),
    areaFilter !== "all" ? t(findArea(areaFilter)?.nameKey ?? areaFilter) : t("records.allAreas"),
    statusFilter !== "all" ? t(`states.${statusFilter}`) : t("records.allStatuses"),
    typeFilter !== "all" ? typeLabel(typeFilter) : t("records.allTypes"),
  ];
  const printReport = (nextPeriod: SummaryPeriod) => {
    const reportRecords = getRecordsForPeriod(nextPeriod);
    const reportTitle = formatReportTitle(nextPeriod);
    const summary = {
      total: reportRecords.length,
      completed: reportRecords.filter((record) => record.status === "completed").length,
      incomplete: reportRecords.filter((record) => record.status === "incomplete").length,
      daily: reportRecords.filter((record) => (record.recordType ?? "daily") === "daily").length,
      weekly: reportRecords.filter((record) => record.recordType === "weekly").length,
      photos: reportRecords.reduce((sum, record) => sum + photoCount(record), 0),
    };
    const rows = reportRecords.map((record) => {
      const photoUrls = collectPhotoUrls(record);
      return {
        branch: branches.length ? findBranch(record.branchId ?? branches[0]?.id)?.name ?? t("common.noValue") : "",
        area: t(findArea(record.areaId)?.nameKey ?? record.areaId),
        employee: findEmployee(record.employeeId)?.name ?? record.employeeId,
        type: typeLabel(record.recordType),
        status: t(`states.${record.status}`),
        comment: record.comment || t("common.noValue"),
        failedTask: findTaskQuestion(record) || t("common.noValue"),
        photoText: photoUrls.length ? `${photoUrls.length} ${t("records.photo")}` : t("records.noPhoto"),
        photoUrls,
        date: new Date(record.createdAt).toLocaleString(locale),
      };
    });
    const branchHeader = branches.length ? `<th>${escapeHtml(t("fields.branch"))}</th>` : "";
    const bodyRows = rows.length
      ? rows
          .map((row) => {
            const photoLinks = row.photoUrls.length
              ? `<br>${row.photoUrls.map((url, index) => `<a href="${escapeHtml(url)}">${escapeHtml(`${t("records.photo")} ${index + 1}`)}</a>`).join(" · ")}`
              : "";
            return `
              <tr>
                ${branches.length ? `<td>${escapeHtml(row.branch)}</td>` : ""}
                <td>${escapeHtml(row.area)}</td>
                <td>${escapeHtml(row.employee)}</td>
                <td>${escapeHtml(row.type)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${escapeHtml(row.comment)}</td>
                <td>${escapeHtml(row.failedTask)}</td>
                <td>${escapeHtml(row.photoText)}${photoLinks}</td>
                <td>${escapeHtml(row.date)}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="${branches.length ? 9 : 8}" class="empty-cell">${escapeHtml(t("records.empty"))}</td></tr>`;
    const reportHtml = `<!doctype html>
      <html lang="${escapeHtml(language)}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(t("records.reportTitle"))} - ${escapeHtml(reportTitle)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #20231b; background: #fff; font-family: Inter, Arial, sans-serif; }
            .report-shell { padding: 6px; }
            .report-brand { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 14px; border-bottom: 2px solid #6b744d; padding-bottom: 10px; }
            .report-brand p, .report-brand h1, .report-brand span { margin: 0; }
            .report-brand p { color: #6b744d; font-size: 10px; font-weight: 900; text-transform: uppercase; }
            .report-brand h1 { margin-top: 3px; font-family: Georgia, serif; font-size: 24px; }
            .report-brand span { color: #4f5739; font-family: Georgia, serif; font-style: italic; }
            .print-date { color: #6d7164; font-size: 10px; font-weight: 700; text-align: right; }
            .filters { margin: 0 0 10px; color: #4d5344; font-size: 10px; font-weight: 700; }
            .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 12px; }
            .metric { min-height: 50px; padding: 7px; background: #f7f8f2; border: 1px solid #d7dccd; border-radius: 8px; }
            .metric strong { display: block; color: #20231b; font-size: 18px; line-height: 1; }
            .metric span { color: #6d7164; font-size: 9px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; font-size: 8.4px; }
            thead { display: table-header-group; }
            th { color: #20231b; background: #eef2e4; }
            th, td { padding: 5px 4px; border: 1px solid #d7dccd; text-align: left; vertical-align: top; word-break: break-word; }
            td a { color: #4f5739; font-weight: 800; text-decoration: none; }
            tr { break-inside: avoid; }
            .empty-cell { padding: 18px; text-align: center; color: #6d7164; font-weight: 800; }
          </style>
        </head>
        <body>
          <main class="report-shell">
            <section class="report-brand">
              <div>
                <p>${escapeHtml(t("records.reportTitle"))}</p>
                <h1>Tuscolo Cleaning Tracker</h1>
                <span>Sotto il cielo d’Italia</span>
              </div>
              <div class="print-date">${escapeHtml(t("records.printedAt"))}: ${escapeHtml(new Date().toLocaleString(locale))}</div>
            </section>
            <p class="filters">${escapeHtml(reportTitle)} · ${escapeHtml(t("records.activeFilters"))}: ${escapeHtml(activeFilterLabels.join(" · "))}</p>
            <section class="summary-grid">
              <div class="metric"><strong>${summary.total}</strong><span>${escapeHtml(t("records.totalRecords"))}</span></div>
              <div class="metric"><strong>${summary.completed}</strong><span>${escapeHtml(t("records.completedRecords"))}</span></div>
              <div class="metric"><strong>${summary.incomplete}</strong><span>${escapeHtml(t("records.incompleteRecords"))}</span></div>
              <div class="metric"><strong>${summary.daily}</strong><span>${escapeHtml(t("records.dailyRecords"))}</span></div>
              <div class="metric"><strong>${summary.weekly}</strong><span>${escapeHtml(t("records.weeklyRecords"))}</span></div>
              <div class="metric"><strong>${summary.photos}</strong><span>${escapeHtml(t("records.photosUploaded"))}</span></div>
            </section>
            <table>
              <thead>
                <tr>
                  ${branchHeader}
                  <th>${escapeHtml(t("fields.area"))}</th>
                  <th>${escapeHtml(t("fields.employee"))}</th>
                  <th>${escapeHtml(t("records.type"))}</th>
                  <th>${escapeHtml(t("fields.status"))}</th>
                  <th>${escapeHtml(t("fields.comment"))}</th>
                  <th>${escapeHtml(t("records.failedTask"))}</th>
                  <th>${escapeHtml(t("records.photo"))}</th>
                  <th>${escapeHtml(t("fields.date"))}</th>
                </tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </main>
        </body>
      </html>`;
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      flushSync(() => setPeriod(nextPeriod));
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    flushSync(() => setPeriod(nextPeriod));
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
          <div className="records-filter-grid">
            <label className="field">
              <span>{t("fields.employee")}</span>
              <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
                <option value="all">{t("records.allEmployees")}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("fields.area")}</span>
              <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="all">{t("records.allAreas")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {t(area.nameKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("fields.status")}</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">{t("records.allStatuses")}</option>
                <option value="completed">{t("states.completed")}</option>
                <option value="incomplete">{t("states.incomplete")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("records.type")}</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
                <option value="all">{t("records.allTypes")}</option>
                <option value="daily">{t("records.type.daily")}</option>
                <option value="weekly">{t("records.type.weekly")}</option>
                <option value="weekly-review">{t("records.type.weeklyReview")}</option>
              </select>
            </label>
          </div>
          <button className="secondary-action" type="button" onClick={() => printReport("week")}>
            <Printer size={18} />
            {t("records.printWeekly")}
          </button>
          <button className="secondary-action" type="button" onClick={() => printReport("month")}>
            <Printer size={18} />
            {t("records.printMonthly")}
          </button>
        </div>
      </div>

      <div className="print-report-summary">
        <div>
          <p>{t("records.reportTitle")}</p>
          <h3>{title}</h3>
          <span>{t("records.activeFilters")}: {activeFilterLabels.join(" · ")}</span>
        </div>
        <div className="print-report-grid">
          <span><strong>{reportSummary.total}</strong>{t("records.totalRecords")}</span>
          <span><strong>{reportSummary.completed}</strong>{t("records.completedRecords")}</span>
          <span><strong>{reportSummary.incomplete}</strong>{t("records.incompleteRecords")}</span>
          <span><strong>{reportSummary.daily}</strong>{t("records.dailyRecords")}</span>
          <span><strong>{reportSummary.weekly}</strong>{t("records.weeklyRecords")}</span>
          <span><strong>{reportSummary.photos}</strong>{t("records.photosUploaded")}</span>
        </div>
        <small>{t("records.printedAt")}: {new Date().toLocaleString(locale)}</small>
      </div>

      {currentRecords.length === 0 ? (
        <p className="empty-state">{t("records.empty")}</p>
      ) : (
        <>
          <div className="records-card-list print-hidden">
            {currentRecords.map((record) => (
              <article className="record-mobile-card" key={record.id}>
                <div>
                  <span className={`table-status ${record.status}`}>{t(`states.${record.status}`)}</span>
                  <strong>{t(findArea(record.areaId)?.nameKey ?? record.areaId)}</strong>
                  <p>{findEmployee(record.employeeId)?.name ?? record.employeeId}</p>
                </div>
                <dl>
                  {branches.length ? (
                    <>
                      <dt>{t("fields.branch")}</dt>
                      <dd>{findBranch(record.branchId ?? branches[0]?.id)?.name ?? t("common.noValue")}</dd>
                    </>
                  ) : null}
                  <dt>{t("records.photo")}</dt>
                  <dd>{photoCount(record) ? `${photoCount(record)} ${t("records.photo")}` : t("records.noPhoto")}</dd>
                  <dt>{t("records.type")}</dt>
                  <dd>{typeLabel(record.recordType)}</dd>
                  <dt>{t("fields.date")}</dt>
                  <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
                </dl>
                {findTaskQuestion(record) ? <p className="record-card-note">{findTaskQuestion(record)}</p> : null}
                <button className="secondary-action" type="button" onClick={() => setSelectedRecord(record)}>
                  <Eye size={18} />
                  {t("records.details")}
                </button>
              </article>
            ))}
          </div>
          <div className="records-table-wrap">
            <table>
              <thead>
                <tr>
                  {branches.length ? <th>{t("fields.branch")}</th> : null}
                  <th>{t("fields.area")}</th>
                  <th>{t("fields.employee")}</th>
                  <th>{t("records.type")}</th>
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
                    <td>{typeLabel(record.recordType)}</td>
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
        </>
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
  const totalPhotos = taskPhotoCount || summaryPhotoUrls.length;
  const portalTarget = document.querySelector(".app-theme-dark, .app-theme-light") ?? document.body;

  return createPortal(
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

        <div className="record-detail-meta">
          <span className={`table-status ${record.status}`}>{t(`states.${record.status}`)}</span>
          <span>{totalPhotos ? `${totalPhotos} ${t("records.photo")}` : t("records.noPhoto")}</span>
          {record.comment ? <p>{t("fields.comment")}: {record.comment}</p> : null}
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
    </div>,
    portalTarget,
  );
}
