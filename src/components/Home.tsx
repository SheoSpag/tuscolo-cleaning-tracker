import { ClipboardCheck, Play } from "lucide-react";
import type { Area, Branch, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";

type HomeProps = {
  employees: Employee[];
  branches: Branch[];
  areas: Area[];
  selectedEmployeeId: string;
  selectedBranchId: string;
  selectedAreaId: string;
  lockedEmployee?: Employee;
  error?: string;
  onEmployeeChange: (employeeId: string) => void;
  onBranchChange: (branchId: string) => void;
  onAreaChange: (areaId: string) => void;
  onStart: () => void;
};

export function Home({
  employees,
  branches,
  areas,
  selectedEmployeeId,
  selectedBranchId,
  selectedAreaId,
  lockedEmployee,
  error,
  onEmployeeChange,
  onBranchChange,
  onAreaChange,
  onStart,
}: HomeProps) {
  const { t } = useI18n();

  return (
    <section className="home-grid">
      <div className="intro-panel">
        <ClipboardCheck size={34} />
        <p>{t("home.ready")}</p>
        <h2>Tuscolo</h2>
        <span>{t("app.slogan")}</span>
      </div>

      <div className="setup-panel">
        {lockedEmployee ? (
          <div className="current-user-card">
            <span>{t("home.currentEmployee")}</span>
            <strong>{lockedEmployee.name}</strong>
          </div>
        ) : (
          <label className="field">
            <span>{t("home.selectEmployee")}</span>
            <select value={selectedEmployeeId} onChange={(event) => onEmployeeChange(event.target.value)}>
              <option value="">{t("common.select")}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {branches.length > 1 ? (
          <label className="field">
            <span>{t("fields.branch")}</span>
            <select value={selectedBranchId} onChange={(event) => onBranchChange(event.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {areas.length ? (
          <label className="field">
            <span>{t("home.selectSector")}</span>
            <select value={selectedAreaId} onChange={(event) => onAreaChange(event.target.value)}>
              <option value="">{t("common.select")}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {t(area.nameKey)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="empty-state">{t("home.noSectors")}</p>
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <button className="primary-action" type="button" onClick={onStart}>
          <Play size={18} />
          {t("actions.start")}
        </button>
      </div>
    </section>
  );
}
