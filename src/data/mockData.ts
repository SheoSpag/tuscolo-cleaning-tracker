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
  {
    id: "demo-employee-luca",
    name: "Luca Romano",
    email: "luca.romano@tuscolo.de",
    password: "demo1234",
    language: "it",
    role: "employee",
    assignedBranchIds: ["branch-frankenbad", "branch-colonia"],
    assignedSectorIds: ["kitchen-pasta", "kitchen-pizza"],
  },
  {
    id: "demo-employee-maria",
    name: "Maria Keller",
    email: "maria.keller@tuscolo.de",
    password: "demo1234",
    language: "de",
    role: "employee",
    assignedBranchIds: ["branch-muensterblick"],
    assignedSectorIds: ["bar", "service"],
  },
  {
    id: "demo-employee-sofia",
    name: "Sofia Bianchi",
    email: "sofia.bianchi@tuscolo.de",
    password: "demo1234",
    language: "es",
    role: "employee",
    assignedBranchIds: ["branch-colonia"],
    assignedSectorIds: ["kitchen-salad", "service"],
  },
  {
    id: "demo-employee-amin",
    name: "Amin Yilmaz",
    email: "amin.yilmaz@tuscolo.de",
    password: "demo1234",
    language: "de",
    role: "employee",
    assignedBranchIds: ["branch-siegburg"],
    assignedSectorIds: ["spule", "kitchen-pizza"],
  },
  {
    id: "demo-employee-elena",
    name: "Elena Fischer",
    email: "elena.fischer@tuscolo.de",
    password: "demo1234",
    language: "en",
    role: "employee",
    assignedBranchIds: ["branch-rheinbach"],
    assignedSectorIds: ["bar", "kitchen-pasta", "service"],
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
