export type Language = "es" | "de" | "en" | "it";

export type RecordStatus = "completed" | "incomplete";
export type UserRole = "admin" | "employee";
export type CleaningFrequency = "daily" | "weekly";
export type CleaningRecordType = "daily" | "weekly" | "weekly-review";

export type BranchArea = {
  id: string;
  name: string;
};

export type Branch = {
  id: string;
  name: string;
  areaIds: string[];
  customAreas?: BranchArea[];
};

export type Employee = {
  id: string;
  name: string;
  language: Language;
};

export type AppUser = Employee & {
  email: string;
  password?: string;
  role: UserRole;
  assignedBranchIds?: string[];
  assignedSectorIds?: string[];
};

export type Area = {
  id: string;
  nameKey: string;
  tasks: CleaningTask[];
};

export type CleaningTask = {
  id: string;
  areaId: string;
  question: string;
  frequency: CleaningFrequency;
};

export type TaskResult = {
  taskId: string;
  label: string;
  status: "done" | "not_done";
  reason?: string | null;
  photoUrls?: string[];
};

export type CleaningRecord = {
  id: string;
  employeeId: string;
  branchId?: string;
  areaId: string;
  sectorId?: string;
  recordType?: CleaningRecordType;
  status: RecordStatus;
  taskResults?: TaskResult[];
  failedTaskId?: string | null;
  failedTaskLabel?: string | null;
  failedTaskIds?: string[];
  failedTaskLabels?: string[];
  failedTaskReasons?: Array<{
    taskId: string;
    label: string;
    reason: string;
  }>;
  comment?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[];
  reviewedRecordId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};
