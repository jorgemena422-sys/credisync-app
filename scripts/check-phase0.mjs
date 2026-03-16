import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  dotenv.config({ path: filePath, override: false });
  return true;
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function value(name) {
  return String(process.env[name] || "").trim();
}

function isEnabled(raw) {
  return ["1", "true", "yes", "on", "si"].includes(String(raw || "").trim().toLowerCase());
}

function isLocalhostUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function looksLikePlaceholder(rawValue) {
  const raw = String(rawValue || "").trim().toLowerCase();
  if (!raw) return true;

  return [
    "your-",
    "replace-",
    "changeme",
    "change-me",
    "example",
    "tu-",
    "dummy"
  ].some((token) => raw.includes(token));
}

function decodeJwtPayload(token) {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

const checks = [];

function pushFail(message) {
  checks.push({ level: "FAIL", message });
}

function pushWarn(message) {
  checks.push({ level: "WARN", message });
}

function pushPass(message) {
  checks.push({ level: "PASS", message });
}

const supabaseUrl = value("SUPABASE_URL");
const serviceRoleKey = value("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = value("SUPABASE_ANON_KEY");
const jwtSecret = value("JWT_SECRET");
const appPublicUrl = value("APP_PUBLIC_URL");
const corsOrigin = value("CORS_ORIGIN");
const superadminBootstrap = value("ENABLE_SUPERADMIN_BOOTSTRAP");

if (!supabaseUrl || looksLikePlaceholder(supabaseUrl)) {
  pushFail("SUPABASE_URL is missing or still placeholder");
} else {
  pushPass("SUPABASE_URL configured");
}

if (!serviceRoleKey || looksLikePlaceholder(serviceRoleKey)) {
  pushFail("SUPABASE_SERVICE_ROLE_KEY is missing or still placeholder");
} else {
  const payload = decodeJwtPayload(serviceRoleKey);
  if (!payload || String(payload.role || "") !== "service_role") {
    pushWarn("SUPABASE_SERVICE_ROLE_KEY does not look like a service_role JWT");
  } else {
    pushPass("SUPABASE_SERVICE_ROLE_KEY looks valid");
  }
}

if (!anonKey || looksLikePlaceholder(anonKey)) {
  pushFail("SUPABASE_ANON_KEY is missing or still placeholder");
} else {
  pushPass("SUPABASE_ANON_KEY configured");
}

if (!jwtSecret || looksLikePlaceholder(jwtSecret)) {
  pushFail("JWT_SECRET is missing or still placeholder");
} else if (jwtSecret.length < 32) {
  pushFail("JWT_SECRET must be at least 32 chars for production");
} else {
  pushPass("JWT_SECRET length is acceptable");
}

if (isEnabled(superadminBootstrap)) {
  pushFail("ENABLE_SUPERADMIN_BOOTSTRAP must be false in production");
} else {
  pushPass("ENABLE_SUPERADMIN_BOOTSTRAP is disabled");
}

if (!appPublicUrl) {
  pushWarn("APP_PUBLIC_URL is not set (recommended for stable absolute URLs)");
} else if (isLocalhostUrl(appPublicUrl)) {
  pushWarn("APP_PUBLIC_URL points to localhost; use your real domain before deploy");
} else {
  pushPass("APP_PUBLIC_URL points to non-localhost host");
}

if (!corsOrigin) {
  pushWarn("CORS_ORIGIN is empty; define your exact production origin");
} else if (isLocalhostUrl(corsOrigin)) {
  pushWarn("CORS_ORIGIN still points to localhost");
} else {
  pushPass("CORS_ORIGIN is not localhost");
}

const failCount = checks.filter((item) => item.level === "FAIL").length;
const warnCount = checks.filter((item) => item.level === "WARN").length;

console.log("Phase 0 readiness report");
console.log("------------------------");
for (const item of checks) {
  console.log(`[${item.level}] ${item.message}`);
}
console.log("------------------------");
console.log(`FAIL: ${failCount} | WARN: ${warnCount} | PASS: ${checks.length - failCount - warnCount}`);

if (failCount > 0) {
  process.exit(1);
}
