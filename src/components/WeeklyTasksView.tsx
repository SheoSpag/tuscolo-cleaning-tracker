import { Camera, Check, ClipboardCheck, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { AppUser, Area, CleaningRecord, CleaningTask, Employee } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { translateTask } from "../i18n/taskTranslations";

type WeeklyTasksViewProps = {
  areas: Area[];
  allAreas: Area[];
  records: CleaningRecord[];
  users: AppUser[];
  employee: Employee;
  onSave: (record: CleaningRecord) => void;
};

type WeeklyTaskItem = {
  area: Area;
  task: CleaningTask;
};

type WeeklyFilter = "pending" | "done" | "all";

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isCurrentWeek(dateValue: string) {
  const date = new Date(dateValue);
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function weeklyRecordForTask(records: CleaningRecord[], areaId: string, taskId: string) {
  return records.find(
    (record) =>
      record.recordType === "weekly" &&
      record.areaId === areaId &&
      isCurrentWeek(record.createdAt) &&
      record.taskResults?.some((result) => result.taskId === taskId && result.status === "done"),
  );
}

export function WeeklyTasksView({ areas, allAreas, records, users, employee, onSave }: WeeklyTasksViewProps) {
  const { language, t } = useI18n();
  const weeklyAreas = areas.filter((area) => area.id !== "management");
  const weeklyTasks = weeklyAreas.flatMap((area) => area.tasks.filter((task) => task.frequency === "weekly").map((task) => ({ area, task })));
  const uniqueWeeklyTasks = [...new Map(weeklyTasks.map((item) => [`${item.area.id}:${item.task.id}`, item])).values()];
  const doneCount = uniqueWeeklyTasks.filter((item) => weeklyRecordForTask(records, item.area.id, item.task.id)).length;
  const pendingCount = Math.max(uniqueWeeklyTasks.length - doneCount, 0);
  const progress = uniqueWeeklyTasks.length ? Math.round((doneCount / uniqueWeeklyTasks.length) * 100) : 0;
  const managementMode = areas.some((area) => area.id === "management");
  const [activeTask, setActiveTask] = useState<WeeklyTaskItem | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [weeklyFilter, setWeeklyFilter] = useState<WeeklyFilter>("pending");
  const [weeklyAreaFilter, setWeeklyAreaFilter] = useState("all");
  const [weeklySearch, setWeeklySearch] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const openWeeklySubmit = (item: WeeklyTaskItem) => {
    setActiveTask(item);
    setPhotoUrls([]);
    setPhotoError("");
    setCameraError("");
    setCameraOpen(false);
    stopCamera();
  };

  const openWeeklyCamera = () => {
    setCameraError("");
    setPhotoError("");
    stopCamera();
    setCameraOpen(true);
  };

  const capturePhoto = () => {
    if (!videoRef.current || photoUrls.length >= 3) return;

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
    setPhotoUrls((value) => [...value, canvas.toDataURL("image/jpeg", 0.72)].slice(0, 3));
    setPhotoError("");
  };

  const submitWeeklyTask = () => {
    if (!activeTask) return;
    if (photoUrls.length < 1) {
      setPhotoError(t("weekly.photoRequirement"));
      return;
    }

    onSave({
      id: crypto.randomUUID(),
      employeeId: employee.id,
      areaId: activeTask.area.id,
      sectorId: activeTask.area.id,
      recordType: "weekly",
      status: "completed",
      failedTaskId: null,
      failedTaskLabel: null,
      failedTaskIds: [],
      failedTaskLabels: [],
      failedTaskReasons: [],
      taskResults: [
        {
          taskId: activeTask.task.id,
          label: activeTask.task.question,
          status: "done",
          photoUrls,
        },
      ],
      photoUrl: photoUrls[0] ?? null,
      photoUrls,
      comment: null,
      createdAt: new Date().toISOString(),
    });
    setActiveTask(null);
    setPhotoUrls([]);
    setCameraOpen(false);
    stopCamera();
  };

  const weeklyRecords = records.filter((record) => record.recordType === "weekly" && isCurrentWeek(record.createdAt));
  const reviewRecords = records.filter((record) => record.recordType === "weekly-review" && isCurrentWeek(record.createdAt));
  const pendingReviewRecords = weeklyRecords.filter((record) => !reviewRecords.some((review) => review.reviewedRecordId === record.id));
  const weeklyTaskRows = uniqueWeeklyTasks
    .map((item) => ({
      ...item,
      doneRecord: weeklyRecordForTask(records, item.area.id, item.task.id),
    }))
    .sort((left, right) => Number(Boolean(left.doneRecord)) - Number(Boolean(right.doneRecord)));
  const filteredWeeklyTaskRows = weeklyTaskRows
    .filter((item) => (weeklyFilter === "all" ? true : weeklyFilter === "done" ? Boolean(item.doneRecord) : !item.doneRecord))
    .filter((item) => (weeklyAreaFilter === "all" ? true : item.area.id === weeklyAreaFilter))
    .filter((item) => translateTask(item.task, language).toLowerCase().includes(weeklySearch.trim().toLowerCase()));

  const validateWeeklyRecord = (record: CleaningRecord) => {
    onSave({
      id: crypto.randomUUID(),
      employeeId: employee.id,
      areaId: "management",
      sectorId: "management",
      recordType: "weekly-review",
      status: "completed",
      reviewedRecordId: record.id,
      reviewedById: employee.id,
      reviewedAt: new Date().toISOString(),
      taskResults: record.taskResults ?? [],
      photoUrl: record.photoUrl ?? null,
      photoUrls: record.photoUrls ?? [],
      comment: t("weekly.validated"),
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <section className="weekly-section">
      <div className="section-heading">
        <div>
          <p>{t("weekly.kicker")}</p>
          <h2>{t("weekly.title")}</h2>
        </div>
      </div>

      <div className="weekly-progress-grid">
        <article>
          <span>{t("weekly.progress")}</span>
          <strong>{progress}%</strong>
          <div className="bar-track">
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>{pendingCount ? `${pendingCount} ${t("weekly.remainingToFull")}` : t("weekly.fullCompleted")}</p>
        </article>
        <article>
          <span>{t("weekly.done")}</span>
          <strong>{doneCount}</strong>
        </article>
        <article>
          <span>{t("weekly.pending")}</span>
          <strong>{pendingCount}</strong>
        </article>
      </div>

      {uniqueWeeklyTasks.length ? (
        <>
          <div className="weekly-filter-row" aria-label={t("weekly.quickFilters")}>
            <button className={weeklyFilter === "pending" ? "active" : ""} type="button" onClick={() => setWeeklyFilter("pending")}>
              {t("weekly.showPending")} ({pendingCount})
            </button>
            <button className={weeklyFilter === "done" ? "active" : ""} type="button" onClick={() => setWeeklyFilter("done")}>
              {t("weekly.showDone")} ({doneCount})
            </button>
            <button className={weeklyFilter === "all" ? "active" : ""} type="button" onClick={() => setWeeklyFilter("all")}>
              {t("weekly.showAll")}
            </button>
          </div>
          <div className="weekly-filter-controls">
            <label className="field search-field">
              <span>{t("fields.search")}</span>
              <div>
                <Search size={18} />
                <input value={weeklySearch} onChange={(event) => setWeeklySearch(event.target.value)} placeholder={t("weekly.searchPlaceholder")} />
              </div>
            </label>
            <label className="field">
              <span>{t("fields.area")}</span>
              <select value={weeklyAreaFilter} onChange={(event) => setWeeklyAreaFilter(event.target.value)}>
                <option value="all">{t("weekly.allAreas")}</option>
                {weeklyAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {t(area.nameKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="weekly-task-list">
          {filteredWeeklyTaskRows.map((item) => {
            const doneRecord = item.doneRecord;
            const user = doneRecord ? users.find((candidate) => candidate.id === doneRecord.employeeId) : null;

            return (
              <article className="weekly-task-row" key={`${item.area.id}-${item.task.id}`}>
                <div>
                  <span>{t(item.area.nameKey)}</span>
                  <strong>{translateTask(item.task, language)}</strong>
                  {doneRecord ? <p>{t("weekly.doneBy")}: {user?.name ?? doneRecord.employeeId}</p> : <p>{t("weekly.pending")}</p>}
                </div>
                {doneRecord ? (
                  <Check size={22} className="success-icon" />
                ) : (
                  <button className="secondary-action" type="button" onClick={() => openWeeklySubmit(item)}>
                    <Camera size={18} />
                    {t("actions.submitWeekly")}
                  </button>
                )}
              </article>
            );
          })}
          {!filteredWeeklyTaskRows.length ? <p className="empty-state">{t("weekly.emptyFilter")}</p> : null}
          </div>
        </>
      ) : (
        <p className="empty-state">{t("weekly.empty")}</p>
      )}

      {managementMode ? (
        <article className="management-review-panel">
          <div className="section-heading">
            <div>
              <p>{t("weekly.managementHelp")}</p>
              <h2>{t("weekly.managementTitle")}</h2>
            </div>
            <ShieldCheck size={24} />
          </div>
          {pendingReviewRecords.length ? (
            <div className="weekly-task-list">
              {pendingReviewRecords.map((record) => {
                const result = record.taskResults?.[0];
                const user = users.find((candidate) => candidate.id === record.employeeId);
                const area = allAreas.find((candidate) => candidate.id === record.areaId);
                const photos = record.photoUrls ?? [];

                return (
                  <article className="weekly-task-row" key={record.id}>
                    <div>
                      <span>{area ? t(area.nameKey) : record.areaId}</span>
                      <strong>{result ? translateTask({ id: result.taskId, areaId: record.areaId, frequency: "weekly", question: result.label }, language) : t("fields.task")}</strong>
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
                    <button className="secondary-action" type="button" onClick={() => validateWeeklyRecord(record)}>
                      <ClipboardCheck size={18} />
                      {t("actions.validateWeekly")}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">{t("weekly.noReviews")}</p>
          )}
        </article>
      ) : null}

      {activeTask ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="weekly-submit-title">
          <div className="confirm-no-photo">
            <h3 id="weekly-submit-title">{translateTask(activeTask.task, language)}</h3>
            <p className="muted">{t(activeTask.area.nameKey)}</p>
            <p className="muted">{t("weekly.photoHelp")}</p>
            {photoError ? <p className="error-text">{photoError}</p> : null}
            {photoUrls.length ? (
              <div className="photo-thumb-grid">
                {photoUrls.map((photoUrl, index) => (
                  <div className="photo-thumb" key={index}>
                    <img src={photoUrl} alt={`${t("records.photo")} ${index + 1}`} />
                    <button type="button" onClick={() => setPhotoUrls((value) => value.filter((_, photoIndex) => photoIndex !== index))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button className="secondary-action" type="button" onClick={openWeeklyCamera} disabled={photoUrls.length >= 3}>
              <Camera size={18} />
              {t("actions.addPhoto")}
            </button>
            <div className="confirm-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setActiveTask(null);
                  setCameraOpen(false);
                  stopCamera();
                }}
              >
                {t("actions.cancel")}
              </button>
              <button className="primary-action" type="button" onClick={submitWeeklyTask}>
                <Check size={18} />
                {t("actions.submitWeekly")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <WeeklyCameraModal
          totalPhotos={photoUrls.length}
          maxPhotos={3}
          cameraError={cameraError}
          isCameraStarting={isCameraStarting}
          videoRef={videoRef}
          onCancel={() => {
            setCameraOpen(false);
            stopCamera();
          }}
          onCapture={capturePhoto}
        />
      ) : null}
    </section>
  );
}

type WeeklyCameraModalProps = {
  totalPhotos: number;
  maxPhotos: number;
  cameraError: string;
  isCameraStarting: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onCancel: () => void;
  onCapture: () => void;
};

function WeeklyCameraModal({ totalPhotos, maxPhotos, cameraError, isCameraStarting, videoRef, onCancel, onCapture }: WeeklyCameraModalProps) {
  const { t } = useI18n();
  const reachedTotalLimit = totalPhotos >= maxPhotos;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="weekly-camera-title">
      <div className="camera-modal">
        <div>
          <h3 id="weekly-camera-title">{t("wizard.cameraTitle")}</h3>
          <p className="muted">{t("wizard.cameraHelp")}</p>
        </div>
        <div className="camera-session-summary">
          <strong>{totalPhotos}/{maxPhotos}</strong>
          <span>{t("wizard.photoTotal")}</span>
        </div>
        <div className="camera-preview">
          {cameraError ? <p className="error-text">{cameraError}</p> : null}
          {!cameraError ? <video ref={videoRef} playsInline muted /> : null}
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
