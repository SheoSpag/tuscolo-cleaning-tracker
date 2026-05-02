import type { AppUser, CleaningRecord, CleaningTask } from "./types";

export type ApiState = {
  users: AppUser[];
  tasks: CleaningTask[];
  records: CleaningRecord[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export const api = {
  state: () => request<ApiState>("/api/state"),
  login: (email: string, password: string) =>
    request<{ user: AppUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  startRegister: (input: { name: string; email: string; password: string; language: string }) =>
    request<{ ok: true; devCode?: string }>("/api/auth/register/start", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  verifyRegister: (email: string, code: string) =>
    request<{ user: AppUser }>("/api/auth/register/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
  saveTasks: (tasks: CleaningTask[]) =>
    request<{ tasks: CleaningTask[] }>("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ tasks }),
    }),
  saveRecord: (record: CleaningRecord) =>
    request<{ record: CleaningRecord }>("/api/records", {
      method: "POST",
      body: JSON.stringify(record),
    }),
  updateUserRole: (userId: string, role: AppUser["role"]) =>
    request<{ user: AppUser }>(`/api/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
};
