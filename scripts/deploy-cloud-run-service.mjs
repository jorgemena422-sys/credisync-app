import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const environmentName = String(process.argv[2] || "").trim().toLowerCase();

const ENVIRONMENTS = {
  prod: {
    service: "credisync-api",
    region: "us-central1",
    project: "credisync-727b6",
    envFile: ".env.production",
    expectedSupabaseProjectRef: "ntgazmqyuovongbkofub",
    expectedAppPublicUrl: "https://credisync-727b6.web.app",
    expectedCorsOrigin: "https://credisync-727b6.web.app"
  },
  staging: {
    service: "credisync-api-staging",
    region: "us-central1",
    project: "credisync-727b6",
    envFile: ".env.staging",
    expectedSupabaseProjectRef: "objmhdwsckpekjolbkov",
    expectedAppPublicUrl: "https://credisync-727b6-staging.web.app",
    expectedCorsOrigin: "https://credisync-727b6-staging.web.app"
  }
};

if (!ENVIRONMENTS[environmentName]) {
  console.error("[deploy-cloud-run-service] Usage: node scripts/deploy-cloud-run-service.mjs <prod|staging>");
  process.exit(1);
}

const envConfig = ENVIRONMENTS[environmentName];
const envFilePath = path.join(projectRoot, envConfig.envFile);

if (!fs.existsSync(envFilePath)) {
  console.error(`[deploy-cloud-run-service] Missing ${envConfig.envFile}. Create it from ${envConfig.envFile}.example before deploying.`);
  process.exit(1);
}

const parsedEnv = dotenv.parse(fs.readFileSync(envFilePath, "utf8"));

const requiredKeys = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "JWT_SECRET",
  "APP_PUBLIC_URL",
  "CORS_ORIGIN"
];

const missingKeys = requiredKeys.filter((key) => !String(parsedEnv[key] || "").trim());
if (missingKeys.length > 0) {
  console.error(`[deploy-cloud-run-service] Missing required keys in ${envConfig.envFile}: ${missingKeys.join(", ")}`);
  process.exit(1);
}

const normalizeUrl = (value) => String(value || "").trim().replace(/\/$/, "");
const supabaseUrl = normalizeUrl(parsedEnv.SUPABASE_URL);
const supabaseRefMatch = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
const actualSupabaseProjectRef = String(parsedEnv.SUPABASE_PROJECT_REF || (supabaseRefMatch ? supabaseRefMatch[1] : "")).trim();

if (!supabaseRefMatch) {
  console.error(`[deploy-cloud-run-service] SUPABASE_URL in ${envConfig.envFile} is invalid: ${parsedEnv.SUPABASE_URL}`);
  process.exit(1);
}

if (actualSupabaseProjectRef !== envConfig.expectedSupabaseProjectRef) {
  console.error(
    `[deploy-cloud-run-service] ${environmentName} must point to Supabase ${envConfig.expectedSupabaseProjectRef}, but ${envConfig.envFile} points to ${actualSupabaseProjectRef}.`
  );
  process.exit(1);
}

if (normalizeUrl(parsedEnv.APP_PUBLIC_URL) !== envConfig.expectedAppPublicUrl) {
  console.error(
    `[deploy-cloud-run-service] ${environmentName} APP_PUBLIC_URL must be ${envConfig.expectedAppPublicUrl}, but found ${parsedEnv.APP_PUBLIC_URL}.`
  );
  process.exit(1);
}

if (normalizeUrl(parsedEnv.CORS_ORIGIN) !== envConfig.expectedCorsOrigin) {
  console.error(
    `[deploy-cloud-run-service] ${environmentName} CORS_ORIGIN must be ${envConfig.expectedCorsOrigin}, but found ${parsedEnv.CORS_ORIGIN}.`
  );
  process.exit(1);
}

const finalEnv = {
  ...parsedEnv,
  NODE_ENV: String(parsedEnv.NODE_ENV || "production").trim() || "production",
  SUPABASE_PROJECT_REF: actualSupabaseProjectRef,
  DEPLOY_ENV_NAME: environmentName,
  EXPECTED_SUPABASE_PROJECT_REF: envConfig.expectedSupabaseProjectRef,
  EXPECTED_APP_PUBLIC_URL: envConfig.expectedAppPublicUrl,
  APP_PUBLIC_URL: envConfig.expectedAppPublicUrl,
  CORS_ORIGIN: envConfig.expectedCorsOrigin
};

const tempEnvFile = path.join(os.tmpdir(), `credisync-${environmentName}-cloud-run-env-${Date.now()}.yaml`);

const toYamlScalar = (value) => JSON.stringify(String(value ?? ""));
const yamlContent = Object.entries(finalEnv)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}: ${toYamlScalar(value)}`)
  .join("\n");

fs.writeFileSync(tempEnvFile, `${yamlContent}\n`, "utf8");

console.log(`[deploy-cloud-run-service] Deploying ${envConfig.service} using ${envConfig.envFile}`);
console.log(`[deploy-cloud-run-service] Supabase ref locked to ${envConfig.expectedSupabaseProjectRef}`);

const deployArgs = [
  "run",
  "deploy",
  envConfig.service,
  "--source",
  ".",
  "--region",
  envConfig.region,
  "--project",
  envConfig.project,
  "--allow-unauthenticated",
  "--env-vars-file",
  tempEnvFile
];

const result = spawnSync("gcloud", deployArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

try {
  fs.unlinkSync(tempEnvFile);
} catch (_error) {
  // ignore temp cleanup failures
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}
