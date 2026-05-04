import { Building2, Camera, ClipboardCheck, ListChecks, Plus, Search, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppUser, Area, Branch, CleaningRecord, UserRole } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type AdminDashboardProps = {
  records: CleaningRecord[];
  areas: Area[];
  users: AppUser[];
  branches: Branch[];
  selectedBranchId: string;
  currentUser: AppUser;
  onBranchChange: (branchId: string) => void;
  onBranchesChange: (branches: Branch[]) => void;
  onUsersChange: (users: AppUser[]) => void;
};

type WeeklyTaskKey = `${string}:${string}`;

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

export function AdminDashboard({
  records,
  areas,
  users,
  branches,
  selectedBranchId,
  currentUser,
  onBranchChange,
  onBranchesChange,
  onUsersChange,
}: AdminDashboardProps) {
  const { language, t } = useI18n();
  const [newBranchName, setNewBranchName] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showAllEmployees, setShowAllEmployees] = useState(false);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const fallbackBranchId = branches[0]?.id ?? selectedBranchId;
  const recordBranchId = (record: CleaningRecord) => record.branchId ?? fallbackBranchId;
  const operationalAreas = areas.filter((area) => area.id !== "management");
  const managementArea = areas.find((area) => area.id === "management");
  const selectedBranchAreaIds = new Set(selectedBranch?.areaIds ?? []);
  const branchAreas = operationalAreas.filter((area) => selectedBranchAreaIds.has(area.id));
  const assignableAreas = managementArea ? [...branchAreas, managementArea] : branchAreas;

  const weekRecords = useMemo(() => records.filter((record) => isCurrentWeek(record.createdAt)), [records]);
  const selectedWeekRecords = useMemo(() => weekRecords.filter((record) => recordBranchId(record) === selectedBranch?.id), [selectedBranch?.id, weekRecords]);
  const selectedWeeklyRecords = selectedWeekRecords.filter((record) => record.recordType === "weekly");
  const selectedWeeklyTasks = weeklyTasksForAreas(branchAreas);
  const selectedDoneKeys = weeklyDoneKeys(selectedWeeklyRecords);
  const weeklyDone = selectedWeeklyTasks.filter(({ area, task }) => selectedDoneKeys.has(weeklyTaskKey(area.id, task.id))).length;
  const weeklyTotal = selectedWeeklyTasks.length;
  const weeklyPending = Math.max(weeklyTotal - weeklyDone, 0);
  const weeklyRate = weeklyTotal ? Math.round((weeklyDone / weeklyTotal) * 100) : 0;
  const weeklyPhotoCount = selectedWeeklyRecords.reduce((sum, record) => sum + (record.photoUrls?.length ?? (record.photoUrl ? 1 : 0)), 0);
  const branchUsers = users.filter((user) => (user.assignedBranchIds ?? []).includes(selectedBranch?.id ?? ""));

  const areaStats = branchAreas.map((area) => {
    const areaWeeklyTasks = area.tasks.filter((task) => task.frequency === "weekly");
    const done = areaWeeklyTasks.filter((task) => selectedDoneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    return {
      area,
      done,
      total: areaWeeklyTasks.length,
      rate: areaWeeklyTasks.length ? Math.round((done / areaWeeklyTasks.length) * 100) : 0,
    };
  });

  const branchComparisons = branches.map((branch) => {
    const branchAreaIds = new Set(branch.areaIds);
    const branchOperationalAreas = operationalAreas.filter((area) => branchAreaIds.has(area.id));
    const branchWeeklyTasks = weeklyTasksForAreas(branchOperationalAreas);
    const branchWeeklyRecords = weekRecords.filter((record) => record.recordType === "weekly" && recordBranchId(record) === branch.id);
    const doneKeys = weeklyDoneKeys(branchWeeklyRecords);
    const done = branchWeeklyTasks.filter(({ area, task }) => doneKeys.has(weeklyTaskKey(area.id, task.id))).length;
    const total = branchWeeklyTasks.length;

    return {
      branch,
      done,
      total,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  });

  const latestWeeklyRecords = selectedWeeklyRecords.slice(0, 8);
  const filteredUsers = users.filter((user) => {
    const matchesBranch = showAllEmployees || (user.assignedBranchIds ?? []).includes(selectedBranch?.id ?? "");
    const query = employeeQuery.trim().toLowerCase();
    const matchesQuery = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    return matchesBranch && matchesQuery;
  });

  const updateBranch = (branch: Branch) => {
    onBranchesChange(branches.map((item) => (item.id === branch.id ? branch : item)));
  };

  const toggleBranchArea = (areaId: string) => {
    if (!selectedBranch) return;
    const areaIds = new Set(selectedBranch.areaIds);
    if (areaIds.has(areaId)) {
      areaIds.delete(areaId);
    } else {
      areaIds.add(areaId);
    }
    updateBranch({ ...selectedBranch, areaIds: [...areaIds] });
  };

  const addBranch = () => {
    const name = newBranchName.trim();
    if (!name) return;
    const baseId = slugify(name) || "sucursal";
    const id = `branch-${baseId}-${Date.now().toString(36)}`;
    const nextBranch: Branch = {
      id,
      name,
      areaIds: operationalAreas.map((area) => area.id),
    };
    onBranchesChange([...branches, nextBranch]);
    onBranchChange(id);
    setNewBranchName("");
  };

  const deleteSelectedBranch = () => {
    if (!selectedBranch || branches.length <= 1) return;
    const nextBranches = branches.filter((branch) => branch.id !== selectedBranch.id);
    onBranchesChange(nextBranches);
    onBranchChange(nextBranches[0]?.id ?? "");
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

  return (
    <section className="admin-dashboard">
      <div className="section-heading">
        <div>
          <p>{t("admin.kicker")}</p>
          <h2>{t("admin.weeklySummary")}</h2>
        </div>
      </div>

      <article className="branch-manager">
        <div className="branch-manager-header">
          <div>
            <p>{t("admin.branchSelector")}</p>
            <h3>{selectedBranch?.name ?? t("common.noValue")}</h3>
          </div>
          <Building2 size={24} />
        </div>

        <div className="branch-controls">
          <label className="field">
            <span>{t("fields.branch")}</span>
            <select value={selectedBranch?.id ?? ""} onChange={(event) => onBranchChange(event.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("admin.newBranch")}</span>
            <input value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} placeholder={t("admin.newBranchPlaceholder")} />
          </label>
          <div className="branch-actions">
            <button className="secondary-action" type="button" onClick={addBranch}>
              <Plus size={18} />
              {t("actions.add")}
            </button>
            <button className="secondary-action danger-action" type="button" onClick={deleteSelectedBranch} disabled={branches.length <= 1}>
              <TriangleAlert size={18} />
              {t("admin.deleteBranch")}
            </button>
          </div>
        </div>

        <div className="branch-area-panel">
          <span>{t("admin.branchAreas")}</span>
          <div className="branch-area-grid">
            {operationalAreas.map((area) => (
              <label key={area.id}>
                <input type="checkbox" checked={selectedBranchAreaIds.has(area.id)} onChange={() => toggleBranchArea(area.id)} />
                <span>{t(area.nameKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </article>

      <div className="kpi-grid">
        <article>
          <ListChecks size={22} />
          <span>{t("admin.kpi.weeklyRate")}</span>
          <strong>{weeklyRate}%</strong>
        </article>
        <article>
          <ClipboardCheck size={22} />
          <span>{t("admin.kpi.weeklyDone")}</span>
          <strong>{weeklyDone}/{weeklyTotal}</strong>
        </article>
        <article>
          <TriangleAlert size={22} />
          <span>{t("admin.kpi.weeklyPending")}</span>
          <strong>{weeklyPending}</strong>
        </article>
        <article>
          <Camera size={22} />
          <span>{t("admin.kpi.weeklyPhotos")}</span>
          <strong>{weeklyPhotoCount}</strong>
        </article>
        <article>
          <Users size={22} />
          <span>{t("admin.kpi.branchEmployees")}</span>
          <strong>{branchUsers.length}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="chart-panel">
          <h3>{t("admin.chart.weeklyStatus")}</h3>
          <div className="donut-chart" style={{ background: `conic-gradient(#3d7547 0 ${weeklyRate}%, #e9ecdf ${weeklyRate}% 100%)` }}>
            <span>{weeklyRate}%</span>
          </div>
          <div className="chart-legend">
            <span><i className="success-dot" />{t("weekly.done")}: {weeklyDone}</span>
            <span><i className="pending-dot" />{t("weekly.pending")}: {weeklyPending}</span>
          </div>
        </article>

        <article className="chart-panel">
          <h3>{t("admin.chart.weeklyAreas")}</h3>
          <div className="bar-list">
            {areaStats.length ? (
              areaStats.map((item) => (
                <div className="bar-row" key={item.area.id}>
                  <span>{t(item.area.nameKey)}</span>
                  <div className="bar-track">
                    <div style={{ width: `${item.rate}%` }} />
                  </div>
                  <strong>{item.done}/{item.total}</strong>
                </div>
              ))
            ) : (
              <p className="empty-state">{t("admin.noBranchAreas")}</p>
            )}
          </div>
        </article>

        <article className="chart-panel">
          <h3>{t("admin.branchComparison")}</h3>
          <div className="bar-list">
            {branchComparisons.map((item) => (
              <div className="bar-row" key={item.branch.id}>
                <span>{item.branch.name}</span>
                <div className="bar-track">
                  <div style={{ width: `${item.rate}%` }} />
                </div>
                <strong>{item.rate}%</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="chart-panel">
        <h3>{t("weekly.title")}</h3>
        {latestWeeklyRecords.length ? (
          <div className="weekly-task-list">
            {latestWeeklyRecords.map((record) => {
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

      <article className="user-management">
        <div className="section-heading">
          <div>
            <p>{t("admin.users.kicker")}</p>
            <h2>{t("admin.users.title")}</h2>
          </div>
          <ShieldCheck size={24} />
        </div>

        <div className="user-management-toolbar">
          <label className="field search-field">
            <span>{t("fields.search")}</span>
            <div>
              <Search size={18} />
              <input value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder={t("admin.users.searchPlaceholder")} />
            </div>
          </label>
          <div className="segmented-control">
            <button className={!showAllEmployees ? "active" : ""} type="button" onClick={() => setShowAllEmployees(false)}>
              {t("admin.showBranchUsers")}
            </button>
            <button className={showAllEmployees ? "active" : ""} type="button" onClick={() => setShowAllEmployees(true)}>
              {t("admin.showAllUsers")}
            </button>
          </div>
        </div>

        <div className="admin-summary-row">
          <span>{t("admin.summary.admins")}: {users.filter((user) => user.role === "admin").length}</span>
          <span>{t("admin.summary.employees")}: {users.filter((user) => user.role === "employee").length}</span>
          <span>{t("admin.branchEmployees")}: {branchUsers.length}</span>
        </div>

        <div className="user-list">
          {filteredUsers.map((user) => {
            const isCurrentUser = user.id === currentUser.id;
            const isInSelectedBranch = (user.assignedBranchIds ?? []).includes(selectedBranch?.id ?? "");

            return (
              <div className="user-row" key={user.id}>
                <div className="user-row-header">
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <span className={`branch-pill ${isInSelectedBranch ? "active" : ""}`}>{isInSelectedBranch ? t("admin.users.inBranch") : t("admin.users.notInBranch")}</span>
                </div>

                <div className="role-toggle" aria-label={t("fields.role")}>
                  <button type="button" className={user.role === "employee" ? "active" : ""} onClick={() => changeUserRole(user.id, "employee")} disabled={isCurrentUser}>
                    {t("roles.employee")}
                  </button>
                  <button type="button" className={user.role === "admin" ? "active" : ""} onClick={() => changeUserRole(user.id, "admin")} disabled={isCurrentUser}>
                    {t("roles.admin")}
                  </button>
                </div>

                {selectedBranch ? (
                  <button className={`branch-toggle ${isInSelectedBranch ? "active" : ""}`} type="button" onClick={() => toggleUserBranch(user.id, selectedBranch.id)} disabled={isCurrentUser}>
                    <Building2 size={17} />
                    {isInSelectedBranch ? t("admin.users.removeBranch") : t("admin.users.addBranch")}
                  </button>
                ) : null}

                <div className="sector-checkboxes" aria-label={t("fields.sectors")}>
                  {assignableAreas.map((area) => {
                    const isManagement = area.id === "management";
                    const disabled = (!isInSelectedBranch && !isManagement) || (isCurrentUser && isManagement);

                    return (
                      <label className={disabled ? "disabled-option" : ""} key={`${user.id}-${area.id}`}>
                        <input
                          type="checkbox"
                          checked={(user.assignedSectorIds ?? []).includes(area.id)}
                          onChange={() => toggleUserSector(user.id, area.id)}
                          disabled={disabled}
                        />
                        <span>{t(area.nameKey)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!filteredUsers.length ? <p className="empty-state">{t("admin.users.empty")}</p> : null}
        </div>
      </article>
    </section>
  );
}
