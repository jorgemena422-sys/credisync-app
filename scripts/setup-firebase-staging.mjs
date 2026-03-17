import process from "node:process";
import { spawnSync } from "node:child_process";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  return !result.error;
}

function firebaseCommand() {
  if (process.platform === "win32") {
    if (commandExists("firebase.cmd")) {
      return { command: "firebase.cmd", prefixArgs: [] };
    }
    return { command: "npx.cmd", prefixArgs: ["firebase-tools"] };
  }

  if (commandExists("firebase")) {
    return { command: "firebase", prefixArgs: [] };
  }

  return { command: "npx", prefixArgs: ["firebase-tools"] };
}

function printHelp() {
  console.log(`Uso:
  node scripts/setup-firebase-staging.mjs [--dry-run]

Variables soportadas:
  GOOGLE_CLOUD_PROJECT          Proyecto Firebase/GCP (requerido)
  FIREBASE_HOSTING_PROD_SITE    Site de produccion (default: <project-id>)
  FIREBASE_HOSTING_STAGING_SITE Site de staging (default: <project-id>-staging)

El script crea el site de staging si no existe y aplica los targets locales:
  prod    -> site productivo
  staging -> site staging`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
const projectId = env("GOOGLE_CLOUD_PROJECT");

if (!projectId) {
  console.error("Falta GOOGLE_CLOUD_PROJECT en el entorno.");
  process.exit(1);
}

const prodSite = env("FIREBASE_HOSTING_PROD_SITE", projectId);
const stagingSite = env("FIREBASE_HOSTING_STAGING_SITE", `${projectId}-staging`);

function mask(value) {
  return String(value || "").trim();
}

function runFirebase(args, options = {}) {
  const commandMeta = firebaseCommand();
  const finalArgs = [...commandMeta.prefixArgs, ...args];
  const commandToRun = process.platform === "win32" && /\s/.test(commandMeta.command) ? `"${commandMeta.command}"` : commandMeta.command;
  const printable = [commandMeta.command, ...finalArgs].map(mask).join(" ");

  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return { status: 0, stdout: "", stderr: "" };
  }

  const result = spawnSync(commandToRun, finalArgs, {
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    console.error("No se encontro Firebase CLI. Instala `firebase-tools` o ejecuta el script desde un entorno con `npx` disponible.");
    process.exit(1);
  }

  if (result.status !== 0 && !options.allowFailure) {
    const stdout = String(result.stdout || "").trim();
    const stderr = String(result.stderr || "").trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    process.exit(result.status || 1);
  }

  return result;
}

function isAlreadyExists(result) {
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  return combined.includes("already exists") || combined.includes("site already exists");
}

const createResult = runFirebase(
  ["hosting:sites:create", stagingSite, "--project", projectId],
  { captureOutput: true, allowFailure: true }
);

if (!dryRun && createResult.status !== 0 && !isAlreadyExists(createResult)) {
  const stdout = String(createResult.stdout || "").trim();
  const stderr = String(createResult.stderr || "").trim();
  if (stdout) console.error(stdout);
  if (stderr) console.error(stderr);
  process.exit(createResult.status || 1);
}

if (!dryRun) {
  console.log(createResult.status === 0 ? `Site staging listo: ${stagingSite}` : `Site staging ya existia: ${stagingSite}`);
}

runFirebase(["target:apply", "hosting", "prod", prodSite, "--project", projectId]);
runFirebase(["target:apply", "hosting", "staging", stagingSite, "--project", projectId]);

console.log(`Proyecto Firebase: ${projectId}`);
console.log(`Target prod -> ${prodSite}`);
console.log(`Target staging -> ${stagingSite}`);
console.log("Siguiente paso: desplegar Cloud Run staging y luego `npm run deploy:hosting:staging`.");
