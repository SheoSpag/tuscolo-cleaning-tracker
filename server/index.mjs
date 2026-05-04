import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "Tuscolo <onboarding@resend.dev>";
const sessionSecret = process.env.SESSION_SECRET || "dev-only-change-me";
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 40 * 1024 * 1024);
const maxRecordPhotoBytes = Number(process.env.MAX_RECORD_PHOTO_BYTES || 32 * 1024 * 1024);
const supportedLanguages = new Set(["es", "de", "en", "it"]);
const supportedOperationalAreaIds = new Set(["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule"]);
const supportedSectorIds = new Set(["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule", "management"]);
const legacySectorAssignments = {
  kitchen: ["kitchen-pasta", "kitchen-salad", "kitchen-pizza"],
};
const verificationCodes = new Map();
const rateLimits = new Map();

const defaultBranches = [
  {
    id: "branch-frankenbad",
    name: "Frankenbad",
    areaIds: [...supportedOperationalAreaIds],
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

const defaultUsers = [
  {
    id: "admin-1",
    name: process.env.INITIAL_ADMIN_NAME || "Tuscolo Admin",
    email: process.env.INITIAL_ADMIN_EMAIL || "admin@tuscolo.de",
    password: process.env.INITIAL_ADMIN_PASSWORD || "admin123",
    language: normalizeLanguage(process.env.INITIAL_ADMIN_LANGUAGE),
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
const retiredSeedUserIds = new Set(["emp-1", "emp-2", "emp-3", "emp-4"]);

function normalizeLanguage(language) {
  return supportedLanguages.has(String(language)) ? String(language) : "es";
}

function normalizeSectorIds(sectorIds, fallback = []) {
  if (!Array.isArray(sectorIds)) return fallback;
  return [
    ...new Set(
      sectorIds
        .map(String)
        .flatMap((sectorId) => legacySectorAssignments[sectorId] ?? [sectorId])
        .filter((sectorId) => supportedSectorIds.has(sectorId)),
    ),
  ];
}

function normalizeBranchAreaIds(areaIds, fallback = [...supportedOperationalAreaIds]) {
  if (!Array.isArray(areaIds)) return fallback;
  return [...new Set(areaIds.map(String).filter((areaId) => supportedOperationalAreaIds.has(areaId)))];
}

function normalizeBranches(branches) {
  const candidates = Array.isArray(branches) && branches.length ? branches : defaultBranches;
  const normalized = candidates
    .map((branch) => ({
      id: String(branch?.id || "").trim(),
      name: String(branch?.name || "").trim(),
      areaIds: normalizeBranchAreaIds(branch?.areaIds),
    }))
    .filter((branch) => branch.id && branch.name);

  const uniqueBranches = [...new Map(normalized.map((branch) => [branch.id, branch])).values()];
  return uniqueBranches.length ? uniqueBranches : defaultBranches;
}

function normalizeBranchIds(branchIds, branches, fallback = []) {
  const supportedBranchIds = new Set(branches.map((branch) => branch.id));
  if (!Array.isArray(branchIds)) return fallback.filter((branchId) => supportedBranchIds.has(branchId));
  return [...new Set(branchIds.map(String).filter((branchId) => supportedBranchIds.has(branchId)))];
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash).split(":");

  if (parts[0] === "scrypt") {
    const [, salt, hash] = parts;
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64).toString("hex");
    if (candidate.length !== hash.length) return false;
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
  }

  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  const candidate = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  if (candidate.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = String(token).split(".");
    if (!header || !body || !signature) return null;
    const expected = createHmac("sha256", sessionSecret).update(`${header}.${body}`).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function createSession(user) {
  return signToken({
    sub: user.id,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function getAuthUser(req, db) {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  return db.users.find((user) => user.id === payload.sub) ?? null;
}

function estimateDataUrlBytes(value) {
  const match = String(value).match(/^data:[^;]+;base64,(.+)$/);
  if (!match) return 0;
  return Math.floor((match[1].length * 3) / 4);
}

function validateRecordPayload(record) {
  if (!record || typeof record !== "object") return "Invalid record";
  if (!record.id || !record.employeeId || !record.areaId || !record.createdAt) return "Missing record fields";
  if (record.status !== "completed" && record.status !== "incomplete") return "Invalid record status";
  const photos = Array.isArray(record.photoUrls) ? record.photoUrls : record.photoUrl ? [record.photoUrl] : [];
  const totalPhotoBytes = photos.reduce((sum, photoUrl) => sum + estimateDataUrlBytes(photoUrl), 0);
  if (totalPhotoBytes > maxRecordPhotoBytes) return "Photos too large";
  return null;
}

function validateTasksPayload(tasks) {
  if (!Array.isArray(tasks)) return "Tasks must be an array";
  const seenIds = new Set();
  for (const task of tasks) {
    if (!task || typeof task !== "object") return "Invalid task";
    if (!task.id || !task.areaId || !task.question) return "Missing task fields";
    if (task.frequency !== "daily" && task.frequency !== "weekly") return "Invalid task frequency";
    if (seenIds.has(task.id)) return "Duplicated task id";
    seenIds.add(task.id);
  }
  return null;
}

function validateBranchesPayload(branches) {
  if (!Array.isArray(branches)) return "Branches must be an array";
  if (branches.length < 1) return "At least one branch is required";
  const seenIds = new Set();
  for (const branch of branches) {
    if (!branch || typeof branch !== "object") return "Invalid branch";
    if (!branch.id || !branch.name) return "Missing branch fields";
    if (seenIds.has(branch.id)) return "Duplicated branch id";
    seenIds.add(branch.id);
    if (!Array.isArray(branch.areaIds)) return "Branch areas must be an array";
    if (branch.areaIds.some((areaId) => !supportedOperationalAreaIds.has(String(areaId)))) return "Invalid branch area";
  }
  return null;
}

function checkRateLimit(req, bucket, limit, windowMs) {
  const ip = req.socket.remoteAddress ?? "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

async function loadSeedTasks() {
  const file = await fs.readFile(path.join(rootDir, "src/data/haccpTasks.ts"), "utf8");
  const tasks = [];
  const pattern = /\{ id: "([^"]+)", areaId: "([^"]+)", frequency: "(daily|weekly)", question: "([^"]*)" \}/g;
  for (const match of file.matchAll(pattern)) {
    tasks.push({ id: match[1], areaId: match[2], frequency: match[3], question: match[4] });
  }
  return tasks;
}

function publicUser(user) {
  const { password, passwordHash, pending, ...safeUser } = user;
  return safeUser;
}

function normalizeDb(db) {
  const branches = normalizeBranches(db.branches);
  const fallbackBranchId = branches[0]?.id ?? defaultBranches[0].id;
  const defaultAdminBranchIds = branches.map((branch) => branch.id);
  const usersWithoutRetiredSeeds = (db.users ?? []).filter((user) => !retiredSeedUserIds.has(user.id));
  const existingIds = new Set(usersWithoutRetiredSeeds.map((user) => user.id));
  const existingEmails = new Set(usersWithoutRetiredSeeds.map((user) => user.email.toLowerCase()));
  const missingDefaults = defaultUsers
    .filter((user) => !existingIds.has(user.id) && !existingEmails.has(user.email.toLowerCase()))
    .map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) }));

  const users = [...missingDefaults, ...usersWithoutRetiredSeeds];
  const seededAdmin = users.find((user) => user.id === "admin-1");
  const defaultAdmin = defaultUsers[0];
  if (seededAdmin) {
    seededAdmin.role = "admin";
    seededAdmin.name = process.env.INITIAL_ADMIN_NAME || seededAdmin.name || defaultAdmin.name;
    seededAdmin.email = process.env.INITIAL_ADMIN_EMAIL || seededAdmin.email || defaultAdmin.email;
    seededAdmin.language = normalizeLanguage(process.env.INITIAL_ADMIN_LANGUAGE || seededAdmin.language);
    seededAdmin.assignedSectorIds = normalizeSectorIds(seededAdmin.assignedSectorIds, defaultAdmin.assignedSectorIds);
    seededAdmin.assignedBranchIds = normalizeBranchIds(seededAdmin.assignedBranchIds, branches, defaultAdminBranchIds);
    if (!seededAdmin.assignedBranchIds.length) {
      seededAdmin.assignedBranchIds = defaultAdminBranchIds;
    }
    if (process.env.INITIAL_ADMIN_PASSWORD && !verifyPassword(process.env.INITIAL_ADMIN_PASSWORD, seededAdmin.passwordHash)) {
      seededAdmin.passwordHash = hashPassword(process.env.INITIAL_ADMIN_PASSWORD);
    }
  }

  const seededTestUser = users.find((user) => user.id === "test-employee-1");
  const defaultTestUser = defaultUsers.find((user) => user.id === "test-employee-1");
  if (seededTestUser && defaultTestUser) {
    seededTestUser.name = seededTestUser.name || defaultTestUser.name;
    seededTestUser.email = seededTestUser.email || defaultTestUser.email;
    seededTestUser.language = normalizeLanguage(seededTestUser.language || defaultTestUser.language);
    seededTestUser.role = "employee";
    seededTestUser.assignedSectorIds = normalizeSectorIds(seededTestUser.assignedSectorIds, defaultTestUser.assignedSectorIds);
    seededTestUser.assignedBranchIds = normalizeBranchIds(seededTestUser.assignedBranchIds, branches, defaultTestUser.assignedBranchIds ?? [fallbackBranchId]);
    if (!seededTestUser.passwordHash || !verifyPassword(defaultTestUser.password, seededTestUser.passwordHash)) {
      seededTestUser.passwordHash = hashPassword(defaultTestUser.password);
    }
  }

  for (const user of users) {
    user.assignedSectorIds = normalizeSectorIds(user.assignedSectorIds, user.role === "admin" ? defaultAdmin.assignedSectorIds : []);
    const fallbackBranchIds = user.role === "admin" ? defaultAdminBranchIds : [fallbackBranchId];
    user.assignedBranchIds = normalizeBranchIds(user.assignedBranchIds, branches, fallbackBranchIds);
    if (user.role === "admin" && !user.assignedBranchIds.length) {
      user.assignedBranchIds = defaultAdminBranchIds;
    }
  }

  return {
    ...db,
    branches,
    users,
    tasks: db.tasks ?? [],
    records: db.records ?? [],
  };
}

async function createInitialDb() {
  return {
    users: defaultUsers.map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) })),
    branches: defaultBranches,
    tasks: await loadSeedTasks(),
    records: [],
  };
}

async function readDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const db = normalizeDb(JSON.parse(await fs.readFile(dbPath, "utf8")));
    await writeDb(db);
    return db;
  } catch {
    const db = await createInitialDb();
    await writeDb(db);
    return db;
  }
}

async function writeDb(db) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw httpError("Request body too large", 413);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError("Invalid JSON", 400);
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(payload);
}

async function sendVerificationEmail({ to, code, name }) {
  if (!resendApiKey) {
    console.log(`[Tuscolo] Verification code for ${to}: ${code}`);
    return { sent: false, devCode: code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject: "Tuscolo Cleaning Tracker - Código de confirmación",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#20231b">
          <h2 style="margin:0 0 12px;color:#6b744d">Tuscolo Cleaning Tracker</h2>
          <p>Hola ${name},</p>
          <p>Tu código de confirmación es:</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:18px 0;color:#20231b">${code}</p>
          <p>Este código vence en 10 minutos.</p>
          <p style="color:#6d7164">Sotto il cielo d’Italia</p>
        </div>
      `,
      text: `Hola ${name}, tu código de confirmación de Tuscolo Cleaning Tracker es ${code}. Vence en 10 minutos.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error: ${body}`);
  }

  return { sent: true };
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function requireAuth(req, res, db) {
  const user = getAuthUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

function requireAdmin(req, res, db) {
  const user = requireAuth(req, res, db);
  if (!user) return null;
  if (user.role !== "admin") {
    sendJson(res, 403, { error: "Forbidden" });
    return null;
  }
  return user;
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const db = await readDb();

  if (req.method === "GET" && url.pathname === "/api/state") {
    const authUser = requireAuth(req, res, db);
    if (!authUser) return;

    const isAdmin = authUser.role === "admin";
    sendJson(res, 200, {
      currentUser: publicUser(authUser),
      users: isAdmin ? db.users.map(publicUser) : [publicUser(authUser)],
      branches: db.branches,
      tasks: db.tasks,
      records: isAdmin ? db.records : db.records.filter((record) => record.employeeId === authUser.id),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    if (!checkRateLimit(req, "login", 12, 15 * 60 * 1000)) {
      sendJson(res, 429, { error: "Too many attempts" });
      return;
    }

    const { email, password } = await readBody(req);
    const user = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      sendJson(res, 401, { error: "Invalid credentials" });
      return;
    }
    sendJson(res, 200, { user: publicUser(user), token: createSession(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register/start") {
    if (!checkRateLimit(req, "register", 8, 15 * 60 * 1000)) {
      sendJson(res, 429, { error: "Too many attempts" });
      return;
    }

    const { name, email, password, language } = await readBody(req);
    if (!name || !email || !password || String(password).length <= 6 || !supportedLanguages.has(String(language))) {
      sendJson(res, 400, { error: "Invalid registration data" });
      return;
    }
    const normalizedLanguage = normalizeLanguage(language);
    if (db.users.some((user) => user.email.toLowerCase() === String(email).toLowerCase())) {
      sendJson(res, 409, { error: "Email exists" });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(String(email).toLowerCase(), {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      user: {
        id: `user-${randomBytes(8).toString("hex")}`,
        name,
        email,
        language: normalizedLanguage,
        role: "employee",
        assignedBranchIds: [],
        assignedSectorIds: [],
        passwordHash: hashPassword(password),
      },
    });

    const emailResult = await sendVerificationEmail({ to: String(email), code, name: String(name) });
    sendJson(res, 200, { ok: true, emailSent: emailResult.sent, devCode: emailResult.devCode });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register/verify") {
    const { email, code } = await readBody(req);
    const key = String(email).toLowerCase();
    const pending = verificationCodes.get(key);
    if (!pending || pending.expiresAt < Date.now() || pending.code !== String(code)) {
      sendJson(res, 400, { error: "Invalid code" });
      return;
    }

    if (db.users.some((user) => user.email.toLowerCase() === key)) {
      verificationCodes.delete(key);
      sendJson(res, 409, { error: "Email exists" });
      return;
    }

    db.users.push(pending.user);
    verificationCodes.delete(key);
    await writeDb(db);
    sendJson(res, 201, { user: publicUser(pending.user), token: createSession(pending.user) });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/tasks") {
    const authUser = requireAdmin(req, res, db);
    if (!authUser) return;

    const { tasks } = await readBody(req);
    const validationError = validateTasksPayload(tasks);
    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }
    db.tasks = tasks;
    await writeDb(db);
    sendJson(res, 200, { tasks: db.tasks });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/branches") {
    const authUser = requireAdmin(req, res, db);
    if (!authUser) return;

    const { branches } = await readBody(req);
    const validationError = validateBranchesPayload(branches);
    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }
    db.branches = normalizeBranches(branches);
    const branchIds = new Set(db.branches.map((branch) => branch.id));
    for (const user of db.users) {
      const fallback = user.role === "admin" ? db.branches.map((branch) => branch.id) : [];
      user.assignedBranchIds = normalizeBranchIds(user.assignedBranchIds, db.branches, fallback);
      if (!user.assignedBranchIds.length && user.role === "employee") {
        user.assignedSectorIds = normalizeSectorIds(user.assignedSectorIds, []);
      }
      user.assignedSectorIds = normalizeSectorIds(user.assignedSectorIds, user.role === "admin" ? ["bar", "kitchen-pasta", "kitchen-salad", "kitchen-pizza", "service", "spule", "management"] : []);
      if (!user.assignedSectorIds.length && user.role === "admin") {
        user.assignedSectorIds = ["management"];
      }
      user.assignedBranchIds = user.assignedBranchIds.filter((branchId) => branchIds.has(branchId));
    }
    await writeDb(db);
    sendJson(res, 200, { branches: db.branches });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/records") {
    const authUser = requireAuth(req, res, db);
    if (!authUser) return;

    const record = await readBody(req);
    const validationError = validateRecordPayload(record);
    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }
    if (authUser.role !== "admin" && record.employeeId !== authUser.id) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    db.records = [record, ...db.records.filter((item) => item.id !== record.id)];
    await writeDb(db);
    sendJson(res, 201, { record });
    return;
  }

  const roleMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (req.method === "PATCH" && roleMatch) {
    const authUser = requireAdmin(req, res, db);
    if (!authUser) return;

    const { role, assignedSectorIds, assignedBranchIds } = await readBody(req);
    if (role !== "admin" && role !== "employee") {
      sendJson(res, 400, { error: "Invalid role" });
      return;
    }
    const user = db.users.find((item) => item.id === roleMatch[1]);
    if (!user) {
      notFound(res);
      return;
    }
    if (user.id === authUser.id && role !== "admin") {
      sendJson(res, 400, { error: "Cannot remove your own admin role" });
      return;
    }
    user.role = role;
    if (Array.isArray(assignedSectorIds)) {
      user.assignedSectorIds = normalizeSectorIds(assignedSectorIds, user.assignedSectorIds);
    }
    if (Array.isArray(assignedBranchIds)) {
      user.assignedBranchIds = normalizeBranchIds(assignedBranchIds, db.branches, user.assignedBranchIds ?? []);
      if (user.role === "admin" && !user.assignedBranchIds.length) {
        user.assignedBranchIds = db.branches.map((branch) => branch.id);
      }
    }
    await writeDb(db);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  notFound(res);
}

async function serveStatic(req, res, url) {
  const distDir = path.join(rootDir, "dist");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(distDir, requestedPath));
  if (!filePath.startsWith(distDir)) {
    notFound(res);
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const contentType = filePath.endsWith(".js")
      ? "text/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : filePath.endsWith(".html")
          ? "text/html"
          : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
    createReadStream(filePath).pipe(res);
  } catch {
    try {
      const indexPath = path.join(distDir, "index.html");
      const stat = await fs.stat(indexPath);
      res.writeHead(200, { "Content-Type": "text/html", "Content-Length": stat.size });
      createReadStream(indexPath).pipe(res);
    } catch {
      sendJson(res, 404, { error: "Build not found. Run npm run build first." });
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode ?? 500, { error: error.statusCode ? error.message : "Internal server error" });
  }
});

server.listen(port, host, () => {
  if (sessionSecret === "dev-only-change-me") {
    console.warn("[Tuscolo] SESSION_SECRET is not configured. Set it before using production traffic.");
  }
  console.log(`Tuscolo backend running on http://${host}:${port}`);
});
