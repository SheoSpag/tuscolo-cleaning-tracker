import { CalendarClock, ClipboardCheck, LineChart, ListChecks } from "lucide-react";
import type { Area, CleaningRecord, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";

type EmployeeHistoryProps = {
  records: CleaningRecord[];
  areas: Area[];
  employee: Employee;
};

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

function weekRange(offset: number) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() - offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function isInRange(record: CleaningRecord, start: Date, end: Date) {
  const date = new Date(record.createdAt);
  return date >= start && date < end;
}

export function EmployeeHistory({ records, areas, employee }: EmployeeHistoryProps) {
  const { t, language } = useI18n();
  const sortedRecords = [...records].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const currentWeek = weekRange(0);
  const previousWeek = weekRange(1);
  const weeklyThisWeek = records.filter((record) => record.recordType === "weekly" && isInRange(record, currentWeek.start, currentWeek.end)).length;
  const weeklyPreviousWeek = records.filter((record) => record.recordType === "weekly" && isInRange(record, previousWeek.start, previousWeek.end)).length;
  const closedThisWeek = records.filter((record) => (record.recordType ?? "daily") === "daily" && isInRange(record, currentWeek.start, currentWeek.end)).length;
  const closedPreviousWeek = records.filter((record) => (record.recordType ?? "daily") === "daily" && isInRange(record, previousWeek.start, previousWeek.end)).length;
  const weeklyTrend = Array.from({ length: 6 }, (_, index) => {
    const offset = 5 - index;
    const range = weekRange(offset);
    return records.filter((record) => record.recordType === "weekly" && isInRange(record, range.start, range.end)).length;
  });
  const maxTrend = Math.max(...weeklyTrend, 1);
  const findArea = (areaId: string) => areas.find((area) => area.id === areaId);

  return (
    <section className="employee-history">
      <div className="section-heading">
        <div>
          <p>{t("employeeHistory.kicker")}</p>
          <h2>{t("employeeHistory.title")}</h2>
        </div>
      </div>

      <div className="employee-history-grid">
        <article>
          <ListChecks size={22} />
          <span>{t("employeeHistory.weeklyDone")}</span>
          <strong>{weeklyThisWeek}</strong>
          <p>{t("employeeHistory.previousWeek")}: {weeklyPreviousWeek}</p>
        </article>
        <article>
          <ClipboardCheck size={22} />
          <span>{t("employeeHistory.closedThisWeek")}</span>
          <strong>{closedThisWeek}</strong>
          <p>{t("employeeHistory.previousWeek")}: {closedPreviousWeek}</p>
        </article>
      </div>

      <article className="employee-history-panel">
        <div className="employee-history-title">
          <LineChart size={22} />
          <div>
            <p>{employee.name}</p>
            <h3>{t("employeeHistory.weeklyChart")}</h3>
          </div>
        </div>
        <div className="employee-mini-chart">
          {weeklyTrend.map((value, index) => (
            <div key={`${index}-${value}`}>
              <span style={{ height: `${Math.max(8, (value / maxTrend) * 100)}%` }} />
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="employee-history-panel">
        <div className="employee-history-title">
          <CalendarClock size={22} />
          <div>
            <p>{t("employeeHistory.records")}</p>
            <h3>{t("records.details")}</h3>
          </div>
        </div>
        {sortedRecords.length ? (
          <div className="employee-record-list">
            {sortedRecords.slice(0, 12).map((record) => (
              <div key={record.id}>
                <strong>{t(findArea(record.areaId)?.nameKey ?? record.areaId)}</strong>
                <span>{t(`states.${record.status}`)}</span>
                <small>{new Date(record.createdAt).toLocaleString(language === "de" ? "de-DE" : language === "en" ? "en-US" : language === "it" ? "it-IT" : "es-ES")}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">{t("records.empty")}</p>
        )}
      </article>
    </section>
  );
}
