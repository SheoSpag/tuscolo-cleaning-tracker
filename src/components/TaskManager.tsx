import { CalendarDays, CheckCircle2, Layers3, MoreHorizontal, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [activeOptionsTaskId, setActiveOptionsTaskId] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
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
  const filteredTasks = selectedTasks.filter((task) => translateTask(task, language).toLowerCase().includes(taskSearch.trim().toLowerCase()));
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
    setCreateOpen(false);
  };

  const startEdit = (task: CleaningTask) => {
    setEditingTaskId(task.id);
    setEditingQuestion(task.question);
    setEditingFrequency(task.frequency);
    setActiveOptionsTaskId(null);
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
        <button className="primary-action compact-action" type="button" onClick={() => setCreateOpen(true)}>
          <Plus size={18} />
          {t("tasksManager.newTaskTitle")}
        </button>
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
                <p>{t("fields.task")}</p>
                <h3>{t("tasksManager.taskListTitle")}</h3>
              </div>
              <span>{selectedTasks.length}</span>
            </div>
            <label className="field search-field task-search-field">
              <span>{t("fields.search")}</span>
              <div>
                <Search size={18} />
                <input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder={t("tasksManager.searchPlaceholder")} />
              </div>
            </label>

            {selectedTasks.length === 0 ? (
              <p className="empty-state">{t("tasksManager.empty")}</p>
            ) : filteredTasks.length === 0 ? (
              <p className="empty-state">{t("tasksManager.emptySearch")}</p>
            ) : (
              <div className="task-card-list">
                {filteredTasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-main">
                      <span className="task-pill">{t(`frequency.${task.frequency}`)}</span>
                      <p>{translateTask(task, language)}</p>
                    </div>
                    <div className="task-actions compact-options">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setActiveOptionsTaskId((current) => (current === task.id ? null : task.id))}
                        aria-label={t("tasksManager.options")}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeOptionsTaskId === task.id ? (
                        <div className="task-options-menu">
                          <button type="button" onClick={() => startEdit(task)}>
                            <Pencil size={16} />
                            {t("actions.edit")}
                          </button>
                          <button className="danger-option" type="button" onClick={() => deleteTask(task.id)}>
                            <Trash2 size={16} />
                            {t("actions.delete")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
      {createOpen ? (
        <TaskDialog
          title={t("tasksManager.newTaskTitle")}
          areaName={selectedArea ? t(selectedArea.nameKey) : t("common.noValue")}
          question={newQuestion}
          frequency={newFrequency}
          onQuestionChange={setNewQuestion}
          onFrequencyChange={setNewFrequency}
          onCancel={() => setCreateOpen(false)}
          onSave={addTask}
          saveLabel={t("actions.add")}
          disabled={!areaId || !newQuestion.trim()}
        />
      ) : null}
      {editingTaskId ? (
        <TaskDialog
          title={t("actions.edit")}
          areaName={selectedArea ? t(selectedArea.nameKey) : t("common.noValue")}
          question={editingQuestion}
          frequency={editingFrequency}
          onQuestionChange={setEditingQuestion}
          onFrequencyChange={setEditingFrequency}
          onCancel={() => setEditingTaskId(null)}
          onSave={() => saveEdit(editingTaskId)}
          saveLabel={t("actions.save")}
          disabled={!editingQuestion.trim()}
        />
      ) : null}
    </section>
  );
}

function TaskDialog({
  title,
  areaName,
  question,
  frequency,
  saveLabel,
  disabled,
  onQuestionChange,
  onFrequencyChange,
  onCancel,
  onSave,
}: {
  title: string;
  areaName: string;
  question: string;
  frequency: CleaningTask["frequency"];
  saveLabel: string;
  disabled?: boolean;
  onQuestionChange: (value: string) => void;
  onFrequencyChange: (value: CleaningTask["frequency"]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
      <div className="admin-dialog">
        <div className="admin-dialog-header">
          <div>
            <p>{areaName}</p>
            <h3 id="task-dialog-title">{title}</h3>
          </div>
          <button className="icon-action" type="button" onClick={onCancel} aria-label={t("actions.cancel")}>
            <X size={18} />
          </button>
        </div>
        <label className="field">
          <span>{t("fields.frequency")}</span>
          <select value={frequency} onChange={(event) => onFrequencyChange(event.target.value as CleaningTask["frequency"])}>
            <option value="daily">{t("frequency.daily")}</option>
            <option value="weekly">{t("frequency.weekly")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("fields.task")}</span>
          <textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder={t("tasksManager.placeholder")} rows={4} />
        </label>
        <div className="confirm-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>
            {t("actions.cancel")}
          </button>
          <button className="primary-action" type="button" onClick={onSave} disabled={disabled}>
            <Save size={18} />
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
