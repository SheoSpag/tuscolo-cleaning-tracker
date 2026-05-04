import type { AppUser, Area, Branch } from "../types";
import { operationalGroupIds } from "./cleaningGroups";
import { haccpTasks } from "./haccpTasks";

export const defaultBranches: Branch[] = [
  {
    id: "branch-frankenbad",
    name: "Frankenbad",
    areaIds: [...operationalGroupIds],
  },
  {
    id: "branch-muensterblick",
    name: "Münsterblick",
    areaIds: ["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule"],
  },
  {
    id: "branch-siegburg",
    name: "Siegburg",
    areaIds: ["bar", "kitchen-pizza", "service", "spule"],
  },
  {
    id: "branch-colonia",
    name: "Colonia Tuscolo",
    areaIds: ["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule"],
  },
  {
    id: "branch-rheinbach",
    name: "Rheinbach",
    areaIds: ["bar", "kitchen-pasta", "service", "spule"],
  },
];

export const defaultUsers: AppUser[] = [
  {
    id: "admin-1",
    name: "Tuscolo Admin",
    email: "admin@tuscolo.de",
    password: "admin123",
    language: "es",
    role: "admin",
    assignedBranchIds: defaultBranches.map((branch) => branch.id),
    assignedSectorIds: ["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule", "management"],
  },
  {
    id: "test-employee-1",
    name: "Usuario Prueba",
    email: "prueba@tuscolo.de",
    password: "prueba123",
    language: "es",
    role: "employee",
    assignedBranchIds: ["branch-frankenbad"],
    assignedSectorIds: ["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule"],
  },
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
