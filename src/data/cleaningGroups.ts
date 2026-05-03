import type { Area, CleaningTask } from "../types";

export type CleaningGroupId =
  | "bar"
  | "kitchen-pasta"
  | "kitchen-salad"
  | "kitchen-pizza"
  | "kitchen-shared"
  | "service"
  | "spule"
  | "management";

export type CleaningGroupDefinition = {
  id: CleaningGroupId;
  nameKey: string;
  areaIds: string[];
  extraTaskIds?: string[];
  managementOnly?: boolean;
  taskManagerOnly?: boolean;
};

const kitchenSharedAreaIds = ["prep-kitchen", "general-kitchen", "kitchen-shared"];
const kitchenSharedExtraTaskIds = ["storage-daily-1", "storage-daily-2", "storage-daily-3", "storage-daily-4", "storage-daily-7", "general-kitchen-weekly-7"];

export const cleaningGroups: CleaningGroupDefinition[] = [
  {
    id: "bar",
    nameKey: "groups.bar",
    areaIds: ["bar"],
    extraTaskIds: ["storage-daily-6", "storage-weekly-8"],
  },
  {
    id: "kitchen-pasta",
    nameKey: "groups.kitchen-pasta",
    areaIds: ["pasta-kitchen", ...kitchenSharedAreaIds],
    extraTaskIds: kitchenSharedExtraTaskIds,
  },
  {
    id: "kitchen-salad",
    nameKey: "groups.kitchen-salad",
    areaIds: ["cold-kitchen", ...kitchenSharedAreaIds],
    extraTaskIds: kitchenSharedExtraTaskIds,
  },
  {
    id: "kitchen-pizza",
    nameKey: "groups.kitchen-pizza",
    areaIds: ["pizza", ...kitchenSharedAreaIds],
    extraTaskIds: kitchenSharedExtraTaskIds,
  },
  {
    id: "kitchen-shared",
    nameKey: "groups.kitchen-shared",
    areaIds: kitchenSharedAreaIds,
    extraTaskIds: kitchenSharedExtraTaskIds,
    taskManagerOnly: true,
  },
  {
    id: "service",
    nameKey: "groups.service",
    areaIds: ["service", "surroundings"],
  },
  {
    id: "spule",
    nameKey: "groups.spule",
    areaIds: ["dishwashing"],
  },
  {
    id: "management",
    nameKey: "groups.management",
    areaIds: [],
    managementOnly: true,
  },
];

export const operationalGroupIds = cleaningGroups.filter((group) => !group.managementOnly && !group.taskManagerOnly).map((group) => group.id);
export const allGroupIds = cleaningGroups.map((group) => group.id);

export const legacyGroupAssignments: Record<string, CleaningGroupId[]> = {
  kitchen: ["kitchen-pasta", "kitchen-salad", "kitchen-pizza"],
};

export function taskBelongsToGroup(task: CleaningTask, group: CleaningGroupDefinition) {
  return group.areaIds.includes(task.areaId) || group.extraTaskIds?.includes(task.id) || task.areaId === group.id;
}

export function buildCleaningGroups(tasks: CleaningTask[]): Area[] {
  return cleaningGroups.map((group) => {
    const groupTasks = tasks.filter((task) => taskBelongsToGroup(task, group));
    const uniqueTasks = [...new Map(groupTasks.map((task) => [task.id, task])).values()];

    return {
      id: group.id,
      nameKey: group.nameKey,
      tasks: uniqueTasks,
    };
  });
}

export function groupForId(groupId: string) {
  return cleaningGroups.find((group) => group.id === groupId);
}

export function isVisibleGroupId(groupId: string) {
  const group = groupForId(groupId);
  return Boolean(group && !group.taskManagerOnly);
}

export function isOperationalGroupId(groupId: string) {
  const group = groupForId(groupId);
  return Boolean(group && !group.managementOnly && !group.taskManagerOnly);
}

export function isTaskManagerGroupId(groupId: string) {
  const group = groupForId(groupId);
  return Boolean(group && !group.managementOnly);
}

export function normalizeGroupAssignments(groupIds: string[] = []) {
  return [
    ...new Set(
      groupIds
        .flatMap((groupId) => legacyGroupAssignments[groupId] ?? [groupId])
        .filter((groupId): groupId is CleaningGroupId => operationalGroupIds.includes(groupId as CleaningGroupId) || groupId === "management"),
    ),
  ];
}
