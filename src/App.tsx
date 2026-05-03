import { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, HomeIcon, ListChecks, LogOut } from "lucide-react";
import { areas as baseAreas, defaultTasks, defaultUsers } from "./data/mockData";
import { I18nContext } from "./i18n/I18nContext";
import { translate } from "./i18n/translations";
import type { AppUser, CleaningRecord, CleaningTask, Language } from "./types";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { CleaningWizard } from "./components/CleaningWizard";
import { FinalScreen } from "./components/FinalScreen";
import { RecordsView } from "./components/RecordsView";
import { TaskManager } from "./components/TaskManager";
import { AuthView } from "./components/AuthView";
import { AdminDashboard } from "./components/AdminDashboard";
import { api, clearAuthToken, setAuthToken, type ApiState } from "./api";

const storageKey = "tuscolo-cleaning-records";
const taskStorageKey = "tuscolo-cleaning-tasks";
const usersStorageKey = "tuscolo-users";

type Screen = "home" | "wizard" | "final" | "dashboard" | "tasks" | "records";

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

function loadUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(usersStorageKey);
    const storedUsers = raw ? (JSON.parse(raw) as AppUser[]) : [];
    const storedEmails = new Set(storedUsers.map((user) => user.email.toLowerCase()));
    return [...defaultUsers.filter((user) => !storedEmails.has(user.email.toLowerCase())), ...storedUsers];
  } catch {
    return defaultUsers;
  }
}

function App() {
  const [language, setLanguage] = useState<Language>("es");
  const [users, setUsers] = useState<AppUser[]>(loadUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [error, setError] = useState("");
  const [records, setRecords] = useState<CleaningRecord[]>(loadRecords);
  const [tasks, setTasks] = useState<CleaningTask[]>(loadTasks);
  const [lastRecord, setLastRecord] = useState<CleaningRecord | null>(null);

  const applyRemoteState = (state: ApiState) => {
    setUsers(state.users);
    setTasks(state.tasks);
    setRecords(state.records);
    setCurrentUser(state.currentUser);
    setSelectedEmployeeId(state.currentUser.id);
    setLanguage(state.currentUser.language);
    setScreen(state.currentUser.role === "admin" ? "dashboard" : "home");
  };

  useEffect(() => {
    void api
      .state()
      .then(applyRemoteState)
      .catch(() => undefined);
  }, []);

  const areas = useMemo(
    () =>
      baseAreas.map((area) => ({
        ...area,
        tasks: tasks.filter((task) => task.areaId === area.id),
      })),
    [tasks],
  );

  const selectedEmployee = users.find((employee) => employee.id === selectedEmployeeId);
  const selectedArea = areas.find((area) => area.id === selectedAreaId);

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
    }
  };

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

  const updateUsers = (nextUsers: AppUser[]) => {
    const changedUsers = nextUsers.filter((nextUser) => users.find((user) => user.id === nextUser.id)?.role !== nextUser.role);
    setUsers(nextUsers);
    localStorage.setItem(usersStorageKey, JSON.stringify(nextUsers));
    void Promise.all(changedUsers.map((user) => api.updateUserRole(user.id, user.role))).catch(() => undefined);
    if (currentUser) {
      setCurrentUser(nextUsers.find((user) => user.id === currentUser.id) ?? currentUser);
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

    if (!activeEmployee || !selectedArea) {
      setError(translate(language, "errors.selectEmployeeArea"));
      return;
    }

    if (selectedArea.tasks.length === 0) {
      setError(translate(language, "errors.noTasks"));
      return;
    }

    setError("");
    setSelectedEmployeeId(activeEmployee.id);
    setScreen("wizard");
  };

  const saveRecord = (record: CleaningRecord) => {
    const nextRecords = [record, ...records];
    setRecords(nextRecords);
    localStorage.setItem(storageKey, JSON.stringify(nextRecords));
    void api.saveRecord(record).catch(() => undefined);
    setLastRecord(record);
    setScreen("final");
  };

  const updateTasks = (nextTasks: CleaningTask[]) => {
    setTasks(nextTasks);
    localStorage.setItem(taskStorageKey, JSON.stringify(nextTasks));
    void api.saveTasks(nextTasks).catch(() => undefined);
  };

  const restart = () => {
    setLastRecord(null);
    setScreen("home");
  };

  const goToScreen = (nextScreen: Screen) => {
    setError("");
    setScreen(nextScreen);
  };

  return (
    <I18nContext.Provider value={i18nValue}>
      <main className="app-shell">
        <Header />
        {!currentUser ? <AuthView users={users} onLogin={login} onStartRegister={startRegister} onVerifyRegister={verifyRegister} error={error} /> : null}
        {currentUser ? (
          <nav className="app-nav" aria-label={translate(language, "nav.aria")}>
            {currentUser.role === "admin" ? (
              <button className={screen === "dashboard" ? "active" : ""} type="button" onClick={() => goToScreen("dashboard")}>
                <BarChart3 size={18} />
                {translate(language, "nav.dashboard")}
              </button>
            ) : null}
            <button className={screen === "home" ? "active" : ""} type="button" onClick={() => goToScreen("home")}>
              <HomeIcon size={18} />
              {translate(language, "nav.home")}
            </button>
            {currentUser.role === "admin" ? (
              <>
                <button className={screen === "tasks" ? "active" : ""} type="button" onClick={() => goToScreen("tasks")}>
                  <ListChecks size={18} />
                  {translate(language, "nav.tasks")}
                </button>
                <button className={screen === "records" ? "active" : ""} type="button" onClick={() => goToScreen("records")}>
                  <ClipboardList size={18} />
                  {translate(language, "nav.records")}
                </button>
              </>
            ) : null}
            <button type="button" onClick={logout}>
              <LogOut size={18} />
              {translate(language, "auth.logout")}
            </button>
          </nav>
        ) : null}
        {currentUser?.role === "admin" && screen === "dashboard" ? (
          <AdminDashboard records={records} areas={areas} tasks={tasks} users={users} currentUser={currentUser} onUsersChange={updateUsers} />
        ) : null}
        {currentUser && screen === "home" ? (
          <Home
            employees={users}
            areas={areas}
            selectedEmployeeId={currentUser?.id ?? selectedEmployeeId}
            selectedAreaId={selectedAreaId}
            lockedEmployee={currentUser}
            error={error}
            onEmployeeChange={handleEmployeeChange}
            onAreaChange={setSelectedAreaId}
            onStart={startFlow}
          />
        ) : null}
        {screen === "wizard" && selectedArea && (currentUser ?? selectedEmployee) ? (
          <CleaningWizard area={selectedArea} employee={(currentUser ?? selectedEmployee)!} onSave={saveRecord} />
        ) : null}
        {screen === "final" && lastRecord ? <FinalScreen record={lastRecord} onRestart={restart} /> : null}
        {currentUser?.role === "admin" && screen === "tasks" ? <TaskManager areas={areas} tasks={tasks} onTasksChange={updateTasks} /> : null}
        {currentUser?.role === "admin" && screen === "records" ? <RecordsView records={records} areas={areas} employees={users} /> : null}
      </main>
    </I18nContext.Provider>
  );
}

export default App;
