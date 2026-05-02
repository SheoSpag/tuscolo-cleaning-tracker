export type Language = "es" | "de" | "en" | "it";

export type RecordStatus = "completed" | "incomplete";
export type UserRole = "admin" | "employee";

export type Employee = {
  id: string;
  name: string;
  language: Language;
};

export type AppUser = Employee & {
  email: string;
  password?: string;
  role: UserRole;
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
  frequency: "daily" | "weekly";
};

export type CleaningRecord = {
  id: string;
  employeeId: string;
  areaId: string;
  status: RecordStatus;
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
  createdAt: string;
};
