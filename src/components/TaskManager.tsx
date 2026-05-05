import { CalendarDays, CheckCircle2, Layers3, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Area, CleaningTask } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type TaskManagerProps = {
  areas: Area[];
  tasks: CleaningTask[];
  onTasksChange: (tasks: CleaningTask[]) => void;
};

export function TaskManager({ areas, tasks, onTasksChange }: TaskManagerProps) {
  const { language, t } = useI18n();
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [newQuestion, setNewQuestion] = useState("");
  const [newFrequency, setNewFrequency] = useState<CleaningTask["frequency"]>("daily");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState("");
  const [editingFrequency, setEditingFrequency] = useState<CleaningTask["frequency"]>("daily");

  useEffect(() => {
    if (areas.some((area) => area.id === areaId)) return;
    setAreaId(areas[0]?.id ?? "");
  }, [areaId, areas]);

  const selectedArea = useMemo(() => areas.find((area) => area.id === areaId), [areaId, areas]);
  const selectedTasks = useMemo(
    () => selectedArea?.tasks ?? [],
    [selectedArea],
  );
  const dailyTasks = selectedTasks.filter((task) => task.frequency === "daily");
  const weeklyTasks = selectedTasks.filter((task) => task.frequency === "weekly");
  const areaStats = areas.map((area) => ({
    area,
    total: area.tasks.length,
    daily: area.tasks.filter((task) => task.frequency === "daily").length,
    weekly: area.tasks.filter((task) => task.frequency === "weekly").length,
  }));

  const addTask = () => {
    const question = newQuestion.trim();
    if (!question || !areaId) {
      return;
    }

    onTasksChange([
      ...tasks,
      {
        id: `${areaId}-${newFrequency}-${crypto.randomUUID()}`,
        areaId,
        frequency: newFrequency,
        question,
      },
    ]);
    setNewQuestion("");
  };

  const startEdit = (task: CleaningTask) => {
    setEditingTaskId(task.id);
    setEditingQuestion(task.question);
    setEditingFrequency(task.frequency);
  };

  const saveEdit = (taskId: string) => {
    const question = editingQuestion.trim();
    if (!question) {
      return;
    }

    onTasksChange(
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              question,
              frequency: editingFrequency,
            }
          : task,
      ),
    );
    setEditingTaskId(null);
  };

  const deleteTask = (taskId: string) => {
    onTasksChange(tasks.filter((task) => task.id !== taskId));
  };

  return (
    <section className="task-manager">
      <div className="section-heading">
        <div>
          <p>{t("tasksManager.subtitle")}</p>
          <h2>{t("tasksManager.title")}</h2>
        </div>
      </div>

      <div className="task-manager-shell">
        <aside className="task-area-panel">
          <div className="task-area-panel-header">
            <span>{t("tasksManager.areaList")}</span>
            <strong>{areas.length}</strong>
          </div>
          <div className="task-area-list">
            {areaStats.map((item) => (
              <button className={areaId === item.area.id ? "active" : ""} type="button" onClick={() => setAreaId(item.area.id)} key={item.area.id}>
                <span>{t(item.area.nameKey)}</span>
                <small>{item.daily} {t("frequency.daily")} - {item.weekly} {t("frequency.weekly")}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="task-workspace">
          <div className="task-metrics-grid">
            <article>
              <Layers3 size={19} />
              <span>{t("tasksManager.totalTasks")}</span>
              <strong>{selectedTasks.length}</strong>
            </article>
            <article>
              <CheckCircle2 size={19} />
              <span>{t("tasksManager.dailyTasks")}</span>
              <strong>{dailyTasks.length}</strong>
            </article>
            <article>
              <CalendarDays size={19} />
              <span>{t("tasksManager.weeklyTasks")}</span>
              <strong>{weeklyTasks.length}</strong>
            </article>
          </div>

          <article className="task-editor-card">
            <div className="task-list-header">
              <div>
                <p>{selectedArea ? t(selectedArea.nameKey) : t("common.noValue")}</p>
                <h3>{t("tasksManager.newTaskTitle")}</h3>
              </div>
            </div>
            <div className="new-task-row">
              <label className="field">
                <span>{t("fields.frequency")}</span>
                <select value={newFrequency} onChange={(event) => setNewFrequency(event.target.value as CleaningTask["frequency"])} disabled={!areaId}>
                  <option value="daily">{t("frequency.daily")}</option>
                  <option value="weekly">{t("frequency.weekly")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("fields.task")}</span>
                <textarea
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  placeholder={t("tasksManager.placeholder")}
                  rows={3}
                  disabled={!areaId}
                />
              </label>
              <button className="primary-action compact-action" type="button" onClick={addTask} disabled={!areaId || !newQuestion.trim()}>
                <Plus size={18} />
                {t("actions.add")}
              </button>
            </div>
          </article>

          <article className="task-editor-card">
            <div className="task-list-header">
              <div>
                <p>{t("fields.task")}</p>
                <h3>{t("tasksManager.taskListTitle")}</h3>
              </div>
              <span>{selectedTasks.length}</span>
            </div>

            {selectedTasks.length === 0 ? (
              <p className="empty-state">{t("tasksManager.empty")}</p>
            ) : (
              <div className="task-card-list">
                {selectedTasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    {editingTaskId === task.id ? (
                      <>
                        <div className="task-card-main">
                          <label className="field">
                            <span>{t("fields.task")}</span>
                            <textarea value={editingQuestion} onChange={(event) => setEditingQuestion(event.target.value)} rows={3} />
                          </label>
                          <label className="field">
                            <span>{t("fields.frequency")}</span>
                            <select
                              value={editingFrequency}
                              onChange={(event) => setEditingFrequency(event.target.value as CleaningTask["frequency"])}
                            >
                              <option value="daily">{t("frequency.daily")}</option>
                              <option value="weekly">{t("frequency.weekly")}</option>
                            </select>
                          </label>
                        </div>
                        <div className="task-actions">
                          <button className="icon-action" type="button" onClick={() => saveEdit(task.id)} aria-label={t("actions.save")}>
                            <Save size={18} />
                          </button>
                          <button className="icon-action" type="button" onClick={() => setEditingTaskId(null)} aria-label={t("actions.cancel")}>
                            <X size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="task-card-main">
                          <span className="task-pill">{t(`frequency.${task.frequency}`)}</span>
                          <p>{translateTask(task, language)}</p>
                        </div>
                        <div className="task-actions">
                          <button className="icon-action" type="button" onClick={() => startEdit(task)} aria-label={t("actions.edit")}>
                            <Pencil size={18} />
                          </button>
                          <button className="icon-action danger-icon" type="button" onClick={() => deleteTask(task.id)} aria-label={t("actions.delete")}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
