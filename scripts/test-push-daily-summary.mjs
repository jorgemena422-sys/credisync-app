import "dotenv/config";
import process from "node:process";

const baseUrl = String(process.env.PUSH_TEST_BASE_URL || process.env.APP_PUBLIC_URL || "http://localhost:3001").trim().replace(/\/$/, "");
const token = String(process.env.PUSH_DAILY_SUMMARY_JOB_TOKEN || "").trim();
const at = String(process.argv[2] || process.env.PUSH_TEST_AT || "2026-03-16T12:05:00Z").trim();

if (!token) {
  console.error("Falta PUSH_DAILY_SUMMARY_JOB_TOKEN en el entorno.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/jobs/push-daily-summary`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ at })
});

let payload = null;
try {
  payload = await response.json();
} catch {
  payload = null;
}

if (!response.ok) {
  console.error("Fallo la prueba del job push.");
  console.error(JSON.stringify(payload || { status: response.status }, null, 2));
  process.exit(1);
}

console.log("Resultado del job push:");
console.log(JSON.stringify(payload, null, 2));
