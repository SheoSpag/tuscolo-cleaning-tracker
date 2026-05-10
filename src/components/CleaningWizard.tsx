import { Camera, Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Area, CleaningRecord, CleaningTask, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type CleaningWizardProps = {
  area: Area;
  employee: Employee;
  onSave: (record: CleaningRecord) => void;
};

type Answer = "yes" | "no";

export function CleaningWizard({ area, employee, onSave }: CleaningWizardProps) {
  const { language, t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [photoStage, setPhotoStage] = useState(false);
  const [summaryPhotoUrls, setSummaryPhotoUrls] = useState<string[]>([]);
  const [pendingFailureTask, setPendingFailureTask] = useState<CleaningTask | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stepButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentTask = area.tasks[stepIndex];
  const finishedQuestions = stepIndex >= area.tasks.length;
  const doneTasks = area.tasks.filter((task) => answers[task.id] === "yes");
  const failedTasks = area.tasks.filter((task) => answers[task.id] === "no");
  const attachedPhotoUrls = summaryPhotoUrls;
  const minDailyPhotos = 6;
  const maxDailyPhotos = 8;
  const answeredCount = Math.min(Object.keys(answers).length, area.tasks.length);
  const progressPercent = area.tasks.length ? Math.round((answeredCount / area.tasks.length) * 100) : 0;
  const missingDailyPhotos = Math.max(minDailyPhotos - attachedPhotoUrls.length, 0);
  const hasEnoughDailyPhotos = !doneTasks.length || (attachedPhotoUrls.length >= minDailyPhotos && attachedPhotoUrls.length <= maxDailyPhotos);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!cameraOpen) return undefined;

    let active = true;
    const startCamera = async () => {
      setIsCameraStarting(true);
      setCameraError("");
      stopCamera();

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t("errors.cameraUnavailable"));
        setIsCameraStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError(t("errors.cameraPermission"));
      } finally {
        if (active) setIsCameraStarting(false);
      }
    };

    void startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [cameraOpen]);

  useEffect(() => {
    stepButtonRefs.current[stepIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [area.tasks.length, stepIndex]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 1200);
  };

  const goToStep = (index: number) => {
    setPendingFailureTask(null);
    setFailureReason("");
    setPhotoStage(false);
    setStepIndex(Math.max(0, Math.min(index, area.tasks.length - 1)));
  };

  const previousStep = () => {
    goToStep(stepIndex - 1);
  };

  const answerTask = (answer: Answer) => {
    if (!currentTask) return;

    if (answer === "no") {
      setPendingFailureTask(currentTask);
      setFailureReason("");
      return;
    }

    setAnswers((value) => ({ ...value, [currentTask.id]: answer }));
    setFailureReasons((value) => {
      const next = { ...value };
      delete next[currentTask.id];
      return next;
    });
    setStepIndex((value) => value + 1);
  };

  const saveFailureReason = () => {
    if (!pendingFailureTask) return;

    setAnswers((value) => ({ ...value, [pendingFailureTask.id]: "no" }));
    setFailureReasons((value) => ({
      ...value,
      [pendingFailureTask.id]: failureReason.trim() || t("common.noValue"),
    }));
    setPendingFailureTask(null);
    setFailureReason("");
    setStepIndex((value) => value + 1);
  };

  const openCamera = () => {
    if (summaryPhotoUrls.length >= maxDailyPhotos) return;
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraError("");
    stopCamera();
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    if (summaryPhotoUrls.length >= maxDailyPhotos) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const ratio = Math.min(1, 900 / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.round(sourceWidth * ratio);
    canvas.height = Math.round(sourceHeight * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL("image/jpeg", 0.72);
    setSummaryPhotoUrls((value) => [...value, photoUrl].slice(0, maxDailyPhotos));
    setPhotoError("");
    showFeedback(t("feedback.photoTaken"));
  };

  const removePhoto = (photoIndex: number) => {
    setSummaryPhotoUrls((value) => value.filter((_, index) => index !== photoIndex));
  };

  const createRecord = () => {
    const failedTaskLabels = failedTasks.map((task) => translateTask(task, language));

    return {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      areaId: area.id,
      sectorId: area.id,
      recordType: "daily" as const,
      status: failedTasks.length ? "incomplete" as const : "completed" as const,
      failedTaskId: failedTasks[0]?.id ?? null,
      failedTaskLabel: failedTaskLabels[0] ?? null,
      failedTaskIds: failedTasks.map((task) => task.id),
      failedTaskLabels,
      failedTaskReasons: failedTasks.map((task) => ({
        taskId: task.id,
        label: task.question,
        reason: failureReasons[task.id] || t("common.noValue"),
      })),
      taskResults: area.tasks.map((task) => ({
        taskId: task.id,
        label: task.question,
        status: answers[task.id] === "yes" ? "done" as const : "not_done" as const,
        reason: answers[task.id] === "no" ? failureReasons[task.id] || t("common.noValue") : null,
        photoUrls: [],
      })),
      comment: comment.trim() || null,
      photoUrl: attachedPhotoUrls[0] ?? null,
      photoUrls: attachedPhotoUrls,
      createdAt: new Date().toISOString(),
    } satisfies CleaningRecord;
  };

  const finishRecord = () => {
    if (!hasEnoughDailyPhotos) {
      setPhotoError(t("wizard.photoRequirement"));
      return;
    }

    onSave(createRecord());
  };

  if (finishedQuestions && !photoStage) {
    return (
      <section className="wizard-panel">
        <div className={failedTasks.length ? "status-badge danger" : "status-badge success"}>
          {failedTasks.length ? <X size={16} /> : <Check size={16} />}
          {failedTasks.length ? t("wizard.failedTitle") : t("states.completed")}
        </div>
        <h2>{failedTasks.length ? t("wizard.reviewIncompleteTitle") : t("wizard.completedReviewTitle")}</h2>
        <p className="muted">{t("wizard.failedHelp")}</p>
        {failedTasks.length ? (
          <ul className="failed-task-list">
            {failedTasks.map((task) => (
              <li key={task.id}>
                <strong>{translateTask(task, language)}</strong>
                <span>{failureReasons[task.id] || t("common.noValue")}</span>
                <button className="admin-link-button" type="button" onClick={() => goToStep(area.tasks.findIndex((item) => item.id === task.id))}>
                  {t("wizard.editStep")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="field">
          <span>{failedTasks.length ? t("fields.comment") : t("fields.message")}</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
        </label>
        {doneTasks.length ? (
          <button className="primary-action" type="button" onClick={() => setPhotoStage(true)}>
            <Camera size={18} />
            {t("actions.continueToPhotos")}
          </button>
        ) : (
          <button className="primary-action danger-action" type="button" onClick={finishRecord}>
            <X size={18} />
            {t("actions.saveIncomplete")}
          </button>
        )}
      </section>
    );
  }

  if (photoStage) {
    return (
      <section className="wizard-panel">
        <div className="status-badge success">
          <Camera size={16} />
          {t("wizard.doneTasks")}: {doneTasks.length}
        </div>
        <h2>{t("wizard.photoStageTitle")}</h2>
        <p className="muted">{t("wizard.photoStageHelp")}</p>
        {photoError ? <p className="error-text">{photoError}</p> : null}
        <div className={`photo-progress-card ${hasEnoughDailyPhotos ? "ready" : ""}`}>
          <strong>{attachedPhotoUrls.length}/{maxDailyPhotos}</strong>
          <span>{hasEnoughDailyPhotos ? t("wizard.photosReady") : `${missingDailyPhotos} ${t("wizard.photosRemaining")}`}</span>
          <div className="bar-track">
            <div style={{ width: `${Math.min(100, (attachedPhotoUrls.length / minDailyPhotos) * 100)}%` }} />
          </div>
        </div>
        <div className="photo-checklist">
          <article className="photo-task-card">
            <div>
              <strong>{t("wizard.photoStageTitle")}</strong>
              <span>{attachedPhotoUrls.length}/{maxDailyPhotos} {t("records.photo")}</span>
            </div>
            {summaryPhotoUrls.length ? (
              <div className="photo-thumb-grid">
                {summaryPhotoUrls.map((photoUrl, index) => (
                  <div className="photo-thumb" key={index}>
                    <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                    <button type="button" onClick={() => removePhoto(index)} aria-label={t("actions.removePhoto")}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button className="secondary-action" type="button" onClick={openCamera} disabled={attachedPhotoUrls.length >= maxDailyPhotos}>
              <Camera size={18} />
              {t("actions.addPhoto")}
            </button>
          </article>
        </div>
        <button className={failedTasks.length ? "primary-action danger-action" : "primary-action"} type="button" onClick={finishRecord} disabled={!hasEnoughDailyPhotos}>
          {failedTasks.length ? <X size={18} /> : <Check size={18} />}
          {failedTasks.length ? t("actions.saveIncomplete") : t("actions.saveCompleted")}
        </button>
        {cameraOpen ? (
          <CameraModal
            totalPhotos={attachedPhotoUrls.length}
            maxPhotos={maxDailyPhotos}
            cameraError={cameraError}
            isCameraStarting={isCameraStarting}
            videoRef={videoRef}
            onCancel={closeCamera}
            onCapture={capturePhoto}
          />
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

  return (
    <section className="wizard-panel">
      <div className="progress-row">
        <span>
          {t("wizard.step")} {stepIndex + 1}/{area.tasks.length}
        </span>
        <strong>{t(area.nameKey)}</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="wizard-micro-summary">
        <span>{answeredCount}/{area.tasks.length} {t("wizard.questionCounter")}</span>
        {failedTasks.length ? <strong>{failedTasks.length} {t("states.incomplete")}</strong> : null}
      </div>
      <div className="wizard-step-strip" aria-label={t("wizard.stepMap")}>
        {area.tasks.map((task, index) => {
          const answer = answers[task.id];
          return (
            <button
              className={`${index === stepIndex ? "active" : ""} ${answer === "yes" ? "done" : answer === "no" ? "failed" : ""}`}
              type="button"
              onClick={() => goToStep(index)}
              ref={(node) => {
                stepButtonRefs.current[index] = node;
              }}
              key={task.id}
              aria-label={`${t("wizard.step")} ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <p className="task-frequency">{t("frequency.daily")}</p>
      <h2>{translateTask(currentTask, language)}</h2>
      <div className="answer-grid wizard-actions">
        <button className="secondary-action" type="button" onClick={previousStep} disabled={stepIndex === 0}>
          {t("actions.back")}
        </button>
        <button className="yes-button" type="button" onClick={() => answerTask("yes")}>
          <Check size={22} />
          {t("actions.yes")}
        </button>
        <button className="no-button" type="button" onClick={() => answerTask("no")}>
          <X size={22} />
          {t("actions.no")}
        </button>
      </div>
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
            <div className="confirm-actions">
              <button className="secondary-action" type="button" onClick={() => setPendingFailureTask(null)}>
                {t("actions.back")}
              </button>
              <button className="primary-action" type="button" onClick={saveFailureReason}>
                <Check size={18} />
                {t("actions.saveReason")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type CameraModalProps = {
  totalPhotos: number;
  maxPhotos: number;
  cameraError: string;
  isCameraStarting: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCancel: () => void;
  onCapture: () => void;
};

function CameraModal({
  totalPhotos,
  maxPhotos,
  cameraError,
  isCameraStarting,
  videoRef,
  onCancel,
  onCapture,
}: CameraModalProps) {
  const { t } = useI18n();
  const reachedTotalLimit = totalPhotos >= maxPhotos;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera-modal">
        <div>
          <h3 id="camera-title">{t("wizard.cameraTitle")}</h3>
          <p className="muted">{t("wizard.dynamicCameraHelp")}</p>
        </div>
        <div className="camera-session-summary">
          <strong>{totalPhotos}/{maxPhotos}</strong>
          <span>{t("wizard.photoTotal")}</span>
        </div>
        <div className="camera-preview">
          {cameraError ? <p className="error-text">{cameraError}</p> : null}
          {!cameraError ? <video ref={videoRef} playsInline muted autoPlay /> : null}
          {isCameraStarting ? <span>{t("wizard.cameraStarting")}</span> : null}
        </div>
        <div className="confirm-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>
            {t("actions.done")}
          </button>
          <button className="primary-action" type="button" onClick={onCapture} disabled={Boolean(cameraError) || isCameraStarting || reachedTotalLimit}>
            <Camera size={18} />
            {t("actions.capturePhoto")}
          </button>
        </div>
      </div>
    </div>
  );
}
