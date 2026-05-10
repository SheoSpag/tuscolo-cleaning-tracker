import { useEffect, useMemo, useState } from "react";
import { History, HomeIcon, LogOut } from "lucide-react";
import { areas as baseAreas, defaultBranches, defaultTasks, defaultUsers } from "./data/mockData";
import { I18nContext } from "./i18n/I18nContext";
import { translate } from "./i18n/translations";
import type { AppUser, Branch, BranchArea, CleaningRecord, CleaningTask, Language } from "./types";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { CleaningWizard } from "./components/CleaningWizard";
import { FinalScreen } from "./components/FinalScreen";
import { AuthView } from "./components/AuthView";
import { AdminDashboard } from "./components/AdminDashboard";
import { WeeklyTasksView } from "./components/WeeklyTasksView";
import { EmployeeHistory } from "./components/EmployeeHistory";
import { api, clearAuthToken, setAuthToken, type ApiState } from "./api";
import { buildCleaningGroups, isTaskManagerGroupId, isVisibleGroupId, normalizeGroupAssignments, operationalGroupIds } from "./data/cleaningGroups";

const storageKey = "tuscolo-cleaning-records";
const taskStorageKey = "tuscolo-cleaning-tasks";
const usersStorageKey = "tuscolo-users";
const branchesStorageKey = "tuscolo-branches";
const themeStorageKey = "tuscolo-theme";

type Screen = "home" | "wizard" | "final" | "dashboard" | "tasks" | "records" | "history";
type Theme = "light" | "dark";

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(themeStorageKey);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function loadRecords(): CleaningRecord[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as CleaningRecord[]) : [];
  } catch {
    return [];
  }
}

function loadTasks(): CleaningTask[] {
  try {
    const raw = localStorage.getItem(taskStorageKey);
    return raw ? (JSON.parse(raw) as CleaningTask[]) : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

function sanitizeCustomAreas(branch: Branch): BranchArea[] {
  const customAreas = Array.isArray(branch.customAreas) ? branch.customAreas : [];
  return [
    ...new Map(
      customAreas
        .map((area) => ({
          id: String(area.id || "").trim(),
          name: String(area.name || "").trim(),
        }))
        .filter((area) => area.id && area.name)
        .map((area) => [area.id, area]),
    ).values(),
  ];
}

function normalizeBranch(branch: Branch): Branch {
  const customAreas = sanitizeCustomAreas(branch);
  const operationalIds = new Set<string>(operationalGroupIds);
  const customAreaIds = new Set(customAreas.map((area) => area.id));
  const sourceAreaIds = Array.isArray(branch.areaIds) ? branch.areaIds : operationalGroupIds;
  const areaIds = [...new Set(sourceAreaIds.map(String).filter((areaId) => operationalIds.has(areaId) || customAreaIds.has(areaId)))];
  return { ...branch, name: String(branch.name || "").trim(), areaIds, customAreas };
}

function loadBranchesForUserNormalization(): Branch[] {
  try {
    const raw = localStorage.getItem(branchesStorageKey);
    const storedBranches = raw ? (JSON.parse(raw) as Branch[]) : [];
    const storedIds = new Set(storedBranches.map((branch) => branch.id));
    return [...defaultBranches.filter((branch) => !storedIds.has(branch.id)), ...storedBranches].map(normalizeBranch);
  } catch {
    return defaultBranches.map(normalizeBranch);
  }
}

function normalizeUserSectorIds(sectorIds: string[] | undefined, branchList: Branch[]) {
  const knownAssignments = normalizeGroupAssignments(sectorIds);
  const knownOperationalIds = new Set<string>(operationalGroupIds);
  const allowedCustomAreaIds = new Set(branchList.flatMap((branch) => branch.areaIds.filter((areaId) => !knownOperationalIds.has(areaId))));
  const customAssignments = (sectorIds ?? []).map(String).filter((sectorId) => allowedCustomAreaIds.has(sectorId));
  return [...new Set([...knownAssignments, ...customAssignments])];
}

function loadUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(usersStorageKey);
    const storedUsers = raw ? (JSON.parse(raw) as AppUser[]) : [];
    const storedEmails = new Set(storedUsers.map((user) => user.email.toLowerCase()));
    const assignmentBranches = loadBranchesForUserNormalization();
    return [...defaultUsers.filter((user) => !storedEmails.has(user.email.toLowerCase())), ...storedUsers].map((user) => ({
      ...user,
      assignedBranchIds: Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : user.role === "admin" ? defaultBranches.map((branch) => branch.id) : [defaultBranches[0].id],
      assignedSectorIds: normalizeUserSectorIds(user.assignedSectorIds, assignmentBranches),
    }));
  } catch {
    const assignmentBranches = defaultBranches.map(normalizeBranch);
    return defaultUsers.map((user) => ({
      ...user,
      assignedBranchIds: Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : user.role === "admin" ? defaultBranches.map((branch) => branch.id) : [defaultBranches[0].id],
      assignedSectorIds: normalizeUserSectorIds(user.assignedSectorIds, assignmentBranches),
    }));
  }
}

function loadBranches(): Branch[] {
  try {
    const raw = localStorage.getItem(branchesStorageKey);
    const storedBranches = raw ? (JSON.parse(raw) as Branch[]) : [];
    const storedIds = new Set(storedBranches.map((branch) => branch.id));
    return [...defaultBranches.filter((branch) => !storedIds.has(branch.id)), ...storedBranches].map(normalizeBranch);
  } catch {
    return defaultBranches.map(normalizeBranch);
  }
}

function App() {
  const [language, setLanguage] = useState<Language>("es");
  const [users, setUsers] = useState<AppUser[]>(loadUsers);
  const [branches, setBranches] = useState<Branch[]>(loadBranches);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranches[0].id);
  const [screen, setScreen] = useState<Screen>("home");
  const [error, setError] = useState("");
  const [records, setRecords] = useState<CleaningRecord[]>(loadRecords);
  const [tasks, setTasks] = useState<CleaningTask[]>(loadTasks);
  const [lastRecord, setLastRecord] = useState<CleaningRecord | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const applyRemoteState = (state: ApiState) => {
    const nextBranches = (state.branches?.length ? state.branches : defaultBranches).map(normalizeBranch);
    setBranches(nextBranches);
    setUsers(state.users.map((user) => ({
      ...user,
      assignedBranchIds: Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : user.role === "admin" ? nextBranches.map((branch) => branch.id) : [nextBranches[0]?.id ?? defaultBranches[0].id],
      assignedSectorIds: normalizeUserSectorIds(user.assignedSectorIds, nextBranches),
    })));
    setTasks(state.tasks);
    setRecords(state.records);
    const nextCurrentUser = {
      ...state.currentUser,
      assignedBranchIds: Array.isArray(state.currentUser.assignedBranchIds)
        ? state.currentUser.assignedBranchIds
        : state.currentUser.role === "admin"
          ? nextBranches.map((branch) => branch.id)
          : [nextBranches[0]?.id ?? defaultBranches[0].id],
      assignedSectorIds: normalizeUserSectorIds(state.currentUser.assignedSectorIds, nextBranches),
    };
    setCurrentUser(nextCurrentUser);
    setSelectedEmployeeId(state.currentUser.id);
    setLanguage(state.currentUser.language);
    setSelectedBranchId(nextCurrentUser.assignedBranchIds?.[0] ?? nextBranches[0]?.id ?? defaultBranches[0].id);
    setScreen(state.currentUser.role === "admin" ? "dashboard" : "home");
  };

  useEffect(() => {
    void api
      .state()
      .then(applyRemoteState)
      .catch(() => undefined);
  }, []);

  const baseAreasWithTasks = useMemo(
    () => baseAreas.map((area) => ({ ...area, tasks: tasks.filter((task) => task.areaId === area.id) })),
    [tasks],
  );
  const areas = useMemo(() => buildCleaningGroups(tasks), [tasks]);
  const customAreas = useMemo(() => {
    const byId = new Map<string, BranchArea>();
    branches.forEach((branch) => {
      (branch.customAreas ?? []).forEach((area) => byId.set(area.id, area));
    });
    return [...byId.values()].map((area) => ({
      id: area.id,
      nameKey: area.name,
      tasks: tasks.filter((task) => task.areaId === area.id),
    }));
  }, [branches, tasks]);
  const visibleAreas = useMemo(() => [...areas.filter((area) => isVisibleGroupId(area.id)), ...customAreas], [areas, customAreas]);
  const taskManagerAreas = useMemo(() => [...areas.filter((area) => isTaskManagerGroupId(area.id)), ...customAreas], [areas, customAreas]);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const availableBranches = useMemo(() => {
    if (!currentUser) return branches;
    if (currentUser.role === "admin") return branches;
    const assignedBranchIds = new Set(currentUser.assignedBranchIds?.length ? currentUser.assignedBranchIds : []);
    return branches.filter((branch) => assignedBranchIds.has(branch.id));
  }, [branches, currentUser]);
  const availableAreas = useMemo(() => {
    if (!currentUser) return visibleAreas;
    const branchAreaIds = new Set(selectedBranch?.areaIds ?? []);
    const branchAreas = visibleAreas.filter((area) => area.id === "management" || branchAreaIds.has(area.id));
    if (currentUser.role === "admin") return branchAreas;
    const assignedBranchIds = new Set(currentUser.assignedBranchIds ?? []);
    if (!assignedBranchIds.has(selectedBranchId)) return [];
    const assignedSectorIds = new Set<string>(normalizeUserSectorIds(currentUser.assignedSectorIds, branches));
    return branchAreas.filter((area) => assignedSectorIds.has(area.id));
  }, [branches, currentUser, selectedBranch, selectedBranchId, visibleAreas]);
  const fallbackBranchId = branches[0]?.id ?? defaultBranches[0].id;
  const selectedBranchRecords = useMemo(
    () => records.filter((record) => (record.branchId ?? fallbackBranchId) === selectedBranchId),
    [fallbackBranchId, records, selectedBranchId],
  );

  const selectedEmployee = users.find((employee) => employee.id === selectedEmployeeId);
  const selectedArea = availableAreas.find((area) => area.id === selectedAreaId);

  const i18nValue = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => translate(language, key),
    }),
    [language],
  );

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = users.find((item) => item.id === employeeId);
    if (employee) {
      setLanguage(employee.language);
      setSelectedBranchId(employee.assignedBranchIds?.[0] ?? fallbackBranchId);
      setSelectedAreaId("");
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedAreaId("");
  };

  useEffect(() => {
    if (!currentUser || !availableBranches.length) return;
    if (!availableBranches.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(availableBranches[0].id);
      setSelectedAreaId("");
    }
  }, [availableBranches, currentUser, selectedBranchId]);

  useEffect(() => {
    if (!selectedAreaId) return;
    if (!availableAreas.some((area) => area.id === selectedAreaId)) {
      setSelectedAreaId("");
    }
  }, [availableAreas, selectedAreaId]);

  const login = async (email: string, password: string) => {
    try {
      const result = await api.login(email, password);
      setAuthToken(result.token);
      applyRemoteState(await api.state());
      setError("");
      return true;
    } catch {
      clearAuthToken();
      setError(translate(language, "errors.invalidLogin"));
      return false;
    }
  };

  const startRegister = async (input: { name: string; email: string; password: string; language: Language }) => {
    try {
      const result = await api.startRegister(input);
      setError("");
      return { ok: true, emailSent: result.emailSent, devCode: result.devCode };
    } catch (requestError) {
      const message = requestError instanceof Error && requestError.message === "Email exists" ? translate(language, "errors.emailExists") : translate(language, "errors.requiredFields");
      setError(message);
      return { ok: false, message };
    }
  };

  const verifyRegister = async (email: string, code: string) => {
    try {
      const result = await api.verifyRegister(email, code);
      setAuthToken(result.token);
      applyRemoteState(await api.state());
      setError("");
      return true;
    } catch {
      setError(translate(language, "errors.invalidCode"));
      return false;
    }
  };

  const startPasswordReset = async (email: string) => {
    try {
      const result = await api.startPasswordReset(email);
      setError("");
      return { ok: true, emailSent: result.emailSent, devCode: result.devCode };
    } catch {
      const message = translate(language, "errors.requiredFields");
      setError(message);
      return { ok: false, message };
    }
  };

  const verifyPasswordReset = async (email: string, code: string) => {
    try {
      await api.verifyPasswordReset(email, code);
      setError("");
      return true;
    } catch {
      setError(translate(language, "errors.invalidCode"));
      return false;
    }
  };

  const finishPasswordReset = async (email: string, code: string, password: string) => {
    try {
      const result = await api.finishPasswordReset(email, code, password);
      setAuthToken(result.token);
      applyRemoteState(await api.state());
      setError("");
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error && requestError.message === "Weak password" ? translate(language, "errors.weakPassword") : translate(language, "errors.invalidCode");
      setError(message);
      return false;
    }
  };

  const updateUsers = (nextUsers: AppUser[]) => {
    const fallbackBranchId = branches[0]?.id ?? defaultBranches[0].id;
    const branchIds = new Set(branches.map((branch) => branch.id));
    const normalizedUsers = nextUsers.map((user) => ({
      ...user,
      assignedBranchIds: (Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : user.role === "admin" ? branches.map((branch) => branch.id) : [fallbackBranchId]).filter((branchId) =>
        branchIds.has(branchId),
      ),
      assignedSectorIds: normalizeUserSectorIds(user.assignedSectorIds, branches),
    }));
    const changedUsers = normalizedUsers.filter((nextUser) => {
      const previousUser = users.find((user) => user.id === nextUser.id);
      return (
        previousUser?.role !== nextUser.role ||
        JSON.stringify(previousUser?.assignedBranchIds ?? []) !== JSON.stringify(nextUser.assignedBranchIds ?? []) ||
        JSON.stringify(previousUser?.assignedSectorIds ?? []) !== JSON.stringify(nextUser.assignedSectorIds ?? [])
      );
    });
    setUsers(normalizedUsers);
    localStorage.setItem(usersStorageKey, JSON.stringify(normalizedUsers));
    void Promise.all(changedUsers.map((user) => api.updateUserRole(user.id, user.role, user.assignedSectorIds, user.assignedBranchIds))).catch(() => undefined);
    if (currentUser) {
      setCurrentUser(normalizedUsers.find((user) => user.id === currentUser.id) ?? currentUser);
    }
  };

  const updateBranches = (nextBranches: Branch[]) => {
    const normalizedBranches = nextBranches.map(normalizeBranch).filter((branch) => branch.name.trim());
    const branchIds = new Set(normalizedBranches.map((branch) => branch.id));
    const normalizedUsers = users.map((user) => {
      const fallbackAssignedBranchIds = user.role === "admin" ? normalizedBranches.map((branch) => branch.id) : [];
      const assignedBranchIds = (Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : fallbackAssignedBranchIds).filter((branchId) => branchIds.has(branchId));
      return {
        ...user,
        assignedBranchIds: assignedBranchIds.length || user.role !== "admin" ? assignedBranchIds : normalizedBranches.map((branch) => branch.id),
        assignedSectorIds: normalizeUserSectorIds(user.assignedSectorIds, normalizedBranches),
      };
    });
    setBranches(normalizedBranches);
    setUsers(normalizedUsers);
    localStorage.setItem(branchesStorageKey, JSON.stringify(normalizedBranches));
    localStorage.setItem(usersStorageKey, JSON.stringify(normalizedUsers));
    void api.saveBranches(normalizedBranches).catch(() => undefined);
    if (!normalizedBranches.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(normalizedBranches[0]?.id ?? defaultBranches[0].id);
    }
    if (currentUser) {
      setCurrentUser(normalizedUsers.find((user) => user.id === currentUser.id) ?? currentUser);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setSelectedEmployeeId("");
    setSelectedAreaId("");
    setScreen("home");
    clearAuthToken();
  };

  const startFlow = () => {
    const activeEmployee = currentUser ?? selectedEmployee;

    if (!activeEmployee || !selectedArea || !selectedBranch) {
      setError(translate(language, "errors.selectEmployeeArea"));
      return;
    }

    const dailyTasks = selectedArea.tasks.filter((task) => task.frequency === "daily");
    if (dailyTasks.length === 0 || selectedArea.id === "management") {
      setError(translate(language, "errors.noTasks"));
      return;
    }

    setError("");
    setSelectedEmployeeId(activeEmployee.id);
    setScreen("wizard");
  };

  const saveRecord = (record: CleaningRecord) => {
    const recordWithBranch = { ...record, branchId: record.branchId ?? selectedBranch?.id ?? selectedBranchId };
    const nextRecords = [recordWithBranch, ...records];
    setRecords(nextRecords);
    localStorage.setItem(storageKey, JSON.stringify(nextRecords));
    void api.saveRecord(recordWithBranch).catch(() => undefined);
    setLastRecord(recordWithBranch);
    setScreen("final");
  };

  const updateTasks = (nextTasks: CleaningTask[]) => {
    setTasks(nextTasks);
    localStorage.setItem(taskStorageKey, JSON.stringify(nextTasks));
    void api.saveTasks(nextTasks).catch(() => undefined);
  };

  const createUser = async (input: {
    name: string;
    email: string;
    password: string;
    language: Language;
    role: AppUser["role"];
    assignedBranchIds?: string[];
    assignedSectorIds?: string[];
  }) => {
    const fallbackBranchId = branches[0]?.id ?? defaultBranches[0].id;
    const optimisticUser: AppUser = {
      id: `local-${crypto.randomUUID()}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      language: input.language,
      role: input.role,
      assignedBranchIds: input.assignedBranchIds?.length ? input.assignedBranchIds : input.role === "admin" ? branches.map((branch) => branch.id) : [fallbackBranchId],
      assignedSectorIds: normalizeUserSectorIds(input.assignedSectorIds, branches),
    };
    const nextUsers = [...users, optimisticUser];
    setUsers(nextUsers);
    localStorage.setItem(usersStorageKey, JSON.stringify(nextUsers));

    try {
      const result = await api.createUser(input);
      const syncedUsers = nextUsers.map((user) => (user.id === optimisticUser.id ? result.user : user));
      setUsers(syncedUsers);
      localStorage.setItem(usersStorageKey, JSON.stringify(syncedUsers));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (["Email exists", "Invalid user data", "Forbidden", "Unauthorized"].includes(message)) {
        setUsers(users);
        localStorage.setItem(usersStorageKey, JSON.stringify(users));
        return false;
      }
      return true;
    }
  };

  const updateTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
  };

  const restart = () => {
    setLastRecord(null);
    setScreen("home");
  };

  const goToScreen = (nextScreen: Screen) => {
    setError("");
    setScreen(nextScreen);
  };
  const isAdmin = currentUser?.role === "admin";

  return (
    <I18nContext.Provider value={i18nValue}>
      <main className={`${isAdmin ? "admin-root" : currentUser ? "app-shell" : "app-shell auth-shell"} app-theme-${theme}`}>
        {!isAdmin ? <Header compact={!currentUser} /> : null}
        {!currentUser ? (
          <AuthView
            users={users}
            onLogin={login}
            onStartRegister={startRegister}
            onVerifyRegister={verifyRegister}
            onStartPasswordReset={startPasswordReset}
            onVerifyPasswordReset={verifyPasswordReset}
            onFinishPasswordReset={finishPasswordReset}
            error={error}
          />
        ) : null}
        {currentUser && !isAdmin ? (
          <nav className="app-nav" aria-label={translate(language, "nav.aria")}>
            <button className={screen === "home" ? "active" : ""} type="button" onClick={() => goToScreen("home")}>
              <HomeIcon size={18} />
              {translate(language, "nav.home")}
            </button>
            <button className={screen === "history" ? "active" : ""} type="button" onClick={() => goToScreen("history")}>
              <History size={18} />
              {translate(language, "nav.history")}
            </button>
            <button type="button" onClick={logout}>
              <LogOut size={18} />
              {translate(language, "auth.logout")}
            </button>
          </nav>
        ) : null}
        {isAdmin ? (
          <AdminDashboard
            records={records}
            areas={visibleAreas}
            recordsAreas={[...visibleAreas, ...baseAreasWithTasks]}
            taskManagerAreas={taskManagerAreas}
            tasks={tasks}
            users={users}
            branches={branches}
            selectedBranchId={selectedBranchId}
            currentUser={currentUser}
            onBranchChange={handleBranchChange}
            onBranchesChange={updateBranches}
            onTasksChange={updateTasks}
            onUsersChange={updateUsers}
            onCreateUser={createUser}
            theme={theme}
            onThemeChange={updateTheme}
            onLogout={logout}
          />
        ) : null}
        {currentUser && !isAdmin && screen === "home" ? (
          <>
            <Home
              employees={users}
              branches={availableBranches}
              areas={availableAreas.filter((area) => area.id !== "management")}
              selectedEmployeeId={currentUser?.id ?? selectedEmployeeId}
              selectedBranchId={selectedBranchId}
              selectedAreaId={selectedAreaId}
              lockedEmployee={currentUser}
              error={error}
              onEmployeeChange={handleEmployeeChange}
              onBranchChange={handleBranchChange}
              onAreaChange={setSelectedAreaId}
              onStart={startFlow}
            />
            <WeeklyTasksView areas={availableAreas} allAreas={visibleAreas} records={selectedBranchRecords} users={users} employee={currentUser} onSave={saveRecord} />
          </>
        ) : null}
        {currentUser && !isAdmin && screen === "history" ? (
          <EmployeeHistory records={records.filter((record) => record.employeeId === currentUser.id)} areas={[...visibleAreas, ...baseAreasWithTasks]} employee={currentUser} />
        ) : null}
        {!isAdmin && screen === "wizard" && selectedArea && (currentUser ?? selectedEmployee) ? (
          <CleaningWizard area={{ ...selectedArea, tasks: selectedArea.tasks.filter((task) => task.frequency === "daily") }} employee={(currentUser ?? selectedEmployee)!} onSave={saveRecord} />
        ) : null}
        {!isAdmin && screen === "final" && lastRecord ? <FinalScreen record={lastRecord} onRestart={restart} /> : null}
      </main>
    </I18nContext.Provider>
  );
}

export default App;
