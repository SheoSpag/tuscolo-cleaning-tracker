import type { Area, CleaningTask } from "../types";

export type CleaningGroupId = "bar" | "kitchen" | "service" | "spule" | "management";

export type CleaningGroupDefinition = {
  id: CleaningGroupId;
  nameKey: string;
  areaIds: string[];
  extraTaskIds?: string[];
  managementOnly?: boolean;
};

export const cleaningGroups: CleaningGroupDefinition[] = [
  {
    id: "bar",
    nameKey: "groups.bar",
    areaIds: ["bar"],
    extraTaskIds: ["storage-daily-6", "storage-weekly-8"],
  },
  {
    id: "kitchen",
    nameKey: "groups.kitchen",
    areaIds: ["cold-kitchen", "pasta-kitchen", "pizza", "prep-kitchen", "general-kitchen"],
    extraTaskIds: ["storage-daily-1", "storage-daily-2", "storage-daily-3", "storage-daily-4", "storage-daily-7", "general-kitchen-weekly-7"],
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

export const operationalGroupIds = cleaningGroups.filter((group) => !group.managementOnly).map((group) => group.id);
export const allGroupIds = cleaningGroups.map((group) => group.id);

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
