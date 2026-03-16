import "dotenv/config";
import process from "node:process";
import { spawnSync } from "node:child_process";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function printHelp() {
  console.log(`Uso:
  node scripts/deploy-push-scheduler.mjs [--dry-run]

Variables soportadas:
  GOOGLE_CLOUD_PROJECT                     Proyecto GCP destino (requerido)
  CLOUD_RUN_SERVICE                        Servicio Cloud Run (default: credisync-api)
  CLOUD_RUN_REGION                         Region Cloud Run y Scheduler (default: us-central1)
  PUSH_DAILY_SUMMARY_SCHEDULER_JOB_NAME    Nombre del job (default: credisync-push-daily-summary)
  PUSH_DAILY_SUMMARY_SCHEDULER_CRON        Cron del job (default: */15 * * * *)
  PUSH_DAILY_SUMMARY_SCHEDULER_TIMEZONE    Timezone del cron (default: Etc/UTC)
  PUSH_DAILY_SUMMARY_JOB_TOKEN             Token Bearer del endpoint (requerido)

El script obtiene la URL publica del servicio Cloud Run y crea o actualiza
un Cloud Scheduler HTTP job apuntando a /api/jobs/push-daily-summary.`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
const projectId = env("GOOGLE_CLOUD_PROJECT");
const serviceName = env("CLOUD_RUN_SERVICE", "credisync-api");
const region = env("CLOUD_RUN_REGION", "us-central1");
const jobName = env("PUSH_DAILY_SUMMARY_SCHEDULER_JOB_NAME", "credisync-push-daily-summary");
const schedule = env("PUSH_DAILY_SUMMARY_SCHEDULER_CRON", "*/15 * * * *");
const scheduleTimezone = env("PUSH_DAILY_SUMMARY_SCHEDULER_TIMEZONE", "Etc/UTC");
const token = env("PUSH_DAILY_SUMMARY_JOB_TOKEN");

if (!projectId) {
  console.error("Falta GOOGLE_CLOUD_PROJECT en el entorno.");
  process.exit(1);
}

if (!token) {
  console.error("Falta PUSH_DAILY_SUMMARY_JOB_TOKEN en el entorno.");
  process.exit(1);
}

function runGcloud(args, options = {}) {
  const printable = ["gcloud", ...args]
    .map((value) => String(value).replace(/Authorization=Bearer\s+[^,\s]+/g, "Authorization=Bearer ***"))
    .join(" ");
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return { status: 0, stdout: "", stderr: "" };
  }

  const result = spawnSync("gcloud", args, {
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit"
  });

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = String(result.stderr || "").trim();
    const stdout = String(result.stdout || "").trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    process.exit(result.status || 1);
  }

  return result;
}

const serviceUrlResult = runGcloud(
  [
    "run",
    "services",
    "describe",
    serviceName,
    "--project",
    projectId,
    "--region",
    region,
    "--format=value(status.url)"
  ],
  { captureOutput: true }
);

const serviceUrl = dryRun ? `https://${serviceName}-${projectId}.${region}.run.app` : String(serviceUrlResult.stdout || "").trim();

if (!serviceUrl) {
  console.error("No se pudo resolver la URL publica de Cloud Run.");
  process.exit(1);
}

const targetUrl = `${serviceUrl.replace(/\/$/, "")}/api/jobs/push-daily-summary`;
const body = JSON.stringify({});
const commonArgs = [
  "--project",
  projectId,
  "--location",
  region,
  "--schedule",
  schedule,
  "--time-zone",
  scheduleTimezone,
  "--uri",
  targetUrl,
  "--http-method",
  "POST",
  "--headers",
  `Authorization=Bearer ${token},Content-Type=application/json`,
  "--message-body",
  body,
  "--description",
  "Push diario de cobranza CrediSync a Cloud Run"
];

const describeResult = runGcloud(
  [
    "scheduler",
    "jobs",
    "describe",
    jobName,
    "--project",
    projectId,
    "--location",
    region
  ],
  { captureOutput: true, allowFailure: true }
);

const exists = dryRun ? false : describeResult.status === 0;

if (exists) {
  runGcloud(["scheduler", "jobs", "update", "http", jobName, ...commonArgs]);
  console.log(`Job actualizado: ${jobName}`);
} else {
  runGcloud(["scheduler", "jobs", "create", "http", jobName, ...commonArgs]);
  console.log(`Job creado: ${jobName}`);
}

console.log(`Cloud Run: ${serviceName}`);
console.log(`Region: ${region}`);
console.log(`URL destino: ${targetUrl}`);
console.log(`Cron: ${schedule}`);
console.log(`Timezone del cron: ${scheduleTimezone}`);
console.log("Siguiente paso recomendado: ejecutar `gcloud scheduler jobs run <job>` para validar el endpoint.");
