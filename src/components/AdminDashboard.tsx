import {
  BarChart3,
  Building2,
  Camera,
  ClipboardList,
  Cog,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { AppUser, Area, Branch, CleaningRecord, CleaningTask, Language, UserRole } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTaskQuestion } from "../i18n/taskTranslations";
import { LanguageSelector } from "./LanguageSelector";
import { RecordsView } from "./RecordsView";
import { TaskManager } from "./TaskManager";

type AdminSection = "summary" | "branches" | "areas" | "tasks" | "records" | "employees" | "users" | "reports" | "settings";
type RoleFilter = "all" | UserRole;
type WeeklyTaskKey = `${string}:${string}`;

type AdminDashboardProps = {
  records: CleaningRecord[];
  areas: Area[];
  recordsAreas: Area[];
  taskManagerAreas: Area[];
  tasks: CleaningTask[];
  users: AppUser[];
  branches: Branch[];
  selectedBranchId: string;
  currentUser: AppUser;
  onBranchChange: (branchId: string) => void;
  onBranchesChange: (branches: Branch[]) => void;
  onTasksChange: (tasks: CleaningTask[]) => void;
  onUsersChange: (users: AppUser[]) => void;
  onLogout: () => void;
};

type BranchSummary = {
  branch: Branch;
  rate: number;
  done: number;
  total: number;
  pending: number;
  notDone: number;
  photos: number;
  employees: number;
};

type FailureRow = {
  task: string;
  area: string;
  count: number;
  lastFailure: string;
};

type ActivityItem = {
  id: string;
  text: string;
  tone: "success" | "warning" | "neutral";
};

const menuItems: Array<{ id: AdminSection; icon: typeof LayoutDashboard; labelKey: string }> = [
  { id: "summary", icon: LayoutDashboard, labelKey: "admin.menu.summary" },
  { id: "branches", icon: Building2, labelKey: "admin.menu.branches" },
  { id: "areas", icon: TableProperties, labelKey: "admin.menu.areas" },
  { id: "tasks", icon: ListChecks, labelKey: "admin.menu.tasks" },
  { id: "records", icon: ClipboardList, labelKey: "admin.menu.records" },
  { id: "employees", icon: Users, labelKey: "admin.menu.employees" },
  { id: "users", icon: ShieldCheck, labelKey: "admin.menu.usersRoles" },
  { id: "reports", icon: BarChart3, labelKey: "admin.menu.reports" },
  { id: "settings", icon: Cog, labelKey: "admin.menu.settings" },
];

const fallbackTrend = [62, 68, 64, 72, 79, 76, 84];
const fallbackFailures: FailureRow[] = [
  { task: "Limpieza de superficies de heladeras", area: "Bar", count: 4, lastFailure: "Hoy" },
  { task: "Limpieza de freidoras", area: "Pizza", count: 3, lastFailure: "Ayer" },
  { task: "Limpieza de hornos", area: "Pizza", count: 3, lastFailure: "Hace 2 días" },
  { task: "Desinfección de tablas de corte", area: "Ensalada", count: 2, lastFailure: "Hace 3 días" },
  { task: "Limpieza de campanas", area: "Pastas", count: 2, lastFailure: "Hace 4 días" },
];

function weeklyTaskKey(areaId: string, taskId: string): WeeklyTaskKey {
  return `${areaId}:${taskId}` as WeeklyTaskKey;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

function isCurrentWeek(dateValue: string, now = new Date()) {
  const date = new Date(dateValue);
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function weeklyTasksForAreas(areas: Area[]) {
  return [
    ...new Map(
      areas
        .flatMap((area) => area.tasks.filter((task) => task.frequency === "weekly").map((task) => ({ area, task })))
        .map((item) => [weeklyTaskKey(item.area.id, item.task.id), item]),
    ).values(),
  ];
}

function weeklyDoneKeys(records: CleaningRecord[]) {
  return new Set<WeeklyTaskKey>(
    records.flatMap((record) =>
      (record.taskResults ?? [])
        .filter((result) => result.status === "done")
        .map((result) => weeklyTaskKey(record.areaId, result.taskId)),
    ),
  );
}

function photoCount(record: CleaningRecord) {
  const taskPhotos = record.taskResults?.reduce((sum, result) => sum + (result.photoUrls?.length ?? 0), 0) ?? 0;
  return taskPhotos || record.photoUrls?.length || (record.photoUrl ? 1 : 0);
}

function notDoneCount(record: CleaningRecord) {
  const taskFailures = record.taskResults?.filter((result) => result.status === "not_done").length ?? 0;
  return taskFailures + (record.failedTaskReasons?.length ?? record.failedTaskIds?.length ?? 0);
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function AdminDashboard({
  records,
  areas,
  recordsAreas,
  taskManagerAreas,
  tasks,
  users,
  branches,
  selectedBranchId,
  currentUser,
  onBranchChange,
  onBranchesChange,
  onTasksChange,
  onUsersChange,
  onLogout,
}: AdminDashboardProps) {
  const { language, t } = useI18n();
  const [activeSection, setActiveSection] = useState<AdminSection>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(selectedBranchId);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const fallbackBranchId = branches[0]?.id ?? selectedBranchId;
  const recordBranchId = (record: CleaningRecord) => record.branchId ?? fallbackBranchId;
  const operationalAreas = areas.filter((area) => area.id !== "management");
  const managementArea = areas.find((area) => area.id === "management");
  const selectedBranchAreaIds = new Set(selectedBranch?.areaIds ?? []);
  const selectedBranchAreas = operationalAreas.filter((area) => selectedBranchAreaIds.has(area.id));
  const assignableAreas = managementArea ? [...selectedBranchAreas, managementArea] : selectedBranchAreas;
  const weekRecords = useMemo(() => records.filter((record) => isCurrentWeek(record.createdAt)), [records]);

  const branchSummaries = branches.map<BranchSummary>((branch) => {
    const branchAreaIds = new Set(branch.areaIds);
    const branchAreas = operationalAreas.filter((area) => branchAreaIds.has(area.id));
    const branchWeeklyTasks = weeklyTasksForAreas(branchAreas);
    const branchWeekRecords = weekRecords.filter((record) => recordBranchId(record) === branch.id);
    const branchWeeklyRecords = branchWeekRecords.filter((record) => record.recordType === "weekly");
    const doneKeys = weeklyDoneKeys(branchWeeklyRecords);
    const done = branchWeeklyTasks.filter(({ area, task }) => doneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    const total = branchWeeklyTasks.length;

    return {
      branch,
      rate: total ? Math.round((done / total) * 100) : 0,
      done,
      total,
      pending: Math.max(total - done, 0),
      notDone: branchWeekRecords.reduce((sum, record) => sum + notDoneCount(record), 0),
      photos: branchWeekRecords.reduce((sum, record) => sum + photoCount(record), 0),
      employees: users.filter((user) => (user.assignedBranchIds ?? []).includes(branch.id)).length,
    };
  });

  const selectedSummary = branchSummaries.find((item) => item.branch.id === selectedBranch?.id) ?? branchSummaries[0] ?? {
    branch: selectedBranch,
    rate: 0,
    done: 0,
    total: 0,
    pending: 0,
    notDone: 0,
    photos: 0,
    employees: 0,
  };
  const selectedWeekRecords = weekRecords.filter((record) => recordBranchId(record) === selectedBranch?.id);
  const selectedWeeklyRecords = selectedWeekRecords.filter((record) => record.recordType === "weekly");
  const areaStats = selectedBranchAreas.map((area) => {
    const areaWeeklyTasks = area.tasks.filter((task) => task.frequency === "weekly");
    const doneKeys = weeklyDoneKeys(selectedWeeklyRecords);
    const done = areaWeeklyTasks.filter((task) => doneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    const total = areaWeeklyTasks.length;

    return {
      area,
      done,
      total,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  });
  const trend = lastSevenDays().map((date, index) => {
    const dayRecords = records.filter((record) => sameDay(new Date(record.createdAt), date));
    if (!dayRecords.length) return fallbackTrend[index];
    const completed = dayRecords.filter((record) => record.status === "completed").length;
    return Math.round((completed / dayRecords.length) * 100);
  });
  const failureRows = buildFailureRows(records, areas, language, t);
  const activity = buildActivity(selectedWeeklyRecords, users, areas, t);

  const addBranch = () => {
    const name = newBranchName.trim();
    if (!name) return;
    const id = `branch-${slugify(name) || "sucursal"}-${Date.now().toString(36)}`;
    const nextBranch: Branch = {
      id,
      name,
      areaIds: operationalAreas.map((area) => area.id),
    };
    onBranchesChange([...branches, nextBranch]);
    onBranchChange(id);
    setBranchFilter(id);
    setNewBranchName("");
  };

  const deleteSelectedBranch = () => {
    if (!selectedBranch || branches.length <= 1) return;
    const nextBranches = branches.filter((branch) => branch.id !== selectedBranch.id);
    onBranchesChange(nextBranches);
    onBranchChange(nextBranches[0]?.id ?? "");
  };

  const toggleBranchArea = (areaId: string) => {
    if (!selectedBranch) return;
    const areaIds = new Set(selectedBranch.areaIds);
    if (areaIds.has(areaId)) {
      areaIds.delete(areaId);
    } else {
      areaIds.add(areaId);
    }
    onBranchesChange(branches.map((branch) => (branch.id === selectedBranch.id ? { ...branch, areaIds: [...areaIds] } : branch)));
  };

  const changeUserRole = (userId: string, role: UserRole) => {
    onUsersChange(
      users.map((user) => {
        if (user.id !== userId) return user;
        if (role === "admin") {
          return {
            ...user,
            role,
            assignedBranchIds: user.assignedBranchIds?.length ? user.assignedBranchIds : branches.map((branch) => branch.id),
            assignedSectorIds: [...new Set([...(user.assignedSectorIds ?? []), "management"])],
          };
        }
        return { ...user, role };
      }),
    );
  };

  const toggleUserBranch = (userId: string, branchId: string) => {
    onUsersChange(
      users.map((user) => {
        if (user.id !== userId) return user;
        const assignedBranchIds = new Set(user.assignedBranchIds ?? []);
        if (assignedBranchIds.has(branchId)) {
          assignedBranchIds.delete(branchId);
        } else {
          assignedBranchIds.add(branchId);
        }
        return { ...user, assignedBranchIds: [...assignedBranchIds] };
      }),
    );
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

  const filteredUsers = users.filter((user) => {
    const query = userSearch.trim().toLowerCase();
    const matchesSearch = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    const matchesBranch = branchFilter === "all" || (user.assignedBranchIds ?? []).includes(branchFilter);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesBranch && matchesRole;
  });

  const openSection = (section: AdminSection) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          <div className="brand-mark">
            <UtensilsCrossed size={23} />
          </div>
          <div>
            <strong>Tuscolo</strong>
            <span>{t("app.slogan")}</span>
          </div>
        </div>

        <nav className="admin-menu" aria-label={t("admin.menu.aria")}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={activeSection === item.id ? "active" : ""} type="button" onClick={() => openSection(item.id)} key={item.id}>
                <Icon size={18} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button type="button">
            <HelpCircle size={17} />
            {t("admin.menu.help")}
          </button>
          <span>{t("admin.menu.version")}</span>
        </div>
      </aside>

      {sidebarOpen ? <button className="admin-sidebar-scrim" type="button" aria-label={t("actions.cancel")} onClick={() => setSidebarOpen(false)} /> : null}

      <section className="admin-content">
        <header className="admin-content-header">
          <button className="admin-menu-toggle" type="button" onClick={() => setSidebarOpen(true)} aria-label={t("admin.menu.open")}>
            <Menu size={20} />
          </button>
          <div className="admin-title-block">
            <p>{t("admin.kicker")}</p>
            <h1>{t("admin.panelTitle")}</h1>
            <span>{t("admin.welcome")}, {currentUser.name}</span>
          </div>
          <div className="admin-header-actions">
            <LanguageSelector />
            <div className="admin-profile">
              <span>{currentUser.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{currentUser.name}</strong>
                <small>{t(`roles.${currentUser.role}`)}</small>
              </div>
            </div>
            <button className="admin-icon-button" type="button" onClick={onLogout} aria-label={t("auth.logout")}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeSection === "summary" ? (
          <DashboardSummary
            selectedSummary={selectedSummary}
            branchSummaries={branchSummaries}
            areaStats={areaStats}
            trend={trend}
            failureRows={failureRows.length ? failureRows : fallbackFailures}
            activity={activity}
            onBranchChange={onBranchChange}
            onOpenBranches={() => openSection("branches")}
          />
        ) : null}

        {activeSection === "branches" ? (
          <BranchesSection
            branchSummaries={branchSummaries}
            selectedBranchId={selectedBranch?.id ?? ""}
            newBranchName={newBranchName}
            onNewBranchNameChange={setNewBranchName}
            onAddBranch={addBranch}
            onDeleteBranch={deleteSelectedBranch}
            onBranchChange={onBranchChange}
          />
        ) : null}

        {activeSection === "areas" ? (
          <AreasSection
            branch={selectedBranch}
            areas={operationalAreas}
            areaStats={areaStats}
            selectedAreaIds={selectedBranchAreaIds}
            onToggleArea={toggleBranchArea}
          />
        ) : null}

        {activeSection === "tasks" ? <TaskManager areas={taskManagerAreas} tasks={tasks} onTasksChange={onTasksChange} /> : null}

        {activeSection === "records" ? (
          <RecordsView records={records} areas={recordsAreas} employees={users} branches={branches} selectedBranchId={selectedBranch?.id} onBranchChange={onBranchChange} />
        ) : null}

        {activeSection === "employees" || activeSection === "users" ? (
          <UsersSection
            users={filteredUsers}
            allUsers={users}
            branches={branches}
            selectedBranch={selectedBranch}
            assignableAreas={assignableAreas}
            currentUser={currentUser}
            search={userSearch}
            branchFilter={branchFilter}
            roleFilter={roleFilter}
            detailed={activeSection === "users"}
            onSearchChange={setUserSearch}
            onBranchFilterChange={setBranchFilter}
            onRoleFilterChange={setRoleFilter}
            onRoleChange={changeUserRole}
            onToggleBranch={toggleUserBranch}
            onToggleSector={toggleUserSector}
          />
        ) : null}

        {activeSection === "reports" ? <ReportsSection selectedBranch={selectedBranch} selectedSummary={selectedSummary} /> : null}
        {activeSection === "settings" ? <SettingsSection selectedBranch={selectedBranch} currentUser={currentUser} /> : null}
      </section>
    </div>
  );
}

function DashboardSummary({
  selectedSummary,
  branchSummaries,
  areaStats,
  trend,
  failureRows,
  activity,
  onBranchChange,
  onOpenBranches,
}: {
  selectedSummary: BranchSummary;
  branchSummaries: BranchSummary[];
  areaStats: Array<{ area: Area; done: number; total: number; rate: number }>;
  trend: number[];
  failureRows: FailureRow[];
  activity: ActivityItem[];
  onBranchChange: (branchId: string) => void;
  onOpenBranches: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="admin-section-stack">
      <div className="admin-kpi-grid">
        <KpiCard icon={TrendingUp} label={t("admin.kpi.weeklyRate")} value={`${selectedSummary.rate}%`} detail={selectedSummary.branch?.name ?? ""} />
        <KpiCard icon={ListChecks} label={t("admin.kpi.weeklyDone")} value={`${selectedSummary.done}/${selectedSummary.total}`} detail={t("weekly.done")} />
        <KpiCard icon={ClipboardList} label={t("admin.kpi.weeklyPending")} value={String(selectedSummary.pending)} detail={t("weekly.pending")} tone="warning" />
        <KpiCard icon={Camera} label={t("admin.kpi.weeklyPhotos")} value={String(selectedSummary.photos)} detail={t("records.photo")} />
        <KpiCard icon={Users} label={t("admin.kpi.branchEmployees")} value={String(selectedSummary.employees)} detail={t("admin.branchEmployees")} />
      </div>

      <BranchSummaryTable branchSummaries={branchSummaries} onBranchChange={onBranchChange} onOpenBranches={onOpenBranches} />

      <div className="admin-analytics-grid">
        <StatusDonut done={selectedSummary.done} pending={selectedSummary.pending} notDone={selectedSummary.notDone} />
        <LineChart values={trend} />
      </div>

      <div className="admin-dashboard-grid">
        <AreaCompliance areaStats={areaStats} />
        <FailuresTable rows={failureRows} />
      </div>

      <RecentActivity items={activity} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof TrendingUp; label: string; value: string; detail: string; tone?: "default" | "warning" }) {
  return (
    <article className={`admin-kpi-card ${tone}`}>
      <div>
        <Icon size={21} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function BranchSummaryTable({
  branchSummaries,
  onBranchChange,
  onOpenBranches,
}: {
  branchSummaries: BranchSummary[];
  onBranchChange: (branchId: string) => void;
  onOpenBranches?: () => void;
}) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.branchSelector")}</p>
          <h2>{t("admin.branchSummary")}</h2>
        </div>
        {onOpenBranches ? (
          <button className="admin-secondary-button" type="button" onClick={onOpenBranches}>
            <SlidersHorizontal size={17} />
            {t("admin.manageBranches")}
          </button>
        ) : null}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("fields.branch")}</th>
              <th>{t("admin.table.compliance")}</th>
              <th>{t("admin.table.completed")}</th>
              <th>{t("admin.table.pending")}</th>
              <th>{t("admin.table.photos")}</th>
              <th>{t("admin.table.employees")}</th>
              <th>{t("admin.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {branchSummaries.map((item) => (
              <tr key={item.branch.id}>
                <td>
                  <strong>{item.branch.name}</strong>
                </td>
                <td>
                  <div className="admin-progress-cell">
                    <div className="bar-track">
                      <div style={{ width: `${item.rate}%` }} />
                    </div>
                    <span>{item.rate}%</span>
                  </div>
                </td>
                <td>{item.done}</td>
                <td>{item.pending}</td>
                <td>{item.photos}</td>
                <td>{item.employees}</td>
                <td>
                  <button className="admin-link-button" type="button" onClick={() => onBranchChange(item.branch.id)}>
                    {t("admin.viewDetail")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function StatusDonut({ done, pending, notDone }: { done: number; pending: number; notDone: number }) {
  const { t } = useI18n();
  const total = Math.max(done + pending + notDone, 1);
  const doneRate = Math.round((done / total) * 100);
  const pendingRate = Math.round((pending / total) * 100);

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.chart.status")}</p>
          <h2>{t("admin.generalStatus")}</h2>
        </div>
      </div>
      <div className="admin-donut-row">
        <div
          className="admin-donut"
          style={{
            background: `conic-gradient(#6b744d 0 ${doneRate}%, #d8dcca ${doneRate}% ${doneRate + pendingRate}%, #a93f3f ${doneRate + pendingRate}% 100%)`,
          }}
        >
          <span>{doneRate}%</span>
        </div>
        <div className="chart-legend">
          <span><i className="success-dot" />{t("weekly.done")}: {done}</span>
          <span><i className="pending-dot" />{t("weekly.pending")}: {pending}</span>
          <span><i className="danger-dot" />{t("admin.notDone")}: {notDone}</span>
        </div>
      </div>
    </article>
  );
}

function LineChart({ values }: { values: number[] }) {
  const { t } = useI18n();
  const width = 640;
  const height = 190;
  const max = 100;
  const min = 0;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / (max - min)) * height;
    return `${x},${y}`;
  });

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("weekly.progress")}</p>
          <h2>{t("admin.weeklyLine")}</h2>
        </div>
      </div>
      <div className="line-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("admin.weeklyLine")}>
          <polyline className="line-chart-grid" points={`0,${height * 0.25} ${width},${height * 0.25}`} />
          <polyline className="line-chart-grid" points={`0,${height * 0.5} ${width},${height * 0.5}`} />
          <polyline className="line-chart-grid" points={`0,${height * 0.75} ${width},${height * 0.75}`} />
          <polyline className="line-chart-line" points={points.join(" ")} />
          {values.map((value, index) => {
            const [x, y] = points[index].split(",").map(Number);
            return <circle className="line-chart-dot" cx={x} cy={y} r="5" key={`${value}-${index}`} />;
          })}
        </svg>
        <div className="line-chart-labels">
          {values.map((value, index) => (
            <span key={`${value}-${index}`}>{value}%</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function AreaCompliance({ areaStats }: { areaStats: Array<{ area: Area; done: number; total: number; rate: number }> }) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.chart.weeklyAreas")}</p>
          <h2>{t("admin.areaCompliance")}</h2>
        </div>
      </div>
      <div className="admin-bar-list">
        {areaStats.length ? (
          areaStats.map((item) => (
            <div className="admin-bar-row" key={item.area.id}>
              <span>{t(item.area.nameKey)}</span>
              <div className="bar-track">
                <div style={{ width: `${item.rate}%` }} />
              </div>
              <strong>{item.rate}%</strong>
            </div>
          ))
        ) : (
          <p className="empty-state">{t("admin.noBranchAreas")}</p>
        )}
      </div>
    </article>
  );
}

function FailuresTable({ rows }: { rows: FailureRow[] }) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("states.incomplete")}</p>
          <h2>{t("admin.topFailures")}</h2>
        </div>
      </div>
      <div className="admin-table-wrap compact">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("fields.task")}</th>
              <th>{t("fields.area")}</th>
              <th>{t("admin.table.failures")}</th>
              <th>{t("admin.table.lastFailure")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.task}-${row.area}`}>
                <td>{row.task}</td>
                <td>{row.area}</td>
                <td>{row.count}</td>
                <td>{row.lastFailure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function RecentActivity({ items }: { items: ActivityItem[] }) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.activity")}</p>
          <h2>{t("admin.recentActivity")}</h2>
        </div>
      </div>
      <div className="activity-list">
        {items.map((item) => (
          <div className={`activity-item ${item.tone}`} key={item.id}>
            <span />
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function BranchesSection({
  branchSummaries,
  selectedBranchId,
  newBranchName,
  onNewBranchNameChange,
  onAddBranch,
  onDeleteBranch,
  onBranchChange,
}: {
  branchSummaries: BranchSummary[];
  selectedBranchId: string;
  newBranchName: string;
  onNewBranchNameChange: (value: string) => void;
  onAddBranch: () => void;
  onDeleteBranch: () => void;
  onBranchChange: (branchId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="admin-section-stack">
      <BranchSummaryTable branchSummaries={branchSummaries} onBranchChange={onBranchChange} />
      <article className="admin-card">
        <div className="admin-card-header">
          <div>
            <p>{t("fields.branches")}</p>
            <h2>{t("admin.manageBranches")}</h2>
          </div>
        </div>
        <div className="admin-form-grid">
          <label className="field">
            <span>{t("fields.branch")}</span>
            <select value={selectedBranchId} onChange={(event) => onBranchChange(event.target.value)}>
              {branchSummaries.map((item) => (
                <option key={item.branch.id} value={item.branch.id}>
                  {item.branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("admin.newBranch")}</span>
            <input value={newBranchName} onChange={(event) => onNewBranchNameChange(event.target.value)} placeholder={t("admin.newBranchPlaceholder")} />
          </label>
          <button className="primary-action" type="button" onClick={onAddBranch}>
            <Plus size={18} />
            {t("actions.add")}
          </button>
          <button className="secondary-action danger-action" type="button" onClick={onDeleteBranch} disabled={branchSummaries.length <= 1}>
            <Trash2 size={18} />
            {t("admin.deleteBranch")}
          </button>
        </div>
      </article>
    </div>
  );
}

function AreasSection({
  branch,
  areas,
  areaStats,
  selectedAreaIds,
  onToggleArea,
}: {
  branch?: Branch;
  areas: Area[];
  areaStats: Array<{ area: Area; done: number; total: number; rate: number }>;
  selectedAreaIds: Set<string>;
  onToggleArea: (areaId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="admin-dashboard-grid">
      <AreaCompliance areaStats={areaStats} />
      <article className="admin-card">
        <div className="admin-card-header">
          <div>
            <p>{branch?.name ?? t("common.noValue")}</p>
            <h2>{t("admin.branchAreas")}</h2>
          </div>
        </div>
        <div className="branch-area-grid clean-grid">
          {areas.map((area) => (
            <label key={area.id}>
              <input type="checkbox" checked={selectedAreaIds.has(area.id)} onChange={() => onToggleArea(area.id)} />
              <span>{t(area.nameKey)}</span>
            </label>
          ))}
        </div>
      </article>
    </div>
  );
}

function UsersSection({
  users,
  allUsers,
  branches,
  selectedBranch,
  assignableAreas,
  currentUser,
  search,
  branchFilter,
  roleFilter,
  detailed,
  onSearchChange,
  onBranchFilterChange,
  onRoleFilterChange,
  onRoleChange,
  onToggleBranch,
  onToggleSector,
}: {
  users: AppUser[];
  allUsers: AppUser[];
  branches: Branch[];
  selectedBranch?: Branch;
  assignableAreas: Area[];
  currentUser: AppUser;
  search: string;
  branchFilter: string;
  roleFilter: RoleFilter;
  detailed: boolean;
  onSearchChange: (value: string) => void;
  onBranchFilterChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onRoleChange: (userId: string, role: UserRole) => void;
  onToggleBranch: (userId: string, branchId: string) => void;
  onToggleSector: (userId: string, sectorId: string) => void;
}) {
  const { t } = useI18n();
  const branchName = (branchId: string) => branches.find((branch) => branch.id === branchId)?.name ?? branchId;

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{detailed ? t("admin.users.kicker") : t("admin.menu.employees")}</p>
          <h2>{detailed ? t("admin.users.title") : t("admin.employeesTitle")}</h2>
        </div>
        <button className="primary-action compact-action" type="button">
          <UserPlus size={18} />
          {t("admin.users.add")}
        </button>
      </div>

      <div className="admin-user-toolbar">
        <label className="field search-field">
          <span>{t("fields.search")}</span>
          <div>
            <Search size={18} />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={t("admin.users.searchPlaceholder")} />
          </div>
        </label>
        <label className="field">
          <span>{t("admin.filterBranch")}</span>
          <select value={branchFilter} onChange={(event) => onBranchFilterChange(event.target.value)}>
            <option value="all">{t("admin.allBranches")}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("admin.filterRole")}</span>
          <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as RoleFilter)}>
            <option value="all">{t("admin.allRoles")}</option>
            <option value="employee">{t("roles.employee")}</option>
            <option value="admin">{t("roles.admin")}</option>
          </select>
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table users-table">
          <thead>
            <tr>
              <th>{t("fields.employee")}</th>
              <th>{t("fields.email")}</th>
              <th>{t("fields.branch")}</th>
              <th>{t("fields.role")}</th>
              <th>{t("admin.table.status")}</th>
              <th>{t("admin.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isCurrentUser = user.id === currentUser.id;
              const inSelectedBranch = Boolean(selectedBranch && (user.assignedBranchIds ?? []).includes(selectedBranch.id));
              return (
                <Fragment key={user.id}>
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.assignedBranchIds?.length ? user.assignedBranchIds.map(branchName).join(", ") : t("common.noValue")}</td>
                    <td>
                      <select value={user.role} onChange={(event) => onRoleChange(user.id, event.target.value as UserRole)} disabled={isCurrentUser}>
                        <option value="employee">{t("roles.employee")}</option>
                        <option value="admin">{t("roles.admin")}</option>
                      </select>
                    </td>
                    <td>
                      <span className="status-pill active">{t("admin.active")}</span>
                    </td>
                    <td>
                      {selectedBranch ? (
                        <button className="admin-link-button" type="button" onClick={() => onToggleBranch(user.id, selectedBranch.id)} disabled={isCurrentUser}>
                          {inSelectedBranch ? t("admin.users.removeBranch") : t("admin.users.addBranch")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {detailed ? (
                    <tr className="user-sector-row" key={`${user.id}-sectors`}>
                      <td colSpan={6}>
                        <div className="sector-checkboxes">
                          {assignableAreas.map((area) => {
                            const disabled = (!inSelectedBranch && area.id !== "management") || (isCurrentUser && area.id === "management");
                            return (
                              <label className={disabled ? "disabled-option" : ""} key={`${user.id}-${area.id}`}>
                                <input
                                  type="checkbox"
                                  checked={(user.assignedSectorIds ?? []).includes(area.id)}
                                  onChange={() => onToggleSector(user.id, area.id)}
                                  disabled={disabled}
                                />
                                <span>{t(area.nameKey)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!users.length ? <p className="empty-state">{t("admin.users.empty")}</p> : null}
      </div>

      <div className="admin-summary-row">
        <span>{t("admin.summary.admins")}: {allUsers.filter((user) => user.role === "admin").length}</span>
        <span>{t("admin.summary.employees")}: {allUsers.filter((user) => user.role === "employee").length}</span>
      </div>
    </article>
  );
}

function ReportsSection({ selectedBranch, selectedSummary }: { selectedBranch?: Branch; selectedSummary: BranchSummary }) {
  const { t } = useI18n();

  return (
    <article className="admin-card report-card">
      <div className="admin-card-header">
        <div>
          <p>{selectedBranch?.name ?? t("common.noValue")}</p>
          <h2>{t("admin.menu.reports")}</h2>
        </div>
      </div>
      <div className="report-metric-row">
        <KpiCard icon={TrendingUp} label={t("admin.kpi.weeklyRate")} value={`${selectedSummary.rate}%`} detail={t("weekly.progress")} />
        <KpiCard icon={ClipboardList} label={t("admin.kpi.weeklyDone")} value={`${selectedSummary.done}/${selectedSummary.total}`} detail={t("weekly.done")} />
      </div>
      <button className="primary-action compact-action" type="button" onClick={() => window.print()}>
        {t("actions.print")}
      </button>
    </article>
  );
}

function SettingsSection({ selectedBranch, currentUser }: { selectedBranch?: Branch; currentUser: AppUser }) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.menu.settings")}</p>
          <h2>{t("admin.settingsTitle")}</h2>
        </div>
      </div>
      <div className="settings-list">
        <span>{t("fields.branch")}: <strong>{selectedBranch?.name ?? t("common.noValue")}</strong></span>
        <span>{t("fields.employee")}: <strong>{currentUser.name}</strong></span>
        <span>{t("fields.role")}: <strong>{t(`roles.${currentUser.role}`)}</strong></span>
      </div>
    </article>
  );
}

function buildFailureRows(records: CleaningRecord[], areas: Area[], language: Language, t: (key: string) => string): FailureRow[] {
  const rows = new Map<string, FailureRow>();

  for (const record of records) {
    const area = areas.find((candidate) => candidate.id === record.areaId);
    const failures = [
      ...(record.failedTaskReasons?.map((item) => item.label) ?? []),
      ...(record.failedTaskLabels ?? []),
      ...(record.taskResults?.filter((result) => result.status === "not_done").map((result) => result.label) ?? []),
    ];

    for (const label of failures) {
      const task = translateTaskQuestion(label, language);
      const areaLabel = area ? t(area.nameKey) : record.areaId;
      const key = `${record.areaId}:${task}`;
      const previous = rows.get(key);
      rows.set(key, {
        task,
        area: areaLabel,
        count: (previous?.count ?? 0) + 1,
        lastFailure: new Date(record.createdAt).toLocaleDateString(),
      });
    }
  }

  return [...rows.values()].sort((left, right) => right.count - left.count).slice(0, 5);
}

function buildActivity(records: CleaningRecord[], users: AppUser[], areas: Area[], t: (key: string) => string): ActivityItem[] {
  if (!records.length) {
    return [
      { id: "mock-1", text: "Pasta Küche completó su semanal", tone: "success" },
      { id: "mock-2", text: "Bar tiene tareas pendientes", tone: "warning" },
      { id: "mock-3", text: "Nueva foto subida en Pizza", tone: "neutral" },
      { id: "mock-4", text: "Lavado semanal completado", tone: "success" },
    ];
  }

  return records.slice(0, 6).map((record) => {
    const user = users.find((candidate) => candidate.id === record.employeeId);
    const area = areas.find((candidate) => candidate.id === record.areaId);
    const areaName = area ? t(area.nameKey) : record.areaId;
    const photos = photoCount(record);
    return {
      id: record.id,
      text: photos ? `${areaName}: ${t("records.photo")} ${photos} - ${user?.name ?? record.employeeId}` : `${areaName}: ${t("weekly.done")} - ${user?.name ?? record.employeeId}`,
      tone: record.status === "completed" ? "success" : "warning",
    };
  });
}
