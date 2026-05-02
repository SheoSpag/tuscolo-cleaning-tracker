import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Area, CleaningRecord, CleaningTask, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type CleaningWizardProps = {
  area: Area;
  employee: Employee;
  onSave: (record: CleaningRecord) => void;
};

export function CleaningWizard({ area, employee, onSave }: CleaningWizardProps) {
  const { language, t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [failedTasks, setFailedTasks] = useState<CleaningTask[]>([]);
  const [comment, setComment] = useState("");
  const [taskPhotoUrls, setTaskPhotoUrls] = useState<Record<string, string>>({});
  const [pendingAnswer, setPendingAnswer] = useState<"yes" | "no" | null>(null);
  const [pendingFailureTask, setPendingFailureTask] = useState<CleaningTask | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [failedTaskReasons, setFailedTaskReasons] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const currentTask = area.tasks[stepIndex];
  const finishedChecklist = stepIndex >= area.tasks.length;
  const hasFailures = failedTasks.length > 0;
  const currentPhotoUrl = currentTask ? taskPhotoUrls[currentTask.id] : null;
  const attachedPhotoUrls = Object.values(taskPhotoUrls);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 1200);
  };

  const createBaseRecord = (): Omit<CleaningRecord, "status"> => ({
    id: crypto.randomUUID(),
    employeeId: employee.id,
    areaId: area.id,
    comment: comment.trim() || null,
    photoUrl: attachedPhotoUrls[0] ?? null,
    photoUrls: attachedPhotoUrls,
    createdAt: new Date().toISOString(),
  });

  const advanceWithAnswer = (answer: "yes" | "no", options?: { withoutPhoto?: boolean }) => {
    if (options?.withoutPhoto) {
      showFeedback(t("feedback.stepSavedWithoutPhoto"));
    }

    if (answer === "no") {
      setPendingFailureTask(currentTask);
      setFailureReason("");
      setPendingAnswer(null);
      return;
    }

    setStepIndex((value) => value + 1);
    setPendingAnswer(null);
  };

  const saveFailureReason = () => {
    if (!pendingFailureTask) {
      return;
    }

    setFailedTasks((value) => [...value, pendingFailureTask]);
    setFailedTaskReasons((value) => ({
      ...value,
      [pendingFailureTask.id]: failureReason.trim() || t("common.noValue"),
    }));
    setPendingFailureTask(null);
    setFailureReason("");
    setStepIndex((value) => value + 1);
  };

  const answerTask = (answer: "yes" | "no") => {
    if (currentTask.frequency === "daily" && !currentPhotoUrl) {
      setPendingAnswer(answer);
      return;
    }

    advanceWithAnswer(answer);
  };

  const saveIncomplete = () => {
    const translatedFailures = failedTasks.map((task) => translateTask(task, language));

    onSave({
      ...createBaseRecord(),
      status: "incomplete",
      failedTaskId: failedTasks[0]?.id ?? null,
      failedTaskLabel: translatedFailures[0] ?? null,
      failedTaskIds: failedTasks.map((task) => task.id),
      failedTaskLabels: translatedFailures,
      failedTaskReasons: failedTasks.map((task, index) => ({
        taskId: task.id,
        label: task.question,
        reason: failedTaskReasons[task.id] || t("common.noValue"),
      })),
    });
  };

  const saveCompleted = () => {
    onSave({
      ...createBaseRecord(),
      status: "completed",
      failedTaskId: null,
      failedTaskLabel: null,
      failedTaskIds: [],
      failedTaskLabels: [],
      failedTaskReasons: [],
    });
  };

  const handlePhotoChange = (taskId: string, file?: File) => {
    if (!file) {
      setTaskPhotoUrls(({ [taskId]: _removed, ...rest }) => rest);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTaskPhotoUrls((value) => ({
        ...value,
        [taskId]: String(reader.result),
      }));
      setPendingAnswer(null);
      showFeedback(t("feedback.photoUploaded"));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (taskId: string) => {
    setTaskPhotoUrls(({ [taskId]: _removed, ...rest }) => rest);
  };

  if (finishedChecklist && hasFailures) {
    return (
      <section className="wizard-panel">
        <div className="status-badge danger">
          <X size={16} />
          {t("wizard.failedTitle")}
        </div>
        <h2>{t("wizard.reviewIncompleteTitle")}</h2>
        <p className="muted">{t("wizard.failedHelp")}</p>
        <ul className="failed-task-list">
          {failedTasks.map((task) => (
            <li key={task.id}>
              <strong>{translateTask(task, language)}</strong>
              <span>{failedTaskReasons[task.id] || t("common.noValue")}</span>
            </li>
          ))}
        </ul>
        <label className="field">
          <span>{t("fields.comment")}</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
        </label>
        <button className="primary-action danger-action" type="button" onClick={saveIncomplete}>
          <X size={18} />
          {t("actions.saveIncomplete")}
        </button>
      </section>
    );
  }

  if (finishedChecklist) {
    return (
      <section className="wizard-panel">
        <div className="status-badge success">
          <Check size={16} />
          {t("states.completed")}
        </div>
        <h2>{t("wizard.completedReviewTitle")}</h2>
        <label className="field">
          <span>{t("fields.message")}</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
        </label>
        <button className="primary-action" type="button" onClick={saveCompleted}>
          <Check size={18} />
          {t("actions.saveCompleted")}
        </button>
      </section>
    );
  }

  return (
    <section className="wizard-panel">
      <div className="progress-row">
        <span>
          {t("wizard.step")} {stepIndex + 1}/{area.tasks.length}
        </span>
        <strong>{t(area.nameKey)}</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${((stepIndex + 1) / area.tasks.length) * 100}%` }} />
      </div>
      <p className="task-frequency">{t(`frequency.${currentTask.frequency}`)}</p>
      <h2>{translateTask(currentTask, language)}</h2>
      {currentTask.frequency === "daily" ? (
        <>
          {currentPhotoUrl ? (
            <div className="photo-loaded-card">
              <img src={currentPhotoUrl} alt={t("fields.photo")} />
              <div>
                <span>{t("feedback.photoUploaded")}</span>
                <label className="text-file-action">
                  <ImagePlus size={17} />
                  {t("actions.changePhoto")}
                  <input
                    className="file-input-hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handlePhotoChange(currentTask.id, event.target.files?.[0])}
                  />
                </label>
              </div>
              <button className="icon-action danger-icon" type="button" onClick={() => removePhoto(currentTask.id)} aria-label={t("actions.removePhoto")}>
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <label className="file-drop compact-drop">
              <ImagePlus size={24} />
              <span>{t("wizard.stepPhotoHelp")}</span>
              <strong>{t("actions.attachPhoto")}</strong>
              <input
                className="file-input-hidden"
                type="file"
                accept="image/*"
                onChange={(event) => handlePhotoChange(currentTask.id, event.target.files?.[0])}
              />
            </label>
          )}
        </>
      ) : null}
      <div className="answer-grid">
        <button className="yes-button" type="button" onClick={() => answerTask("yes")}>
          <Check size={22} />
          {t("actions.yes")}
        </button>
        <button className="no-button" type="button" onClick={() => answerTask("no")}>
          <X size={22} />
          {t("actions.no")}
        </button>
      </div>
      {pendingAnswer ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-no-photo-title">
          <div className="confirm-no-photo">
            <h3 id="confirm-no-photo-title">{t("wizard.confirmNoPhoto")}</h3>
            <div className="confirm-actions">
              <button className="secondary-action" type="button" onClick={() => setPendingAnswer(null)}>
                {t("actions.attachPhoto")}
              </button>
              <button className="primary-action" type="button" onClick={() => advanceWithAnswer(pendingAnswer, { withoutPhoto: true })}>
                {t("actions.continueWithoutPhoto")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingFailureTask ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="failure-reason-title">
          <div className="confirm-no-photo">
            <h3 id="failure-reason-title">{t("wizard.reasonTitle")}</h3>
            <p className="muted">{translateTask(pendingFailureTask, language)}</p>
            <label className="field">
              <span>{t("fields.reason")}</span>
              <textarea
                value={failureReason}
                onChange={(event) => setFailureReason(event.target.value)}
                placeholder={t("wizard.reasonPlaceholder")}
                rows={4}
              />
            </label>
            <button className="primary-action" type="button" onClick={saveFailureReason}>
              <Check size={18} />
              {t("actions.saveReason")}
            </button>
          </div>
        </div>
      ) : null}
      {feedback ? (
        <div className="wizard-feedback" role="status" aria-live="polite">
          <Check size={18} />
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
