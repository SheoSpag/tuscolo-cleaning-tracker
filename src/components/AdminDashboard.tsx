import {
  Building2,
  Camera,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sun,
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

type AdminSection = "summary" | "branches" | "tasks" | "records" | "employees" | "users";
type BranchScope = "all" | string;
type RoleFilter = "all" | UserRole;
type Theme = "light" | "dark";
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
  onCreateUser: (input: {
    name: string;
    email: string;
    password: string;
    language: Language;
    role: UserRole;
    assignedSectorIds?: string[];
    assignedBranchIds?: string[];
  }) => Promise<boolean>;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
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
  time: string;
  tone: "success" | "warning" | "neutral";
};

const menuItems: Array<{ id: AdminSection; icon: typeof LayoutDashboard; labelKey: string }> = [
  { id: "summary", icon: LayoutDashboard, labelKey: "admin.menu.summary" },
  { id: "branches", icon: Building2, labelKey: "admin.menu.branches" },
  { id: "tasks", icon: ListChecks, labelKey: "admin.menu.tasks" },
  { id: "records", icon: ClipboardList, labelKey: "admin.menu.records" },
  { id: "employees", icon: Users, labelKey: "admin.menu.employees" },
  { id: "users", icon: ShieldCheck, labelKey: "admin.menu.usersRoles" },
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

function completedWeekRanges(count = 4) {
  const currentStart = startOfWeek(new Date());
  return Array.from({ length: count }, (_, index) => {
    const end = new Date(currentStart);
    end.setDate(currentStart.getDate() - index * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    return { start, end };
  });
}

function isRecordInRange(record: CleaningRecord, start: Date, end: Date) {
  const date = new Date(record.createdAt);
  return date >= start && date < end;
}

function missedWeeklyTasksForCompletedWeeks(branch: Branch, branchAreas: Area[], records: CleaningRecord[], recordBranchId: (record: CleaningRecord) => string) {
  const weeklyTasks = weeklyTasksForAreas(branchAreas);
  if (!weeklyTasks.length) return 0;

  return completedWeekRanges().reduce((missed, range) => {
    const branchWeekRecords = records.filter((record) => recordBranchId(record) === branch.id && isRecordInRange(record, range.start, range.end));
    if (!branchWeekRecords.length) return missed;
    const doneKeys = weeklyDoneKeys(branchWeekRecords.filter((record) => record.recordType === "weekly"));
    const done = weeklyTasks.filter(({ area, task }) => doneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    return missed + Math.max(weeklyTasks.length - done, 0);
  }, 0);
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
  onCreateUser,
  theme,
  onThemeChange,
  onLogout,
}: AdminDashboardProps) {
  const { language, t } = useI18n();
  const [activeSection, setActiveSection] = useState<AdminSection>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [branchScope, setBranchScope] = useState<BranchScope>("all");
  const [newBranchName, setNewBranchName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(selectedBranchId);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [helpOpen, setHelpOpen] = useState(false);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const fallbackBranchId = branches[0]?.id ?? selectedBranchId;
  const recordBranchId = (record: CleaningRecord) => record.branchId ?? fallbackBranchId;
  const operationalAreas = areas.filter((area) => area.id !== "management");
  const managementArea = areas.find((area) => area.id === "management");
  const selectedBranchAreaIds = new Set(selectedBranch?.areaIds ?? []);
  const globalCustomAreaIds = new Set(branches.flatMap((branch) => (branch.customAreas ?? []).map((area) => area.id)));
  const standardOperationalAreas = operationalAreas.filter((area) => !globalCustomAreaIds.has(area.id));
  const selectedCustomAreaIds = new Set((selectedBranch?.customAreas ?? []).map((area) => area.id));
  const selectedCustomAreas = (selectedBranch?.customAreas ?? []).map((area) => ({
    id: area.id,
    nameKey: area.name,
    tasks: tasks.filter((task) => task.areaId === area.id),
  }));
  const branchManageAreas = [...standardOperationalAreas, ...selectedCustomAreas];
  const scopedBranches = branchScope === "all" ? branches : branches.filter((branch) => branch.id === branchScope);
  const scopedBranchIds = new Set(scopedBranches.map((branch) => branch.id));
  const selectedBranchAreas = operationalAreas.filter((area) => selectedBranchAreaIds.has(area.id));
  const assignableAreas = managementArea ? [...selectedBranchAreas, managementArea] : selectedBranchAreas;
  const weekRecords = useMemo(() => records.filter((record) => isCurrentWeek(record.createdAt)), [records]);
  const scopedWeekRecords = weekRecords.filter((record) => scopedBranchIds.has(recordBranchId(record)));
  const scopedRecords = branchScope === "all" ? records : records.filter((record) => scopedBranchIds.has(recordBranchId(record)));

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
      notDone: missedWeeklyTasksForCompletedWeeks(branch, branchAreas, records, recordBranchId),
      photos: branchWeekRecords.reduce((sum, record) => sum + photoCount(record), 0),
      employees: users.filter((user) => (user.assignedBranchIds ?? []).includes(branch.id)).length,
    };
  });

  const selectedSummary = branchScope === "all" ? {
    branch: {
      id: "all",
      name: t("admin.allBranches"),
      areaIds: operationalAreas.map((area) => area.id),
    },
    rate: branchSummaries.reduce((sum, item) => sum + item.total, 0)
      ? Math.round((branchSummaries.reduce((sum, item) => sum + item.done, 0) / branchSummaries.reduce((sum, item) => sum + item.total, 0)) * 100)
      : 0,
    done: branchSummaries.reduce((sum, item) => sum + item.done, 0),
    total: branchSummaries.reduce((sum, item) => sum + item.total, 0),
    pending: branchSummaries.reduce((sum, item) => sum + item.pending, 0),
    notDone: branchSummaries.reduce((sum, item) => sum + item.notDone, 0),
    photos: branchSummaries.reduce((sum, item) => sum + item.photos, 0),
    employees: users.length,
  } : branchSummaries.find((item) => item.branch.id === branchScope) ?? branchSummaries[0] ?? {
    branch: selectedBranch,
    rate: 0,
    done: 0,
    total: 0,
    pending: 0,
    notDone: 0,
    photos: 0,
    employees: 0,
  };
  const scopedWeeklyRecords = scopedWeekRecords.filter((record) => record.recordType === "weekly");
  const areaStats = operationalAreas.map((area) => {
    const areaWeeklyTasks = area.tasks.filter((task) => task.frequency === "weekly");
    const total = scopedBranches.reduce((sum, branch) => sum + (branch.areaIds.includes(area.id) ? areaWeeklyTasks.length : 0), 0);
    const done = scopedBranches.reduce((sum, branch) => {
      if (!branch.areaIds.includes(area.id)) return sum;
      const branchAreaRecords = scopedWeeklyRecords.filter((record) => recordBranchId(record) === branch.id && record.areaId === area.id);
      const doneKeys = weeklyDoneKeys(branchAreaRecords);
      return sum + areaWeeklyTasks.filter((task) => doneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    }, 0);

    return {
      area,
      done,
      total,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  }).filter((item) => item.total > 0 || branchScope !== "all" && selectedBranchAreaIds.has(item.area.id));
  const trend = lastSevenDays().map((date, index) => {
    const dayRecords = scopedRecords.filter((record) => sameDay(new Date(record.createdAt), date));
    if (!dayRecords.length) return fallbackTrend[index];
    const completed = dayRecords.filter((record) => record.status === "completed").length;
    return Math.round((completed / dayRecords.length) * 100);
  });
  const failureRows = buildFailureRows(scopedRecords, areas, language, t);
  const activity = buildActivity(scopedWeeklyRecords, users, areas, language, t);

  const addBranch = () => {
    const name = newBranchName.trim();
    if (!name) return;
    const id = `branch-${slugify(name) || "sucursal"}-${Date.now().toString(36)}`;
    const nextBranch: Branch = {
      id,
      name,
      areaIds: standardOperationalAreas.map((area) => area.id),
    };
    onBranchesChange([...branches, nextBranch]);
    onBranchChange(id);
    setBranchFilter(id);
    setNewBranchName("");
  };

  const deleteSelectedBranch = () => {
    if (!selectedBranch || branches.length <= 1) return;
    const removedCustomAreaIds = new Set((selectedBranch.customAreas ?? []).map((area) => area.id));
    const nextBranches = branches.filter((branch) => branch.id !== selectedBranch.id);
    const remainingCustomAreaIds = new Set(nextBranches.flatMap((branch) => (branch.customAreas ?? []).map((area) => area.id)));
    const orphanedCustomAreaIds = [...removedCustomAreaIds].filter((areaId) => !remainingCustomAreaIds.has(areaId));
    onBranchesChange(nextBranches);
    if (orphanedCustomAreaIds.length) {
      onTasksChange(tasks.filter((task) => !orphanedCustomAreaIds.includes(task.areaId)));
    }
    onBranchChange(nextBranches[0]?.id ?? "");
    if (branchScope === selectedBranch.id) {
      setBranchScope(nextBranches[0]?.id ?? "all");
      setBranchFilter(nextBranches[0]?.id ?? "all");
    }
  };

  const resetAreaEditor = () => {
    setNewAreaName("");
    setEditingAreaId(null);
    setEditingAreaName("");
  };

  const selectBranchForEditing = (branchId: string) => {
    resetAreaEditor();
    onBranchChange(branchId);
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

  const addCustomArea = () => {
    const name = newAreaName.trim();
    if (!selectedBranch || !name) return;
    const id = `custom-${selectedBranch.id}-${slugify(name) || "area"}-${Date.now().toString(36)}`;
    const nextArea = { id, name };
    onBranchesChange(
      branches.map((branch) =>
        branch.id === selectedBranch.id
          ? {
              ...branch,
              customAreas: [...(branch.customAreas ?? []), nextArea],
              areaIds: [...new Set([...branch.areaIds, id])],
            }
          : branch,
      ),
    );
    setNewAreaName("");
  };

  const startEditArea = (areaId: string, areaName: string) => {
    if (!selectedCustomAreaIds.has(areaId)) return;
    setEditingAreaId(areaId);
    setEditingAreaName(areaName);
  };

  const saveAreaEdit = () => {
    const name = editingAreaName.trim();
    if (!selectedBranch || !editingAreaId || !name) return;
    onBranchesChange(
      branches.map((branch) =>
        branch.id === selectedBranch.id
          ? {
              ...branch,
              customAreas: (branch.customAreas ?? []).map((area) => (area.id === editingAreaId ? { ...area, name } : area)),
            }
          : branch,
      ),
    );
    setEditingAreaId(null);
    setEditingAreaName("");
  };

  const deleteBranchArea = (areaId: string) => {
    if (!selectedBranch) return;
    if (!selectedCustomAreaIds.has(areaId)) {
      onBranchesChange(
        branches.map((branch) =>
          branch.id === selectedBranch.id
            ? {
                ...branch,
                areaIds: branch.areaIds.filter((currentAreaId) => currentAreaId !== areaId),
              }
            : branch,
        ),
      );
      return;
    }

    onBranchesChange(
      branches.map((branch) =>
        branch.id === selectedBranch.id
          ? {
              ...branch,
              customAreas: (branch.customAreas ?? []).filter((area) => area.id !== areaId),
              areaIds: branch.areaIds.filter((currentAreaId) => currentAreaId !== areaId),
            }
          : branch,
      ),
    );
    onTasksChange(tasks.filter((task) => task.areaId !== areaId));
    if (editingAreaId === areaId) {
      setEditingAreaId(null);
      setEditingAreaName("");
    }
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
  const scopedBranch = branchScope === "all" ? undefined : branches.find((branch) => branch.id === branchScope) ?? selectedBranch;

  const openSection = (section: AdminSection) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const handleBranchScopeChange = (value: BranchScope) => {
    setBranchScope(value);
    setBranchFilter(value);
    if (value !== "all") {
      onBranchChange(value);
    }
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
          <button className="admin-sidebar-logout" type="button" onClick={onLogout}>
            <LogOut size={17} />
            {t("auth.logout")}
          </button>
          <button type="button" onClick={() => setHelpOpen(true)}>
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
            <p>{t("app.title")}</p>
            <h1>{t("admin.panelTitle")}</h1>
            <span>{t("admin.welcome")}, {currentUser.name}</span>
          </div>
          <div className="admin-header-actions">
            <label className="admin-branch-scope">
              <span><MapPin size={16} />{t("fields.branch")}</span>
              <select value={branchScope} onChange={(event) => handleBranchScopeChange(event.target.value)}>
                <option value="all">{t("admin.allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <LanguageSelector />
            <button className="admin-theme-toggle" type="button" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </button>
            <div className="admin-profile">
              <span>{currentUser.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{currentUser.name}</strong>
                <small>{t(`roles.${currentUser.role}`)}</small>
              </div>
            </div>
          </div>
        </header>

        {activeSection === "summary" ? (
          <DashboardSummary
            selectedSummary={selectedSummary}
            areaStats={areaStats}
            trend={trend}
            failureRows={failureRows.length ? failureRows : fallbackFailures}
            activity={activity}
          />
        ) : null}

        {activeSection === "branches" ? (
          <BranchesSection
            users={users}
            branchSummaries={branchSummaries}
            selectedBranchId={selectedBranch?.id ?? ""}
            selectedBranch={selectedBranch}
            areas={branchManageAreas}
            selectedAreaIds={selectedBranchAreaIds}
            customAreaIds={selectedCustomAreaIds}
            newBranchName={newBranchName}
            newAreaName={newAreaName}
            editingAreaId={editingAreaId}
            editingAreaName={editingAreaName}
            onNewBranchNameChange={setNewBranchName}
            onNewAreaNameChange={setNewAreaName}
            onEditingAreaNameChange={setEditingAreaName}
            onAddBranch={addBranch}
            onDeleteBranch={deleteSelectedBranch}
            onBranchChange={selectBranchForEditing}
            onToggleArea={toggleBranchArea}
            onAddArea={addCustomArea}
            onStartEditArea={startEditArea}
            onSaveAreaEdit={saveAreaEdit}
            onCancelAreaEdit={() => {
              setEditingAreaId(null);
              setEditingAreaName("");
            }}
            onDeleteArea={deleteBranchArea}
          />
        ) : null}

        {activeSection === "tasks" ? <TaskManager areas={taskManagerAreas} tasks={tasks} onTasksChange={onTasksChange} /> : null}

        {activeSection === "records" ? (
          <RecordsView records={records} areas={recordsAreas} employees={users} branches={branches} selectedBranchId={branchScope === "all" ? undefined : scopedBranch?.id} onBranchChange={handleBranchScopeChange} />
        ) : null}

        {activeSection === "employees" || activeSection === "users" ? (
          <UsersSection
            users={filteredUsers}
            allUsers={users}
            branches={branches}
            selectedBranch={scopedBranch}
            assignableAreas={branchScope === "all" ? [] : assignableAreas}
            currentUser={currentUser}
            search={userSearch}
            branchFilter={branchFilter}
            roleFilter={roleFilter}
            detailed={activeSection === "users"}
            records={scopedRecords}
            onSearchChange={setUserSearch}
            onBranchFilterChange={setBranchFilter}
            onRoleFilterChange={setRoleFilter}
            onRoleChange={changeUserRole}
            onToggleBranch={toggleUserBranch}
            onToggleSector={toggleUserSector}
            onCreateUser={onCreateUser}
          />
        ) : null}
        {helpOpen ? <AdminHelpModal onClose={() => setHelpOpen(false)} /> : null}
      </section>
    </div>
  );
}

function AdminHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-help-title">
      <div className="admin-dialog">
        <div className="admin-dialog-header">
          <div>
            <p>{t("admin.menu.help")}</p>
            <h3 id="admin-help-title">{t("admin.help.title")}</h3>
          </div>
          <button className="icon-action" type="button" onClick={onClose} aria-label={t("actions.cancel")}>
            <X size={18} />
          </button>
        </div>
        <div className="admin-help-list">
          <p>{t("admin.help.summary")}</p>
          <span>{t("admin.help.branch")}</span>
          <span>{t("admin.help.tasks")}</span>
          <span>{t("admin.help.users")}</span>
        </div>
      </div>
    </div>
  );
}

function DashboardSummary({
  selectedSummary,
  areaStats,
  trend,
  failureRows,
  activity,
}: {
  selectedSummary: BranchSummary;
  areaStats: Array<{ area: Area; done: number; total: number; rate: number }>;
  trend: number[];
  failureRows: FailureRow[];
  activity: ActivityItem[];
}) {
  const { t } = useI18n();

  return (
    <div className="admin-section-stack">
      <MobileAdminPulse selectedSummary={selectedSummary} failureRows={failureRows} activity={activity} />
      <div className="admin-kpi-grid">
        <KpiCard icon={TrendingUp} label={t("admin.kpi.weeklyRate")} value={`${selectedSummary.rate}%`} detail={selectedSummary.branch?.name ?? ""} />
        <KpiCard icon={ListChecks} label={t("admin.kpi.weeklyDone")} value={`${selectedSummary.done}/${selectedSummary.total}`} detail={t("weekly.done")} />
        <KpiCard icon={ClipboardList} label={t("admin.kpi.weeklyPending")} value={String(selectedSummary.pending)} detail={t("weekly.pending")} tone="warning" />
        <KpiCard icon={Camera} label={t("admin.kpi.weeklyPhotos")} value={String(selectedSummary.photos)} detail={t("records.photo")} />
        <KpiCard icon={Users} label={t("admin.kpi.branchEmployees")} value={String(selectedSummary.employees)} detail={t("admin.branchEmployees")} />
      </div>
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

function MobileAdminPulse({
  selectedSummary,
  failureRows,
  activity,
}: {
  selectedSummary: BranchSummary;
  failureRows: FailureRow[];
  activity: ActivityItem[];
}) {
  const { t } = useI18n();
  const mainRisk = failureRows[0];
  const lastActivity = activity[0];

  return (
    <article className="admin-mobile-pulse">
      <div>
        <p>{t("admin.mobilePulseTitle")}</p>
        <h2>{selectedSummary.rate}%</h2>
        <span>{selectedSummary.branch?.name ?? t("admin.allBranches")}</span>
      </div>
      <div className="admin-mobile-pulse-grid">
        <span>
          <strong>{selectedSummary.pending}</strong>
          {t("admin.mobilePulsePending")}
        </span>
        <span>
          <strong>{selectedSummary.photos}</strong>
          {t("admin.mobilePulsePhotos")}
        </span>
        <span>
          <strong>{mainRisk?.count ?? 0}</strong>
          {mainRisk ? `${t("admin.mobilePulseRisk")}: ${mainRisk.task}` : t("admin.mobilePulseRisk")}
        </span>
        <span>
          <strong>{lastActivity?.time ?? "-"}</strong>
          {lastActivity?.text ?? t("admin.mobilePulseLast")}
        </span>
      </div>
    </article>
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
  showHint = false,
}: {
  branchSummaries: BranchSummary[];
  onBranchChange: (branchId: string) => void;
  showHint?: boolean;
}) {
  const { t } = useI18n();

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{t("admin.branchSelector")}</p>
          <h2>{t("admin.branchSummary")}</h2>
        </div>
      </div>
      {showHint ? <p className="admin-card-note">{t("admin.allBranchesHint")}</p> : null}

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
            <span className="activity-icon">
              <ClipboardList size={16} />
            </span>
            <div>
              <p>{item.text}</p>
              <small>{item.time}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function BranchesSection({
  users,
  branchSummaries,
  selectedBranchId,
  selectedBranch,
  areas,
  selectedAreaIds,
  customAreaIds,
  newBranchName,
  newAreaName,
  editingAreaId,
  editingAreaName,
  onNewBranchNameChange,
  onNewAreaNameChange,
  onEditingAreaNameChange,
  onAddBranch,
  onDeleteBranch,
  onBranchChange,
  onToggleArea,
  onAddArea,
  onStartEditArea,
  onSaveAreaEdit,
  onCancelAreaEdit,
  onDeleteArea,
}: {
  users: AppUser[];
  branchSummaries: BranchSummary[];
  selectedBranchId: string;
  selectedBranch?: Branch;
  areas: Area[];
  selectedAreaIds: Set<string>;
  customAreaIds: Set<string>;
  newBranchName: string;
  newAreaName: string;
  editingAreaId: string | null;
  editingAreaName: string;
  onNewBranchNameChange: (value: string) => void;
  onNewAreaNameChange: (value: string) => void;
  onEditingAreaNameChange: (value: string) => void;
  onAddBranch: () => void;
  onDeleteBranch: () => void;
  onBranchChange: (branchId: string) => void;
  onToggleArea: (areaId: string) => void;
  onAddArea: () => void;
  onStartEditArea: (areaId: string, areaName: string) => void;
  onSaveAreaEdit: () => void;
  onCancelAreaEdit: () => void;
  onDeleteArea: (areaId: string) => void;
}) {
  const { t } = useI18n();
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);

  const handleAddBranch = () => {
    onAddBranch();
    if (newBranchName.trim()) {
      setBranchDialogOpen(false);
    }
  };

  const handleAddArea = () => {
    onAddArea();
    if (newAreaName.trim()) {
      setAreaDialogOpen(false);
    }
  };

  return (
    <div className="admin-section-stack">
      <BranchSummaryTable branchSummaries={branchSummaries} onBranchChange={onBranchChange} />
      <article className="admin-card branch-admin-card">
        <div className="admin-card-header">
          <div>
            <p>{t("fields.branches")}</p>
            <h2>{t("admin.manageBranches")}</h2>
          </div>
          <button className="primary-action compact-action" type="button" onClick={() => setBranchDialogOpen(true)}>
            <Plus size={18} />
            {t("admin.addBranch")}
          </button>
        </div>
        <div className="branch-selector-list">
          {branchSummaries.map((item) => (
            <button className={item.branch.id === selectedBranchId ? "active" : ""} type="button" onClick={() => onBranchChange(item.branch.id)} key={item.branch.id}>
              <strong>{item.branch.name}</strong>
              <span>{item.rate}% · {item.pending} {t("weekly.pending")}</span>
            </button>
          ))}
        </div>
        <div className="branch-admin-actions">
          <button className="secondary-action danger-action" type="button" onClick={() => setDeleteBranchOpen(true)} disabled={branchSummaries.length <= 1}>
            <Trash2 size={18} />
            {t("admin.deleteSelectedBranch")}
          </button>
        </div>
      </article>

      <article className="admin-card">
        <div className="admin-card-header">
          <div>
            <p>{selectedBranch?.name ?? t("common.noValue")}</p>
            <h2>{t("admin.branchAreas")}</h2>
          </div>
          <button className="primary-action compact-action" type="button" onClick={() => setAreaDialogOpen(true)}>
            <Plus size={18} />
            {t("admin.addArea")}
          </button>
        </div>
        <p className="admin-card-note">{t("admin.branchAreasHelp")}</p>

        <div className="branch-area-list">
          {areas.map((area) => {
            const isCustom = customAreaIds.has(area.id);
            const isActive = selectedAreaIds.has(area.id);
            const isEditing = editingAreaId === area.id;
            const assignedUsers = selectedBranch
              ? users.filter(
                  (user) =>
                    user.role === "employee" &&
                    (user.assignedBranchIds ?? []).includes(selectedBranch.id) &&
                    (user.assignedSectorIds ?? []).includes(area.id),
                )
              : [];
            return (
              <article className={`branch-area-card ${isActive ? "active" : ""}`} key={area.id}>
                <div className="branch-area-card-top">
                  <div className="branch-area-card-main">
                    {isEditing ? (
                      <input value={editingAreaName} onChange={(event) => onEditingAreaNameChange(event.target.value)} aria-label={t("admin.editAreaName")} />
                    ) : (
                      <strong>{t(area.nameKey)}</strong>
                    )}
                    <small>{isCustom ? t("admin.customArea") : t("admin.baseArea")}</small>
                  </div>
                  <button className="branch-area-toggle" type="button" aria-pressed={isActive} onClick={() => onToggleArea(area.id)}>
                    <span>{isActive ? t("admin.areaActive") : t("admin.areaInactive")}</span>
                  </button>
                </div>
                <div className="branch-area-people">
                  <span>
                    <Users size={15} />
                    {t("admin.assignedEmployees")} · {assignedUsers.length}
                  </span>
                  <div>
                    {assignedUsers.slice(0, 5).map((user) => (
                      <small className="branch-person-chip" key={`${area.id}-${user.id}`}>
                        {user.name}
                      </small>
                    ))}
                    {assignedUsers.length > 5 ? <small className="branch-person-chip muted-chip">+{assignedUsers.length - 5}</small> : null}
                    {!assignedUsers.length ? <small className="branch-person-empty">{t("admin.noAssignedEmployees")}</small> : null}
                  </div>
                </div>
                <div className="branch-area-card-actions">
                  {isCustom ? (
                    isEditing ? (
                      <>
                        <button className="icon-action" type="button" onClick={onSaveAreaEdit} aria-label={t("actions.save")}>
                          <Save size={17} />
                        </button>
                        <button className="icon-action" type="button" onClick={onCancelAreaEdit} aria-label={t("actions.cancel")}>
                          <X size={17} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="icon-action" type="button" onClick={() => onStartEditArea(area.id, t(area.nameKey))} aria-label={t("actions.edit")}>
                          <Pencil size={17} />
                        </button>
                        <button className="icon-action danger-icon" type="button" onClick={() => onDeleteArea(area.id)} aria-label={t("admin.deleteArea")}>
                          <Trash2 size={17} />
                        </button>
                      </>
                    )
                  ) : (
                    <button className="admin-link-button danger-link" type="button" onClick={() => onDeleteArea(area.id)} disabled={!isActive}>
                      <Trash2 size={16} />
                      {t("admin.removeAreaFromBranch")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!areas.length ? <p className="empty-state">{t("admin.noBranchAreas")}</p> : null}
        </div>
      </article>

      {branchDialogOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-branch-title">
          <div className="admin-dialog">
            <div className="admin-dialog-header">
              <div>
                <p>{t("fields.branches")}</p>
                <h3 id="new-branch-title">{t("admin.newBranch")}</h3>
              </div>
              <button className="icon-action" type="button" onClick={() => setBranchDialogOpen(false)} aria-label={t("actions.cancel")}>
                <X size={18} />
              </button>
            </div>
            <label className="field">
              <span>{t("admin.newBranch")}</span>
              <input value={newBranchName} onChange={(event) => onNewBranchNameChange(event.target.value)} placeholder={t("admin.newBranchPlaceholder")} />
            </label>
            <div className="confirm-actions">
              <button className="secondary-action" type="button" onClick={() => setBranchDialogOpen(false)}>
                {t("actions.cancel")}
              </button>
              <button className="primary-action" type="button" onClick={handleAddBranch}>
                <Plus size={18} />
                {t("actions.add")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {areaDialogOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-area-title">
          <div className="admin-dialog">
            <div className="admin-dialog-header">
              <div>
                <p>{selectedBranch?.name ?? t("common.noValue")}</p>
                <h3 id="new-area-title">{t("admin.newArea")}</h3>
              </div>
              <button className="icon-action" type="button" onClick={() => setAreaDialogOpen(false)} aria-label={t("actions.cancel")}>
                <X size={18} />
              </button>
            </div>
            <label className="field">
              <span>{t("admin.newArea")}</span>
              <input value={newAreaName} onChange={(event) => onNewAreaNameChange(event.target.value)} placeholder={t("admin.newAreaPlaceholder")} />
            </label>
            <div className="confirm-actions">
              <button className="secondary-action" type="button" onClick={() => setAreaDialogOpen(false)}>
                {t("actions.cancel")}
              </button>
              <button className="primary-action" type="button" onClick={handleAddArea}>
                <Plus size={18} />
                {t("admin.addArea")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteBranchOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-branch-title">
          <div className="admin-dialog">
            <div className="admin-dialog-header">
              <div>
                <p>{selectedBranch?.name ?? t("common.noValue")}</p>
                <h3 id="delete-branch-title">{t("admin.deleteSelectedBranch")}</h3>
              </div>
              <button className="icon-action" type="button" onClick={() => setDeleteBranchOpen(false)} aria-label={t("actions.cancel")}>
                <X size={18} />
              </button>
            </div>
            <p className="admin-card-note">{t("admin.deleteBranchHelp")}</p>
            <div className="confirm-actions">
              <button className="secondary-action" type="button" onClick={() => setDeleteBranchOpen(false)}>
                {t("actions.cancel")}
              </button>
              <button
                className="primary-action danger-action"
                type="button"
                onClick={() => {
                  onDeleteBranch();
                  setDeleteBranchOpen(false);
                }}
              >
                <Trash2 size={18} />
                {t("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserFilters({
  branches,
  search,
  branchFilter,
  roleFilter,
  onSearchChange,
  onBranchFilterChange,
  onRoleFilterChange,
}: {
  branches: Branch[];
  search: string;
  branchFilter: string;
  roleFilter: RoleFilter;
  onSearchChange: (value: string) => void;
  onBranchFilterChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
}) {
  const { t } = useI18n();

  return (
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
  records,
  onSearchChange,
  onBranchFilterChange,
  onRoleFilterChange,
  onRoleChange,
  onToggleBranch,
  onToggleSector,
  onCreateUser,
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
  records: CleaningRecord[];
  onSearchChange: (value: string) => void;
  onBranchFilterChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onRoleChange: (userId: string, role: UserRole) => void;
  onToggleBranch: (userId: string, branchId: string) => void;
  onToggleSector: (userId: string, sectorId: string) => void;
  onCreateUser: (input: {
    name: string;
    email: string;
    password: string;
    language: Language;
    role: UserRole;
    assignedSectorIds?: string[];
    assignedBranchIds?: string[];
  }) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const branchName = (branchId: string) => branches.find((branch) => branch.id === branchId)?.name ?? branchId;
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const usersWithPerformance = users
    .map((user) => {
      const userRecords = records.filter((record) => record.employeeId === user.id && isCurrentWeek(record.createdAt));
      const weeklyDone = userRecords.filter((record) => record.recordType === "weekly").length;
      const dailyDone = userRecords.filter((record) => (record.recordType ?? "daily") === "daily").length;
      const completed = userRecords.filter((record) => record.status === "completed").length;
      const score = weeklyDone * 3 + dailyDone * 2 + completed;
      return { user, weeklyDone, dailyDone, score };
    })
    .sort((left, right) => right.score - left.score || left.user.name.localeCompare(right.user.name));

  if (detailed) {
    return (
      <article className="admin-card role-management-panel">
        <div className="admin-card-header">
          <div>
            <p>{t("admin.users.kicker")}</p>
            <h2>{t("admin.users.title")}</h2>
          </div>
          <button className="primary-action compact-action" type="button" onClick={() => setCreateUserOpen(true)}>
            <UserPlus size={18} />
            {t("admin.users.add")}
          </button>
        </div>

        <UserFilters
          branches={branches}
          search={search}
          branchFilter={branchFilter}
          roleFilter={roleFilter}
          onSearchChange={onSearchChange}
          onBranchFilterChange={onBranchFilterChange}
          onRoleFilterChange={onRoleFilterChange}
        />

        <div className="role-card-grid">
          {usersWithPerformance.map(({ user, weeklyDone, dailyDone, score }) => {
            const isCurrentUser = user.id === currentUser.id;
            const inSelectedBranch = Boolean(selectedBranch && (user.assignedBranchIds ?? []).includes(selectedBranch.id));

            return (
              <article className="role-user-card" key={user.id}>
                <div className="role-user-card-header">
                  <div className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <span className="status-pill active">{t("admin.active")}</span>
                </div>

                <div className="employee-performance-row">
                  <span><strong>{score}</strong>{t("admin.performance.score")}</span>
                  <span><strong>{weeklyDone}</strong>{t("employeeHistory.weeklyDone")}</span>
                  <span><strong>{dailyDone}</strong>{t("employeeHistory.closedThisWeek")}</span>
                </div>

                <div className="role-toggle wide" aria-label={t("fields.role")}>
                  <button type="button" className={user.role === "employee" ? "active" : ""} onClick={() => onRoleChange(user.id, "employee")} disabled={isCurrentUser}>
                    {t("roles.employee")}
                  </button>
                  <button type="button" className={user.role === "admin" ? "active" : ""} onClick={() => onRoleChange(user.id, "admin")} disabled={isCurrentUser}>
                    {t("roles.admin")}
                  </button>
                </div>

                <div className="role-card-section">
                  <span>{t("fields.branch")}</span>
                  <div className="branch-chip-list">
                    {branches.map((branch) => {
                      const active = (user.assignedBranchIds ?? []).includes(branch.id);
                      return (
                        <button className={active ? "active" : ""} type="button" onClick={() => onToggleBranch(user.id, branch.id)} disabled={isCurrentUser} key={`${user.id}-${branch.id}`}>
                          {branch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="role-card-section">
                  <span>{t("fields.sectors")}</span>
                  {selectedBranch ? (
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
                  ) : (
                    <p className="admin-card-note">{t("admin.chooseBranchForRoles")}</p>
                  )}
                </div>
              </article>
            );
          })}
          {!users.length ? <p className="empty-state">{t("admin.users.empty")}</p> : null}
        </div>
        {createUserOpen ? (
          <CreateUserModal
            branches={branches}
            selectedBranch={selectedBranch}
            onClose={() => setCreateUserOpen(false)}
            onCreate={async (input) => {
              const ok = await onCreateUser(input);
              if (ok) setCreateUserOpen(false);
            }}
          />
        ) : null}
      </article>
    );
  }

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p>{detailed ? t("admin.users.kicker") : t("admin.menu.employees")}</p>
          <h2>{detailed ? t("admin.users.title") : t("admin.employeesTitle")}</h2>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setCreateUserOpen(true)}>
          <UserPlus size={18} />
          {t("admin.users.add")}
        </button>
      </div>

      <UserFilters
        branches={branches}
        search={search}
        branchFilter={branchFilter}
        roleFilter={roleFilter}
        onSearchChange={onSearchChange}
        onBranchFilterChange={onBranchFilterChange}
        onRoleFilterChange={onRoleFilterChange}
      />

      <div className="admin-table-wrap">
        <table className="admin-table users-table">
          <thead>
            <tr>
              <th>{t("fields.employee")}</th>
              <th>{t("fields.email")}</th>
              <th>{t("fields.branch")}</th>
              <th>{t("fields.role")}</th>
              <th>{t("admin.table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {usersWithPerformance.map(({ user, weeklyDone, dailyDone, score }) => {
              const isCurrentUser = user.id === currentUser.id;
              return (
                <Fragment key={user.id}>
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <small className="employee-score-line">{t("admin.performance.score")}: {score} · {t("employeeHistory.weeklyDone")}: {weeklyDone} · {t("employeeHistory.closedThisWeek")}: {dailyDone}</small>
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
                  </tr>
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
      {createUserOpen ? (
        <CreateUserModal
          branches={branches}
          selectedBranch={selectedBranch}
          onClose={() => setCreateUserOpen(false)}
          onCreate={async (input) => {
            const ok = await onCreateUser(input);
            if (ok) setCreateUserOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function CreateUserModal({
  branches,
  selectedBranch,
  onClose,
  onCreate,
}: {
  branches: Branch[];
  selectedBranch?: Branch;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    email: string;
    password: string;
    language: Language;
    role: UserRole;
    assignedSectorIds?: string[];
    assignedBranchIds?: string[];
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<Language>("es");
  const [role, setRole] = useState<UserRole>("employee");
  const [branchId, setBranchId] = useState(selectedBranch?.id ?? branches[0]?.id ?? "");
  const canSave = Boolean(name.trim() && email.trim() && password.length > 6);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <div className="admin-dialog">
        <div className="admin-dialog-header">
          <div>
            <p>{t("admin.users.kicker")}</p>
            <h3 id="create-user-title">{t("admin.users.add")}</h3>
          </div>
          <button className="icon-action" type="button" onClick={onClose} aria-label={t("actions.cancel")}>
            <X size={18} />
          </button>
        </div>
        <div className="admin-dialog-grid">
          <label className="field">
            <span>{t("fields.name")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("fields.email")}</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label className="field">
            <span>{t("fields.password")}</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <label className="field">
            <span>{t("fields.language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="it">Italiano</option>
            </select>
          </label>
          <label className="field">
            <span>{t("fields.role")}</span>
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="employee">{t("roles.employee")}</option>
              <option value="admin">{t("roles.admin")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("fields.branch")}</span>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="confirm-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            {t("actions.cancel")}
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!canSave}
            onClick={() =>
              onCreate({
                name,
                email,
                password,
                language,
                role,
                assignedBranchIds: branchId ? [branchId] : [],
                assignedSectorIds: role === "admin" ? ["management"] : [],
              })
            }
          >
            <UserPlus size={18} />
            {t("admin.users.add")}
          </button>
        </div>
      </div>
    </div>
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

function buildActivity(records: CleaningRecord[], users: AppUser[], areas: Area[], language: Language, t: (key: string) => string): ActivityItem[] {
  if (!records.length) {
    return [
      { id: "mock-1", text: "Pasta Küche completó su semanal", time: "Hace 2 horas", tone: "success" },
      { id: "mock-2", text: "Bar tiene tareas pendientes", time: "Hace 4 horas", tone: "warning" },
      { id: "mock-3", text: "Nueva foto subida en Pizza", time: "Hoy", tone: "neutral" },
      { id: "mock-4", text: "Lavado semanal completado", time: "Ayer", tone: "success" },
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
      time: formatActivityTime(record.createdAt, language),
      tone: record.status === "completed" ? "success" : "warning",
    };
  });
}

function formatActivityTime(createdAt: string, language: Language) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (diffMinutes < 60) {
    const value = `${diffMinutes} min`;
    return language === "de" ? `Vor ${value}` : language === "en" ? `${value} ago` : language === "it" ? `${value} fa` : `Hace ${value}`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    const value = language === "en" ? `${diffHours}h` : `${diffHours} h`;
    return language === "de" ? `Vor ${value}` : language === "en" ? `${value} ago` : language === "it" ? `${value} fa` : `Hace ${value}`;
  }
  const diffDays = Math.round(diffHours / 24);
  const value = language === "de" ? `${diffDays} T.` : language === "en" ? `${diffDays}d` : language === "it" ? `${diffDays} g` : `${diffDays} d`;
  return language === "de" ? `Vor ${value}` : language === "en" ? `${value} ago` : language === "it" ? `${value} fa` : `Hace ${value}`;
}
