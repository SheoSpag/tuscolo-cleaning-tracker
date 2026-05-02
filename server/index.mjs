import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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
const verificationCodes = new Map();

const defaultUsers = [
  { id: "admin-1", name: "Tuscolo Admin", email: "admin@tuscolo.de", password: "admin123", language: "es", role: "admin" },
];
const retiredSeedUserIds = new Set(["emp-1", "emp-2", "emp-3", "emp-4"]);

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash).split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
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
  const { passwordHash, pending, ...safeUser } = user;
  return safeUser;
}

function normalizeDb(db) {
  const defaultEmails = new Set(defaultUsers.map((user) => user.email.toLowerCase()));
  const usersWithoutRetiredSeeds = (db.users ?? []).filter((user) => !retiredSeedUserIds.has(user.id));
  const existingEmails = new Set(usersWithoutRetiredSeeds.map((user) => user.email.toLowerCase()));
  const missingDefaults = defaultUsers
    .filter((user) => !existingEmails.has(user.email.toLowerCase()))
    .map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) }));

  return {
    ...db,
    users: [...missingDefaults, ...usersWithoutRetiredSeeds.filter((user) => !defaultEmails.has(user.email.toLowerCase()) || user.id === "admin-1")],
    tasks: db.tasks ?? [],
    records: db.records ?? [],
  };
}

async function createInitialDb() {
  return {
    users: defaultUsers.map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) })),
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
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const db = await readDb();

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, {
      users: db.users.map(publicUser),
      tasks: db.tasks,
      records: db.records,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const { email, password } = await readBody(req);
    const user = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      sendJson(res, 401, { error: "Invalid credentials" });
      return;
    }
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register/start") {
    const { name, email, password, language } = await readBody(req);
    if (!name || !email || !password || String(password).length <= 6) {
      sendJson(res, 400, { error: "Invalid registration data" });
      return;
    }
    if (db.users.some((user) => user.email.toLowerCase() === String(email).toLowerCase())) {
      sendJson(res, 409, { error: "Email exists" });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(String(email).toLowerCase(), {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      user: { id: `user-${randomBytes(8).toString("hex")}`, name, email, language, role: "employee", passwordHash: hashPassword(password) },
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
    sendJson(res, 201, { user: publicUser(pending.user) });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/tasks") {
    const { tasks } = await readBody(req);
    if (!Array.isArray(tasks)) {
      sendJson(res, 400, { error: "Tasks must be an array" });
      return;
    }
    db.tasks = tasks;
    await writeDb(db);
    sendJson(res, 200, { tasks: db.tasks });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/records") {
    const record = await readBody(req);
    db.records = [record, ...db.records.filter((item) => item.id !== record.id)];
    await writeDb(db);
    sendJson(res, 201, { record });
    return;
  }

  const roleMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (req.method === "PATCH" && roleMatch) {
    const { role } = await readBody(req);
    if (role !== "admin" && role !== "employee") {
      sendJson(res, 400, { error: "Invalid role" });
      return;
    }
    const user = db.users.find((item) => item.id === roleMatch[1]);
    if (!user) {
      notFound(res);
      return;
    }
    user.role = role;
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
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Tuscolo backend running on http://${host}:${port}`);
});
