import { BarChart3, Camera, ClipboardCheck, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AppUser, Area, CleaningRecord, CleaningTask, UserRole } from "../types";
import { useI18n } from "../i18n/I18nContext";

type AdminDashboardProps = {
  records: CleaningRecord[];
  areas: Area[];
  tasks: CleaningTask[];
  users: AppUser[];
  currentUser: AppUser;
  onUsersChange: (users: AppUser[]) => void;
};

export function AdminDashboard({ records, areas, tasks, users, currentUser, onUsersChange }: AdminDashboardProps) {
  const { t } = useI18n();
  const now = new Date();
  const monthRecords = records.filter((record) => {
    const date = new Date(record.createdAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const completed = monthRecords.filter((record) => record.status === "completed").length;
  const incomplete = monthRecords.filter((record) => record.status === "incomplete").length;
  const photoCount = monthRecords.reduce((sum, record) => sum + (record.photoUrls?.length ?? (record.photoUrl ? 1 : 0)), 0);
  const completionRate = monthRecords.length ? Math.round((completed / monthRecords.length) * 100) : 0;

  const areaStats = areas.map((area) => {
    const areaRecords = monthRecords.filter((record) => record.areaId === area.id);
    return {
      area,
      total: areaRecords.length,
      completed: areaRecords.filter((record) => record.status === "completed").length,
    };
  });
  const maxAreaTotal = Math.max(...areaStats.map((item) => item.total), 1);
  const changeUserRole = (userId: string, role: UserRole) => {
    onUsersChange(users.map((user) => (user.id === userId ? { ...user, role } : user)));
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
      </div>

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
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
