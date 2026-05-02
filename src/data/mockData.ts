import type { AppUser, Area } from "../types";
import { haccpTasks } from "./haccpTasks";

export const defaultUsers: AppUser[] = [
  { id: "admin-1", name: "Tuscolo Admin", email: "admin@tuscolo.de", password: "admin123", language: "es", role: "admin" },
  { id: "emp-1", name: "Giulia Rossi", email: "giulia@tuscolo.de", password: "demo123", language: "it", role: "employee" },
  { id: "emp-2", name: "Marco Schneider", email: "marco@tuscolo.de", password: "demo123", language: "de", role: "employee" },
  { id: "emp-3", name: "Lucia Garcia", email: "lucia@tuscolo.de", password: "demo123", language: "es", role: "employee" },
  { id: "emp-4", name: "Anna Miller", email: "anna@tuscolo.de", password: "demo123", language: "en", role: "employee" },
];

export const employees = defaultUsers;

const areaIds = [
  "bar",
  "cold-kitchen",
  "pasta-kitchen",
  "pizza",
  "prep-kitchen",
  "dishwashing",
  "general-kitchen",
  "storage",
  "service",
  "surroundings",
] as const;

export const areas: Area[] = areaIds.map((areaId) => ({
  id: areaId,
  nameKey: `areas.${areaId}`,
  tasks: haccpTasks.filter((task) => task.areaId === areaId),
}));

export const defaultTasks = haccpTasks;
