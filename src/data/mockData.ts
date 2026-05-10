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

const demoBranchTeams: Record<string, Array<[string, string, AppUser["language"], string[]]>> = {
  "branch-frankenbad": [
    ["ana-molina", "Ana Molina", "es", ["bar", "service"]],
    ["giulia-conti", "Giulia Conti", "it", ["kitchen-pasta"]],
    ["niklas-weber", "Niklas Weber", "de", ["spule", "service"]],
    ["mateo-rossi", "Mateo Rossi", "it", ["kitchen-pizza"]],
    ["lara-schmidt", "Lara Schmidt", "de", ["kitchen-salad"]],
    ["sofia-navarro", "Sofia Navarro", "es", ["bar", "spule"]],
    ["jonas-klein", "Jonas Klein", "de", ["kitchen-pasta", "kitchen-pizza"]],
  ],
  "branch-muensterblick": [
    ["maria-keller", "Maria Keller", "de", ["bar", "service"]],
    ["alessio-ferri", "Alessio Ferri", "it", ["kitchen-pizza"]],
    ["clara-hansen", "Clara Hansen", "de", ["kitchen-salad"]],
    ["diego-ramos", "Diego Ramos", "es", ["spule"]],
    ["emilia-greco", "Emilia Greco", "it", ["kitchen-pasta"]],
    ["tom-becker", "Tom Becker", "de", ["service"]],
    ["valentina-soler", "Valentina Soler", "es", ["bar", "kitchen-salad"]],
  ],
  "branch-siegburg": [
    ["amin-yilmaz", "Amin Yilmaz", "de", ["spule", "kitchen-pizza"]],
    ["francesca-lupo", "Francesca Lupo", "it", ["bar"]],
    ["paula-martin", "Paula Martin", "es", ["service"]],
    ["ben-hoffmann", "Ben Hoffmann", "de", ["kitchen-pizza"]],
    ["noemi-ricci", "Noemi Ricci", "it", ["spule"]],
    ["marco-santos", "Marco Santos", "es", ["bar", "service"]],
    ["julia-wagner", "Julia Wagner", "de", ["kitchen-pizza", "spule"]],
  ],
  "branch-colonia": [
    ["sofia-bianchi", "Sofia Bianchi", "es", ["kitchen-salad", "service"]],
    ["luca-romano", "Luca Romano", "it", ["kitchen-pasta", "kitchen-pizza"]],
    ["mia-schulz", "Mia Schulz", "de", ["bar"]],
    ["andrea-moretti", "Andrea Moretti", "it", ["spule"]],
    ["carmen-ortega", "Carmen Ortega", "es", ["service", "bar"]],
    ["felix-bauer", "Felix Bauer", "de", ["kitchen-pasta"]],
    ["chiara-fabbri", "Chiara Fabbri", "it", ["kitchen-salad"]],
  ],
  "branch-rheinbach": [
    ["elena-fischer", "Elena Fischer", "en", ["bar", "kitchen-pasta", "service"]],
    ["roberto-villa", "Roberto Villa", "it", ["kitchen-pasta"]],
    ["marina-lopez", "Marina Lopez", "es", ["service"]],
    ["tim-schneider", "Tim Schneider", "de", ["spule"]],
    ["nina-hartmann", "Nina Hartmann", "de", ["bar"]],
    ["fabio-rinaldi", "Fabio Rinaldi", "it", ["kitchen-pasta", "service"]],
    ["laura-ibarra", "Laura Ibarra", "es", ["spule", "bar"]],
  ],
};

const demoEmployeeUsers: AppUser[] = Object.entries(demoBranchTeams).flatMap(([branchId, team]) =>
  team.map(([slug, name, language, sectorIds]) => ({
    id: `demo-${slug}`,
    name,
    email: `${slug}@tuscolo-demo.de`,
    password: "demo1234",
    language,
    role: "employee",
    assignedBranchIds: [branchId],
    assignedSectorIds: sectorIds,
  })),
);

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
  ...demoEmployeeUsers,
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
