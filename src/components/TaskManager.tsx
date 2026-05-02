import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
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

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.areaId === areaId),
    [areaId, tasks],
  );

  const addTask = () => {
    const question = newQuestion.trim();
    if (!question) {
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

      <div className="task-manager-controls">
        <label className="field">
          <span>{t("fields.area")}</span>
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {t(area.nameKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("fields.frequency")}</span>
          <select value={newFrequency} onChange={(event) => setNewFrequency(event.target.value as CleaningTask["frequency"])}>
            <option value="daily">{t("frequency.daily")}</option>
            <option value="weekly">{t("frequency.weekly")}</option>
          </select>
        </label>
      </div>

      <div className="new-task-row">
        <label className="field">
          <span>{t("fields.task")}</span>
          <textarea
            value={newQuestion}
            onChange={(event) => setNewQuestion(event.target.value)}
            placeholder={t("tasksManager.placeholder")}
            rows={2}
          />
        </label>
        <button className="primary-action" type="button" onClick={addTask}>
          <Plus size={18} />
          {t("actions.add")}
        </button>
      </div>

      {selectedTasks.length === 0 ? (
        <p className="empty-state">{t("tasksManager.empty")}</p>
      ) : (
        <div className="task-list">
          {selectedTasks.map((task) => (
            <article className="task-row" key={task.id}>
              {editingTaskId === task.id ? (
                <>
                  <label className="field">
                    <span>{t("fields.task")}</span>
                    <textarea value={editingQuestion} onChange={(event) => setEditingQuestion(event.target.value)} rows={2} />
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
                  <div>
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
    </section>
  );
}
