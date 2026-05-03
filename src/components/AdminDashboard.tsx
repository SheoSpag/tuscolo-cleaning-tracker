import { BarChart3, Camera, ClipboardCheck, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AppUser, Area, CleaningRecord, CleaningTask, UserRole } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type AdminDashboardProps = {
  records: CleaningRecord[];
  areas: Area[];
  tasks: CleaningTask[];
  users: AppUser[];
  currentUser: AppUser;
  onUsersChange: (users: AppUser[]) => void;
};

export function AdminDashboard({ records, areas, tasks, users, currentUser, onUsersChange }: AdminDashboardProps) {
  const { language, t } = useI18n();
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() + (day === 0 ? -6 : 1 - day));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const monthRecords = records.filter((record) => {
    const date = new Date(record.createdAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const weekRecords = records.filter((record) => {
    const date = new Date(record.createdAt);
    return date >= startOfWeek && date < endOfWeek;
  });
  const weeklyRecords = weekRecords.filter((record) => record.recordType === "weekly");
  const completed = monthRecords.filter((record) => record.status === "completed").length;
  const incomplete = monthRecords.filter((record) => record.status === "incomplete").length;
  const photoCount = monthRecords.reduce((sum, record) => sum + (record.photoUrls?.length ?? (record.photoUrl ? 1 : 0)), 0);
  const completionRate = monthRecords.length ? Math.round((completed / monthRecords.length) * 100) : 0;
  const operationalAreas = areas.filter((area) => area.id !== "management");
  const weeklyTaskTotal = operationalAreas.reduce((sum, area) => sum + area.tasks.filter((task) => task.frequency === "weekly").length, 0);
  const weeklyDone = new Set(weeklyRecords.flatMap((record) => record.taskResults?.map((result) => `${record.areaId}:${result.taskId}`) ?? [])).size;
  const weeklyRate = weeklyTaskTotal ? Math.round((weeklyDone / weeklyTaskTotal) * 100) : 0;

  const areaStats = areas.map((area) => {
    const areaRecords = monthRecords.filter((record) => record.areaId === area.id);
    const areaWeeklyTasks = area.tasks.filter((task) => task.frequency === "weekly");
    const areaWeeklyDone = areaWeeklyTasks.filter((task) =>
      weeklyRecords.some((record) => record.areaId === area.id && record.taskResults?.some((result) => result.taskId === task.id)),
    ).length;
    return {
      area,
      total: areaRecords.length,
      completed: areaRecords.filter((record) => record.status === "completed").length,
      weeklyTotal: areaWeeklyTasks.length,
      weeklyDone: areaWeeklyDone,
    };
  });
  const maxAreaTotal = Math.max(...areaStats.map((item) => item.total), 1);
  const changeUserRole = (userId: string, role: UserRole) => {
    onUsersChange(users.map((user) => (user.id === userId ? { ...user, role } : user)));
  };
  const toggleUserSector = (userId: string, sectorId: string) => {
    onUsersChange(
      users.map((user) => {
        if (user.id !== userId) return user;
        const assignedSectorIds = new Set(user.assignedSectorIds ?? []);
        if (assignedSectorIds.has(sectorId)) {
          assignedSectorIds.delete(sectorId);
        } else {
          assignedSectorIds.add(sectorId);
        }
        return { ...user, assignedSectorIds: [...assignedSectorIds] };
      }),
    );
  };

  return (
    <section className="admin-dashboard">
      <div className="section-heading">
        <div>
          <p>{t("admin.kicker")}</p>
          <h2>{t("admin.title")}</h2>
        </div>
      </div>

      <div className="kpi-grid">
        <article>
          <ClipboardCheck size={22} />
          <span>{t("admin.kpi.records")}</span>
          <strong>{monthRecords.length}</strong>
        </article>
        <article>
          <BarChart3 size={22} />
          <span>{t("admin.kpi.completion")}</span>
          <strong>{completionRate}%</strong>
        </article>
        <article>
          <TriangleAlert size={22} />
          <span>{t("admin.kpi.incomplete")}</span>
          <strong>{incomplete}</strong>
        </article>
        <article>
          <Camera size={22} />
          <span>{t("admin.kpi.photos")}</span>
          <strong>{photoCount}</strong>
        </article>
        <article>
          <ListChecks size={22} />
          <span>{t("weekly.progress")}</span>
          <strong>{weeklyRate}%</strong>
        </article>
        <article>
          <ListChecks size={22} />
          <span>{t("admin.kpi.tasks")}</span>
          <strong>{tasks.length}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="chart-panel">
          <h3>{t("admin.chart.status")}</h3>
          <div className="donut-chart" style={{ background: `conic-gradient(#3d7547 0 ${completionRate}%, #a93f3f ${completionRate}% 100%)` }}>
            <span>{completionRate}%</span>
          </div>
          <div className="chart-legend">
            <span><i className="success-dot" />{t("states.completed")}: {completed}</span>
            <span><i className="danger-dot" />{t("states.incomplete")}: {incomplete}</span>
          </div>
        </article>

        <article className="chart-panel">
          <h3>{t("admin.chart.areas")}</h3>
          <div className="bar-list">
            {areaStats.map((item) => (
              <div className="bar-row" key={item.area.id}>
                <span>{t(item.area.nameKey)}</span>
                <div className="bar-track">
                  <div style={{ width: `${(item.total / maxAreaTotal) * 100}%` }} />
                </div>
                <strong>{item.total}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="chart-panel">
          <h3>{t("weekly.title")}</h3>
          <div className="bar-list">
            {areaStats.filter((item) => item.area.id !== "management").map((item) => {
              const rate = item.weeklyTotal ? Math.round((item.weeklyDone / item.weeklyTotal) * 100) : 0;

              return (
                <div className="bar-row" key={`${item.area.id}-weekly`}>
                  <span>{t(item.area.nameKey)}</span>
                  <div className="bar-track">
                    <div style={{ width: `${rate}%` }} />
                  </div>
                  <strong>{item.weeklyDone}/{item.weeklyTotal}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <article className="chart-panel">
        <h3>{t("weekly.title")}</h3>
        {weeklyRecords.length ? (
          <div className="weekly-task-list">
            {weeklyRecords.map((record) => {
              const user = users.find((candidate) => candidate.id === record.employeeId);
              const area = areas.find((candidate) => candidate.id === record.areaId);
              const result = record.taskResults?.[0];
              const photos = record.photoUrls ?? [];

              return (
                <div className="weekly-task-row" key={record.id}>
                  <div>
                    <span>{area ? t(area.nameKey) : record.areaId}</span>
                    <strong>
                      {result ? translateTask({ id: result.taskId, areaId: record.areaId, frequency: "weekly", question: result.label }, language) : t("fields.task")}
                    </strong>
                    <p>{t("weekly.doneBy")}: {user?.name ?? record.employeeId}</p>
                    {photos.length ? (
                      <div className="photo-evidence-list">
                        {photos.map((photoUrl, index) => (
                          <a className="photo-evidence" href={photoUrl} target="_blank" rel="noreferrer" key={`${record.id}-${index}`}>
                            <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                            <span>{t("records.photo")} {index + 1}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">{t("weekly.empty")}</p>
        )}
      </article>

      <div className="admin-summary-row">
        <span>{t("admin.summary.admins")}: {users.filter((user) => user.role === "admin").length}</span>
        <span>{t("admin.summary.employees")}: {users.filter((user) => user.role === "employee").length}</span>
      </div>

      <article className="user-management">
        <div className="section-heading">
          <div>
            <p>{t("admin.users.kicker")}</p>
            <h2>{t("admin.users.title")}</h2>
          </div>
          <ShieldCheck size={24} />
        </div>

        <div className="user-list">
          {users.map((user) => (
            <div className="user-row" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <select
                value={user.role}
                onChange={(event) => changeUserRole(user.id, event.target.value as UserRole)}
                disabled={user.id === currentUser.id}
              >
                <option value="employee">{t("roles.employee")}</option>
                <option value="admin">{t("roles.admin")}</option>
              </select>
              <div className="sector-checkboxes" aria-label={t("fields.sectors")}>
                {areas.map((area) => (
                  <label key={`${user.id}-${area.id}`}>
                    <input
                      type="checkbox"
                      checked={(user.assignedSectorIds ?? []).includes(area.id)}
                      onChange={() => toggleUserSector(user.id, area.id)}
                      disabled={user.id === currentUser.id && area.id === "management"}
                    />
                    <span>{t(area.nameKey)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
