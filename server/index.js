const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const webPush = require("web-push");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3001);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_URL_PROJECT_REF = (() => {
  const match = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : "";
})();
const SUPABASE_PROJECT_REF = String(process.env.SUPABASE_PROJECT_REF || SUPABASE_URL_PROJECT_REF || "").trim();
const SUPABASE_CLIENT_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const HAS_SUPABASE_SERVICE_ROLE_KEY = Boolean(SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
const JWT_COOKIE_NAME = "__session";
const DEFAULT_SUPERADMIN_EMAIL = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const DEFAULT_SUPERADMIN_PASSWORD = String(process.env.SUPERADMIN_PASSWORD || "").trim();
const DEFAULT_SUPERADMIN_NAME = String(process.env.SUPERADMIN_NAME || "Super Administrador").trim();
const ENABLE_SUPERADMIN_BOOTSTRAP =
  String(process.env.ENABLE_SUPERADMIN_BOOTSTRAP || (IS_PROD ? "false" : "true")).trim().toLowerCase() === "true";
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || process.env.APP_ORIGIN || "").trim();
const IS_CLOUD_RUN = Boolean(process.env.K_SERVICE);
const APP_PUBLIC_URL = (() => {
  const raw = String(process.env.APP_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (raw && (raw.startsWith("https://") || !IS_PROD)) return raw;
  if (IS_CLOUD_RUN && process.env.K_SERVICE) {
    const region = process.env.K_REVISION ? "" : "us-central1";
    return `https://${process.env.K_SERVICE}-${process.env.GOOGLE_CLOUD_PROJECT || "credisync-727b6"}.${region ? region + "." : ""}run.app`;
  }
  return raw;
})();
const DEPLOY_ENV_NAME = String(process.env.DEPLOY_ENV_NAME || "").trim().toLowerCase();
const EXPECTED_SUPABASE_PROJECT_REF = String(process.env.EXPECTED_SUPABASE_PROJECT_REF || "").trim();
const EXPECTED_APP_PUBLIC_URL = String(process.env.EXPECTED_APP_PUBLIC_URL || "").trim().replace(/\/$/, "");
const PUSH_VAPID_PUBLIC_KEY = String(process.env.PUSH_VAPID_PUBLIC_KEY || "").trim();
const PUSH_VAPID_PRIVATE_KEY = String(process.env.PUSH_VAPID_PRIVATE_KEY || "").trim();
const PUSH_VAPID_SUBJECT = String(process.env.PUSH_VAPID_SUBJECT || "mailto:soporte@credisync.app").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM_EMAIL = String(process.env.RESEND_FROM_EMAIL || "").trim();
const RESEND_FROM_NAME = String(process.env.RESEND_FROM_NAME || "CrediSync").trim();
const RESEND_REPLY_TO_EMAIL = String(process.env.RESEND_REPLY_TO_EMAIL || RESEND_FROM_EMAIL || "").trim();
const BILLING_AUTO_EMAIL_ENABLED = String(process.env.BILLING_AUTO_EMAIL_ENABLED || "true").trim().toLowerCase() === "true";
const DEFAULT_BILLING_INVOICE_NOTE = "Recuerda hacer el pago antes de la fecha limite para evitar suspencion";
const DEFAULT_CASH_PAYMENT_REFERENCE = "PAGO EN EFECTIVO";
const DEFAULT_TRANSFER_PAYMENT_REFERENCE = "COMPROBANTE DE TRANSFERENCIA";
const BILLING_PAYMENT_META_KIND = "billing_payment_meta_v1";
const MAX_BILLING_PAYMENT_PROOF_BYTES = 2 * 1024 * 1024;
const PUSH_DAILY_SUMMARY_JOB_TOKEN = String(process.env.PUSH_DAILY_SUMMARY_JOB_TOKEN || "").trim();
const PUSH_DAILY_SUMMARY_LOCAL_HOUR = 8;
const PUSH_DELIVERY_TYPE_DAILY_SUMMARY = "daily_summary";
const PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT = "notification_event";
const PUSH_DELIVERY_TYPE_PAYMENT_RECEIVED = "payment_received";
const ENABLE_LOCAL_PUSH_SCHEDULER = String(process.env.ENABLE_LOCAL_PUSH_SCHEDULER || (IS_PROD ? "false" : "true"))
  .trim()
  .toLowerCase() === "true";
const ICS_LOOKAHEAD_DAYS = Math.max(Math.trunc(Number(process.env.ICS_LOOKAHEAD_DAYS || 45)), 1);
const DEFAULT_ACCOUNT_STATUS = "active";
const SUPERADMIN_ROLE = "SuperAdministrador";
const ADMIN_ROLE = "Administrador";
const INACTIVE_BAN_DURATION = "876000h";
const PAYMENT_PROMISE_STATUSES = new Set(["pending", "kept", "broken", "cancelled"]);
const SUBSCRIPTION_STATUSES = new Set(["active", "suspended"]);
const READ_ONLY_SUBSCRIPTION_STATUSES = new Set(["suspended"]);
const BILLING_INVOICE_STATUSES = new Set(["pending", "overdue", "paid", "void"]);
const BILLING_PAYMENT_STATUSES = new Set(["reported", "confirmed", "rejected"]);
const OUTSTANDING_BILLING_INVOICE_STATUSES = new Set(["pending", "overdue"]);
const DEFAULT_SUBSCRIPTION_CURRENCY = "DOP";
const DEFAULT_SUBSCRIPTION_CYCLE = "monthly";
const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_BILLING_PERIOD_DAYS = 30;
const TENANT_SUBSCRIPTION_MAINTENANCE_INTERVAL_MS = Math.max(
  Math.trunc(Number(process.env.TENANT_SUBSCRIPTION_MAINTENANCE_INTERVAL_MS || 5 * 60 * 1000)),
  60 * 1000
);
const UNIFIED_SUBSCRIPTION_PLAN_ID = "PLAN-CREDISYNC-MONTHLY";
const UNIFIED_SUBSCRIPTION_PLAN_CODE = "credisync_monthly";
const SUBSCRIPTION_PLAN_CACHE_TTL_MS = 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW = 5;
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RESET_VERIFY_MAX_ATTEMPTS = 10;
const PASSWORD_CHANGE_MIN_LENGTH = 8;
const CLIENT_DIST_DIR = path.resolve(__dirname, "../dist");
const HAS_CLIENT_DIST = fs.existsSync(path.join(CLIENT_DIST_DIR, "index.html"));
const HAS_WEB_PUSH_CONFIG = Boolean(PUSH_VAPID_PUBLIC_KEY && PUSH_VAPID_PRIVATE_KEY);
const HAS_RESEND_CONFIG = Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);
let subscriptionPlanCache = {
  expiresAt: 0,
  plans: null
};
let tenantSubscriptionMaintenancePromise = null;
let tenantSubscriptionMaintenanceNextRunAt = 0;
const passwordResetRateLimits = new Map();

function invalidateSubscriptionPlanCache() {
  subscriptionPlanCache = {
    expiresAt: 0,
    plans: null
  };
}

function parseAllowedOrigins(rawOrigins) {
  return String(rawOrigins || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function getRateLimitKey(parts) {
  return parts.map((value) => String(value || "").trim().toLowerCase()).join("::");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return String(req.ip || req.socket?.remoteAddress || "unknown").trim();
}

function checkSimpleRateLimit(bucketKey, limit, windowMs) {
  const now = Date.now();
  const entry = passwordResetRateLimits.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    passwordResetRateLimits.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(entry.resetAt - now, 0)
    };
  }

  entry.count += 1;
  passwordResetRateLimits.set(bucketKey, entry);
  return { allowed: true, remaining: Math.max(limit - entry.count, 0) };
}

function enforcePasswordResetRateLimit(req, scopes) {
  const ip = getClientIp(req);

  for (const scope of scopes) {
    const result = checkSimpleRateLimit(scope.key, scope.limit, scope.windowMs);
    if (!result.allowed) {
      const retryAfterSeconds = Math.max(Math.ceil(result.retryAfterMs / 1000), 1);
      return {
        allowed: false,
        retryAfterSeconds,
        message: scope.message
      };
    }
  }

  return { allowed: true, ip };
}

function buildPasswordResetLimitScopes(req, email, mode) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const ip = getClientIp(req);
  const limit = mode === "verify" ? PASSWORD_RESET_VERIFY_MAX_ATTEMPTS : PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW;
  const message = mode === "verify"
    ? "Demasiados intentos de verificacion. Intenta de nuevo en unos minutos."
    : "Demasiadas solicitudes de recuperacion. Intenta de nuevo en unos minutos.";

  return [
    {
      key: getRateLimitKey([mode, "ip", ip]),
      limit,
      windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
      message
    },
    {
      key: getRateLimitKey([mode, "email", normalizedEmail]),
      limit,
      windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
      message
    }
  ];
}

const ALLOWED_CORS_ORIGINS = CORS_ORIGIN
  ? parseAllowedOrigins(CORS_ORIGIN)
  : IS_PROD
    ? []
    : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"];

function assertRequiredConfig() {
  const missing = [];
  const normalizedAppPublicUrl = APP_PUBLIC_URL.replace(/\/$/, "");
  const normalizedExpectedAppPublicUrl = EXPECTED_APP_PUBLIC_URL.replace(/\/$/, "");
  const actualSupabaseProjectRef = SUPABASE_URL_PROJECT_REF || SUPABASE_PROJECT_REF;

  if (!SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!SUPABASE_CLIENT_KEY) {
    missing.push("SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!SUPABASE_PROJECT_REF) {
    missing.push("SUPABASE_PROJECT_REF or a valid SUPABASE_URL");
  }

  if (!JWT_SECRET) {
    missing.push("JWT_SECRET");
  }

  if (IS_PROD && !SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (IS_PROD && !APP_PUBLIC_URL && !IS_CLOUD_RUN) {
    missing.push("APP_PUBLIC_URL");
  }

  if (missing.length > 0) {
    console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (process.env.SUPABASE_PROJECT_REF && SUPABASE_URL_PROJECT_REF && SUPABASE_PROJECT_REF !== SUPABASE_URL_PROJECT_REF) {
    console.warn(`[CONFIG WARN] SUPABASE_PROJECT_REF (${SUPABASE_PROJECT_REF}) does not match SUPABASE_URL project ref (${SUPABASE_URL_PROJECT_REF}). Password reset emails may call the wrong Edge Function project.`);
  }

  if (IS_PROD && JWT_SECRET.length < 32) {
    console.error("[CONFIG ERROR] JWT_SECRET must be at least 32 characters in production.");
    process.exit(1);
  }

  if (APP_PUBLIC_URL && !isValidHttpUrl(APP_PUBLIC_URL)) {
    console.error("[CONFIG ERROR] APP_PUBLIC_URL must be a valid URL (http/https).");
    process.exit(1);
  }

  if (EXPECTED_SUPABASE_PROJECT_REF && actualSupabaseProjectRef && actualSupabaseProjectRef !== EXPECTED_SUPABASE_PROJECT_REF) {
    console.error(
      `[CONFIG ERROR] Environment ${DEPLOY_ENV_NAME || "unknown"} expected Supabase project ${EXPECTED_SUPABASE_PROJECT_REF}, but backend is configured for ${actualSupabaseProjectRef}.`
    );
    process.exit(1);
  }

  if (normalizedExpectedAppPublicUrl && normalizedAppPublicUrl && normalizedAppPublicUrl !== normalizedExpectedAppPublicUrl) {
    console.error(
      `[CONFIG ERROR] Environment ${DEPLOY_ENV_NAME || "unknown"} expected APP_PUBLIC_URL ${normalizedExpectedAppPublicUrl}, but backend is configured for ${normalizedAppPublicUrl}.`
    );
    process.exit(1);
  }

  if (IS_PROD && !IS_CLOUD_RUN && APP_PUBLIC_URL && !APP_PUBLIC_URL.startsWith("https://")) {
    console.error("[CONFIG ERROR] APP_PUBLIC_URL must use https in production.");
    process.exit(1);
  }

  if (!IS_CLOUD_RUN) {
    const corsOrigins = parseAllowedOrigins(CORS_ORIGIN);
    const invalidCorsOrigins = corsOrigins.filter((origin) => !isValidHttpUrl(origin));
    if (invalidCorsOrigins.length > 0) {
      console.error(`[CONFIG ERROR] Invalid CORS_ORIGIN value(s): ${invalidCorsOrigins.join(", ")}`);
      process.exit(1);
    }
  }
}

assertRequiredConfig();

if (HAS_WEB_PUSH_CONFIG) {
  try {
    webPush.setVapidDetails(PUSH_VAPID_SUBJECT, PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY);
  } catch (error) {
    console.error("[CONFIG ERROR] Invalid web push VAPID settings.");
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
} else {
  console.warn("[CONFIG WARNING] Web push disabled. Define PUSH_VAPID_PUBLIC_KEY and PUSH_VAPID_PRIVATE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_CLIENT_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_CLIENT_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (ALLOWED_CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      if (!IS_PROD && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

function defaultSettings() {
  return {
    personalLoanRate: 12,
    businessLoanRate: 15,
    mortgageLoanRate: 10,
    autoLoanRate: 14,
    latePenaltyRate: 5,
    graceDays: 3,
    autoApprovalScore: 720,
    maxDebtToIncome: 40,
    capitalBudget: 0,
    currency: DEFAULT_SUBSCRIPTION_CURRENCY
  };
}

function defaultRiskModel() {
  return {
    initialScore: 70,
    onTimePaymentReward: 2.2,
    keptPromiseReward: 3.8,
    paymentActivityReward: 0.45,
    paymentActivityCap: 12,
    latePaymentPenalty: 3.4,
    brokenPromisePenalty: 11.5,
    pendingPromisePenalty: 2.4,
    overdueDayPenalty: 0.75,
    overdueDayCap: 20,
    overdueAccumulatedPenalty: 0.14,
    overdueAccumulatedCap: 14,
    lagInstallmentPenalty: 3.8,
    noPaymentHistoryPenalty: 6
  };
}

function defaultUserCalendarIntegration() {
  return {
    enabled: true,
    timezone: "America/Santo_Domingo",
    feedToken: ""
  };
}

function defaultPlanFeatures() {
  return {
    calendarIcsEnabled: true,
    advancedReportsEnabled: true,
    exportsEnabled: true,
    brandingEnabled: true,
    prioritySupport: true
  };
}

function defaultPlanLimits() {
  return {
    maxUsers: 100000,
    maxCustomers: 1000000,
    maxActiveLoans: 1000000
  };
}

function defaultSubscriptionPlans() {
  return [
    {
      id: UNIFIED_SUBSCRIPTION_PLAN_ID,
      code: UNIFIED_SUBSCRIPTION_PLAN_CODE,
      name: "CrediSync Mensual",
      description: "Suscripcion mensual con acceso completo a todas las funciones del sistema.",
      priceMonthly: 0,
      currency: DEFAULT_SUBSCRIPTION_CURRENCY,
      billingCycle: DEFAULT_SUBSCRIPTION_CYCLE,
      isActive: true,
      features: defaultPlanFeatures(),
      limits: defaultPlanLimits()
    }
  ];
}

function defaultSubscriptionSummary() {
  const starter = defaultSubscriptionPlans()[0];
  return {
    id: "",
    tenantId: "",
    planId: starter.id,
    planCode: starter.code,
    planName: starter.name,
    description: starter.description,
    status: "active",
    billingCycle: starter.billingCycle,
    priceMonthly: starter.priceMonthly,
    currency: starter.currency,
    currentPeriodStart: isoToday(),
    currentPeriodEnd: addDaysToDateKey(isoToday(), DEFAULT_BILLING_PERIOD_DAYS),
    nextBillingDate: addDaysToDateKey(isoToday(), DEFAULT_BILLING_PERIOD_DAYS),
    trialEndsAt: "",
    suspendedAt: null,
    cancelledAt: null,
    notes: "",
    features: starter.features,
    limits: starter.limits,
    usage: {
      users: 0,
      customers: 0,
      activeLoans: 0
    },
    isReadOnly: false
  };
}

function defaultPlatformSettings() {
  return {
    platformName: "CrediSync",
    supportEmail: DEFAULT_SUPERADMIN_EMAIL,
    supportPhone: "",
    allowAdminRegistration: true,
    newTenantStatus: "active",
    tenantDefaults: defaultSettings(),
    riskModel: defaultRiskModel()
  };
}

function createEmptyState() {
  return {
    users: [],
    settings: defaultSettings(),
    riskModel: defaultRiskModel(),
    subscription: defaultSubscriptionSummary(),
    customers: [],
    loans: [],
    payments: [],
    paymentPromises: [],
    collectionNotes: [],
    notifications: []
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function round2(number) {
  return Math.round((Number(number) + Number.EPSILON) * 100) / 100;
}

function parseNumericInput(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value == null ? "" : value).trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.replace(/\s/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex >= 0) {
    const integerPart = normalized.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = normalized.slice(decimalIndex + 1).replace(/[.,]/g, "");
    const parsed = Number(`${integerPart}.${decimalPart}`);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(normalized.replace(/[.,]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numericId() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
}

function nameFromEmail(email) {
  const localPart = String(email).split("@")[0] || "admin";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMoneyValue(amount, currency) {
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const normalizedCurrency = normalizeCurrency(currency, DEFAULT_SUBSCRIPTION_CURRENCY);
  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numeric);
  } catch (_error) {
    return `${round2(numeric).toFixed(2)} ${normalizedCurrency}`;
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
}

function buildEmailFromHeader() {
  if (!RESEND_FROM_EMAIL) {
    return "";
  }
  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL;
}

async function sendEmailViaResend(payload) {
  if (!HAS_RESEND_CONFIG) {
    const error = new Error("El envio de correos no esta configurado. Falta RESEND_API_KEY o RESEND_FROM_EMAIL.");
    error.status = 503;
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "User-Agent": "credisync-server/1.0"
    },
    body: JSON.stringify({
      from: buildEmailFromHeader(),
      to: Array.isArray(payload.to) ? payload.to.filter(Boolean) : [String(payload.to || "").trim()].filter(Boolean),
      reply_to: RESEND_REPLY_TO_EMAIL ? [RESEND_REPLY_TO_EMAIL] : undefined,
      subject: String(payload.subject || "").trim(),
      html: String(payload.html || "").trim(),
      text: String(payload.text || "").trim() || undefined,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined
    })
  });

  if (!response.ok) {
    let message = `No se pudo enviar el correo (${response.status})`;
    try {
      const details = await response.json();
      const errorText =
        details?.message
        || details?.error
        || details?.errors?.[0]?.message
        || details?.name;
      if (errorText) {
        message = String(errorText);
      }
    } catch (_error) {
      const raw = await response.text();
      if (raw) {
        message = raw;
      }
    }

    const error = new Error(message);
    error.status = 502;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  return {
    id: data?.id || null
  };
}

async function getTenantName(tenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  if (error && !["PGRST116", "42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }

  return String(data?.name || "CrediSync").trim() || "CrediSync";
}

async function buildPaymentReceiptContext(user, paymentId) {
  const state = await readStateForUser(user);
  const payment = (state.payments || []).find((item) => String(item.id) === String(paymentId));
  if (!payment) {
    return null;
  }

  const loan = (state.loans || []).find((item) => String(item.id) === String(payment.loanId));
  const customer = (state.customers || []).find((item) => String(item.id) === String(payment.customerId));
  const tenantName = await getTenantName(user.tenantId);
  const currency = normalizeCurrency(state?.settings?.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
  const isInterestOnlyLoan = isInterestOnlyBalloonLoan(loan);
  const loanSettings = state?.settings || {};
  const referenceDate = startOfDay(toDate(payment?.date || new Date()));

  const principalComponentFromPayment = (item) => {
    const principalValue = Number.isFinite(Number(item?.principalAmount))
      ? Number(item.principalAmount)
      : (Number.isFinite(Number(item?.baseAmount)) ? Number(item.baseAmount) : 0);
    return Math.max(round2(principalValue), 0);
  };

  const sumPrincipalPaid = (payments) => round2((payments || []).reduce((acc, item) => acc + principalComponentFromPayment(item), 0));

  let loanPaymentsOrdered = sortPaymentsChronologically((state.payments || [])
    .filter((item) => String(item?.loanId || "") === String(payment.loanId || "")));
  if (!loanPaymentsOrdered.some((item) => String(item?.id || "") === String(payment.id || ""))) {
    loanPaymentsOrdered = sortPaymentsChronologically([...loanPaymentsOrdered, payment]);
  }

  let paymentPosition = loanPaymentsOrdered.findIndex((item) => String(item?.id || "") === String(payment.id || ""));
  if (paymentPosition < 0) {
    paymentPosition = Math.max(loanPaymentsOrdered.length - 1, 0);
  }

  const paymentsBeforeTarget = loanPaymentsOrdered.slice(0, paymentPosition);
  const paymentsUpToTarget = loanPaymentsOrdered.slice(0, paymentPosition + 1);

  const principalAmount = Number.isFinite(Number(payment.principalAmount))
    ? Math.max(round2(Number(payment.principalAmount)), 0)
    : (Number.isFinite(Number(payment.baseAmount)) ? Math.max(round2(Number(payment.baseAmount)), 0) : 0);
  const interestAmount = Number.isFinite(Number(payment.interestAmount))
    ? Math.max(round2(Number(payment.interestAmount)), 0)
    : 0;
  const baseAmount = principalAmount;
  const lateFeeAmount = Number.isFinite(Number(payment.lateFeeAmount))
    ? Math.max(round2(Number(payment.lateFeeAmount)), 0)
    : Math.max(round2(Number(payment.amount || 0) - principalAmount - interestAmount), 0);

  let totalPaidToDate = baseAmount;
  let outstandingBase = loan ? loanOutstanding(loan) : 0;
  let nextDueDate = loan ? loanNextDueDate(loan) : null;
  let paymentImpact = {
    principalAmount: baseAmount,
    interestAmount,
    lateFeeAmount,
    lateFeeInterestAmount: 0,
    lateFeePrincipalAmount: 0
  };
  let remainingAfterPayment = {
    totalDueToday: Math.max(round2(outstandingBase + lateFeeAmount), 0),
    baseOutstanding: outstandingBase,
    lateFeeOutstanding: 0,
    interestOutstanding: 0,
    maturityPrincipalDue: 0,
    interestLateFeeOutstanding: 0,
    principalLateFeeOutstanding: 0,
    principalOutstanding: outstandingBase
  };

  if (loan) {
    if (isInterestOnlyLoan) {
      const snapshotBefore = interestOnlySnapshotAtDate(loan, loanSettings, paymentsBeforeTarget, referenceDate)
        || interestOnlySnapshotAtDate(loan, loanSettings, [], referenceDate)
        || {
        principalOutstanding: Math.max(round2(Number(loan.principal || 0)), 0),
        principalPaidToDate: 0,
        interestOutstanding: 0,
        interestLateFeeOutstanding: 0,
        principalLateFeeOutstanding: 0,
        lateFeeOutstanding: 0,
        maturityPrincipalDue: 0,
        totalDueBeforePrincipal: 0,
        totalOutstanding: Math.max(round2(Number(loan.principal || 0)), 0),
        nextDueDate: null
      };
      const snapshotAfter = interestOnlySnapshotAtDate(loan, loanSettings, paymentsUpToTarget, referenceDate) || snapshotBefore;

      const interestLateFeeBefore = Math.max(round2(snapshotBefore.interestLateFeeOutstanding || 0), 0);
      const principalLateFeeBefore = Math.max(round2(snapshotBefore.principalLateFeeOutstanding || 0), 0);
      const lateFeeAppliedToInterest = round2(Math.min(lateFeeAmount, interestLateFeeBefore));
      const lateFeeAppliedToPrincipal = round2(Math.min(Math.max(round2(lateFeeAmount - lateFeeAppliedToInterest), 0), principalLateFeeBefore));

      totalPaidToDate = Math.max(round2(snapshotAfter.principalPaidToDate || 0), 0);
      outstandingBase = Math.max(round2(snapshotAfter.principalOutstanding || 0), 0);
      nextDueDate = snapshotAfter.nextDueDate || null;
      paymentImpact = {
        principalAmount: baseAmount,
        interestAmount,
        lateFeeAmount,
        lateFeeInterestAmount: lateFeeAppliedToInterest,
        lateFeePrincipalAmount: lateFeeAppliedToPrincipal
      };

      const maturityPrincipalDueAfter = Math.max(round2(snapshotAfter.maturityPrincipalDue || 0), 0);
      const interestOutstandingAfter = Math.max(round2(snapshotAfter.interestOutstanding || 0), 0);
      const interestLateFeeOutstandingAfter = Math.max(round2(snapshotAfter.interestLateFeeOutstanding || 0), 0);
      const principalLateFeeOutstandingAfter = Math.max(round2(snapshotAfter.principalLateFeeOutstanding || 0), 0);
      const lateFeeOutstandingAfter = Math.max(round2(snapshotAfter.lateFeeOutstanding || 0), 0);

      remainingAfterPayment = {
        totalDueToday: round2(maturityPrincipalDueAfter + interestOutstandingAfter + lateFeeOutstandingAfter),
        baseOutstanding: outstandingBase,
        lateFeeOutstanding: lateFeeOutstandingAfter,
        interestOutstanding: interestOutstandingAfter,
        maturityPrincipalDue: maturityPrincipalDueAfter,
        interestLateFeeOutstanding: interestLateFeeOutstandingAfter,
        principalLateFeeOutstanding: principalLateFeeOutstandingAfter,
        principalOutstanding: outstandingBase
      };
    } else {
      const principalPaidAfter = sumPrincipalPaid(paymentsUpToTarget);
      const loanAfter = { ...loan, paidAmount: principalPaidAfter };
      const penaltyAfter = loanPenaltySnapshotAtDate(loanAfter, loanSettings, paymentsUpToTarget, referenceDate);

      totalPaidToDate = principalPaidAfter;
      outstandingBase = Math.max(round2(loanOutstanding(loanAfter)), 0);
      nextDueDate = loanNextDueDate(loanAfter);
      paymentImpact = {
        principalAmount: baseAmount,
        interestAmount: 0,
        lateFeeAmount,
        lateFeeInterestAmount: 0,
        lateFeePrincipalAmount: 0
      };

      const lateFeeOutstandingAfter = Math.max(round2(penaltyAfter?.lateFeeOutstanding || 0), 0);
      remainingAfterPayment = {
        totalDueToday: round2(outstandingBase + lateFeeOutstandingAfter),
        baseOutstanding: outstandingBase,
        lateFeeOutstanding: lateFeeOutstandingAfter,
        interestOutstanding: 0,
        maturityPrincipalDue: 0,
        interestLateFeeOutstanding: 0,
        principalLateFeeOutstanding: 0,
        principalOutstanding: outstandingBase
      };
    }
  }

  const installmentProgress = paymentInstallmentProgress(loan, paymentsUpToTarget, payment.id);
  const customerDisplayId = String(customer?.id || payment.customerId || "-").trim() || "-";
  const paymentMethodLabel = ({
    transfer: "Transferencia bancaria",
    cash: "Efectivo",
    card: "Tarjeta",
    check: "Cheque"
  })[String(payment.method || "").trim().toLowerCase()] || String(payment.method || "-");

  return {
    payment,
    loan,
    customer,
    tenantName,
    currency,
    baseAmount,
    principalAmount,
    interestAmount,
    lateFeeAmount,
    totalAmount: round2(Number(payment.amount || 0)),
    totalPaidToDate,
    outstandingBase,
    nextDueDate,
    isInterestOnlyLoan,
    paymentImpact,
    remainingAfterPayment,
    installmentNumber: installmentProgress.installmentNumber,
    installmentProgressLabel: installmentProgress.label,
    customerDisplayId,
    paymentMethodLabel
  };
}

function buildPaymentReceiptEmailHtml(receiptContext) {
  const customerName = escapeHtml(receiptContext?.customer?.name || "Cliente");
  const tenantName = escapeHtml(receiptContext?.tenantName || "CrediSync");
  const paymentId = escapeHtml(receiptContext?.payment?.id || "-");
  const loanId = escapeHtml(receiptContext?.loan?.id || receiptContext?.payment?.loanId || "-");
  const paymentDate = escapeHtml(formatDateLabel(receiptContext?.payment?.date || ""));

  return `
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:28px 16px;">
          <table role="presentation" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;">Comprobante de pago PDF</h1>
                <p style="margin:8px 0 0 0;opacity:.85;font-size:13px;">${tenantName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px 0;font-size:14px;">Hola ${customerName},</p>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;">Adjuntamos tu comprobante de pago correspondiente al prestamo <strong>${loanId}</strong>.</p>
                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">ID pago</td><td style="padding:6px 0;text-align:right;"><strong>${paymentId}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Fecha</td><td style="padding:6px 0;text-align:right;"><strong>${paymentDate}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto total</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(formatMoneyValue(receiptContext.totalAmount, receiptContext.currency))}</strong></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function generatePaymentReceiptPdfBuffer(receiptContext) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 36;
    const contentWidth = pageWidth - (margin * 2);
    const customerName = receiptContext?.customer?.name || "Cliente";
    const customerPhone = receiptContext?.customer?.phone || "-";
    const loanId = receiptContext?.loan?.id || receiptContext?.payment?.loanId || "-";
    const paymentDate = formatDateLabel(receiptContext?.payment?.date || "");
    const nextDueDate = receiptContext?.nextDueDate ? formatDateLabel(receiptContext.nextDueDate.toISOString()) : "Sin vencimiento";
    const isInterestOnlyLoan = Boolean(receiptContext?.isInterestOnlyLoan);
    const montoOriginal = receiptContext?.loan ? formatMoneyValue(receiptContext.loan.principal, receiptContext.currency) : formatMoneyValue(0, receiptContext.currency);
    const totalPagado = formatMoneyValue(receiptContext.totalPaidToDate, receiptContext.currency);
    const saldoPendiente = formatMoneyValue(receiptContext.outstandingBase, receiptContext.currency);
    const totalPagadoDisplay = formatMoneyValue(receiptContext.totalAmount, receiptContext.currency);
    const paymentImpact = receiptContext?.paymentImpact || {};
    const remainingAfterPayment = receiptContext?.remainingAfterPayment || {};
    const amountValue = (value) => Math.max(round2(Number(value || 0)), 0);
    const moneyValue = (value) => formatMoneyValue(amountValue(value), receiptContext.currency);

    const impactRows = isInterestOnlyLoan
      ? [
        { label: "Capital abonado", value: moneyValue(paymentImpact.principalAmount) },
        { label: "Interes vencido pagado", value: moneyValue(paymentImpact.interestAmount) },
        { label: "Mora total pagada", value: moneyValue(paymentImpact.lateFeeAmount), bold: true },
        { label: "Mora del interes pagada", value: moneyValue(paymentImpact.lateFeeInterestAmount) },
        { label: "Mora de capital vencido pagada", value: moneyValue(paymentImpact.lateFeePrincipalAmount) }
      ]
      : [
        { label: "Cuota/base abonada", value: moneyValue(paymentImpact.principalAmount), bold: true },
        { label: "Mora pagada", value: moneyValue(paymentImpact.lateFeeAmount) },
        { label: "Total pagado", value: totalPagadoDisplay }
      ];

    const remainingRows = isInterestOnlyLoan
      ? [
        { label: "Total exigible hoy", value: moneyValue(remainingAfterPayment.totalDueToday), bold: true },
        { label: "Interes vencido pendiente", value: moneyValue(remainingAfterPayment.interestOutstanding) },
        { label: "Capital vencido pendiente", value: moneyValue(remainingAfterPayment.maturityPrincipalDue) },
        { label: "Mora total pendiente", value: moneyValue(remainingAfterPayment.lateFeeOutstanding), bold: true },
        { label: "Mora del interes pendiente", value: moneyValue(remainingAfterPayment.interestLateFeeOutstanding) },
        { label: "Mora de capital vencido pendiente", value: moneyValue(remainingAfterPayment.principalLateFeeOutstanding), gapAfter: 4 },
        { label: "Capital pendiente total", value: moneyValue(remainingAfterPayment.principalOutstanding) }
      ]
      : [
        { label: "Total exigible hoy", value: moneyValue(remainingAfterPayment.totalDueToday), bold: true },
        { label: "Saldo base pendiente", value: moneyValue(remainingAfterPayment.baseOutstanding) },
        { label: "Mora pendiente", value: moneyValue(remainingAfterPayment.lateFeeOutstanding) },
        { label: "Saldo pendiente total", value: saldoPendiente, bold: true }
      ];
    const blue = "#2952e3";
    const blueSoft = "#eef2ff";
    const ink = "#111827";
    const muted = "#6b7280";
    const line = "#e5e7eb";
    const panel = "#f8fafc";
    const green = "#0f8a5f";
    const greenSoft = "#e7f8ee";
    const innerBottom = pageHeight - 22;

    const drawRoundedCard = (x, y, width, height, fill, stroke = line, radius = 12) => {
      doc.save();
      doc.roundedRect(x, y, width, height, radius).fillAndStroke(fill, stroke);
      doc.restore();
    };

    const drawSectionTitle = (x, y, icon, title) => {
      doc.save();
      doc.fillColor(blue).circle(x + 8, y + 8, 8).fill();
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text(icon, x + 5.7, y + 4.1, { width: 6, align: "center" });
      doc.fillColor(blue).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), x + 22, y + 2, { characterSpacing: 1 });
      doc.restore();
    };

    const drawLabelValue = (x, y, label, value, width, options = {}) => {
      doc.font("Helvetica-Bold").fontSize(options.labelSize || 7.5).fillColor(options.labelColor || muted).text(label.toUpperCase(), x, y, { width, align: options.align || "left" });
      doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.valueSize || 11).fillColor(options.valueColor || ink).text(value, x, y + 14, { width, align: options.align || "left" });
    };

    const drawAmountRows = (rows, x, y, width, options = {}) => {
      const labelWidth = Math.max((options.labelWidth || (width - 110)), 80);
      const valueWidth = width - labelWidth;
      const rowGap = options.rowGap || 6;
      const minRowHeight = options.minRowHeight || 13;
      let cursorY = y;

      for (const row of rows) {
        const labelText = String(row?.label || "");
        const valueText = String(row?.value || "");

        doc
          .font("Helvetica")
          .fontSize(options.labelSize || 8.8)
          .fillColor(options.labelColor || muted)
          .text(labelText, x, cursorY, { width: labelWidth, align: "left" });

        doc
          .font(row?.bold ? "Helvetica-Bold" : (options.valueBold ? "Helvetica-Bold" : "Helvetica"))
          .fontSize(options.valueSize || 9.6)
          .fillColor(options.valueColor || ink)
          .text(valueText, x + labelWidth, cursorY, { width: valueWidth, align: "right", lineBreak: false });

        doc.font("Helvetica").fontSize(options.labelSize || 8.8);
        const labelHeight = doc.heightOfString(labelText, { width: labelWidth, align: "left" });
        const valueFont = row?.bold ? "Helvetica-Bold" : (options.valueBold ? "Helvetica-Bold" : "Helvetica");
        doc.font(valueFont).fontSize(options.valueSize || 9.6);
        const valueHeight = doc.heightOfString(valueText, { width: valueWidth, align: "right" });
        const rowHeight = Math.max(labelHeight, valueHeight, minRowHeight);

        cursorY += rowHeight + rowGap + Math.max(Number(row?.gapAfter || 0), 0);
      }

      return cursorY;
    };

    const fitFontSize = (text, maxWidth, maxSize, minSize = 15) => {
      let size = maxSize;
      while (size > minSize) {
        doc.font("Helvetica-Bold").fontSize(size);
        if (doc.widthOfString(String(text || "")) <= maxWidth) {
          break;
        }
        size -= 1;
      }
      return size;
    };

    drawRoundedCard(8, 8, pageWidth - 16, pageHeight - 16, "#f5f7fb", "#edf1f7", 0);
    drawRoundedCard(margin, 30, contentWidth, innerBottom - 22, "#ffffff", line, 14);

    const headerTop = 42;
    const leftX = margin + 22;
    const headerMidX = margin + 292;
    const rightX = headerMidX + 14;
    const rightWidth = contentWidth - (rightX - margin);

    const logoSize = 38;
    const logoX = leftX;
    const logoY = headerTop + 6;
    const brandX = logoX + logoSize + 16;
    const brandWidth = 220;

    doc.save();
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 12).fill(blue);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11.5).text("CR", logoX + 9, logoY + 12, { width: 20, align: "center" });
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(25).fillColor(blue).text("CREDISYNC", brandX, logoY + 2, { width: brandWidth, height: 30, align: "left" });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(muted).text("POWERED BY CREDISYNC", brandX, logoY + 33, { width: brandWidth, characterSpacing: 1.15, align: "left" });

    doc.font("Helvetica-Bold").fontSize(16).fillColor(ink).text("COMPROBANTE DE\nPAGO", rightX, headerTop + 6, { width: rightWidth, lineGap: 4, align: "left" });
    doc.font("Helvetica").fontSize(8.4).fillColor(muted).text(`Recibo N.: ${receiptContext?.payment?.id || "-"}`, rightX, headerTop + 60, { width: rightWidth, align: "left" });
    doc.text(`Fecha: ${paymentDate}`, rightX, headerTop + 78, { width: rightWidth, align: "left" });

    drawRoundedCard(rightX, headerTop + 110, 176, 22, greenSoft, greenSoft, 11);
    doc.fillColor(green).font("Helvetica-Bold").fontSize(8).text("ESTADO: PAGADO", rightX + 28, headerTop + 117, { width: 120, characterSpacing: 0.55, align: "left" });
    doc.circle(rightX + 14, headerTop + 115, 4).fill(green);

    doc.strokeColor(line).lineWidth(1).moveTo(margin, 202).lineTo(margin + contentWidth, 202).stroke();

    drawSectionTitle(margin, 218, "C", "Informacion del cliente");
    drawRoundedCard(margin, 236, contentWidth, 62, panel, line, 8);
    drawLabelValue(margin + 16, 252, "Nombre completo", customerName, 184, { valueSize: 10.8 });
    drawLabelValue(margin + 206, 252, "ID cliente", receiptContext.customerDisplayId, 150, { valueSize: 10.6 });
    drawLabelValue(margin + 360, 252, "Telefono", customerPhone, 130, { bold: true, valueSize: 10.6 });

    drawSectionTitle(margin, 316, "D", "Detalles del pago");
    drawRoundedCard(margin, 334, contentWidth, 28, "#e9efff", "#e9efff", 8);
    drawLabelValue(margin + 16, 342, "ID prestamo", loanId, 100, { labelColor: blue, valueSize: 0.1, valueColor: blue });
    drawLabelValue(margin + 126, 342, "Fecha de pago", paymentDate, 110, { labelColor: blue, valueSize: 0.1, valueColor: blue });
    drawLabelValue(margin + 252, 342, "Metodo de pago", receiptContext.paymentMethodLabel, 150, { labelColor: blue, valueSize: 0.1, valueColor: blue });
    drawLabelValue(margin + 418, 342, "Monto pagado", totalPagadoDisplay, 92, { labelColor: blue, valueSize: 0.1, valueColor: blue, align: "right" });

    doc.font("Helvetica").fontSize(10.2).fillColor(ink).text(loanId, margin + 16, 372, { width: 100, align: "left" });
    doc.text(paymentDate, margin + 126, 372, { width: 110, align: "left" });
    doc.text(receiptContext.paymentMethodLabel, margin + 252, 372, { width: 150, align: "left" });
    doc.font("Helvetica-Bold").text(totalPagadoDisplay, margin + 418, 372, { width: 92, align: "right" });

    drawSectionTitle(margin, 410, "R", "Impacto y saldo pendiente");

    const impactCardX = margin;
    const impactCardY = 428;
    const impactCardWidth = 248;
    const impactCardHeight = 188;
    const remainingCardX = margin + 264;
    const remainingCardWidth = contentWidth - (remainingCardX - margin);

    drawRoundedCard(impactCardX, impactCardY, impactCardWidth, impactCardHeight, blueSoft, "#dbe5ff", 10);
    drawRoundedCard(remainingCardX, impactCardY, remainingCardWidth, impactCardHeight, panel, line, 10);

    doc.font("Helvetica-Bold").fontSize(8.8).fillColor(blue).text("ESTE PAGO IMPACTO EN", impactCardX + 14, impactCardY + 14, { width: impactCardWidth - 28, characterSpacing: 0.45 });
    drawAmountRows(impactRows, impactCardX + 14, impactCardY + 36, impactCardWidth - 28, { rowGap: 20, labelWidth: 122 });

    doc.font("Helvetica-Bold").fontSize(8.8).fillColor(ink).text("DESPUES DE ESTE PAGO RESTA", remainingCardX + 14, impactCardY + 14, { width: remainingCardWidth - 28, characterSpacing: 0.35 });
    drawAmountRows(remainingRows, remainingCardX + 14, impactCardY + 36, remainingCardWidth - 28, {
      rowGap: 4,
      minRowHeight: 12,
      labelSize: 8,
      valueSize: 9.2,
      labelWidth: 132
    });

    doc.font("Helvetica-Oblique").fontSize(8).fillColor(muted).text(`Proximo vencimiento: ${nextDueDate}`, margin, 626, { width: contentWidth, align: "left" });
    doc.text(`Capital original: ${montoOriginal}  ·  Capital pagado a la fecha: ${totalPagado}`, margin, 640, { width: contentWidth, align: "left" });

    doc.strokeColor(line).lineWidth(1).moveTo(margin, 662).lineTo(margin + contentWidth, 662).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(muted).text("2026 CREDISYNC ALL RIGHTS RESERVED.", margin, 676, { width: 220, align: "left" });

    doc.end();
  });
}

function buildBillingInvoiceEmailHtml(invoiceContext) {
  const ownerName = escapeHtml(invoiceContext?.ownerName || "Cliente");
  const tenantName = escapeHtml(invoiceContext?.tenantName || "CrediSync");
  const invoiceId = escapeHtml(invoiceContext?.invoice?.id || "-");
  const dueDate = escapeHtml(formatDateLabel(invoiceContext?.invoice?.dueDate || ""));
  const periodLabel = escapeHtml(`${formatDateLabel(invoiceContext?.invoice?.periodStart)} - ${formatDateLabel(invoiceContext?.invoice?.periodEnd)}`);
  const amountLabel = escapeHtml(formatMoneyValue(invoiceContext?.invoice?.amount || 0, invoiceContext?.invoice?.currency));

  return `
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:28px 16px;">
          <table role="presentation" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;">Factura de suscripcion</h1>
                <p style="margin:8px 0 0 0;opacity:.85;font-size:13px;">${tenantName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px 0;font-size:14px;">Hola ${ownerName},</p>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;">Adjuntamos la factura de tu suscripcion en CrediSync para el periodo <strong>${periodLabel}</strong>.</p>
                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Factura</td><td style="padding:6px 0;text-align:right;"><strong>${invoiceId}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto</td><td style="padding:6px 0;text-align:right;"><strong>${amountLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Vencimiento</td><td style="padding:6px 0;text-align:right;"><strong>${dueDate}</strong></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function generateBillingInvoicePdfBuffer(invoiceContext) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const invoice = invoiceContext?.invoice || {};
    const ownerName = invoiceContext?.ownerName || "Cliente";
    const currency = normalizeCurrency(invoice.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
    const amountLabel = formatMoneyValue(invoice.amount || 0, currency);
    const dueDate = formatDateLabel(invoice.dueDate || "");
    const issuedAt = formatDateLabel(invoice.issuedAt || invoice.createdAt || "");
    const periodStart = formatDateLabel(invoice.periodStart || "");
    const periodEnd = formatDateLabel(invoice.periodEnd || "");
    const notes = String(invoice.notes || "").trim() || DEFAULT_BILLING_INVOICE_NOTE;
    const blue = "#2952e3";
    const ink = "#111827";
    const muted = "#6b7280";
    const line = "#e5e7eb";
    const soft = "#f8fafc";

    doc.roundedRect(24, 24, doc.page.width - 48, doc.page.height - 48, 18).fillAndStroke("#ffffff", "#edf1f7");
    doc.roundedRect(48, 52, doc.page.width - 96, 88, 16).fill(blue);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("FACTURA", 72, 88);

    const headerInfoX = 336;
    const headerInfoY = 72;
    const headerInfoWidth = 176;
    doc.save();
    doc.roundedRect(headerInfoX, headerInfoY, headerInfoWidth, 52, 10).fillOpacity(0.12).fillAndStroke("#ffffff", "#ffffff");
    doc.restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(`Factura N.: ${invoice.id || "-"}`, headerInfoX + 16, headerInfoY + 12, {
      width: headerInfoWidth - 32,
      align: "left"
    });
    doc.font("Helvetica").fontSize(10).text(`Emitida: ${issuedAt}`, headerInfoX + 16, headerInfoY + 28, {
      width: headerInfoWidth - 32,
      align: "left"
    });
    doc.text(`Vence: ${dueDate}`, headerInfoX + 16, headerInfoY + 42, {
      width: headerInfoWidth - 32,
      align: "left"
    });

    doc.roundedRect(72, 248, 220, 88, 12).fillAndStroke(soft, line);
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("FACTURAR A", 88, 264);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(ownerName, 88, 284, { width: 180 });
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(invoiceContext?.ownerEmail || "-", 88, 304, { width: 180 });

    doc.roundedRect(316, 248, 220, 88, 12).fillAndStroke(soft, line);
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("RESUMEN", 332, 264);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text(amountLabel, 332, 286, { width: 180 });
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(`Periodo: ${periodStart} - ${periodEnd}`, 332, 314, { width: 180 });

    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11).text("Detalle", 72, 372);
    doc.roundedRect(72, 396, 464, 118, 10).stroke(line);
    doc.font("Helvetica-Bold").fontSize(10).text("Concepto", 88, 414);
    doc.text("Periodo", 292, 414);
    doc.text("Monto", 450, 414, { width: 70, align: "right" });
    doc.moveTo(88, 434).lineTo(520, 434).stroke(line);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text("Suscripcion CrediSync", 88, 450, { width: 180 });
    doc.text(`${periodStart} - ${periodEnd}`, 292, 450, { width: 120 });
    doc.font("Helvetica-Bold").text(amountLabel, 450, 450, { width: 70, align: "right" });

    doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text("Notas", 72, 606);
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(notes, 72, 624, { width: 464 });

    doc.moveTo(72, 714).lineTo(536, 714).stroke(line);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text("Total", 382, 732);
    doc.text(amountLabel, 430, 732, { width: 90, align: "right" });

    doc.end();
  });
}

async function buildBillingInvoiceEmailContext(tenantId, invoiceRow) {
  const [tenant, ownerUser, subscription] = await Promise.all([
    getTenantById(tenantId),
    getTenantOwnerUser(tenantId),
    ensureTenantSubscription(tenantId)
  ]);

  const invoice = mapInvoiceRow(invoiceRow);
  return {
    tenantName: tenant?.name || "CrediSync",
    ownerName: ownerUser?.name || ownerUser?.email || "Cliente",
    ownerEmail: String(ownerUser?.email || "").trim(),
    subscription,
    invoice
  };
}

async function sendBillingInvoiceEmail(invoiceContext) {
  const ownerEmail = String(invoiceContext?.ownerEmail || "").trim();
  if (!ownerEmail) {
    const error = new Error("El tenant no tiene un correo propietario configurado");
    error.status = 400;
    throw error;
  }

  const pdfBuffer = await generateBillingInvoicePdfBuffer(invoiceContext);
  const invoiceId = invoiceContext?.invoice?.id || "factura";

  return sendEmailViaResend({
    to: [ownerEmail],
    subject: `Factura ${invoiceId} de CrediSync`,
    html: buildBillingInvoiceEmailHtml(invoiceContext),
    text: `Adjuntamos la factura ${invoiceId} de tu suscripcion en CrediSync.`,
    attachments: [
      {
        filename: `factura-${invoiceId}.pdf`,
        content: pdfBuffer.toString("base64")
      }
    ]
  });
}

function normalizeBillingPaymentMethod(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "efectivo") {
    return "Efectivo";
  }
  return "Transferencia";
}

function parseBillingPaymentStoredNotes(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      publicNote: "",
      proofImageData: "",
      proofImageName: "",
      proofImageType: "",
      hasProofImage: false
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.kind === BILLING_PAYMENT_META_KIND) {
      const proofImageData = String(parsed.proofImageData || "").trim();
      const proofImageName = String(parsed.proofImageName || "").trim();
      const proofImageType = String(parsed.proofImageType || "").trim();
      return {
        publicNote: String(parsed.publicNote || "").trim(),
        proofImageData,
        proofImageName,
        proofImageType,
        hasProofImage: Boolean(proofImageData)
      };
    }
  } catch (_error) {
    // keep backward compatibility with plain text notes
  }

  return {
    publicNote: raw,
    proofImageData: "",
    proofImageName: "",
    proofImageType: "",
    hasProofImage: false
  };
}

function buildBillingPaymentStoredNotes(payload) {
  const publicNote = String(payload?.publicNote || "").trim();
  const proofImageData = String(payload?.proofImageData || "").trim();
  const proofImageName = String(payload?.proofImageName || "").trim();
  const proofImageType = String(payload?.proofImageType || "").trim();

  if (!proofImageData) {
    return publicNote;
  }

  return JSON.stringify({
    kind: BILLING_PAYMENT_META_KIND,
    publicNote,
    proofImageData,
    proofImageName,
    proofImageType
  });
}

function parseBillingPaymentProofPayload(body) {
  const rawDataUrl = String(body?.proofImageData || "").trim();
  if (!rawDataUrl) {
    return null;
  }

  const match = rawDataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    const error = new Error("El comprobante debe ser una imagen PNG, JPG o WEBP valida");
    error.status = 400;
    throw error;
  }

  const contentType = String(match[1] || "").toLowerCase() === "image/jpg" ? "image/jpeg" : String(match[1] || "").toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) {
    const error = new Error("No se pudo procesar la imagen del comprobante");
    error.status = 400;
    throw error;
  }

  if (bytes.length > MAX_BILLING_PAYMENT_PROOF_BYTES) {
    const error = new Error("El comprobante no puede superar 2 MB");
    error.status = 400;
    throw error;
  }

  const normalizedName = String(body?.proofImageName || "").trim().replace(/[^\w.\- ]+/g, "").slice(0, 120);

  return {
    proofImageData: rawDataUrl,
    proofImageName: normalizedName || "comprobante-transferencia",
    proofImageType: contentType
  };
}

function dataUrlImageToBuffer(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    return null;
  }

  try {
    return {
      contentType: String(match[1] || "").toLowerCase(),
      buffer: Buffer.from(match[2], "base64")
    };
  } catch (_error) {
    return null;
  }
}

function buildBillingPaymentConfirmationEmailHtml(paymentContext) {
  const ownerName = escapeHtml(paymentContext?.ownerName || "Cliente");
  const tenantName = escapeHtml(paymentContext?.tenantName || "CrediSync");
  const invoiceId = escapeHtml(paymentContext?.invoice?.id || "-");
  const paymentId = escapeHtml(paymentContext?.payment?.id || "-");
  const paymentDate = escapeHtml(formatDateLabel(paymentContext?.payment?.receivedAt || paymentContext?.payment?.createdAt || ""));
  const paymentMethod = escapeHtml(paymentContext?.payment?.method || "-");
  const reference = escapeHtml(paymentContext?.payment?.reference || "Sin referencia");
  const proofLabel = paymentContext?.payment?.hasProofImage
    ? `Comprobante adjunto: ${paymentContext?.payment?.proofImageName || "Transferencia"}`
    : "";
  const notes = escapeHtml(paymentContext?.payment?.notes || proofLabel || "Pago confirmado correctamente.");
  const currency = normalizeCurrency(paymentContext?.invoice?.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
  const paymentAmountLabel = escapeHtml(formatMoneyValue(paymentContext?.payment?.amount || 0, currency));
  const invoiceAmountLabel = escapeHtml(formatMoneyValue(paymentContext?.invoice?.amount || 0, currency));
  const confirmedPaidLabel = escapeHtml(formatMoneyValue(paymentContext?.settlement?.confirmedPaidAmount || paymentContext?.payment?.amount || 0, currency));
  const outstandingAmount = round2(Number(paymentContext?.settlement?.outstandingAmount || 0));
  const outstandingLabel = escapeHtml(formatMoneyValue(outstandingAmount, currency));
  const periodStart = escapeHtml(formatDateLabel(paymentContext?.invoice?.periodStart || ""));
  const periodEnd = escapeHtml(formatDateLabel(paymentContext?.invoice?.periodEnd || ""));
  const isFullyPaid = outstandingAmount <= 0.009 || normalizeInvoiceStatus(paymentContext?.invoice?.status, "pending") === "paid";
  const statusLabel = isFullyPaid ? "Pagada" : "Pago parcial aplicado";
  const thankYouCopy = isFullyPaid
    ? "Gracias por completar el pago de tu factura. La factura ha quedado saldada por completo."
    : `Gracias por tu pago. Lo hemos aplicado a tu factura y el saldo pendiente actual es ${outstandingLabel}.`;

  return `
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:28px 16px;">
          <table role="presentation" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;">Pago aplicado a tu factura</h1>
                <p style="margin:8px 0 0 0;opacity:.85;font-size:13px;">${tenantName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px 0;font-size:14px;">Hola ${ownerName},</p>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;">${thankYouCopy}</p>
                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Factura</td><td style="padding:6px 0;text-align:right;"><strong>${invoiceId}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Estado</td><td style="padding:6px 0;text-align:right;"><strong>${statusLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Periodo facturado</td><td style="padding:6px 0;text-align:right;"><strong>${periodStart} - ${periodEnd}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto factura</td><td style="padding:6px 0;text-align:right;"><strong>${invoiceAmountLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Pago recibido</td><td style="padding:6px 0;text-align:right;"><strong>${paymentAmountLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Pagado acumulado</td><td style="padding:6px 0;text-align:right;"><strong>${confirmedPaidLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Saldo pendiente</td><td style="padding:6px 0;text-align:right;"><strong>${outstandingLabel}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">ID pago</td><td style="padding:6px 0;text-align:right;"><strong>${paymentId}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Fecha de registro</td><td style="padding:6px 0;text-align:right;"><strong>${paymentDate}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Metodo</td><td style="padding:6px 0;text-align:right;"><strong>${paymentMethod}</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Referencia</td><td style="padding:6px 0;text-align:right;"><strong>${reference}</strong></td></tr>
                </table>
                <div style="margin-top:20px;padding:16px;border-radius:10px;background:#f8fafc;border:1px solid #e5e7eb;">
                  <p style="margin:0 0 8px 0;font-size:13px;color:#475569;"><strong>Nota del pago</strong></p>
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">${notes}</p>
                </div>
                <p style="margin:20px 0 0 0;font-size:13px;line-height:1.6;color:#4b5563;">Adjuntamos tu recibo de pago en PDF para tu respaldo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function generateBillingPaymentReceiptPdfBuffer(paymentContext) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const invoice = paymentContext?.invoice || {};
    const payment = paymentContext?.payment || {};
    const settlement = paymentContext?.settlement || {};
    const tenantName = paymentContext?.tenantName || "CrediSync";
    const ownerName = paymentContext?.ownerName || "Cliente";
    const ownerEmail = String(paymentContext?.ownerEmail || "-").trim() || "-";
    const currency = normalizeCurrency(invoice.currency || payment.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
    const invoiceAmountLabel = formatMoneyValue(invoice.amount || 0, currency);
    const paymentAmountLabel = formatMoneyValue(payment.amount || 0, currency);
    const confirmedPaidLabel = formatMoneyValue(settlement.confirmedPaidAmount || payment.amount || 0, currency);
    const outstandingAmount = round2(Number(settlement.outstandingAmount || 0));
    const outstandingLabel = formatMoneyValue(outstandingAmount, currency);
    const issuedAt = formatDateLabel(payment.receivedAt || payment.createdAt || "");
    const invoiceIssuedAt = formatDateLabel(invoice.issuedAt || invoice.createdAt || "");
    const periodStart = formatDateLabel(invoice.periodStart || "");
    const periodEnd = formatDateLabel(invoice.periodEnd || "");
    const paymentMethod = String(payment.method || "-").trim() || "-";
    const reference = String(payment.reference || "-").trim() || "-";
    const proofImage = payment.proofImageData ? dataUrlImageToBuffer(payment.proofImageData) : null;
    const hasProofThumbnail = Boolean(proofImage?.buffer?.length);
    const isFullyPaid = outstandingAmount <= 0.009 || normalizeInvoiceStatus(invoice.status, "pending") === "paid";
    const green = "#0f8a5f";
    const greenSoft = "#e7f8ee";
    const ink = "#111827";
    const muted = "#6b7280";
    const line = "#e5e7eb";
    const soft = "#f8fafc";
    const accent = isFullyPaid ? "PAGADA" : "ABONO APLICADO";

    doc.roundedRect(24, 24, doc.page.width - 48, doc.page.height - 48, 18).fillAndStroke("#ffffff", "#edf1f7");
    doc.roundedRect(48, 52, doc.page.width - 96, 96, 16).fill(green);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("RECIBO DE PAGO", 72, 82);
    doc.font("Helvetica").fontSize(11).text(tenantName, 72, 114, { width: 260 });

    doc.save();
    doc.roundedRect(392, 70, 128, 58, 12).fillOpacity(0.16).fillAndStroke("#ffffff", "#ffffff");
    doc.restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9.5).text("RECIBO N.", 406, 82, { width: 100, align: "left" });
    doc.font("Helvetica-Bold").fontSize(11).text(payment.id || "-", 406, 96, { width: 100, align: "left" });
    doc.font("Helvetica-Bold").fontSize(9.5).text("FECHA", 406, 110, { width: 100, align: "left" });
    doc.font("Helvetica").fontSize(10).text(issuedAt, 450, 110, { width: 56, align: "right" });

    doc.roundedRect(72, 172, 220, 90, 12).fillAndStroke(soft, line);
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("RECIBIDO DE", 88, 188);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(ownerName, 88, 208, { width: 180 });
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(ownerEmail, 88, 228, { width: 180 });

    doc.roundedRect(316, 172, 220, 90, 12).fillAndStroke(greenSoft, line);
    doc.fillColor(green).font("Helvetica-Bold").fontSize(9).text("ESTADO DEL PAGO", 332, 188);
    doc.font("Helvetica-Bold").fontSize(20).text(paymentAmountLabel, 332, 208, { width: 180 });
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(accent, 332, 236, { width: 180 });

    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11).text("Detalle del recibo", 72, 302);
    doc.roundedRect(72, 326, 464, 164, 10).stroke(line);
    doc.font("Helvetica-Bold").fontSize(10).text("Factura asociada", 88, 344);
    doc.text("Periodo", 292, 344);
    doc.text("Monto", 450, 344, { width: 70, align: "right" });
    doc.moveTo(88, 364).lineTo(520, 364).stroke(line);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(invoice.id || "-", 88, 380, { width: 180 });
    doc.text(`${periodStart} - ${periodEnd}`, 292, 380, { width: 120 });
    doc.font("Helvetica-Bold").text(invoiceAmountLabel, 450, 380, { width: 70, align: "right" });

    doc.moveTo(88, 410).lineTo(520, 410).stroke(line);
    doc.font("Helvetica-Bold").fontSize(10).text("Pago registrado", 88, 426);
    doc.text("Metodo", 292, 426);
    doc.text("Monto", 450, 426, { width: 70, align: "right" });
    doc.moveTo(88, 446).lineTo(520, 446).stroke(line);
    doc.font("Helvetica").fontSize(10).text(payment.id || "-", 88, 462, { width: 180 });
    doc.text(paymentMethod, 292, 462, { width: 120 });
    doc.font("Helvetica-Bold").text(paymentAmountLabel, 450, 462, { width: 70, align: "right" });

    doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text("Resumen", 72, 530);
    doc.roundedRect(72, 554, 220, 112, 10).fillAndStroke(soft, line);
    doc.roundedRect(316, 554, 220, 112, 10).fillAndStroke(soft, line);
    if (hasProofThumbnail) {
      doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("COMPROBANTE RECIBIDO", 88, 570);
      doc.save();
      doc.roundedRect(88, 588, 188, 56, 8).clip();
      doc.image(proofImage.buffer, 88, 588, { fit: [188, 56], align: "center", valign: "center" });
      doc.restore();
      doc.roundedRect(88, 588, 188, 56, 8).stroke("#d6dde8");
      doc.fillColor(muted).font("Helvetica").fontSize(8.5).text("Miniatura del comprobante validado", 88, 648, { width: 188 });
    } else {
      doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("REFERENCIA", 88, 570);
      doc.fillColor(ink).font("Helvetica").fontSize(10).text(reference, 88, 590, { width: 188 });
    }
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("FACTURA EMITIDA", 332, 570);
    doc.fillColor(ink).font("Helvetica").fontSize(10).text(invoiceIssuedAt, 332, 590, { width: 180 });
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("PAGADO ACUMULADO", 332, 616);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text(confirmedPaidLabel, 332, 634, { width: 180 });

    doc.roundedRect(344, 688, 176, 76, 12).fillAndStroke("#ffffff", line);
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("SALDO PENDIENTE", 360, 704, { width: 144, align: "center" });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(outstandingLabel, 360, 724, { width: 144, align: "center" });
    doc.fillColor(green).font("Helvetica-Bold").fontSize(9).text("Gracias por tu pago.", 360, 748, { width: 144, align: "center" });

    doc.end();
  });
}

async function buildBillingPaymentEmailContext(tenantId, invoiceRow, paymentRow, settlement) {
  const invoiceContext = await buildBillingInvoiceEmailContext(tenantId, invoiceRow);
  const paymentMeta = parseBillingPaymentStoredNotes(paymentRow?.notes);
  return {
    ...invoiceContext,
    payment: {
      ...mapBillingPaymentRow(paymentRow),
      proofImageData: paymentMeta.proofImageData || ""
    },
    settlement: settlement
      ? {
        amount: Number(settlement.amount || invoiceContext?.invoice?.amount || 0),
        confirmedPaidAmount: Number(settlement.confirmedPaidAmount || 0),
        outstandingAmount: Number(settlement.outstandingAmount || 0),
        status: normalizeInvoiceStatus(settlement.expectedStatus, invoiceContext?.invoice?.status || "pending")
      }
      : null
  };
}

async function sendBillingPaymentConfirmationEmail(paymentContext) {
  const ownerEmail = String(paymentContext?.ownerEmail || "").trim();
  if (!ownerEmail) {
    const error = new Error("El tenant no tiene un correo propietario configurado");
    error.status = 400;
    throw error;
  }

  const pdfBuffer = await generateBillingPaymentReceiptPdfBuffer(paymentContext);
  const invoiceId = paymentContext?.invoice?.id || "factura";
  const paymentId = paymentContext?.payment?.id || "pago";

  return sendEmailViaResend({
    to: [ownerEmail],
    subject: `Pago recibido para la factura ${invoiceId}`,
    html: buildBillingPaymentConfirmationEmailHtml(paymentContext),
    text: `Gracias por tu pago. Registramos el pago ${paymentId} aplicado a la factura ${invoiceId}. Adjuntamos tu recibo de pago en PDF.`,
    attachments: [
      {
        filename: `recibo-pago-${paymentId}.pdf`,
        content: pdfBuffer.toString("base64")
      }
    ]
  });
}

function normalizeRole(value, fallback) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "superadministrador" || normalized === "superadmin") {
    return SUPERADMIN_ROLE;
  }

  if (normalized === "administrador" || normalized === "admin") {
    return ADMIN_ROLE;
  }

  return fallback === undefined ? ADMIN_ROLE : fallback;
}

function normalizeAccountStatus(value) {
  const raw = String(value || DEFAULT_ACCOUNT_STATUS).trim().toLowerCase();
  return raw === "inactive" ? "inactive" : "active";
}

function normalizePromiseStatus(value) {
  const raw = String(value || "pending").trim().toLowerCase();
  return PAYMENT_PROMISE_STATUSES.has(raw) ? raw : "pending";
}

async function autoBreakOverduePromises(tenantId) {
  const now = isoNow();
  const today = isoToday();

  const { error } = await supabase
    .from("payment_promises")
    .update({
      status: "broken",
      resolved_at: now,
      updated_at: now
    })
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .lt("promised_date", today);

  if (error && !["42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }
}

function notificationPayload(base) {
  return {
    id: `NTF-${base.code}`,
    code: base.code,
    tenant_id: base.tenantId,
    type: base.type,
    severity: base.severity,
    title: base.title,
    message: base.message,
    entity_type: base.entityType || null,
    entity_id: base.entityId || null,
    event_date: base.eventDate || isoToday(),
    status: "unread",
    meta: base.meta || {}
  };
}

function buildAutomatedNotifications(state, tenantId) {
  const notifications = [];
  const today = startOfDay(new Date());
  const todayISO = isoToday();
  const graceDays = Number(state?.settings?.graceDays) || 0;
  const customersById = new Map((state.customers || []).map((customer) => [customer.id, customer]));

  (state.paymentPromises || []).forEach((promise) => {
    const customer = customersById.get(promise.customerId);
    const customerName = customer ? customer.name : "Cliente";

    if (promise.status === "broken") {
      notifications.push(notificationPayload({
        code: `promise-${promise.id}-broken`,
        tenantId,
        type: "promise_broken",
        severity: "critical",
        title: "Promesa incumplida",
        message: `${customerName} incumplio la promesa asociada a ${promise.loanId}.`,
        entityType: "payment_promise",
        entityId: promise.id,
        eventDate: todayISO,
        meta: { customerId: promise.customerId, loanId: promise.loanId }
      }));
    }
  });

  (state.loans || []).forEach((loan) => {
    if (String(loan?.status || "").toLowerCase() === "paid") {
      return;
    }

    const customer = customersById.get(loan.customerId);
    const customerName = customer ? customer.name : "Cliente";
    const dueDate = loanNextDueDate(loan);
    const overdueDays = daysOverdue(loan, graceDays);

    if (dueDate && startOfDay(dueDate).getTime() === today.getTime()) {
      notifications.push(notificationPayload({
        code: `loan-${loan.id}-due-${todayISO}`,
        tenantId,
        type: "due_today",
        severity: overdueDays > 0 ? "critical" : "warning",
        title: "Cobro programado para hoy",
        message: `${customerName} tiene un cobro previsto hoy en ${loan.id}.`,
        entityType: "loan",
        entityId: loan.id,
        eventDate: todayISO,
        meta: { customerId: loan.customerId, loanId: loan.id }
      }));
    }

    const shouldNotifyOverdue =
      overdueDays > 0
      && (overdueDays === 1 || overdueDays === 3 || overdueDays === 7 || overdueDays % 7 === 0);

    if (shouldNotifyOverdue) {
      notifications.push(notificationPayload({
        code: `loan-${loan.id}-overdue-${overdueDays}`,
        tenantId,
        type: "overdue_alert",
        severity: overdueDays >= 7 ? "critical" : "warning",
        title: overdueDays >= 7 ? "Mora critica detectada" : "Prestamo en mora",
        message: `${customerName} acumula ${overdueDays} dia(s) de atraso en ${loan.id}.`,
        entityType: "loan",
        entityId: loan.id,
        eventDate: todayISO,
        meta: { customerId: loan.customerId, loanId: loan.id, overdueDays }
      }));
    }
  });

  const budget = Math.max(Number(state?.settings?.capitalBudget) || 0, 0);
  if (budget > 0) {
    const committed = capitalCommittedFromLoans(state.loans || []);
    const available = round2(Math.max(budget - committed, 0));
    const usagePct = round2((committed / budget) * 100);
    if (usagePct >= 85) {
      notifications.push(notificationPayload({
        code: `capital-usage-${todayISO}`,
        tenantId,
        type: "capital_alert",
        severity: usagePct >= 95 ? "critical" : "warning",
        title: "Capital disponible bajo",
        message: `Uso de capital en ${usagePct}%. Disponible ${available.toFixed(2)} ${DEFAULT_SUBSCRIPTION_CURRENCY}.`,
        entityType: "settings",
        entityId: "capital_budget",
        eventDate: todayISO,
        meta: { usagePct, available }
      }));
    }
  }

  const dueToday = (state.loans || []).filter((loan) => {
    const dueDate = loanNextDueDate(loan);
    if (!dueDate) return false;
    return startOfDay(dueDate).getTime() === today.getTime();
  }).length;
  const overdueCount = (state.loans || []).filter((loan) => daysOverdue(loan, graceDays) > 0).length;
  const pendingPromises = (state.paymentPromises || []).filter((promise) => promise.status === "pending").length;

  notifications.push(notificationPayload({
    code: `daily-summary-${todayISO}`,
    tenantId,
    type: "daily_summary",
    severity: overdueCount > 0 ? "warning" : "info",
    title: "Resumen diario de cobranza",
    message: `${dueToday} cobro(s) para hoy, ${overdueCount} prestamo(s) en mora y ${pendingPromises} promesa(s) pendiente(s).`,
    entityType: "dashboard",
    entityId: "daily_summary",
    eventDate: todayISO,
    meta: { dueToday, overdueCount, pendingPromises }
  }));

  return notifications;
}

function buildAppUrl(pathname, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    const normalizedValue = String(value ?? "").trim();
    if (normalizedValue) {
      searchParams.set(key, normalizedValue);
    }
  });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildPushPayloadFromNotification(notification) {
  const type = String(notification?.type || "").trim().toLowerCase();
  const loanId = String(notification?.meta?.loanId || notification?.entityId || "").trim();
  const customerId = String(notification?.meta?.customerId || "").trim();
  const tenantId = String(notification?.meta?.tenantId || notification?.entityId || "").trim();
  const tenantName = String(notification?.meta?.tenantName || "").trim();
  const ownerEmail = String(notification?.meta?.ownerEmail || "").trim();
  const overdueDays = Number(notification?.meta?.overdueDays || 0);
  const loanDetailUrl = buildAppUrl("/loans", {
    loanId,
    status: type === "overdue_alert" ? "overdue" : ""
  });
  const customerDetailUrl = buildAppUrl("/customers", { customerId });
  const tenantDetailUrl = buildAppUrl("/superadmin/tenants", { tenantId });

  if (type === "tenant_signup_alert") {
    return {
      type,
      title: notification.title || "Nuevo cliente registrado",
      body: notification.message || `${tenantName || "Un nuevo cliente"} ya esta activo en CrediSync.`,
      url: tenantId ? tenantDetailUrl : "/notifications",
      tag: `tenant-signup-${notification.code}`,
      renotify: true,
      requireInteraction: true,
      primaryAction: {
        action: "open-primary",
        title: tenantId ? "Ver tenant" : "Ver tenants",
        url: tenantId ? tenantDetailUrl : "/superadmin/tenants"
      },
      secondaryAction: {
        action: "open-notifications",
        title: "Ver alertas",
        url: "/notifications"
      },
      context: { tenantId, tenantName, ownerEmail }
    };
  }

  if (type === "promise_broken") {
    return {
      type,
      title: notification.title || "Promesa incumplida",
      body: notification.message || "Se detecto una promesa incumplida.",
      url: customerId ? customerDetailUrl : loanDetailUrl || "/notifications",
      tag: `promise-broken-${notification.code}`,
      renotify: true,
      requireInteraction: true,
      primaryAction: {
        action: "open-primary",
        title: customerId ? "Ver cliente" : "Ver alerta",
        url: customerId ? customerDetailUrl : "/notifications"
      },
      secondaryAction: {
        action: "open-loan",
        title: loanId ? "Ver prestamo" : "Prestamos",
        url: loanId ? loanDetailUrl : "/loans"
      },
      context: { loanId, customerId }
    };
  }

  if (type === "due_today") {
    return {
      type,
      title: notification.title || "Cobro programado para hoy",
      body: notification.message || "Tienes un cobro pendiente para hoy.",
      url: loanId ? loanDetailUrl : "/payments?focus=queue",
      tag: `due-today-${notification.code}`,
      renotify: true,
      requireInteraction: false,
      primaryAction: {
        action: "open-primary",
        title: loanId ? "Ver prestamo" : "Ver cobros",
        url: loanId ? loanDetailUrl : "/payments?focus=queue"
      },
      secondaryAction: {
        action: "open-customer",
        title: customerId ? "Ver cliente" : "Clientes",
        url: customerId ? customerDetailUrl : "/customers"
      },
      context: { loanId, customerId }
    };
  }

  if (type === "overdue_alert") {
    return {
      type,
      title: notification.title || "Prestamo en mora",
      body: notification.message || "Se detecto un prestamo vencido.",
      url: loanId ? loanDetailUrl : "/loans?status=overdue",
      tag: `overdue-${notification.code}`,
      renotify: true,
      requireInteraction: overdueDays >= 7,
      primaryAction: {
        action: "open-primary",
        title: loanId ? "Ver prestamo" : "Ver mora",
        url: loanId ? loanDetailUrl : "/loans?status=overdue"
      },
      secondaryAction: {
        action: "open-customer",
        title: customerId ? "Ver cliente" : "Alertas",
        url: customerId ? customerDetailUrl : "/notifications"
      },
      context: { loanId, customerId, overdueDays }
    };
  }

  return null;
}

function buildPaymentReceivedPushPayload(payment, options = {}) {
  const amount = round2(Number(payment?.amount || 0));
  const customerName = String(options.customerName || "Cliente").trim() || "Cliente";
  const loanId = String(payment?.loanId || options.loanId || "").trim();
  const customerId = String(payment?.customerId || options.customerId || "").trim();
  const loanDetailUrl = buildAppUrl("/loans", { loanId });
  const customerDetailUrl = buildAppUrl("/customers", { customerId });

  return {
    type: "payment_received",
    title: "Pago registrado",
    body: `${customerName} pago ${amount.toFixed(2)} ${DEFAULT_SUBSCRIPTION_CURRENCY}${loanId ? ` en ${loanId}` : ""}.`,
    url: loanId ? loanDetailUrl : "/payments",
    tag: `payment-${payment?.id || loanId || isoNow()}`,
    renotify: true,
    requireInteraction: false,
    primaryAction: {
      action: "open-primary",
      title: loanId ? "Ver prestamo" : "Ver pagos",
      url: loanId ? loanDetailUrl : "/payments"
    },
    secondaryAction: {
      action: "open-customer",
      title: customerId ? "Ver cliente" : "Clientes",
      url: customerId ? customerDetailUrl : "/customers"
    },
    context: {
      paymentId: String(payment?.id || "").trim(),
      loanId,
      customerId
    }
  };
}

async function syncAutomatedNotificationsForTenant(tenantId, state) {
  const notifications = buildAutomatedNotifications(state, tenantId);
  if (notifications.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .upsert(notifications, { onConflict: "code", ignoreDuplicates: true });

  if (error && !["42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }

  for (const notification of notifications) {
    const payload = buildPushPayloadFromNotification(notification);
    if (!payload) {
      continue;
    }

    await sendPushPayloadToTenant(tenantId, payload, {
      deliveryType: PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT,
      eventKey: notification.code,
      deliveryDate: String(notification.eventDate || isoToday()).trim() || isoToday()
    });
  }
}

function buildDailyCollectionSummaryFromState(state, timezone, nowDate) {
  const normalizedTimezone = sanitizePushTimezone(timezone, "America/Santo_Domingo");
  const referenceDate = nowDate instanceof Date ? nowDate : new Date();
  const localDateParts = getDatePartsForTimezone(normalizedTimezone, referenceDate);
  const todayKey = localDateParts.dateKey;
  const graceDays = Number(state?.settings?.graceDays) || 0;

  const dueLoans = (state?.loans || [])
    .filter((loan) => String(loan.status || "") !== "paid")
    .map((loan) => {
      const dueDate = loanNextDueDate(loan);
      if (!dueDate) {
        return null;
      }

      const dueDateKey = getDatePartsForTimezone(normalizedTimezone, dueDate).dateKey;
      if (dueDateKey !== todayKey) {
        return null;
      }

      return loan;
    })
    .filter(Boolean);

  const overdueCount = (state?.loans || []).filter((loan) => daysOverdue(loan, graceDays) > 0).length;
  const pendingPromises = (state?.paymentPromises || []).filter((promise) => promise.status === "pending").length;
  const dueToday = dueLoans.length;

  const title = dueToday > 0 ? "Resumen de cobros de hoy" : "Sin cobros programados hoy";
  const message =
    dueToday > 0
      ? `Tienes ${dueToday} cobro(s) para hoy, ${overdueCount} prestamo(s) en mora y ${pendingPromises} promesa(s) pendiente(s).`
      : `Hoy no tienes cobros programados. En mora: ${overdueCount}. Promesas pendientes: ${pendingPromises}.`;

  return {
    timezone: normalizedTimezone,
    localDateKey: todayKey,
    dueToday,
    overdueCount,
    pendingPromises,
    title,
    message
  };
}

function buildPushPayload(summary, tenantName) {
  const hasDueToday = Number(summary?.dueToday || 0) > 0;
  const hasOverdue = Number(summary?.overdueCount || 0) > 0;
  const primaryUrl = hasDueToday
    ? "/payments?focus=queue"
    : hasOverdue
      ? "/loans?status=overdue"
      : "/dashboard";
  const primaryTitle = hasDueToday ? "Ver cobros" : hasOverdue ? "Ver mora" : "Abrir panel";

  return {
    type: PUSH_DELIVERY_TYPE_DAILY_SUMMARY,
    tenantName: tenantName || "CrediSync",
    title: summary.title,
    body: summary.message,
    dueToday: summary.dueToday,
    overdueCount: summary.overdueCount,
    pendingPromises: summary.pendingPromises,
    localDateKey: summary.localDateKey,
    timezone: summary.timezone,
    url: primaryUrl,
    tag: `daily-summary-${summary.localDateKey}`,
    renotify: hasDueToday || hasOverdue,
    requireInteraction: hasOverdue,
    primaryAction: {
      action: "open-primary",
      title: primaryTitle,
      url: primaryUrl
    },
    secondaryAction: {
      action: "open-notifications",
      title: "Alertas",
      url: "/notifications"
    },
    context: {
      dueToday: Number(summary?.dueToday || 0),
      overdueCount: Number(summary?.overdueCount || 0),
      pendingPromises: Number(summary?.pendingPromises || 0)
    }
  };
}

function buildPushDeliveryKey(tenantId, userId, deliveryType, localDateKey) {
  const scopeKey = String(tenantId || "platform").trim() || "platform";
  return crypto
    .createHash("sha256")
    .update(`${scopeKey}|${userId}|${deliveryType}|${localDateKey}`)
    .digest("hex")
    .slice(0, 40);
}

let superadminPushTenantScopeCache = {
  tenantId: null,
  expiresAt: 0
};

async function resolveSuperadminPushTenantScope() {
  if (superadminPushTenantScopeCache.expiresAt > Date.now()) {
    return superadminPushTenantScopeCache.tenantId;
  }

  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("role", SUPERADMIN_ROLE)
    .not("tenant_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    superadminPushTenantScopeCache = { tenantId: null, expiresAt: Date.now() + 15 * 1000 };
    return null;
  }

  const tenantId = String(data?.[0]?.tenant_id || "").trim() || null;
  if (tenantId) {
    superadminPushTenantScopeCache = {
      tenantId,
      expiresAt: Date.now() + 5 * 60 * 1000
    };
    return tenantId;
  }

  const tenantsResult = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  const fallbackTenantId = String(tenantsResult?.data?.[0]?.id || "").trim() || null;
  superadminPushTenantScopeCache = {
    tenantId: fallbackTenantId,
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  return fallbackTenantId;
}

async function resolveLatestPushTenantScopeForUser(userId) {
  const scopedUserId = String(userId || "").trim();
  if (!scopedUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("tenant_id,updated_at")
    .eq("user_id", scopedUserId)
    .eq("enabled", true)
    .is("deleted_at", null)
    .not("tenant_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    if (isSchemaMissingError(error)) {
      return null;
    }

    console.warn(`[PUSH SCOPE WARNING] Could not resolve latest push scope for user ${scopedUserId}:`, error.message);
    return null;
  }

  return String(data?.[0]?.tenant_id || "").trim() || null;
}

async function resolvePreferredPushTenantScopeForUser(user) {
  const directTenantId = String(user?.tenantId || "").trim() || null;
  if (directTenantId) {
    return directTenantId;
  }

  if (isSuperadminRole(user?.role)) {
    const scopedTenantFromSubscriptions = await resolveLatestPushTenantScopeForUser(user?.id);
    if (scopedTenantFromSubscriptions) {
      return scopedTenantFromSubscriptions;
    }

    return resolveSuperadminPushTenantScope();
  }

  return null;
}

async function listSuperadminAppUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,role,tenant_id")
    .eq("role", SUPERADMIN_ROLE)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    email: entry.email,
    role: entry.role,
    tenantId: entry.tenant_id || null
  }));
}

async function listPushSubscriptionsForUser(tenantId, userId) {
  const scopedTenantId = String(tenantId || "").trim() || null;
  let query = supabase
    .from("push_subscriptions")
    .select("id,tenant_id,user_id,endpoint,p256dh,auth,expiration_time,user_agent,device_label,timezone,enabled,last_seen_at,created_at,updated_at")
    .eq("user_id", userId)
    .eq("enabled", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  query = scopedTenantId ? query.eq("tenant_id", scopedTenantId) : query.is("tenant_id", null);
  const { data, error } = await query;

  if (error) {
    if (isSchemaMissingError(error)) {
      return null;
    }
    throw error;
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    tenantId: entry.tenant_id,
    userId: entry.user_id,
    endpoint: entry.endpoint,
    expirationTime: entry.expiration_time == null ? null : Number(entry.expiration_time),
    keys: {
      p256dh: entry.p256dh,
      auth: entry.auth
    },
    userAgent: entry.user_agent || "",
    deviceLabel: entry.device_label || "",
    timezone: sanitizePushTimezone(entry.timezone, "America/Santo_Domingo"),
    enabled: entry.enabled !== false,
    lastSeenAt: entry.last_seen_at || null,
    createdAt: entry.created_at || null,
    updatedAt: entry.updated_at || null
  }));
}

async function listPushSubscriptionsForTenant(tenantId) {
  const scopedTenantId = String(tenantId || "").trim() || null;
  let query = supabase
    .from("push_subscriptions")
    .select("id,tenant_id,user_id,endpoint,p256dh,auth,expiration_time,user_agent,device_label,timezone,enabled,last_seen_at,created_at,updated_at")
    .eq("enabled", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  query = scopedTenantId ? query.eq("tenant_id", scopedTenantId) : query.is("tenant_id", null);
  const { data, error } = await query;

  if (error) {
    if (isSchemaMissingError(error)) {
      return null;
    }
    throw error;
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    tenantId: entry.tenant_id,
    userId: entry.user_id,
    endpoint: entry.endpoint,
    expirationTime: entry.expiration_time == null ? null : Number(entry.expiration_time),
    keys: {
      p256dh: entry.p256dh,
      auth: entry.auth
    },
    userAgent: entry.user_agent || "",
    deviceLabel: entry.device_label || "",
    timezone: sanitizePushTimezone(entry.timezone, "America/Santo_Domingo"),
    enabled: entry.enabled !== false,
    lastSeenAt: entry.last_seen_at || null,
    createdAt: entry.created_at || null,
    updatedAt: entry.updated_at || null
  }));
}

async function disablePushSubscriptionById(id) {
  if (!id) {
    return;
  }

  const now = isoNow();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: now })
    .eq("id", id);

  if (error && !isSchemaMissingError(error)) {
    throw error;
  }
}

async function sendPushToSubscription(subscription, payload) {
  if (!HAS_WEB_PUSH_CONFIG || !subscription) {
    return { ok: false, status: 503, error: "Web Push no configurado" };
  }

  try {
    const topic = String(payload?.tag || payload?.type || payload?.localDateKey || "credisync-push")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .slice(0, 32) || "credisync-push";
    const response = await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 4,
        urgency: "high",
        topic
      }
    );

    return {
      ok: true,
      status: Number(response && response.statusCode ? response.statusCode : 201),
      error: ""
    };
  } catch (error) {
    const status = Number(error && error.statusCode ? error.statusCode : 0);
    const message = error && error.body ? String(error.body) : error && error.message ? String(error.message) : "Push failed";

    if (status === 404 || status === 410) {
      await disablePushSubscriptionById(subscription.id);
    }

    return {
      ok: false,
      status,
      error: message.slice(0, 600)
    };
  }
}

async function recordPushDeliveryAttempt(entry) {
  const payload = entry && typeof entry === "object" ? entry : {};
  const tenantId = String(payload.tenantId || "").trim() || null;
  const userId = String(payload.userId || "").trim() || null;
  if (!tenantId || !userId) {
    return;
  }

  const row = {
    id: payload.id || `PDL-${numericId()}`,
    tenant_id: tenantId,
    user_id: userId,
    subscription_id: payload.subscriptionId || null,
    delivery_type: payload.deliveryType || PUSH_DELIVERY_TYPE_DAILY_SUMMARY,
    delivery_date: payload.deliveryDate,
    delivery_key: payload.deliveryKey,
    status: payload.status || "sent",
    response_code: payload.responseCode == null ? null : Number(payload.responseCode),
    error_message: payload.errorMessage || null,
    payload: payload.payload || {},
    sent_at: payload.sentAt || isoNow()
  };

  const { error } = await supabase.from("push_delivery_logs").upsert([row], { onConflict: "delivery_key" });
  if (error && !isPushDeliveryTableMissingError(error)) {
    throw error;
  }
}

async function hasPushDeliveredByKey(deliveryKey) {
  const key = String(deliveryKey || "").trim();
  if (!key) {
    return false;
  }

  const { data, error } = await supabase
    .from("push_delivery_logs")
    .select("delivery_key,status")
    .eq("delivery_key", key)
    .eq("status", "sent")
    .maybeSingle();

  if (error) {
    if (isPushDeliveryTableMissingError(error)) {
      return false;
    }
    throw error;
  }

  return Boolean(data && data.delivery_key);
}

async function hasPushDeliveredDailySummary(tenantId, userId, localDateKey) {
  const deliveryKey = buildPushDeliveryKey(tenantId, userId, PUSH_DELIVERY_TYPE_DAILY_SUMMARY, localDateKey);
  return hasPushDeliveredByKey(deliveryKey);
}

async function sendPushPayloadToTenant(tenantId, payload, options = {}) {
  const scopedTenantId = String(tenantId || "").trim() || null;
  if (!HAS_WEB_PUSH_CONFIG || !payload) {
    return { sentUsers: 0, skippedUsers: 0, failedUsers: 0 };
  }

  const subscriptions = await listPushSubscriptionsForTenant(scopedTenantId);
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { sentUsers: 0, skippedUsers: 0, failedUsers: 0 };
  }

  const deliveryType = String(options.deliveryType || PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT).trim() || PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT;
  const eventKey = String(options.eventKey || options.deliveryDate || isoToday()).trim() || isoToday();
  const deliveryDate = String(options.deliveryDate || isoToday()).trim() || isoToday();
  const canPersistDeliveryLog = Boolean(scopedTenantId);
  const subscriptionsByUser = new Map();

  subscriptions.forEach((entry) => {
    const userId = String(entry.userId || "").trim();
    if (!userId) {
      return;
    }

    if (!subscriptionsByUser.has(userId)) {
      subscriptionsByUser.set(userId, []);
    }
    subscriptionsByUser.get(userId).push(entry);
  });

  let sentUsers = 0;
  let skippedUsers = 0;
  let failedUsers = 0;

  for (const [userId, userSubscriptions] of subscriptionsByUser.entries()) {
    const deliveryKey = buildPushDeliveryKey(scopedTenantId, userId, deliveryType, eventKey);
    if (canPersistDeliveryLog && await hasPushDeliveredByKey(deliveryKey)) {
      skippedUsers += 1;
      continue;
    }

    const results = await Promise.all(userSubscriptions.map((entry) => sendPushToSubscription(entry, payload)));
    const counters = summarizePushSendResults(results);
    const status = counters.sent > 0 ? "sent" : "failed";

    if (canPersistDeliveryLog) {
      await recordPushDeliveryAttempt({
        tenantId: scopedTenantId,
        userId,
        subscriptionId: null,
        deliveryType,
        deliveryDate,
        deliveryKey,
        status,
        responseCode: counters.sent > 0 ? 201 : 500,
        errorMessage: counters.sent > 0 ? "" : "No se pudo entregar a ningun dispositivo activo",
        payload
      });
    }

    if (counters.sent > 0) {
      sentUsers += 1;
    } else {
      failedUsers += 1;
    }
  }

  return {
    sentUsers,
    skippedUsers,
    failedUsers
  };
}

async function sendPushPayloadToUser(tenantId, userId, payload, options = {}) {
  const scopedTenantId = String(tenantId || "").trim() || null;
  const scopedUserId = String(userId || "").trim() || null;
  if (!HAS_WEB_PUSH_CONFIG || !scopedUserId || !payload) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await listPushSubscriptionsForUser(scopedTenantId, scopedUserId);
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.all(subscriptions.map((entry) => sendPushToSubscription(entry, payload)));
  const counters = summarizePushSendResults(results);
  const canPersistDeliveryLog = Boolean(scopedTenantId);

  if (canPersistDeliveryLog) {
    const deliveryType = String(options.deliveryType || PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT).trim() || PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT;
    const eventKey = String(options.eventKey || options.deliveryDate || isoToday()).trim() || isoToday();
    const deliveryDate = String(options.deliveryDate || isoToday()).trim() || isoToday();
    const deliveryKey = buildPushDeliveryKey(scopedTenantId, scopedUserId, deliveryType, eventKey);

    if (!(await hasPushDeliveredByKey(deliveryKey))) {
      await recordPushDeliveryAttempt({
        tenantId: scopedTenantId,
        userId: scopedUserId,
        subscriptionId: null,
        deliveryType,
        deliveryDate,
        deliveryKey,
        status: counters.sent > 0 ? "sent" : "failed",
        responseCode: counters.sent > 0 ? 201 : 500,
        errorMessage: counters.sent > 0 ? "" : "No se pudo entregar a ningun dispositivo activo",
        payload
      });
    }
  }

  return counters;
}

function isInsideDailySummaryWindow(localDateParts) {
  const hour = Number(localDateParts && localDateParts.hour);
  const minute = Number(localDateParts && localDateParts.minute);
  return hour === PUSH_DAILY_SUMMARY_LOCAL_HOUR && minute >= 0 && minute <= 20;
}

function summarizePushSendResults(results) {
  return results.reduce(
    (acc, item) => {
      if (item.ok) {
        acc.sent += 1;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    { sent: 0, failed: 0 }
  );
}

async function runPushDailySummaryJob(options = {}) {
  if (!HAS_WEB_PUSH_CONFIG) {
    const error = new Error("Push no configurado en servidor.");
    error.status = 503;
    throw error;
  }

  const now = options.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("tenant_id,user_id,timezone,updated_at")
    .eq("enabled", true)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) {
      const schemaError = new Error("Tablas de push no encontradas. Ejecuta supabase_schema.sql para habilitar notificaciones push.");
      schemaError.status = 503;
      throw schemaError;
    }
    throw error;
  }

  const candidatesByUser = new Map();
  (rows || []).forEach((row) => {
    const tenantId = String(row.tenant_id || "").trim();
    const userId = String(row.user_id || "").trim();
    if (!tenantId || !userId) return;

    const key = `${tenantId}:${userId}`;
    if (candidatesByUser.has(key)) return;

    candidatesByUser.set(key, {
      tenantId,
      userId,
      timezone: sanitizePushTimezone(row.timezone, "America/Santo_Domingo")
    });
  });

  const tenantStateCache = new Map();
  let evaluated = 0;
  let sentUsers = 0;
  let skippedUsers = 0;
  let failedUsers = 0;

  for (const candidate of candidatesByUser.values()) {
    const localParts = getDatePartsForTimezone(candidate.timezone, now);
    if (!isInsideDailySummaryWindow(localParts)) {
      skippedUsers += 1;
      continue;
    }

    evaluated += 1;
    if (await hasPushDeliveredDailySummary(candidate.tenantId, candidate.userId, localParts.dateKey)) {
      skippedUsers += 1;
      continue;
    }

    const subscriptions = await listPushSubscriptionsForUser(candidate.tenantId, candidate.userId);
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      skippedUsers += 1;
      continue;
    }

    let state = tenantStateCache.get(candidate.tenantId);
    if (!state) {
      state = await readStateForTenant(candidate.tenantId);
      tenantStateCache.set(candidate.tenantId, state);
    }

    const summary = buildDailyCollectionSummaryFromState(state, candidate.timezone, now);
    const payload = buildPushPayload(summary, "CrediSync");
    const results = await Promise.all(subscriptions.map((entry) => sendPushToSubscription(entry, payload)));
    const counters = summarizePushSendResults(results);
    const status = counters.sent > 0 ? "sent" : "failed";
    const deliveryKey = buildPushDeliveryKey(candidate.tenantId, candidate.userId, PUSH_DELIVERY_TYPE_DAILY_SUMMARY, summary.localDateKey);

    await recordPushDeliveryAttempt({
      tenantId: candidate.tenantId,
      userId: candidate.userId,
      subscriptionId: null,
      deliveryType: PUSH_DELIVERY_TYPE_DAILY_SUMMARY,
      deliveryDate: summary.localDateKey,
      deliveryKey,
      status,
      responseCode: counters.sent > 0 ? 201 : 500,
      errorMessage: counters.sent > 0 ? "" : "No se pudo entregar a ningun dispositivo activo",
      payload
    });

    if (counters.sent > 0) {
      sentUsers += 1;
    } else {
      failedUsers += 1;
    }
  }

  return {
    ok: true,
    evaluated,
    sentUsers,
    skippedUsers,
    failedUsers,
    totalCandidates: candidatesByUser.size,
    serverTime: now.toISOString()
  };
}

let pushDailyJobRunning = false;
function startLocalPushScheduler() {
  if (!ENABLE_LOCAL_PUSH_SCHEDULER || !PUSH_DAILY_SUMMARY_JOB_TOKEN || !HAS_WEB_PUSH_CONFIG) return;

  const run = async () => {
    if (pushDailyJobRunning) return;
    pushDailyJobRunning = true;
    try {
      const result = await runPushDailySummaryJob();
      console.log("[push-scheduler]", result);
    } catch (error) {
      console.error("[push-scheduler] error", error.message || error);
    } finally {
      pushDailyJobRunning = false;
    }
  };

  run();
  setInterval(run, 5 * 60 * 1000);
}

function isSuperadminRole(value) {
  return normalizeRole(value) === SUPERADMIN_ROLE;
}

function buildTenantId() {
  return `TEN-${numericId()}`;
}

function buildTenantName(name, email) {
  const baseName = String(name || nameFromEmail(email) || "Tenant").trim();
  const emailLocal = String(email || "").trim().toLowerCase().split("@")[0] || "";
  if (!emailLocal) {
    return `${baseName} Workspace`;
  }
  return `${baseName} Workspace (${emailLocal})`;
}

function isoNow() {
  return new Date().toISOString();
}

function isoToday() {
  return getDatePartsForTimezone("America/Santo_Domingo", new Date()).dateKey;
}

const PAYMENT_META_MARKER = "__CSMETA__:";
const PAYMENT_MODEL_LEGACY = "legacy_add_on";
const PAYMENT_MODEL_INTEREST_ONLY_BALLOON = "interest_only_balloon";

function normalizePaymentModel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === PAYMENT_MODEL_INTEREST_ONLY_BALLOON
    ? PAYMENT_MODEL_INTEREST_ONLY_BALLOON
    : PAYMENT_MODEL_LEGACY;
}

function isInterestOnlyBalloonLoan(loan) {
  return normalizePaymentModel(loan?.paymentModel) === PAYMENT_MODEL_INTEREST_ONLY_BALLOON;
}

function decodePaymentMeta(storedNote) {
  const raw = String(storedNote || "");
  const markerIndex = raw.lastIndexOf(PAYMENT_META_MARKER);
  if (markerIndex < 0) {
    return { note: raw, meta: null };
  }

  const encoded = raw.slice(markerIndex + PAYMENT_META_MARKER.length).trim();
  if (!encoded) {
    return { note: raw, meta: null };
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Number(parsed.v) !== 1) {
      return { note: raw, meta: null };
    }

    return {
      note: raw.slice(0, markerIndex).trimEnd(),
      meta: parsed
    };
  } catch (_error) {
    return { note: raw, meta: null };
  }
}

function encodePaymentMeta(note, meta) {
  const cleanNote = String(note || "").trim();
  if (!meta || typeof meta !== "object") {
    return cleanNote;
  }

  const payload = Buffer.from(JSON.stringify(meta), "utf8").toString("base64");
  return cleanNote ? `${cleanNote}\n${PAYMENT_META_MARKER}${payload}` : `${PAYMENT_META_MARKER}${payload}`;
}

function paymentMetaSnapshot(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const carryAfter = Number(meta?.penalty?.carryAfter);
  const episodeNumberAfter = Number(meta?.penalty?.episodeNumberAfter);
  const episodeLateFeePaidAfter = Number(meta?.penalty?.episodeLateFeePaidAfter);
  const hasLegacyPenaltySnapshot = Number.isFinite(carryAfter) && Number.isFinite(episodeNumberAfter) && Number.isFinite(episodeLateFeePaidAfter);

  const baseAmount = Number.isFinite(Number(meta?.alloc?.baseAmount)) ? Math.max(round2(Number(meta.alloc.baseAmount)), 0) : null;
  const lateFeeAmount = Number.isFinite(Number(meta?.alloc?.lateFeeAmount)) ? Math.max(round2(Number(meta.alloc.lateFeeAmount)), 0) : null;
  const principalAmount = Number.isFinite(Number(meta?.alloc?.principalAmount)) ? Math.max(round2(Number(meta.alloc.principalAmount)), 0) : baseAmount;
  const interestAmount = Number.isFinite(Number(meta?.alloc?.interestAmount)) ? Math.max(round2(Number(meta.alloc.interestAmount)), 0) : null;
  const model = normalizePaymentModel(meta?.alloc?.paymentModel);

  if (!hasLegacyPenaltySnapshot && !Number.isFinite(principalAmount) && !Number.isFinite(interestAmount) && !Number.isFinite(lateFeeAmount)) {
    return null;
  }

  return {
    carryAfter: hasLegacyPenaltySnapshot ? Math.max(round2(carryAfter), 0) : null,
    episodeNumberAfter: hasLegacyPenaltySnapshot ? Math.max(Math.round(episodeNumberAfter), 1) : null,
    episodeLateFeePaidAfter: hasLegacyPenaltySnapshot ? Math.max(round2(episodeLateFeePaidAfter), 0) : null,
    baseAmount,
    principalAmount,
    interestAmount,
    lateFeeAmount,
    paymentModel: model
  };
}

function loanInstallmentNumber(loan) {
  const installment = loanInstallment(loan);
  const termMonths = Math.max(Number(loan?.termMonths || 0), 1);
  if (!Number.isFinite(installment) || installment <= 0) {
    return 1;
  }

  const paidInstallments = Math.min(termMonths, Math.floor((Number(loan?.paidAmount || 0) + 0.00001) / installment));
  return Math.max(1, Math.min(termMonths, paidInstallments + 1));
}

function sortPaymentsChronologically(payments) {
  return [...(payments || [])].sort((a, b) => {
    const leftDate = toDate(a?.date || "");
    const rightDate = toDate(b?.date || "");
    const leftTime = Number.isNaN(leftDate.getTime()) ? 0 : leftDate.getTime();
    const rightTime = Number.isNaN(rightDate.getTime()) ? 0 : rightDate.getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    const leftCreated = new Date(a?.created_at || a?.createdAt || 0).getTime() || 0;
    const rightCreated = new Date(b?.created_at || b?.createdAt || 0).getTime() || 0;
    if (leftCreated !== rightCreated) {
      return leftCreated - rightCreated;
    }

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

function latestPenaltySnapshotFromPayments(payments) {
  const ordered = sortPaymentsChronologically(payments);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const { meta } = decodePaymentMeta(ordered[index]?.note || "");
    const snapshot = paymentMetaSnapshot(meta);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function legacyLateFeePaidFromPayments(loan, payments) {
  const paidCash = round2((payments || []).reduce((acc, payment) => acc + Number(payment?.amount || 0), 0));
  return Math.max(round2(paidCash - Number(loan?.paidAmount || 0)), 0);
}

function loanPenaltySnapshotAtDate(loan, settings, payments, referenceDate = new Date()) {
  const overdueDays = daysOverdueAtDate(loan, Number(settings?.graceDays) || 0, referenceDate);
  const installment = loanInstallment(loan);
  const outstanding = loanOutstanding(loan);
  const penaltyBase = Math.max(round2(Math.min(installment, outstanding)), 0);
  const dailyRate = Math.max(Number(settings?.latePenaltyRate) || 0, 0) / 100;
  const currentEpisodeAccrued = overdueDays > 0 && dailyRate > 0 && penaltyBase > 0
    ? round2(penaltyBase * dailyRate * overdueDays)
    : 0;

  const snapshot = latestPenaltySnapshotFromPayments(payments);
  const episodeNumber = loanInstallmentNumber(loan);
  const carryOutstanding = snapshot ? snapshot.carryAfter : 0;
  const currentEpisodeLateFeePaid = snapshot
    ? (snapshot.episodeNumberAfter === episodeNumber ? snapshot.episodeLateFeePaidAfter : 0)
    : legacyLateFeePaidFromPayments(loan, payments);
  const currentEpisodeLateFeeOutstanding = Math.max(round2(currentEpisodeAccrued - currentEpisodeLateFeePaid), 0);
  const lateFeeOutstanding = round2(carryOutstanding + currentEpisodeLateFeeOutstanding);

  return {
    episodeNumber,
    overdueDays,
    penaltyBase,
    carryOutstanding,
    currentEpisodeAccrued,
    currentEpisodeLateFeePaid,
    currentEpisodeLateFeeOutstanding,
    lateFeeOutstanding
  };
}

function mapPaymentRow(paymentRow) {
  const parsed = decodePaymentMeta(paymentRow?.note || "");
  const snapshot = paymentMetaSnapshot(parsed.meta);

  return {
    id: paymentRow.id,
    tenantId: paymentRow.tenant_id,
    loanId: paymentRow.loan_id,
    customerId: paymentRow.customer_id,
    date: paymentRow.date,
    createdAt: paymentRow.created_at || paymentRow.createdAt || null,
    amount: Number(paymentRow.amount || 0),
    method: paymentRow.method,
    note: parsed.note || "",
    baseAmount: snapshot ? snapshot.baseAmount : null,
    principalAmount: snapshot ? snapshot.principalAmount : null,
    interestAmount: snapshot ? snapshot.interestAmount : null,
    lateFeeAmount: snapshot ? snapshot.lateFeeAmount : null,
    lateFeeCarryAfter: snapshot ? snapshot.carryAfter : null,
    lateFeeEpisodeNumberAfter: snapshot ? snapshot.episodeNumberAfter : null,
    lateFeeEpisodeLatePaidAfter: snapshot ? snapshot.episodeLateFeePaidAfter : null,
    paymentModel: snapshot ? snapshot.paymentModel : PAYMENT_MODEL_LEGACY
  };
}

function monthRateForLoan(loan) {
  const rate = Math.max(Number(loan?.interestRate) || 0, 0) / 100;
  return loan?.interestRateMode === "monthly" ? rate : (rate / 12);
}

function loanPrincipalOutstanding(loan) {
  if (!loan) {
    return 0;
  }
  const explicitPrincipalOutstanding = Number(loan.principalOutstanding);
  if (Number.isFinite(explicitPrincipalOutstanding)) {
    return Math.max(round2(explicitPrincipalOutstanding), 0);
  }
  if (isInterestOnlyBalloonLoan(loan)) {
    return Math.max(round2(Number(loan.principal || 0) - Number(loan.paidAmount || 0)), 0);
  }
  return Math.max(round2(Number(loan.principal || 0) - Number(loan.paidAmount || 0)), 0);
}

function addMonthsSafe(date, monthsToAdd) {
  const clone = new Date(date.getTime());
  clone.setMonth(clone.getMonth() + monthsToAdd);
  return clone;
}

function addDaysSafe(date, daysToAdd) {
  const clone = new Date(date.getTime());
  clone.setDate(clone.getDate() + daysToAdd);
  return clone;
}

function interestOnlyPeriodSchedule(loan) {
  const startDate = startOfDay(toDate(loan?.startDate));
  if (Number.isNaN(startDate.getTime())) {
    return [];
  }
  const termMonths = Math.max(Number(loan?.termMonths || 0), 0);
  const schedule = [];
  for (let periodNumber = 1; periodNumber <= termMonths; periodNumber += 1) {
    const periodStart = addMonthsSafe(startDate, periodNumber - 1);
    const dueDate = addMonthsSafe(startDate, periodNumber);
    schedule.push({
      periodNumber,
      periodStart,
      dueDate,
      interestCharged: 0,
      interestPaid: 0,
      interestSettledAt: null,
      interestAllocations: []
    });
  }
  return schedule;
}

function interestOnlySnapshotAtDate(loan, settings, payments, referenceDate = new Date()) {
  if (!isInterestOnlyBalloonLoan(loan)) {
    return null;
  }

  const referenceDay = startOfDay(referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now()));
  if (Number.isNaN(referenceDay.getTime())) {
    return null;
  }

  const principal = Math.max(Number(loan?.principal || 0), 0);
  const monthlyRate = monthRateForLoan(loan);
  const graceDays = Math.max(Number(settings?.graceDays) || 0, 0);
  const dailyRate = Math.max(Number(settings?.latePenaltyRate) || 0, 0) / 100;
  const schedule = interestOnlyPeriodSchedule(loan);
  const startDate = startOfDay(toDate(loan?.startDate));
  const maturityDate = addMonthsSafe(startDate, Math.max(Number(loan?.termMonths || 0), 0));

  const orderedPayments = sortPaymentsChronologically((payments || [])
    .filter((item) => String(item?.loanId || item?.loan_id) === String(loan.id))
    .filter((item) => {
      const paymentDate = startOfDay(toDate(item?.date || ""));
      return !Number.isNaN(paymentDate.getTime()) && paymentDate.getTime() <= referenceDay.getTime();
    }));

  const principalPaidByDate = orderedPayments.map((payment) => {
    const paymentDate = startOfDay(toDate(payment?.date || ""));
    const principalAmount = Number.isFinite(Number(payment?.principalAmount))
      ? Math.max(round2(Number(payment.principalAmount)), 0)
      : Math.max(round2(Number(payment?.baseAmount || 0)), 0);
    return {
      date: paymentDate,
      principalAmount,
      interestAmount: Math.max(round2(Number(payment?.interestAmount || 0)), 0),
      lateFeeAmount: Math.max(round2(Number(payment?.lateFeeAmount || 0)), 0)
    };
  });

  for (const period of schedule) {
    const principalPaidBeforePeriod = principalPaidByDate
      .filter((entry) => entry.date.getTime() < period.periodStart.getTime())
      .reduce((acc, entry) => acc + entry.principalAmount, 0);
    const principalAtPeriodStart = Math.max(round2(principal - principalPaidBeforePeriod), 0);
    period.interestCharged = round2(principalAtPeriodStart * monthlyRate);
    period.interestPaid = 0;
    period.interestSettledAt = period.interestCharged <= 0 ? period.periodStart : null;
    period.interestAllocations = [];
  }

  for (const payment of principalPaidByDate) {
    let pendingInterestFromPayment = payment.interestAmount;
    if (pendingInterestFromPayment <= 0) {
      continue;
    }
    for (const period of schedule) {
      const periodOutstanding = Math.max(round2(period.interestCharged - period.interestPaid), 0);
      if (periodOutstanding <= 0) {
        continue;
      }
      const applied = Math.min(periodOutstanding, pendingInterestFromPayment);
      if (applied <= 0) {
        continue;
      }
      period.interestPaid = round2(period.interestPaid + applied);
      period.interestAllocations.push({
        date: payment.date,
        amount: round2(applied)
      });
      if (!period.interestSettledAt && period.interestPaid >= Math.max(round2(period.interestCharged - 0.00001), 0)) {
        period.interestSettledAt = payment.date;
      }
      pendingInterestFromPayment = round2(pendingInterestFromPayment - applied);
      if (pendingInterestFromPayment <= 0.00001) {
        break;
      }
    }
  }

  const duePeriods = schedule.filter((period) => period.dueDate.getTime() <= referenceDay.getTime());
  const interestOutstanding = round2(duePeriods.reduce((acc, period) => {
    const outstanding = Math.max(round2(period.interestCharged - period.interestPaid), 0);
    return acc + outstanding;
  }, 0));

  const totalLateFeePaid = round2(principalPaidByDate.reduce((acc, payment) => acc + payment.lateFeeAmount, 0));
  const principalPaidToDate = round2(principalPaidByDate.reduce((acc, entry) => acc + entry.principalAmount, 0));
  const principalOutstanding = Math.max(round2(principal - principalPaidToDate), 0);
  const maturityPrincipalDue = maturityDate.getTime() <= referenceDay.getTime() ? principalOutstanding : 0;

  let maxOverdueDays = 0;
  const interestPenaltyEvents = new Map();
  const principalPenaltyEvents = new Map();

  const queuePenaltyEvent = (bucket, date, delta) => {
    const amount = round2(Number(delta || 0));
    if (!Number.isFinite(amount) || Math.abs(amount) <= 0.00001) {
      return;
    }
    const day = startOfDay(date instanceof Date ? date : toDate(date));
    if (Number.isNaN(day.getTime()) || day.getTime() >= referenceDay.getTime()) {
      return;
    }
    const key = day.getTime();
    const current = Number(bucket.get(key) || 0);
    bucket.set(key, round2(current + amount));
  };

  for (const period of duePeriods) {
    const chargedInterest = Math.max(round2(period.interestCharged), 0);
    if (chargedInterest <= 0) {
      continue;
    }

    const outstandingNow = Math.max(round2(chargedInterest - period.interestPaid), 0);
    const rawOverdueNow = Math.floor((referenceDay.getTime() - period.dueDate.getTime()) / 86400000);
    if (outstandingNow > 0 && rawOverdueNow > graceDays) {
      maxOverdueDays = Math.max(maxOverdueDays, Math.max(0, rawOverdueNow - graceDays));
    }

    if (dailyRate <= 0 || rawOverdueNow <= graceDays) {
      continue;
    }

    const allocations = (period.interestAllocations || [])
      .filter((allocation) => allocation.date.getTime() <= referenceDay.getTime())
      .sort((left, right) => left.date.getTime() - right.date.getTime());

    const graceCutoff = addDaysSafe(period.dueDate, graceDays);
    const paidBeforeGraceCutoff = allocations
      .filter((allocation) => allocation.date.getTime() < graceCutoff.getTime())
      .reduce((acc, allocation) => acc + Number(allocation.amount || 0), 0);
    const outstandingAtGraceCutoff = Math.max(round2(chargedInterest - paidBeforeGraceCutoff), 0);
    if (outstandingAtGraceCutoff <= 0) {
      continue;
    }

    const paidBeforeDueDate = allocations
      .filter((allocation) => allocation.date.getTime() < period.dueDate.getTime())
      .reduce((acc, allocation) => acc + Number(allocation.amount || 0), 0);
    const outstandingAtDueDate = Math.max(round2(chargedInterest - paidBeforeDueDate), 0);
    if (outstandingAtDueDate <= 0) {
      continue;
    }

    queuePenaltyEvent(interestPenaltyEvents, period.dueDate, outstandingAtDueDate);
    allocations
      .filter((allocation) => allocation.date.getTime() >= period.dueDate.getTime())
      .forEach((allocation) => queuePenaltyEvent(interestPenaltyEvents, allocation.date, -Number(allocation.amount || 0)));
  }

  if (principalOutstanding > 0 && maturityDate.getTime() <= referenceDay.getTime()) {
    const rawMaturityOverdueDays = Math.floor((referenceDay.getTime() - maturityDate.getTime()) / 86400000);
    if (rawMaturityOverdueDays > graceDays) {
      maxOverdueDays = Math.max(maxOverdueDays, Math.max(0, rawMaturityOverdueDays - graceDays));
    }

    if (dailyRate > 0 && rawMaturityOverdueDays > graceDays) {
      const principalPaidBeforeMaturity = principalPaidByDate
        .filter((entry) => entry.date.getTime() < maturityDate.getTime())
        .reduce((acc, entry) => acc + entry.principalAmount, 0);
      const principalAtMaturityDate = Math.max(round2(principal - principalPaidBeforeMaturity), 0);

      if (principalAtMaturityDate > 0) {
        queuePenaltyEvent(principalPenaltyEvents, maturityDate, principalAtMaturityDate);
        principalPaidByDate
          .filter((entry) => entry.date.getTime() >= maturityDate.getTime() && entry.date.getTime() <= referenceDay.getTime())
          .forEach((entry) => queuePenaltyEvent(principalPenaltyEvents, entry.date, -entry.principalAmount));
      }
    }
  }

  const calculateLateFeeAccrued = (eventsMap) => {
    if (dailyRate <= 0 || eventsMap.size === 0) {
      return 0;
    }
    const eventDates = [...eventsMap.keys()].sort((left, right) => left - right);
    let overdueBalance = 0;
    let accrued = 0;
    for (let index = 0; index < eventDates.length; index += 1) {
      const eventDate = eventDates[index];
      overdueBalance = Math.max(round2(overdueBalance + Number(eventsMap.get(eventDate) || 0)), 0);
      const nextEventDate = index + 1 < eventDates.length ? eventDates[index + 1] : referenceDay.getTime();
      const segmentEnd = Math.min(nextEventDate, referenceDay.getTime());
      const segmentDays = Math.floor((segmentEnd - eventDate) / 86400000);
      if (segmentDays > 0 && overdueBalance > 0) {
        accrued = round2(accrued + (overdueBalance * dailyRate * segmentDays));
      }
    }
    return accrued;
  };

  const interestLateFeeAccrued = calculateLateFeeAccrued(interestPenaltyEvents);
  const principalLateFeeAccrued = calculateLateFeeAccrued(principalPenaltyEvents);

  const interestLateFeePaid = Math.min(totalLateFeePaid, interestLateFeeAccrued);
  const principalLateFeePaid = Math.min(Math.max(round2(totalLateFeePaid - interestLateFeePaid), 0), principalLateFeeAccrued);

  const interestLateFeeOutstanding = Math.max(round2(interestLateFeeAccrued - interestLateFeePaid), 0);
  const principalLateFeeOutstanding = Math.max(round2(principalLateFeeAccrued - principalLateFeePaid), 0);
  const lateFeeOutstanding = round2(interestLateFeeOutstanding + principalLateFeeOutstanding);
  const totalDueBeforePrincipal = round2(interestOutstanding + lateFeeOutstanding);
  const nextDuePeriod = schedule.find((period) => Math.max(round2(period.interestCharged - period.interestPaid), 0) > 0);

  return {
    principalOutstanding,
    principalPaidToDate,
    interestOutstanding,
    interestLateFeeOutstanding,
    principalLateFeeOutstanding,
    lateFeeOutstanding,
    maturityPrincipalDue,
    totalDueBeforePrincipal,
    totalOutstanding: round2(principalOutstanding + interestOutstanding + lateFeeOutstanding),
    overdueDays: maxOverdueDays,
    nextDueDate: nextDuePeriod ? nextDuePeriod.dueDate : null,
    maturityDate,
    schedule
  };
}

function paymentInstallmentProgress(loan, payments, targetPaymentId) {
  if (!loan) {
    return { installmentNumber: 1, label: "1/1" };
  }

  if (isInterestOnlyBalloonLoan(loan)) {
    const termMonths = Math.max(Number(loan.termMonths || 0), 1);
    const payment = (payments || []).find((item) => String(item.id) === String(targetPaymentId));
    const reference = startOfDay(toDate(payment?.date || loan.startDate || new Date()));
    const start = startOfDay(toDate(loan.startDate));
    let periodNumber = 1;
    if (!Number.isNaN(reference.getTime()) && !Number.isNaN(start.getTime())) {
      periodNumber = Math.max(1, Math.min(termMonths, ((reference.getFullYear() - start.getFullYear()) * 12) + (reference.getMonth() - start.getMonth()) + 1));
    }
    return { installmentNumber: periodNumber, label: `${periodNumber}/${termMonths}` };
  }

  const installment = loanInstallment(loan);
  const termMonths = Math.max(Number(loan.termMonths || 0), 1);
  if (!Number.isFinite(installment) || installment <= 0) {
    return { installmentNumber: 1, label: `1/${termMonths}` };
  }

  const orderedPayments = sortPaymentsChronologically((payments || []).filter((item) => String(item.loanId) === String(loan.id)));
  let basePaidBefore = 0;
  let targetPayment = null;

  for (const payment of orderedPayments) {
    if (String(payment.id) === String(targetPaymentId)) {
      targetPayment = payment;
      break;
    }
    basePaidBefore += Math.max(Number(payment.baseAmount || 0), 0);
  }

  if (!targetPayment) {
    const fallbackNumber = loanInstallmentNumber(loan);
    return { installmentNumber: fallbackNumber, label: `${fallbackNumber}/${termMonths}` };
  }

  const installmentNumber = Math.max(1, Math.min(termMonths, Math.floor((basePaidBefore + 0.00001) / installment) + 1));
  return {
    installmentNumber,
    label: `${installmentNumber}/${termMonths}`
  };
}

function toDate(value) {
  const raw = String(value || "");
  return raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function loanTotalPayable(loan) {
  if (isInterestOnlyBalloonLoan(loan)) {
    return round2(Number(loan?.principal || 0));
  }
  if (loan.interestRateMode === 'monthly') {
    return round2(loan.principal * (1 + (loan.interestRate / 100) * loan.termMonths));
  }
  return round2(loan.principal * (1 + (loan.interestRate / 100) * (loan.termMonths / 12)));
}

function loanInstallment(loan) {
  if (isInterestOnlyBalloonLoan(loan)) {
    return round2(loanPrincipalOutstanding(loan) * monthRateForLoan(loan));
  }
  return round2(loanTotalPayable(loan) / loan.termMonths);
}

function loanOutstanding(loan) {
  if (isInterestOnlyBalloonLoan(loan)) {
    return loanPrincipalOutstanding(loan);
  }
  return Math.max(round2(loanTotalPayable(loan) - loan.paidAmount), 0);
}

function loanCapitalCommitted(loan) {
  if (isInterestOnlyBalloonLoan(loan)) {
    return loanPrincipalOutstanding(loan);
  }
  return Math.max(round2(Number(loan.principal || 0) - Number(loan.paidAmount || 0)), 0);
}

function capitalCommittedFromLoans(loans) {
  return round2((loans || []).reduce((acc, loan) => acc + loanCapitalCommitted(loan), 0));
}

function loanNextDueDate(loan) {
  if (isInterestOnlyBalloonLoan(loan)) {
    if (loan && loan.nextDueDate) {
      return toDate(loan.nextDueDate);
    }
    const maturityDate = addMonthsSafe(toDate(loan?.startDate), Math.max(Number(loan?.termMonths || 0), 0));
    const today = startOfDay(new Date());
    if (!loan || loanOutstanding(loan) <= 0.5 || Number.isNaN(maturityDate.getTime()) || maturityDate.getTime() < today.getTime()) {
      return null;
    }
    return maturityDate;
  }
  if (!loan || loanOutstanding(loan) <= 0.5) {
    return null;
  }

  const paidInstallments = Math.min(loan.termMonths, Math.floor(loan.paidAmount / loanInstallment(loan)));
  const date = toDate(loan.startDate);
  date.setMonth(date.getMonth() + paidInstallments + 1);
  return date;
}

function daysOverdue(loan, graceDays) {
  return daysOverdueAtDate(loan, graceDays, new Date());
}

function daysOverdueAtDate(loan, graceDays, referenceDate) {
  if (isInterestOnlyBalloonLoan(loan)) {
    return Math.max(Number(loan?.overdueDays || 0), 0);
  }
  const dueDate = loanNextDueDate(loan);
  if (!dueDate) {
    return 0;
  }

  const day = startOfDay(referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now()));
  const diff = Math.floor((day - dueDate) / 86400000);
  const grace = Math.max(Number(graceDays) || 0, 0);
  if (diff <= grace) {
    return 0;
  }
  return Math.max(0, diff);
}

function loanLateFeeAccrued(loan, settings, referenceDate = new Date()) {
  if (isInterestOnlyBalloonLoan(loan)) {
    const snapshot = interestOnlySnapshotAtDate(loan, settings, [], referenceDate);
    return Math.max(round2(snapshot?.lateFeeOutstanding || 0), 0);
  }
  const dailyRate = Math.max(Number(settings?.latePenaltyRate) || 0, 0) / 100;
  if (!loan || dailyRate <= 0) {
    return 0;
  }

  const overdueDays = daysOverdueAtDate(loan, Number(settings?.graceDays) || 0, referenceDate);
  if (overdueDays <= 0) {
    return 0;
  }

  const installment = loanInstallment(loan);
  const outstanding = loanOutstanding(loan);
  const penaltyBase = Math.max(round2(Math.min(installment, outstanding)), 0);
  if (penaltyBase <= 0) {
    return 0;
  }

  return round2(penaltyBase * dailyRate * overdueDays);
}

function refreshLoanStatuses(state) {
  const graceDays = Number(state.settings.graceDays) || 0;
  state.loans.forEach((loan) => {
    if (isInterestOnlyBalloonLoan(loan)) {
      const snapshot = interestOnlySnapshotAtDate(loan, state.settings, state.payments || [], new Date());
      const principalOutstanding = Math.max(round2(snapshot?.principalOutstanding ?? loanPrincipalOutstanding(loan)), 0);
      const interestOutstanding = Math.max(round2(snapshot?.interestOutstanding || 0), 0);
      const interestLateFeeOutstanding = Math.max(round2(snapshot?.interestLateFeeOutstanding || 0), 0);
      const principalLateFeeOutstanding = Math.max(round2(snapshot?.principalLateFeeOutstanding || 0), 0);
      const lateFeeOutstanding = Math.max(round2(snapshot?.lateFeeOutstanding || 0), 0);
      const maturityPrincipalDue = Math.max(round2(snapshot?.maturityPrincipalDue || 0), 0);
      const totalOutstanding = Math.max(round2(snapshot?.totalOutstanding ?? (principalOutstanding + interestOutstanding + lateFeeOutstanding)), 0);
      const overdueDays = Math.max(Number(snapshot?.overdueDays || 0), 0);

      loan.principalOutstanding = principalOutstanding;
      loan.interestOutstanding = interestOutstanding;
      loan.interestLateFeeOutstanding = interestLateFeeOutstanding;
      loan.principalLateFeeOutstanding = principalLateFeeOutstanding;
      loan.lateFeeOutstanding = lateFeeOutstanding;
      loan.maturityPrincipalDue = maturityPrincipalDue;
      loan.totalOutstanding = totalOutstanding;
      loan.overdueDays = overdueDays;
      loan.nextDueDate = snapshot?.nextDueDate ? snapshot.nextDueDate.toISOString().slice(0, 10) : null;

      if (totalOutstanding <= 0.5) {
        loan.status = "paid";
      } else if (maturityPrincipalDue > 0.01 || overdueDays > 0) {
        loan.status = "overdue";
      } else {
        loan.status = "active";
      }
      return;
    }

    const outstanding = loanOutstanding(loan);
    if (outstanding <= 0.5) {
      loan.status = "paid";
      return;
    }

    loan.status = daysOverdue(loan, graceDays) > 0 ? "overdue" : "active";
  });
}

function normalizeState(state) {
  const normalized = {
    users: Array.isArray(state.users) ? state.users : [],
    settings: state.settings && typeof state.settings === "object" ? state.settings : {},
    riskModel: state.riskModel && typeof state.riskModel === "object" ? state.riskModel : {},
    subscription: state.subscription && typeof state.subscription === "object" ? state.subscription : {},
    customers: Array.isArray(state.customers) ? state.customers : [],
    loans: Array.isArray(state.loans) ? state.loans : [],
    payments: Array.isArray(state.payments) ? state.payments : [],
    paymentPromises: Array.isArray(state.paymentPromises) ? state.paymentPromises : [],
    collectionNotes: Array.isArray(state.collectionNotes) ? state.collectionNotes : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : []
  };

  const defaults = defaultSettings();
  Object.keys(defaults).forEach((key) => {
    if (typeof normalized.settings[key] !== "number") {
      normalized.settings[key] = defaults[key];
    }
  });

  const defaultRisk = defaultRiskModel();
  Object.keys(defaultRisk).forEach((key) => {
    if (typeof normalized.riskModel[key] !== "number") {
      normalized.riskModel[key] = defaultRisk[key];
    }
  });

  normalized.subscription = {
    ...defaultSubscriptionSummary(),
    ...(normalized.subscription || {}),
    features: {
      ...defaultSubscriptionSummary().features,
      ...((normalized.subscription && normalized.subscription.features) || {})
    },
    limits: {
      ...defaultSubscriptionSummary().limits,
      ...((normalized.subscription && normalized.subscription.limits) || {})
    },
    usage: {
      ...defaultSubscriptionSummary().usage,
      ...((normalized.subscription && normalized.subscription.usage) || {})
    }
  };
  normalized.subscription.isReadOnly = READ_ONLY_SUBSCRIPTION_STATUSES.has(String(normalized.subscription.status || ""));

  return normalized;
}

function parseBooleanInput(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (!raw) {
    return fallback;
  }

  if (["true", "1", "si", "yes", "on"].includes(raw)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(raw)) {
    return false;
  }

  return fallback;
}

function parseJsonObject(value, fallback) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // ignore invalid JSON and fallback
    }
  }

  return fallback;
}

function normalizeSubscriptionStatus(value, fallback) {
  const raw = String(value || fallback || "active").trim().toLowerCase();
  if (["suspended", "cancelled", "inactive", "blocked"].includes(raw)) {
    return "suspended";
  }
  return "active";
}

function normalizeInvoiceStatus(value, fallback) {
  const raw = String(value || fallback || "pending").trim().toLowerCase();
  return BILLING_INVOICE_STATUSES.has(raw) ? raw : String(fallback || "pending");
}

function normalizePaymentRecordStatus(value, fallback) {
  const raw = String(value || fallback || "reported").trim().toLowerCase();
  return BILLING_PAYMENT_STATUSES.has(raw) ? raw : String(fallback || "reported");
}

function isBillingSchemaMissingError(error) {
  return ["42P01", "42703"].includes(String(error && error.code ? error.code : ""));
}

function billingUnavailableError() {
  const error = new Error("Facturacion no habilitada. Ejecuta supabase_schema.sql.");
  error.status = 503;
  return error;
}

function normalizeCurrency(value, fallback) {
  const raw = String(value || fallback || DEFAULT_SUBSCRIPTION_CURRENCY).trim().toUpperCase();
  return raw || DEFAULT_SUBSCRIPTION_CURRENCY;
}

function getDatePartsForTimezone(timeZone, date) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch (error) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  const parts = formatter.formatToParts(date || new Date());
  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  const weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const year = Number(map.year || "0");
  const month = Number(map.month || "1");
  const day = Number(map.day || "1");
  const hour = Number(map.hour || "0");
  const minute = Number(map.minute || "0");
  const weekday = weekMap[map.weekday] ?? 0;
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    dateKey,
    slotKey: `${dateKey} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  };
}

function sanitizeTimezoneInput(value, fallback) {
  const raw = String(value || fallback || "America/Santo_Domingo").trim() || "America/Santo_Domingo";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
    return raw;
  } catch (error) {
    return String(fallback || "America/Santo_Domingo");
  }
}

function sanitizeUserCalendarIntegrationInput(input, defaults) {
  const source = input && typeof input === "object" ? input : {};
  const base = defaults || defaultUserCalendarIntegration();
  return {
    enabled: parseBooleanInput(source.enabled, base.enabled),
    timezone: sanitizeTimezoneInput(source.timezone, base.timezone),
    feedToken: String(source.feedToken || base.feedToken || "").trim()
  };
}

function sanitizePushSubscriptionInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const endpoint = String(source.endpoint || "").trim();
  const expirationTime = source.expirationTime == null ? null : Number(source.expirationTime);
  const keys = source.keys && typeof source.keys === "object" ? source.keys : {};
  const p256dh = String(keys.p256dh || "").trim();
  const auth = String(keys.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: Number.isFinite(expirationTime) ? expirationTime : null,
    keys: {
      p256dh,
      auth
    }
  };
}

function pushSubscriptionDeviceHash(subscription) {
  const normalized = sanitizePushSubscriptionInput(subscription);
  if (!normalized) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(`${normalized.endpoint}|${normalized.keys.p256dh}|${normalized.keys.auth}`)
    .digest("hex")
    .slice(0, 32);
}

function sanitizeDeviceLabel(value) {
  return String(value || "").trim().slice(0, 120);
}

function sanitizePushTimezone(value, fallback) {
  return sanitizeTimezoneInput(value, fallback || "America/Santo_Domingo");
}

function isSchemaMissingError(error) {
  return ["42P01", "42703"].includes(String(error && error.code ? error.code : ""));
}

function isPushDeliveryTableMissingError(error) {
  return isSchemaMissingError(error) || String(error && error.code ? error.code : "") === "42P10";
}

function isPushSubscriptionCompatible(req) {
  const ua = String((req && req.get ? req.get("user-agent") : "") || "").toLowerCase();
  if (!ua) {
    return true;
  }
  return ua.includes("iphone") || ua.includes("ipad") || ua.includes("safari") || ua.includes("chrome") || ua.includes("android");
}

function buildCalendarFeedToken() {
  return crypto.randomBytes(24).toString("hex");
}

function requestBaseUrl(req) {
  if (!req || !req.get) {
    return "";
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(req.get("host") || "").trim();
  const protocol = forwardedProto || req.protocol || "http";

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function publicAppBaseUrl(req) {
  if (APP_PUBLIC_URL) {
    return APP_PUBLIC_URL;
  }

  const requestUrl = requestBaseUrl(req);

  if (requestUrl) {
    return requestUrl;
  }

  if (CORS_ORIGIN) {
    return CORS_ORIGIN.split(",")[0].trim().replace(/\/$/, "");
  }

  return `http://localhost:${PORT}`;
}

function buildCalendarFeedUrls(req, feedToken) {
  if (!feedToken) {
    return { feedUrl: "", webcalUrl: "" };
  }

  const feedUrl = `${publicAppBaseUrl(req)}/calendar/${feedToken}.ics`;
  const webcalUrl = feedUrl.startsWith("https://")
    ? `webcal://${feedUrl.slice("https://".length)}`
    : feedUrl.startsWith("http://")
      ? `webcal://${feedUrl.slice("http://".length)}`
      : feedUrl;

  return { feedUrl, webcalUrl };
}

function formatDateKeyForIcs(dateKey) {
  return String(dateKey || "").replace(/-/g, "");
}

function addDaysToDateKey(dateKey, days) {
  const source = toDate(`${dateKey}T00:00:00`);
  source.setDate(source.getDate() + Number(days || 0));
  return `${source.getFullYear()}-${String(source.getMonth() + 1).padStart(2, "0")}-${String(source.getDate()).padStart(2, "0")}`;
}

function formatIcsTimestamp(date) {
  const source = date instanceof Date ? date : new Date();
  const year = source.getUTCFullYear();
  const month = String(source.getUTCMonth() + 1).padStart(2, "0");
  const day = String(source.getUTCDate()).padStart(2, "0");
  const hour = String(source.getUTCHours()).padStart(2, "0");
  const minute = String(source.getUTCMinutes()).padStart(2, "0");
  const second = String(source.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function escapeIcsText(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildCalendarIcsContent(tenantName, events, fallbackDateKey, lookaheadDays) {
  const now = new Date();
  const nowStamp = formatIcsTimestamp(now);
  const defaultDateKey = String(fallbackDateKey || isoToday());
  const rangeDays = Math.max(Math.trunc(Number(lookaheadDays || ICS_LOOKAHEAD_DAYS)), 1);
  const safeEvents = Array.isArray(events) && events.length > 0
    ? events
    : [
      {
        uid: `no-due-${defaultDateKey}@credisync.local`,
        dateKey: defaultDateKey,
        summary: "Sin cobros programados",
        description: `No hay cuotas con vencimiento en los proximos ${rangeDays} dias.`,
        sequence: 0,
        lastModified: nowStamp
      }
    ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrediSync//Cobros Diario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`Cobros - ${tenantName || "CrediSync"}`)}`,
    `X-WR-CALDESC:${escapeIcsText(`Cuotas con vencimiento en los proximos ${rangeDays} dias`)}`,
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M"
  ];

  safeEvents.forEach((event) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.uid)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`LAST-MODIFIED:${escapeIcsText(event.lastModified || nowStamp)}`);
    lines.push(`SEQUENCE:${Math.max(0, Math.trunc(Number(event.sequence || 0)))}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDateKeyForIcs(event.dateKey)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateKeyForIcs(addDaysToDateKey(event.dateKey, 1))}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function normalizePlanFeatures(input) {
  const source = parseJsonObject(input, {});
  const defaults = defaultPlanFeatures();
  return {
    calendarIcsEnabled: parseBooleanInput(source.calendarIcsEnabled, defaults.calendarIcsEnabled),
    advancedReportsEnabled: parseBooleanInput(source.advancedReportsEnabled, defaults.advancedReportsEnabled),
    exportsEnabled: parseBooleanInput(source.exportsEnabled, defaults.exportsEnabled),
    brandingEnabled: parseBooleanInput(source.brandingEnabled, defaults.brandingEnabled),
    prioritySupport: parseBooleanInput(source.prioritySupport, defaults.prioritySupport)
  };
}

function normalizePlanLimits(input) {
  const source = parseJsonObject(input, {});
  const defaults = defaultPlanLimits();
  return {
    maxUsers: Math.max(Math.trunc(parseNumericInput(source.maxUsers, defaults.maxUsers)), 1),
    maxCustomers: Math.max(Math.trunc(parseNumericInput(source.maxCustomers, defaults.maxCustomers)), 1),
    maxActiveLoans: Math.max(Math.trunc(parseNumericInput(source.maxActiveLoans, defaults.maxActiveLoans)), 1)
  };
}

function mapPlanRow(row, fallback) {
  const base = fallback || defaultSubscriptionPlans()[0];
  return {
    id: String(row?.id || base.id),
    code: String(row?.code || base.code),
    name: String(row?.name || base.name),
    description: String(row?.description || base.description || ""),
    priceMonthly: Number(row?.price_monthly ?? base.priceMonthly),
    currency: normalizeCurrency(row?.currency, base.currency),
    billingCycle: String(row?.billing_cycle || base.billingCycle || DEFAULT_SUBSCRIPTION_CYCLE),
    isActive: parseBooleanInput(row?.is_active, base.isActive),
    features: normalizePlanFeatures(row?.features || base.features),
    limits: normalizePlanLimits(row?.limits || base.limits),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

function mapInvoiceRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subscriptionId: row.subscription_id || "",
    planId: row.plan_id || "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: Number(row.amount || 0),
    currency: normalizeCurrency(row.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    status: normalizeInvoiceStatus(row.status, "pending"),
    dueDate: row.due_date,
    issuedAt: row.issued_at || row.created_at || null,
    paidAt: row.paid_at || null,
    reference: row.reference || "",
    notes: row.notes || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapBillingPaymentRow(row) {
  const meta = parseBillingPaymentStoredNotes(row.notes);
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    tenantId: row.tenant_id,
    amount: Number(row.amount || 0),
    currency: normalizeCurrency(row.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    method: row.method || "",
    reference: row.reference || "",
    status: normalizePaymentRecordStatus(row.status, "reported"),
    source: row.source || "tenant",
    receivedAt: row.received_at || null,
    recordedBy: row.recorded_by || null,
    notes: meta.publicNote || "",
    proofImageName: meta.proofImageName || "",
    proofImageType: meta.proofImageType || "",
    hasProofImage: Boolean(meta.hasProofImage),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapSubscriptionRow(row, plan, usage) {
  const defaults = defaultSubscriptionSummary();
  const activePlan = plan || defaultSubscriptionPlans()[0];
  const status = normalizeSubscriptionStatus(row?.status, defaults.status);
  return {
    id: String(row?.id || defaults.id),
    tenantId: String(row?.tenant_id || defaults.tenantId),
    planId: String(activePlan.id || defaults.planId),
    planCode: String(activePlan.code || defaults.planCode),
    planName: String(activePlan.name || defaults.planName),
    description: String(activePlan.description || defaults.description),
    status,
    billingCycle: String(row?.billing_cycle || activePlan.billingCycle || defaults.billingCycle),
    priceMonthly: Number(activePlan.priceMonthly || defaults.priceMonthly),
    currency: normalizeCurrency(row?.currency || activePlan.currency, defaults.currency),
    currentPeriodStart: String(row?.current_period_start || defaults.currentPeriodStart),
    currentPeriodEnd: String(row?.current_period_end || defaults.currentPeriodEnd),
    nextBillingDate: String(row?.next_billing_date || defaults.nextBillingDate),
    trialEndsAt: String(row?.trial_ends_at || defaults.trialEndsAt),
    suspendedAt: row?.suspended_at || null,
    cancelledAt: row?.cancelled_at || null,
    notes: String(row?.notes || ""),
    features: normalizePlanFeatures(activePlan.features),
    limits: normalizePlanLimits(activePlan.limits),
    usage: usage || defaults.usage,
    isReadOnly: READ_ONLY_SUBSCRIPTION_STATUSES.has(status)
  };
}

function buildBillingWindow(startDate) {
  const safeStart = String(startDate || isoToday()).trim() || isoToday();
  return {
    start: safeStart,
    end: addDaysToDateKey(safeStart, DEFAULT_BILLING_PERIOD_DAYS)
  };
}

async function createSuperadminNotification(base) {
  const payload = notificationPayload({
    ...base,
    tenantId: null
  });

  const persistNotification = async (notification) => {
    const { error } = await supabase
      .from("notifications")
      .upsert(
        [
          {
            ...notification,
            updated_at: isoNow()
          }
        ],
        { onConflict: "code", ignoreDuplicates: true }
      );

    return error || null;
  };

  let persistError = await persistNotification(payload);
  let persistedPayload = payload;

  if (persistError && String(persistError.code || "") === "23502") {
    const fallbackTenantId = String(
      payload.tenantId
      || payload?.meta?.tenantId
      || payload.entityId
      || await resolveSuperadminPushTenantScope()
      || ""
    ).trim() || null;

    if (fallbackTenantId) {
      const scopedPayload = notificationPayload({
        ...base,
        tenantId: fallbackTenantId
      });
      persistError = await persistNotification(scopedPayload);
      persistedPayload = scopedPayload;
    }
  }

  if (persistError && !["42P01", "42703"].includes(String(persistError.code || ""))) {
    throw persistError;
  }

  const pushPayload = buildPushPayloadFromNotification(persistedPayload);
  if (pushPayload) {
    const superadminUsers = await listSuperadminAppUsers();
    const deliveryDate = String(persistedPayload.eventDate || isoToday()).trim() || isoToday();

    for (const user of superadminUsers) {
      const superadminPushScopeTenantId = await resolvePreferredPushTenantScopeForUser(user);
      await sendPushPayloadToUser(superadminPushScopeTenantId, user.id, pushPayload, {
        deliveryType: PUSH_DELIVERY_TYPE_NOTIFICATION_EVENT,
        eventKey: persistedPayload.code,
        deliveryDate
      });
    }
  }
}

async function listSuperadminNotifications(limit = 120) {
  const max = Math.min(Math.max(parseNumericInput(limit, 120), 1), 200);
  let query = supabase
    .from("notifications")
    .select("id,tenant_id,code,type,severity,title,message,entity_type,entity_id,event_date,status,meta,read_at,created_at,updated_at")
    .order("created_at", { ascending: false });
  query = query.or("tenant_id.is.null,type.eq.tenant_signup_alert").limit(max);
  const { data, error } = await query;

  if (error) {
    if (String(error.code || "") === "42P01") {
      return [];
    }
    throw error;
  }

  return (data || []).map((notification) => ({
    id: notification.id,
    tenantId: notification.tenant_id || null,
    code: notification.code,
    type: notification.type,
    severity: notification.severity || "info",
    title: notification.title,
    message: notification.message,
    entityType: notification.entity_type || "",
    entityId: notification.entity_id || "",
    eventDate: notification.event_date || null,
    status: notification.status || "unread",
    meta: notification.meta || {},
    readAt: notification.read_at || null,
    createdAt: notification.created_at,
    updatedAt: notification.updated_at
  }));
}

function currentSubscriptionUsage(state) {
  return {
    users: Array.isArray(state?.users) ? state.users.length : 0,
    customers: Array.isArray(state?.customers) ? state.customers.length : 0,
    activeLoans: Array.isArray(state?.loans)
      ? state.loans.filter((loan) => String(loan.status || "") !== "paid").length
      : 0
  };
}

function exceedsLimit(limitValue, currentValue) {
  const limit = Math.max(Math.trunc(parseNumericInput(limitValue, 0)), 0);
  if (limit <= 0) {
    return false;
  }
  return Number(currentValue || 0) >= limit;
}

async function recordPlatformAuditLog(payload) {
  const entry = payload && typeof payload === "object" ? payload : {};
  const { error } = await supabase
    .from("platform_audit_logs")
    .insert([
      {
        id: `AUD-${numericId()}`,
        actor_user_id: entry.actorUserId || null,
        actor_role: entry.actorRole || "",
        action: entry.action || "",
        entity_type: entry.entityType || "",
        entity_id: entry.entityId || "",
        tenant_id: entry.tenantId || null,
        before_data: entry.beforeData || {},
        after_data: entry.afterData || {},
        meta: entry.meta || {}
      }
    ]);

  if (error && !["42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }
}

function mapPlatformSettingsRow(row) {
  const defaults = defaultPlatformSettings();
  const tenantDefaults = defaults.tenantDefaults;
  const riskModel = defaults.riskModel;

  return {
    platformName: row && row.platform_name ? String(row.platform_name) : defaults.platformName,
    supportEmail: row && row.support_email ? String(row.support_email) : defaults.supportEmail,
    supportPhone: row && row.support_phone ? String(row.support_phone) : defaults.supportPhone,
    allowAdminRegistration: row ? Boolean(row.allow_admin_registration) : defaults.allowAdminRegistration,
    newTenantStatus: "active",
    tenantDefaults: {
      personalLoanRate: row ? Number(row.default_personal_loan_rate ?? tenantDefaults.personalLoanRate) : tenantDefaults.personalLoanRate,
      businessLoanRate: row ? Number(row.default_business_loan_rate ?? tenantDefaults.businessLoanRate) : tenantDefaults.businessLoanRate,
      mortgageLoanRate: row ? Number(row.default_mortgage_loan_rate ?? tenantDefaults.mortgageLoanRate) : tenantDefaults.mortgageLoanRate,
      autoLoanRate: row ? Number(row.default_auto_loan_rate ?? tenantDefaults.autoLoanRate) : tenantDefaults.autoLoanRate,
      latePenaltyRate: row ? Number(row.default_late_penalty_rate ?? tenantDefaults.latePenaltyRate) : tenantDefaults.latePenaltyRate,
      graceDays: row ? Number(row.default_grace_days ?? tenantDefaults.graceDays) : tenantDefaults.graceDays,
      autoApprovalScore: row ? Number(row.default_auto_approval_score ?? tenantDefaults.autoApprovalScore) : tenantDefaults.autoApprovalScore,
      maxDebtToIncome: row ? Number(row.default_max_debt_to_income ?? tenantDefaults.maxDebtToIncome) : tenantDefaults.maxDebtToIncome,
      capitalBudget: row ? Number(row.default_capital_budget ?? tenantDefaults.capitalBudget) : tenantDefaults.capitalBudget,
      currency: normalizeCurrency(row?.default_currency, tenantDefaults.currency)
    },
    riskModel: {
      initialScore: row ? Number(row.risk_initial_score ?? riskModel.initialScore) : riskModel.initialScore,
      onTimePaymentReward: row ? Number(row.risk_on_time_payment_reward ?? riskModel.onTimePaymentReward) : riskModel.onTimePaymentReward,
      keptPromiseReward: row ? Number(row.risk_kept_promise_reward ?? riskModel.keptPromiseReward) : riskModel.keptPromiseReward,
      paymentActivityReward: row ? Number(row.risk_payment_activity_reward ?? riskModel.paymentActivityReward) : riskModel.paymentActivityReward,
      paymentActivityCap: row ? Number(row.risk_payment_activity_cap ?? riskModel.paymentActivityCap) : riskModel.paymentActivityCap,
      latePaymentPenalty: row ? Number(row.risk_late_payment_penalty ?? riskModel.latePaymentPenalty) : riskModel.latePaymentPenalty,
      brokenPromisePenalty: row ? Number(row.risk_broken_promise_penalty ?? riskModel.brokenPromisePenalty) : riskModel.brokenPromisePenalty,
      pendingPromisePenalty: row ? Number(row.risk_pending_promise_penalty ?? riskModel.pendingPromisePenalty) : riskModel.pendingPromisePenalty,
      overdueDayPenalty: row ? Number(row.risk_overdue_day_penalty ?? riskModel.overdueDayPenalty) : riskModel.overdueDayPenalty,
      overdueDayCap: row ? Number(row.risk_overdue_day_cap ?? riskModel.overdueDayCap) : riskModel.overdueDayCap,
      overdueAccumulatedPenalty: row ? Number(row.risk_overdue_accumulated_penalty ?? riskModel.overdueAccumulatedPenalty) : riskModel.overdueAccumulatedPenalty,
      overdueAccumulatedCap: row ? Number(row.risk_overdue_accumulated_cap ?? riskModel.overdueAccumulatedCap) : riskModel.overdueAccumulatedCap,
      lagInstallmentPenalty: row ? Number(row.risk_lag_installment_penalty ?? riskModel.lagInstallmentPenalty) : riskModel.lagInstallmentPenalty,
      noPaymentHistoryPenalty: row ? Number(row.risk_no_payment_history_penalty ?? riskModel.noPaymentHistoryPenalty) : riskModel.noPaymentHistoryPenalty
    }
  };
}

async function ensurePlatformSettings() {
  const defaults = defaultPlatformSettings();
  const upsertPayload = {
    id: "global",
    platform_name: defaults.platformName,
    support_email: defaults.supportEmail,
    support_phone: defaults.supportPhone,
    allow_admin_registration: defaults.allowAdminRegistration,
    new_tenant_status: defaults.newTenantStatus,
    default_personal_loan_rate: defaults.tenantDefaults.personalLoanRate,
    default_business_loan_rate: defaults.tenantDefaults.businessLoanRate,
    default_mortgage_loan_rate: defaults.tenantDefaults.mortgageLoanRate,
    default_auto_loan_rate: defaults.tenantDefaults.autoLoanRate,
    default_late_penalty_rate: defaults.tenantDefaults.latePenaltyRate,
    default_grace_days: defaults.tenantDefaults.graceDays,
    default_auto_approval_score: defaults.tenantDefaults.autoApprovalScore,
    default_max_debt_to_income: defaults.tenantDefaults.maxDebtToIncome,
    default_capital_budget: defaults.tenantDefaults.capitalBudget,
    risk_initial_score: defaults.riskModel.initialScore,
    risk_on_time_payment_reward: defaults.riskModel.onTimePaymentReward,
    risk_kept_promise_reward: defaults.riskModel.keptPromiseReward,
    risk_payment_activity_reward: defaults.riskModel.paymentActivityReward,
    risk_payment_activity_cap: defaults.riskModel.paymentActivityCap,
    risk_late_payment_penalty: defaults.riskModel.latePaymentPenalty,
    risk_broken_promise_penalty: defaults.riskModel.brokenPromisePenalty,
    risk_pending_promise_penalty: defaults.riskModel.pendingPromisePenalty,
    risk_overdue_day_penalty: defaults.riskModel.overdueDayPenalty,
    risk_overdue_day_cap: defaults.riskModel.overdueDayCap,
    risk_overdue_accumulated_penalty: defaults.riskModel.overdueAccumulatedPenalty,
    risk_overdue_accumulated_cap: defaults.riskModel.overdueAccumulatedCap,
    risk_lag_installment_penalty: defaults.riskModel.lagInstallmentPenalty,
    risk_no_payment_history_penalty: defaults.riskModel.noPaymentHistoryPenalty
  };

  let data = null;
  let error = null;

  ({ data, error } = await supabase
    .from("platform_settings")
    .upsert([upsertPayload], { onConflict: "id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle());

  if (error && String(error.code || "") === "42703") {
    const legacyPayload = { ...upsertPayload };
    Object.keys(legacyPayload)
      .filter((key) => key.startsWith("risk_"))
      .forEach((key) => delete legacyPayload[key]);

    ({ data, error } = await supabase
      .from("platform_settings")
      .upsert([legacyPayload], { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle());
  }

  if (error) {
    // If table doesn't exist, return defaults
    if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === 'PGRST301') {
      return defaults;
    }
    throw error;
  }

  if (data) {
    return mapPlatformSettingsRow(data);
  }

  const { data: existing, error: existingError } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  if (existingError) {
    if (existingError.code === 'PGRST204' || existingError.code === 'PGRST205') {
      return defaults;
    }
    throw existingError;
  }

  return mapPlatformSettingsRow(existing || { id: 'global' });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: normalizeAccountStatus(user.status),
    tenantId: user.tenantId || null,
    tenantName: user.tenantName || null,
    tenantStatus: user.tenantStatus || null,
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,
    subscriptionStatus: user.subscriptionStatus || null,
    subscriptionReadOnly: Boolean(user.subscriptionReadOnly)
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || null,
      status: user.status || DEFAULT_ACCOUNT_STATUS
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function mapAppUserRow(row, tenant) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role),
    status: normalizeAccountStatus(row.status),
    tenantId: row.tenant_id || null,
    tenantName: tenant ? tenant.name : null,
    tenantStatus: tenant ? tenant.status : null,
    createdAt: row.created_at || null,
    lastLoginAt: row.last_login_at || null
  };
}

async function getTenantById(tenantId) {
  if (!tenantId) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,status,created_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getTenantOwnerUser(tenantId) {
  if (!tenantId) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role,status,last_login_at,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const users = data || [];
  return users.find((user) => !isSuperadminRole(user.role || "")) || users[0] || null;
}

async function deleteRowsByTenant(tableName, tenantId) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq("tenant_id", tenantId);

  if (error && !["42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }
}

async function getAppUserRowById(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getAppUserRowByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getAppUserById(userId) {
  const row = await getAppUserRowById(userId);
  if (!row) {
    return null;
  }

  const tenant = row.tenant_id ? await getTenantById(row.tenant_id) : null;
  return mapAppUserRow(row, tenant);
}

async function ensureTenantRecord(tenantId, tenantName, status) {
  const payload = {
    id: tenantId,
    name: tenantName,
    status: normalizeAccountStatus(status)
  };

  const { data, error } = await supabase
    .from("tenants")
    .upsert([payload], { onConflict: "id" })
    .select("id,name,status,created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || payload;
}

async function ensureTenantSettings(tenantId) {
  if (!tenantId) {
    return defaultSettings();
  }

  const platformSettings = await ensurePlatformSettings();
  const defaults = {
    ...defaultSettings(),
    ...((platformSettings && platformSettings.tenantDefaults) || {})
  };
  const baseSelection = "tenant_id,personal_loan_rate,business_loan_rate,mortgage_loan_rate,auto_loan_rate,late_penalty_rate,grace_days,auto_approval_score,max_debt_to_income,capital_budget,currency";
  const { data: existing, error: existingError } = await supabase
    .from("tenant_settings")
    .select(`${baseSelection},deleted_at`)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing) {
    if (existing.deleted_at) {
      const { data: restored, error: restoreError } = await supabase
        .from("tenant_settings")
        .update({ deleted_at: null })
        .eq("tenant_id", tenantId)
        .select(baseSelection)
        .maybeSingle();

      if (restoreError) {
        throw restoreError;
      }

      return restored || existing;
    }

    return existing;
  }

  const { data, error } = await supabase
    .from("tenant_settings")
    .insert(
      [
        {
          tenant_id: tenantId,
          personal_loan_rate: defaults.personalLoanRate,
          business_loan_rate: defaults.businessLoanRate,
          mortgage_loan_rate: defaults.mortgageLoanRate,
          auto_loan_rate: defaults.autoLoanRate,
          late_penalty_rate: defaults.latePenaltyRate,
          grace_days: defaults.graceDays,
          auto_approval_score: defaults.autoApprovalScore,
          max_debt_to_income: defaults.maxDebtToIncome,
          capital_budget: defaults.capitalBudget,
          currency: normalizeCurrency(defaults.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
          deleted_at: null
        }
      ]
    )
    .select(baseSelection)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function ensureDefaultSubscriptionPlans() {
  if (
    subscriptionPlanCache.plans &&
    Array.isArray(subscriptionPlanCache.plans) &&
    subscriptionPlanCache.expiresAt > Date.now()
  ) {
    return subscriptionPlanCache.plans;
  }

  const defaults = defaultSubscriptionPlans();
  const payload = defaults.map((plan) => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price_monthly: plan.priceMonthly,
    currency: plan.currency,
    billing_cycle: plan.billingCycle,
    is_active: plan.isActive,
    features: plan.features,
    limits: plan.limits
  }));

  const { error } = await supabase
    .from("subscription_plans")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    if (["42P01", "42703"].includes(String(error.code || ""))) {
      subscriptionPlanCache = {
        plans: defaults,
        expiresAt: Date.now() + SUBSCRIPTION_PLAN_CACHE_TTL_MS
      };
      return defaults;
    }
    throw error;
  }

  const { data, error: listError } = await supabase
    .from("subscription_plans")
    .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
    .order("price_monthly", { ascending: true });

  if (listError) {
    if (["42P01", "42703"].includes(String(listError.code || ""))) {
      subscriptionPlanCache = {
        plans: defaults,
        expiresAt: Date.now() + SUBSCRIPTION_PLAN_CACHE_TTL_MS
      };
      return defaults;
    }
    throw listError;
  }

  if (!Array.isArray(data) || data.length === 0) {
    subscriptionPlanCache = {
      plans: defaults,
      expiresAt: Date.now() + SUBSCRIPTION_PLAN_CACHE_TTL_MS
    };
    return defaults;
  }

  const defaultPlan = defaults[0];
  const matchingRow =
    data.find((row) => String(row?.id || "") === defaultPlan.id)
    || data.find((row) => String(row?.code || "").toLowerCase() === defaultPlan.code)
    || null;

  const plans = [matchingRow ? mapPlanRow(matchingRow, defaultPlan) : defaultPlan];

  subscriptionPlanCache = {
    plans,
    expiresAt: Date.now() + SUBSCRIPTION_PLAN_CACHE_TTL_MS
  };

  return plans;
}

async function loadSubscriptionPlanById(planId) {
  const id = String(planId || "").trim();
  if (!id) {
    return null;
  }

  if (subscriptionPlanCache.plans && Array.isArray(subscriptionPlanCache.plans)) {
    const cachedPlan = subscriptionPlanCache.plans.find((plan) => plan.id === id) || null;
    if (cachedPlan) {
      return cachedPlan;
    }
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (["42P01", "42703", "PGRST116"].includes(String(error.code || ""))) {
      return null;
    }
    throw error;
  }

  return data ? mapPlanRow(data) : null;
}

async function loadSubscriptionPlanByCode(planCode) {
  const code = String(planCode || "").trim().toLowerCase();
  if (!code) {
    return null;
  }

  if (subscriptionPlanCache.plans && Array.isArray(subscriptionPlanCache.plans)) {
    const cachedPlan = subscriptionPlanCache.plans.find((plan) => String(plan.code || "").toLowerCase() === code) || null;
    if (cachedPlan) {
      return cachedPlan;
    }
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    if (["42P01", "42703", "PGRST116"].includes(String(error.code || ""))) {
      return null;
    }
    throw error;
  }

  return data ? mapPlanRow(data) : null;
}

async function findBillingInvoiceForCycle(tenantId, periodStart, periodEnd, dueDate) {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("due_date", dueDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isBillingSchemaMissingError(error)) {
      return null;
    }
    throw error;
  }

  return data ? mapInvoiceRow(data) : null;
}

async function ensureBillingInvoiceForSubscriptionCycle(tenantId, subscription, plan) {
  if (!tenantId || !subscription || Number(plan?.priceMonthly || 0) <= 0) {
    return null;
  }

  const periodStart = String(subscription.currentPeriodStart || isoToday()).trim() || isoToday();
  const periodEnd = String(subscription.currentPeriodEnd || buildBillingWindow(periodStart).end).trim()
    || buildBillingWindow(periodStart).end;
  const dueDate = String(subscription.nextBillingDate || periodEnd).trim() || periodEnd;

  const existing = await findBillingInvoiceForCycle(tenantId, periodStart, periodEnd, dueDate);
  if (existing) {
    return existing;
  }

  const invoicePayload = {
    id: `INV-${numericId()}`,
    tenant_id: tenantId,
    subscription_id: subscription.id || null,
    plan_id: subscription.planId || plan?.id || null,
    period_start: periodStart,
    period_end: periodEnd,
    amount: round2(Number(plan?.priceMonthly || 0)),
    currency: normalizeCurrency(subscription.currency || plan?.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    status: dueDate && dueDate <= isoToday() ? "overdue" : "pending",
    due_date: dueDate,
    issued_at: isoNow(),
    reference: "",
    notes: "Factura generada automaticamente por vencimiento del ciclo mensual."
  };

  const { data, error } = await supabase
    .from("billing_invoices")
    .insert([invoicePayload])
    .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
    .maybeSingle();

  if (error) {
    if (isBillingSchemaMissingError(error)) {
      return null;
    }
    throw error;
  }

  return data ? mapInvoiceRow(data) : null;
}

async function syncTenantSubscriptionLifecycle(tenantId, row, plan) {
  if (!tenantId || !row) {
    return row;
  }

  const now = isoNow();
  const today = isoToday();
  const billingWindow = buildBillingWindow(row.current_period_start || isoToday());
  const nextStatus = normalizeSubscriptionStatus(row.status, "active");
  const nextPeriodStart = String(row.current_period_start || billingWindow.start).trim() || billingWindow.start;
  const nextPeriodEnd = String(row.current_period_end || billingWindow.end).trim() || billingWindow.end;
  const nextBillingDate = String(row.next_billing_date || nextPeriodEnd).trim() || nextPeriodEnd;
  const nextCurrency = normalizeCurrency(row.currency || plan?.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
  const nextUpdate = {};

  if (String(row.status || "").trim().toLowerCase() !== nextStatus) {
    nextUpdate.status = nextStatus;
  }
  if (String(row.current_period_start || "") !== nextPeriodStart) {
    nextUpdate.current_period_start = nextPeriodStart;
  }
  if (String(row.current_period_end || "") !== nextPeriodEnd) {
    nextUpdate.current_period_end = nextPeriodEnd;
  }
  if (String(row.next_billing_date || "") !== nextBillingDate) {
    nextUpdate.next_billing_date = nextBillingDate;
  }
  if (String(row.currency || "") !== nextCurrency) {
    nextUpdate.currency = nextCurrency;
  }
  if (row.trial_ends_at) {
    nextUpdate.trial_ends_at = null;
  }
  if (row.cancelled_at) {
    nextUpdate.cancelled_at = null;
  }
  if (nextStatus === "active" && row.suspended_at) {
    nextUpdate.suspended_at = null;
  }

  let effectiveRow = {
    ...row,
    ...nextUpdate,
    status: nextUpdate.status || nextStatus,
    current_period_start: nextPeriodStart,
    current_period_end: nextPeriodEnd,
    next_billing_date: nextBillingDate,
    currency: nextCurrency
  };

  const dueReached = nextBillingDate && nextBillingDate <= today;
  if (dueReached && Number(plan?.priceMonthly || 0) > 0) {
    const invoice = await ensureBillingInvoiceForSubscriptionCycle(tenantId, mapSubscriptionRow(effectiveRow, plan), plan);
    if (invoice) {
      const settlement = await summarizeInvoiceBalance(invoice.id);
      const settlementResult = await applyInvoiceSettlement(tenantId, settlement, {
        activateOnPaid: settlement?.expectedStatus === "paid",
        suspendWhenUnpaid: settlement?.expectedStatus !== "paid"
      });

      if (settlementResult.subscriptionChanged) {
        const { data: updatedRow, error: refreshError } = await supabase
          .from("tenant_subscriptions")
          .select("id,tenant_id,plan_id,status,billing_cycle,currency,current_period_start,current_period_end,next_billing_date,trial_ends_at,suspended_at,cancelled_at,notes,created_at,updated_at")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (refreshError) {
          if (isBillingSchemaMissingError(refreshError)) {
            return effectiveRow;
          }
          throw refreshError;
        }

        return updatedRow || effectiveRow;
      }
    } else if (effectiveRow.status !== "suspended") {
      nextUpdate.status = "suspended";
      nextUpdate.suspended_at = row.suspended_at || now;
    }
  }

  if (Object.keys(nextUpdate).length === 0) {
    return effectiveRow;
  }

  nextUpdate.updated_at = now;
  const { data: updatedRow, error: updateError } = await supabase
    .from("tenant_subscriptions")
    .update(nextUpdate)
    .eq("tenant_id", tenantId)
    .select("id,tenant_id,plan_id,status,billing_cycle,currency,current_period_start,current_period_end,next_billing_date,trial_ends_at,suspended_at,cancelled_at,notes,created_at,updated_at")
    .maybeSingle();

  if (updateError) {
    if (isBillingSchemaMissingError(updateError)) {
      return {
        ...effectiveRow,
        ...nextUpdate
      };
    }
    throw updateError;
  }

  return updatedRow || {
    ...effectiveRow,
    ...nextUpdate
  };
}

async function ensureTenantSubscription(tenantId) {
  if (!tenantId) {
    return defaultSubscriptionSummary();
  }

  const plans = await ensureDefaultSubscriptionPlans();
  const unifiedPlan = plans.find((plan) => plan.code === UNIFIED_SUBSCRIPTION_PLAN_CODE) || plans[0] || defaultSubscriptionPlans()[0];

  const { data: current, error } = await supabase
    .from("tenant_subscriptions")
    .select(
      "id,tenant_id,plan_id,status,billing_cycle,currency,current_period_start,current_period_end,next_billing_date,trial_ends_at,suspended_at,cancelled_at,notes,created_at,updated_at"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    if (["42P01", "42703"].includes(String(error.code || ""))) {
      const fallback = defaultSubscriptionSummary();
      return {
        ...fallback,
        tenantId,
        status: "active",
        isReadOnly: false,
        features: defaultPlanFeatures(),
        limits: defaultPlanLimits()
      };
    }
    throw error;
  }

  let row = current || null;

  if (!row) {
    const today = isoToday();
    const { data: created, error: createError } = await supabase
      .from("tenant_subscriptions")
      .insert([
        {
          id: `SUB-${numericId()}`,
          tenant_id: tenantId,
          plan_id: unifiedPlan.id,
          status: "active",
          billing_cycle: unifiedPlan.billingCycle,
          currency: unifiedPlan.currency,
          current_period_start: today,
          current_period_end: addDaysToDateKey(today, DEFAULT_BILLING_PERIOD_DAYS),
          next_billing_date: addDaysToDateKey(today, DEFAULT_BILLING_PERIOD_DAYS),
          trial_ends_at: null,
          notes: "Alta inicial automatica en modo activo"
        }
      ])
      .select(
        "id,tenant_id,plan_id,status,billing_cycle,currency,current_period_start,current_period_end,next_billing_date,trial_ends_at,suspended_at,cancelled_at,notes,created_at,updated_at"
      )
      .maybeSingle();

    if (createError) {
      if (["42P01", "42703"].includes(String(createError.code || ""))) {
        const fallback = defaultSubscriptionSummary();
        return {
          ...fallback,
          tenantId,
          status: "active",
          isReadOnly: false
        };
      }
      throw createError;
    }

    row = created || null;
  }

  let plan = plans.find((item) => item.id === row?.plan_id) || null;
  if (!plan && row?.plan_id) {
    plan = await loadSubscriptionPlanById(row.plan_id);
  }
  if (!plan) {
    plan = unifiedPlan;
  }

  if (row && String(row.plan_id || "") !== String(unifiedPlan.id || "")) {
    await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: unifiedPlan.id,
        billing_cycle: unifiedPlan.billingCycle,
        currency: unifiedPlan.currency,
        updated_at: isoNow()
      })
      .eq("tenant_id", tenantId);
    row.plan_id = unifiedPlan.id;
    row.billing_cycle = unifiedPlan.billingCycle;
    row.currency = unifiedPlan.currency;
    plan = unifiedPlan;
  }

  row = await syncTenantSubscriptionLifecycle(tenantId, row, plan);
  return mapSubscriptionRow(row, plan);
}

async function syncAllTenantSubscriptionsToUnifiedPlan() {
  const plans = await ensureDefaultSubscriptionPlans();
  const unifiedPlan = plans[0] || defaultSubscriptionPlans()[0];

  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("tenant_id,plan_id,billing_cycle,currency");

  if (error) {
    if (["42P01", "42703"].includes(String(error.code || ""))) {
      return [unifiedPlan];
    }
    throw error;
  }

  for (const row of data || []) {
    if (!row?.tenant_id) {
      continue;
    }

    const needsUpdate =
      String(row.plan_id || "") !== String(unifiedPlan.id || "")
      || String(row.billing_cycle || "") !== String(unifiedPlan.billingCycle || "")
      || String(row.currency || "") !== String(unifiedPlan.currency || "");

    if (!needsUpdate) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: unifiedPlan.id,
        billing_cycle: unifiedPlan.billingCycle,
        currency: unifiedPlan.currency,
        updated_at: isoNow()
      })
      .eq("tenant_id", row.tenant_id);

    if (updateError && !["42P01", "42703"].includes(String(updateError.code || ""))) {
      throw updateError;
    }
  }

  return [unifiedPlan];
}

async function syncTenantSubscriptionToUnifiedPlan(tenantId) {
  const plans = await ensureDefaultSubscriptionPlans();
  const unifiedPlan = plans[0] || defaultSubscriptionPlans()[0];

  if (!tenantId) {
    return unifiedPlan;
  }

  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({
      plan_id: unifiedPlan.id,
      billing_cycle: unifiedPlan.billingCycle,
      currency: unifiedPlan.currency,
      updated_at: isoNow()
    })
    .eq("tenant_id", tenantId);

  if (error && !["42P01", "42703"].includes(String(error.code || ""))) {
    throw error;
  }

  return unifiedPlan;
}

async function syncAllTenantSubscriptionLifecycles(options) {
  const config = options || {};
  const force = parseBooleanInput(config.force, false);
  const now = Date.now();

  if (tenantSubscriptionMaintenancePromise) {
    return tenantSubscriptionMaintenancePromise;
  }

  if (!force && tenantSubscriptionMaintenanceNextRunAt > now) {
    return false;
  }

  const run = (async () => {
    await syncAllTenantSubscriptionsToUnifiedPlan();

    const { data, error } = await supabase
      .from("tenants")
      .select("id");

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      if (!row?.id) {
        continue;
      }
      await ensureTenantSubscription(row.id);
    }

    tenantSubscriptionMaintenanceNextRunAt = Date.now() + TENANT_SUBSCRIPTION_MAINTENANCE_INTERVAL_MS;
    return true;
  })();

  tenantSubscriptionMaintenancePromise = run;

  try {
    return await run;
  } finally {
    if (tenantSubscriptionMaintenancePromise === run) {
      tenantSubscriptionMaintenancePromise = null;
    }
  }
}

async function listInvoicesForTenant(tenantId, limit) {
  const max = Math.max(Math.trunc(parseNumericInput(limit, 25)), 1);
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(max);

  if (error) {
    if (["42P01", "42703"].includes(String(error.code || ""))) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapInvoiceRow);
}

async function listPaymentsForTenant(tenantId, limit) {
  const max = Math.max(Math.trunc(parseNumericInput(limit, 50)), 1);
  const { data, error } = await supabase
    .from("billing_payments")
    .select("id,invoice_id,tenant_id,amount,currency,method,reference,status,source,received_at,recorded_by,notes,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(max);

  if (error) {
    if (["42P01", "42703"].includes(String(error.code || ""))) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapBillingPaymentRow);
}

async function summarizeInvoiceBalance(invoiceId) {
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("billing_invoices")
    .select("id,tenant_id,subscription_id,amount,currency,status,due_date,period_start,period_end,paid_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    if (isBillingSchemaMissingError(invoiceError)) {
      throw billingUnavailableError();
    }
    throw invoiceError;
  }

  if (!invoiceRow) {
    return null;
  }

  const { data: paymentRows, error: paymentError } = await supabase
    .from("billing_payments")
    .select("amount,status")
    .eq("invoice_id", invoiceId);

  if (paymentError) {
    if (isBillingSchemaMissingError(paymentError)) {
      throw billingUnavailableError();
    }
    throw paymentError;
  }

  const confirmedPaidAmount = round2(
    (paymentRows || []).reduce((acc, row) => {
      if (normalizePaymentRecordStatus(row && row.status, "reported") !== "confirmed") {
        return acc;
      }
      return acc + Number(row && row.amount ? row.amount : 0);
    }, 0)
  );

  const invoiceAmount = round2(Number(invoiceRow.amount || 0));
  const outstandingAmount = round2(Math.max(invoiceAmount - confirmedPaidAmount, 0));
  const normalizedStatus = normalizeInvoiceStatus(invoiceRow.status, "pending");
  const dueDate = String(invoiceRow.due_date || "").trim();
  const today = isoToday();

  let expectedStatus = normalizedStatus;
  if (normalizedStatus !== "void") {
    if (outstandingAmount <= 0.009) {
      expectedStatus = "paid";
    } else if (dueDate && dueDate < today) {
      expectedStatus = "overdue";
    } else {
      expectedStatus = "pending";
    }
  }

  return {
    invoice: invoiceRow,
    amount: invoiceAmount,
    confirmedPaidAmount,
    outstandingAmount,
    expectedStatus,
    isFullyPaid: expectedStatus === "paid"
  };
}

async function applyInvoiceSettlement(tenantId, settlement, options) {
  if (!settlement || !settlement.invoice) {
    return { invoice: null, subscriptionChanged: false };
  }

  const config = options || {};
  const invoiceRow = settlement.invoice;
  const now = isoNow();
  const currentStatus = normalizeInvoiceStatus(invoiceRow.status, "pending");
  const nextStatus = settlement.expectedStatus;

  const invoiceUpdate = {};
  if (currentStatus !== nextStatus) {
    invoiceUpdate.status = nextStatus;
  }

  if (nextStatus === "paid") {
    if (!invoiceRow.paid_at) {
      invoiceUpdate.paid_at = now;
    }
  } else if (invoiceRow.paid_at) {
    invoiceUpdate.paid_at = null;
  }

  let updatedInvoice = invoiceRow;
  if (Object.keys(invoiceUpdate).length > 0) {
    invoiceUpdate.updated_at = now;
    const { data, error } = await supabase
      .from("billing_invoices")
      .update(invoiceUpdate)
      .eq("id", invoiceRow.id)
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .maybeSingle();

    if (error) {
      if (isBillingSchemaMissingError(error)) {
        throw billingUnavailableError();
      }
      throw error;
    }

    updatedInvoice = data || {
      ...invoiceRow,
      ...invoiceUpdate
    };
  }

  let subscriptionChanged = false;
  if (config.activateOnPaid && nextStatus === "paid") {
    const nextPeriodStart = String(invoiceRow.period_end || invoiceRow.due_date || isoToday()).trim() || isoToday();
    const nextPeriodEnd = addDaysToDateKey(nextPeriodStart, DEFAULT_BILLING_PERIOD_DAYS);

    const { error: subscriptionError } = await supabase
      .from("tenant_subscriptions")
      .update({
        status: "active",
        current_period_start: nextPeriodStart,
        current_period_end: nextPeriodEnd,
        next_billing_date: nextPeriodEnd,
        suspended_at: null,
        cancelled_at: null,
        trial_ends_at: null,
        updated_at: now
      })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "suspended", "trial", "past_due", "cancelled"]);

    if (subscriptionError && !isBillingSchemaMissingError(subscriptionError)) {
      throw subscriptionError;
    }

    if (!subscriptionError) {
      subscriptionChanged = true;
    }
  }

  if (config.suspendWhenUnpaid && nextStatus !== "paid") {
    const { error: subscriptionError } = await supabase
      .from("tenant_subscriptions")
      .update({
        status: "suspended",
        suspended_at: now,
        updated_at: now
      })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "suspended", "trial", "past_due", "cancelled"]);

    if (subscriptionError && !isBillingSchemaMissingError(subscriptionError)) {
      throw subscriptionError;
    }

    if (!subscriptionError) {
      subscriptionChanged = true;
    }
  }

  return {
    invoice: updatedInvoice,
    subscriptionChanged
  };
}

async function ensureUserCalendarIntegration(userId, tenantId) {
  if (!userId || !tenantId) {
    return null;
  }

  const defaults = defaultUserCalendarIntegration();
  const existing = await supabase
    .from("user_calendar_integrations")
    .select("user_id,tenant_id,enabled,timezone,feed_token,updated_at")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) {
    if (["42P01", "42703"].includes(String(existing.error.code || ""))) {
      return null;
    }
    throw existing.error;
  }

  let row = existing.data || null;

  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from("user_calendar_integrations")
      .insert([
        {
          user_id: userId,
          tenant_id: tenantId,
          enabled: defaults.enabled,
          timezone: defaults.timezone,
          feed_token: buildCalendarFeedToken()
        }
      ])
      .select("user_id,tenant_id,enabled,timezone,feed_token,updated_at")
      .maybeSingle();

    if (insertError) {
      if (["42P01", "42703"].includes(String(insertError.code || ""))) {
        return null;
      }
      throw insertError;
    }

    row = inserted || null;
  }

  if (!row) {
    return {
      ...defaults,
      feedToken: ""
    };
  }

  const integration = sanitizeUserCalendarIntegrationInput(
    {
      enabled: row.enabled,
      timezone: row.timezone,
      feedToken: row.feed_token || ""
    },
    defaults
  );

  if (!integration.feedToken) {
    const fallbackToken = buildCalendarFeedToken();
    const { error: patchError } = await supabase
      .from("user_calendar_integrations")
      .update({ feed_token: fallbackToken, updated_at: isoNow() })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (patchError && !["42P01", "42703"].includes(String(patchError.code || ""))) {
      throw patchError;
    }

    integration.feedToken = fallbackToken;
  }

  return integration;
}

async function loadUserCalendarIntegrationByToken(feedToken) {
  const token = String(feedToken || "").trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_calendar_integrations")
    .select("user_id,tenant_id,enabled,timezone,feed_token")
    .eq("feed_token", token)
    .maybeSingle();

  if (error) {
    if (["42P01", "42703", "PGRST116"].includes(String(error.code || ""))) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    tenantId: data.tenant_id,
    integration: sanitizeUserCalendarIntegrationInput(
      {
        enabled: data.enabled,
        timezone: data.timezone,
        feedToken: data.feed_token || ""
      },
      defaultUserCalendarIntegration()
    )
  };
}

async function listDueTodayCalendarEvents(tenantId, timezone) {
  const normalizedTimezone = sanitizeTimezoneInput(timezone, "America/Santo_Domingo");
  const lookaheadDays = ICS_LOOKAHEAD_DAYS;
  const [{ data: tenantRow, error: tenantError }, customersResult, loansResult] = await Promise.all([
    supabase.from("tenants").select("id,name").eq("id", tenantId).maybeSingle(),
    supabase.from("customers").select("id,name").eq("tenant_id", tenantId),
    supabase
      .from("loans")
      .select("id,tenant_id,customer_id,type,principal,interest_rate,term_months,start_date,paid_amount,status,created_at")
      .eq("tenant_id", tenantId)
      .then(async (res) => {
        if (res.error) {
          return res;
        }

        const { data: modes, error: modeError } = await supabase
          .from("loans")
          .select("id,interest_rate_mode,payment_model,principal_outstanding")
          .eq("tenant_id", tenantId);

        if (!modeError && Array.isArray(modes)) {
          const modeMap = new Map(modes.map((item) => [item.id, {
            interestRateMode: item.interest_rate_mode || "annual",
            paymentModel: normalizePaymentModel(item.payment_model),
            principalOutstanding: Number.isFinite(Number(item.principal_outstanding))
              ? Number(item.principal_outstanding)
              : null
          }]));
          res.data = (res.data || []).map((loan) => ({
            ...loan,
            interest_rate_mode: modeMap.get(loan.id)?.interestRateMode || "annual",
            payment_model: modeMap.get(loan.id)?.paymentModel || PAYMENT_MODEL_LEGACY,
            principal_outstanding: modeMap.get(loan.id)?.principalOutstanding
          }));
        } else {
          res.data = (res.data || []).map((loan) => ({
            ...loan,
            interest_rate_mode: "annual",
            payment_model: PAYMENT_MODEL_LEGACY,
            principal_outstanding: null
          }));
        }

        return res;
      })
  ]);

  if (tenantError) {
    throw tenantError;
  }
  if (customersResult.error) {
    throw customersResult.error;
  }
  if (loansResult.error) {
    throw loansResult.error;
  }

  const todayKey = getDatePartsForTimezone(normalizedTimezone, new Date()).dateKey;
  const endKey = addDaysToDateKey(todayKey, lookaheadDays);
  const customersById = new Map((customersResult.data || []).map((customer) => [customer.id, customer.name || customer.id]));

  const events = (loansResult.data || [])
    .map((loan) => ({
      id: loan.id,
      customerId: loan.customer_id,
      principal: Number(loan.principal || 0),
      interestRate: Number(loan.interest_rate || 0),
      interestRateMode: loan.interest_rate_mode || "annual",
      paymentModel: normalizePaymentModel(loan.payment_model),
      termMonths: Number(loan.term_months || 0),
      startDate: loan.start_date,
      paidAmount: Number(loan.paid_amount || 0),
      principalOutstanding: Number.isFinite(Number(loan.principal_outstanding)) ? Number(loan.principal_outstanding) : null,
      status: loan.status || "active",
      createdAt: loan.created_at || null
    }))
    .filter((loan) => loan.status !== "paid")
    .map((loan) => {
      const dueDate = loanNextDueDate(loan);
      if (!dueDate) {
        return null;
      }

      const dueDateKey = getDatePartsForTimezone(normalizedTimezone, dueDate).dateKey;
      if (dueDateKey < todayKey || dueDateKey > endKey) {
        return null;
      }

      const customerName = customersById.get(loan.customerId) || "Cliente";
      const amountDue = Math.min(loanInstallment(loan), loanOutstanding(loan));
      const sequence = Math.max(0, Math.trunc(Math.floor((loan.paidAmount || 0) / Math.max(loanInstallment(loan), 0.01))));
      const modifiedStamp = formatIcsTimestamp(loan.createdAt ? new Date(loan.createdAt) : new Date());

      return {
        uid: `${tenantId}-${loan.id}-${dueDateKey}@credisync.local`,
        dateKey: dueDateKey,
        summary: dueDateKey === todayKey ? `Cobro hoy: ${customerName}` : `Proximo cobro: ${customerName}`,
        description: `Prestamo ${loan.id}. Vencimiento ${dueDateKey}. Cuota estimada: ${round2(amountDue)}.`,
        sequence,
        lastModified: modifiedStamp
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return String(a.dateKey || "").localeCompare(String(b.dateKey || ""));
      }
      return String(a.summary || "").localeCompare(String(b.summary || ""));
    });

  return {
    tenantName: tenantRow?.name || "CrediSync",
    dateKey: todayKey,
    events
  };
}

async function listAuthUsers() {
  if (!HAS_SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const chunk = Array.isArray(data && data.users) ? data.users : [];
    users.push(...chunk);

    if (chunk.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function findAuthUserByEmail(email) {
  if (!HAS_SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const users = await listAuthUsers();
  return users.find((user) => String(user.email || "").toLowerCase() === normalizedEmail) || null;
}

async function updateAuthUserMetadata(userId, patch) {
  if (!HAS_SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const authUsers = await listAuthUsers();
  const current = authUsers.find((user) => user.id === userId);
  const currentMetadata = current && current.user_metadata ? current.user_metadata : {};

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMetadata,
      ...patch
    }
  });

  if (error) {
    throw error;
  }
}

async function setAuthUserBanStatus(userId, status) {
  if (!HAS_SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: status === "inactive" ? INACTIVE_BAN_DURATION : "none"
  });

  if (error) {
    throw error;
  }
}

async function resetAuthUserPassword(userId, password) {
  if (!HAS_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("El reseteo de contrasena requiere SUPABASE_SERVICE_ROLE_KEY");
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) {
    throw error;
  }
}

async function upsertAppUserFromAuth(authUser, fallbackRole, options) {
  const config = options || {};
  const email = String(authUser && authUser.email ? authUser.email : "").trim().toLowerCase();
  if (!email) {
    throw new Error("No se pudo resolver el correo del usuario autenticado");
  }

  const metadata = authUser && authUser.user_metadata ? authUser.user_metadata : {};
  const existingById = await getAppUserRowById(authUser.id);
  const existingByEmail = existingById ? null : await getAppUserRowByEmail(email);
  const existing = existingById || existingByEmail;
  const role = normalizeRole(config.role || (existing && existing.role) || fallbackRole);
  const status = normalizeAccountStatus(config.status || (existing && existing.status) || DEFAULT_ACCOUNT_STATUS);
  const name = String(config.name || metadata.name || (existing && existing.name) || nameFromEmail(email)).trim();

  let tenantId = config.tenantId !== undefined ? config.tenantId : existing && existing.tenant_id ? existing.tenant_id : null;
  let tenant = null;
  let tenantWasCreatedNow = false;

  if (isSuperadminRole(role)) {
    tenantId = config.keepTenant ? tenantId : null;
  } else {
    tenantId = tenantId || buildTenantId();
    const tenantBefore = await getTenantById(tenantId);
    tenant = await ensureTenantRecord(tenantId, buildTenantName(name, email), status);
    await ensureTenantSettings(tenantId);
    await ensureTenantSubscription(tenantId);
    tenantWasCreatedNow = !tenantBefore;
  }

  if (existingByEmail && existingByEmail.id !== authUser.id) {
    const { data: migrated, error: migrateError } = await supabase
      .from("users")
      .update({
        id: authUser.id,
        email,
        password: "SUPABASE_AUTH",
        name,
        role,
        status,
        tenant_id: tenantId
      })
      .eq("email", email)
      .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
      .maybeSingle();

    if (migrateError) {
      throw migrateError;
    }

    if (migrated) {
      const migratedTenant = tenantId ? await getTenantById(tenantId) : null;
      return mapAppUserRow(migrated, migratedTenant);
    }
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(
      [
        {
          id: authUser.id,
          email,
          password: "SUPABASE_AUTH",
          name,
          role,
          status,
          tenant_id: tenantId
        }
      ],
      { onConflict: "id" }
    )
    .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const finalTenant = tenantId ? tenant || (await getTenantById(tenantId)) : null;
  const finalUser = mapAppUserRow(data || {
    id: authUser.id,
    email,
    name,
    role,
    status,
    tenant_id: tenantId,
    created_at: null,
    last_login_at: null
  }, finalTenant);

  if (!isSuperadminRole(role) && !existing && tenantWasCreatedNow && finalTenant) {
    try {
      await createSuperadminNotification({
        code: `tenant-signup-${tenantId}`,
        type: "tenant_signup_alert",
        severity: "info",
        title: "Nuevo cliente registrado",
        message: `${finalTenant.name || tenantId} inicio su suscripcion y ya esta activo en CrediSync.`,
        entityType: "tenant",
        entityId: tenantId,
        eventDate: isoToday(),
        meta: {
          tenantId,
          tenantName: finalTenant.name || tenantId,
          ownerEmail: email
        }
      });
    } catch (notificationError) {
      console.warn("[SUPERADMIN NOTIFICATION WARNING]", notificationError?.message || notificationError);
    }

    try {
      await recordPlatformAuditLog({
        actorUserId: finalUser.id,
        actorRole: finalUser.role,
        action: "tenant_registered",
        entityType: "tenant",
        entityId: tenantId,
        tenantId,
        afterData: {
          tenantName: finalTenant.name || tenantId,
          ownerEmail: email,
          subscriptionStatus: "active"
        }
      });
    } catch (auditError) {
      console.warn("[TENANT REGISTER AUDIT WARNING]", auditError?.message || auditError);
    }
  }

  return finalUser;
}

async function updateAppUserLogin(userId) {
  const { error } = await supabase
    .from("users")
    .update({ last_login_at: isoNow() })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

async function tenantQueryOrEmpty(tableName, selectClause, tenantId, options) {
  const config = options || {};
  let query = supabase
    .from(tableName)
    .select(selectClause)
    .eq("tenant_id", tenantId);

  // Filtrar por deleted_at si es null (no eliminado)
  if (config.filter?.is === null && config.filter?.column) {
    query = query.is(config.filter.column, null);
  } else {
    query = query.is("deleted_at", null);
  }

  if (config.orderBy) {
    query = query.order(config.orderBy.column, { ascending: Boolean(config.orderBy.ascending) });
  }

  if (config.excludeType) {
    query = query.neq("type", String(config.excludeType || "").trim());
  }

  if (Number.isFinite(config.limit) && config.limit > 0) {
    query = query.limit(config.limit);
  }

  const result = await query;
  if (result.error && ["42P01", "42703"].includes(String(result.error.code || ""))) {
    return { data: [], error: null };
  }

  return result;
}

async function readStateForTenant(tenantId) {
  await ensureTenantSettings(tenantId);
  const subscription = await ensureTenantSubscription(tenantId);
  await autoBreakOverduePromises(tenantId);
  const platformSettings = await ensurePlatformSettings();

  const [
    usersResult,
    settingsResult,
    customersResult,
    loansResult,
    paymentsResult,
    promisesResult,
    notesResult
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("tenant_settings")
      .select("tenant_id,personal_loan_rate,business_loan_rate,mortgage_loan_rate,auto_loan_rate,late_penalty_rate,grace_days,auto_approval_score,max_debt_to_income,capital_budget,currency")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id,tenant_id,name,email,phone,status,joined_at,created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("loans")
      .select("id,tenant_id,customer_id,type,principal,interest_rate,term_months,start_date,paid_amount,status,created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .then(async (res) => {
        if (res.error) return res;
        // Try to fetch interest_rate_mode separately to fail gracefully if column missing
        const { data: modes, error: modeError } = await supabase
          .from("loans")
          .select("id,interest_rate_mode,payment_model,principal_outstanding")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);

        if (!modeError && modes) {
          const modeMap = Object.fromEntries(modes.map((m) => [m.id, {
            interestRateMode: m.interest_rate_mode || "annual",
            paymentModel: normalizePaymentModel(m.payment_model),
            principalOutstanding: Number.isFinite(Number(m.principal_outstanding)) ? Number(m.principal_outstanding) : null
          }]));
          res.data = res.data.map(loan => ({
            ...loan,
            interest_rate_mode: modeMap[loan.id]?.interestRateMode || 'annual',
            payment_model: modeMap[loan.id]?.paymentModel || PAYMENT_MODEL_LEGACY,
            principal_outstanding: modeMap[loan.id]?.principalOutstanding
          }));
        } else {
          res.data = res.data.map(loan => ({
            ...loan,
            interest_rate_mode: 'annual',
            payment_model: PAYMENT_MODEL_LEGACY,
            principal_outstanding: null
          }));
        }
        return res;
      }),
    supabase
      .from("payments")
      .select("id,tenant_id,loan_id,customer_id,date,amount,method,note,created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    tenantQueryOrEmpty(
      "payment_promises",
      "id,tenant_id,loan_id,customer_id,promised_date,promised_amount,status,note,created_by,resolved_at,created_at,updated_at",
      tenantId,
      { orderBy: { column: "created_at", ascending: false }, filter: { column: "deleted_at", is: null } }
    ),
    tenantQueryOrEmpty(
      "collection_notes",
      "id,tenant_id,customer_id,loan_id,body,created_by,created_at",
      tenantId,
      { orderBy: { column: "created_at", ascending: false }, filter: { column: "deleted_at", is: null } }
    )
  ]);

  if (usersResult.error) throw usersResult.error;
  if (settingsResult.error && settingsResult.error.code !== "PGRST116") throw settingsResult.error;
  if (customersResult.error) throw customersResult.error;
  if (loansResult.error) throw loansResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (promisesResult.error) throw promisesResult.error;
  if (notesResult.error) throw notesResult.error;

  const state = {
    users: (usersResult.data || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      status: normalizeAccountStatus(user.status),
      tenantId: user.tenant_id,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    })),
    settings: settingsResult.data
      ? {
        personalLoanRate: Number(settingsResult.data.personal_loan_rate || 0),
        businessLoanRate: Number(settingsResult.data.business_loan_rate || 0),
        mortgageLoanRate: Number(settingsResult.data.mortgage_loan_rate || 0),
        autoLoanRate: Number(settingsResult.data.auto_loan_rate || 0),
        latePenaltyRate: Number(settingsResult.data.late_penalty_rate || 0),
        graceDays: Number(settingsResult.data.grace_days || 0),
        autoApprovalScore: Number(settingsResult.data.auto_approval_score || 0),
        maxDebtToIncome: Number(settingsResult.data.max_debt_to_income || 0),
        capitalBudget: Number(settingsResult.data.capital_budget || 0),
        currency: normalizeCurrency(settingsResult.data.currency, DEFAULT_SUBSCRIPTION_CURRENCY)
      }
      : defaultSettings(),
    riskModel: platformSettings && platformSettings.riskModel ? platformSettings.riskModel : defaultRiskModel(),
    subscription,
    customers: (customersResult.data || []).map((customer) => ({
      id: customer.id,
      tenantId: customer.tenant_id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      joinedAt: customer.joined_at
    })),
    loans: (loansResult.data || []).map((loan) => ({
      id: loan.id,
      tenantId: loan.tenant_id,
      customerId: loan.customer_id,
      type: loan.type,
      principal: Number(loan.principal || 0),
      interestRate: Number(loan.interest_rate || 0),
      interestRateMode: loan.interest_rate_mode || 'annual',
      paymentModel: normalizePaymentModel(loan.payment_model),
      termMonths: Number(loan.term_months || 0),
      startDate: loan.start_date,
      paidAmount: Number(loan.paid_amount || 0),
      principalOutstanding: Number.isFinite(Number(loan.principal_outstanding)) ? Number(loan.principal_outstanding) : null,
      status: loan.status || "active"
    })),
    payments: (paymentsResult.data || []).map((payment) => mapPaymentRow(payment)),
    paymentPromises: (promisesResult.data || []).map((promise) => ({
      id: promise.id,
      tenantId: promise.tenant_id,
      loanId: promise.loan_id,
      customerId: promise.customer_id,
      promisedDate: promise.promised_date,
      promisedAmount: Number(promise.promised_amount || 0),
      status: promise.status || "pending",
      note: promise.note || "",
      createdBy: promise.created_by || "",
      resolvedAt: promise.resolved_at || null,
      createdAt: promise.created_at,
      updatedAt: promise.updated_at
    })),
    collectionNotes: (notesResult.data || []).map((entry) => ({
      id: entry.id,
      tenantId: entry.tenant_id,
      customerId: entry.customer_id,
      loanId: entry.loan_id || "",
      body: entry.body || "",
      createdBy: entry.created_by || "",
      createdAt: entry.created_at
    }))
  };

  const normalized = normalizeState(state);
  normalized.subscription = {
    ...normalized.subscription,
    ...subscription,
    usage: currentSubscriptionUsage(normalized),
    isReadOnly: READ_ONLY_SUBSCRIPTION_STATUSES.has(String(subscription?.status || "").toLowerCase())
  };

  refreshLoanStatuses(normalized);

  await syncAutomatedNotificationsForTenant(tenantId, normalized);
  const notificationsResult = await tenantQueryOrEmpty(
    "notifications",
    "id,tenant_id,code,type,severity,title,message,entity_type,entity_id,event_date,status,meta,read_at,created_at,updated_at",
    tenantId,
    {
      orderBy: { column: "created_at", ascending: false },
      limit: 120,
      excludeType: "tenant_signup_alert"
    }
  );

  if (notificationsResult.error) {
    throw notificationsResult.error;
  }

  normalized.notifications = (notificationsResult.data || []).map((notification) => ({
    id: notification.id,
    tenantId: notification.tenant_id,
    code: notification.code,
    type: notification.type,
    severity: notification.severity || "info",
    title: notification.title,
    message: notification.message,
    entityType: notification.entity_type || "",
    entityId: notification.entity_id || "",
    eventDate: notification.event_date || null,
    status: notification.status || "unread",
    meta: notification.meta || {},
    readAt: notification.read_at || null,
    createdAt: notification.created_at,
    updatedAt: notification.updated_at
  }));

  return normalized;
}

async function readStateForUser(user) {
  if (!user) {
    return createEmptyState();
  }

  if (isSuperadminRole(user.role)) {
    const base = createEmptyState();
    base.notifications = await listSuperadminNotifications(120);
    return base;
  }

  if (!user.tenantId) {
    return createEmptyState();
  }

  return readStateForTenant(user.tenantId);
}

async function ensureDefaultSuperadmin() {
  if (!ENABLE_SUPERADMIN_BOOTSTRAP || !DEFAULT_SUPERADMIN_EMAIL || !DEFAULT_SUPERADMIN_PASSWORD) {
    return;
  }

  try {
    if (HAS_SUPABASE_SERVICE_ROLE_KEY) {
      let authUser = await findAuthUserByEmail(DEFAULT_SUPERADMIN_EMAIL);

      if (!authUser) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: DEFAULT_SUPERADMIN_EMAIL,
          password: DEFAULT_SUPERADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            name: DEFAULT_SUPERADMIN_NAME,
            role: SUPERADMIN_ROLE
          }
        });

        if (error) {
          throw error;
        }

        authUser = data && data.user ? data.user : null;
      } else {
        const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            name: DEFAULT_SUPERADMIN_NAME,
            role: SUPERADMIN_ROLE
          }
        });

        if (error) {
          throw error;
        }

        authUser = data && data.user ? data.user : authUser;
      }

      if (authUser) {
        await upsertAppUserFromAuth(authUser, SUPERADMIN_ROLE, {
          role: SUPERADMIN_ROLE,
          name: DEFAULT_SUPERADMIN_NAME,
          status: "active"
        });
      }

      return;
    }

    const { data, error } = await supabasePublic.auth.signUp({
      email: DEFAULT_SUPERADMIN_EMAIL,
      password: DEFAULT_SUPERADMIN_PASSWORD,
      options: {
        data: {
          name: DEFAULT_SUPERADMIN_NAME,
          role: SUPERADMIN_ROLE
        }
      }
    });

    if (error && !String(error.message || "").toLowerCase().includes("already")) {
      throw error;
    }

    if (data && data.user) {
      await upsertAppUserFromAuth(data.user, SUPERADMIN_ROLE, {
        role: SUPERADMIN_ROLE,
        name: DEFAULT_SUPERADMIN_NAME,
        status: "active"
      });
    }
  } catch (error) {
    if (!IS_PROD) {
      console.error("[SUPERADMIN BOOTSTRAP ERROR]", error);
    }
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[JWT_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: "Sesion no valida" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getAppUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Sesion no valida" });
    }

    syncAllTenantSubscriptionLifecycles().catch((error) => {
      if (!IS_PROD) {
        console.error("[SUBSCRIPTION MAINTENANCE ERROR]", error);
      }
    });

    if (normalizeAccountStatus(user.status) !== "active") {
      return res.status(403).json({ message: "Tu cuenta esta desactivada. Contacta al superadministrador." });
    }

    if (!isSuperadminRole(user.role) && user.tenantId) {
      const tenant = await getTenantById(user.tenantId);
      if (!tenant || normalizeAccountStatus(tenant.status) !== "active") {
        return res.status(403).json({ message: "Tu espacio de trabajo esta desactivado." });
      }
      const subscription = await ensureTenantSubscription(user.tenantId);
      req.tenant = tenant;
      req.subscription = subscription;
      req.user = sanitizeUser({
        ...user,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        subscriptionStatus: subscription.status,
        subscriptionReadOnly: subscription.isReadOnly
      });
      return next();
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Sesion no valida" });
  }
}

function requireTenantUser(req, res, next) {
  if (!req.user || !req.user.tenantId) {
    return res.status(403).json({ message: "Este modulo solo esta disponible para cuentas con espacio de trabajo asignado" });
  }

  return next();
}

function requireTenantWriteAccess(req, res, next) {
  const status = String(req.subscription?.status || req.user?.subscriptionStatus || "").trim().toLowerCase();
  if (READ_ONLY_SUBSCRIPTION_STATUSES.has(status)) {
    return res.status(403).json({
      message: "Tu suscripcion esta suspendida en modo solo lectura. Regulariza el pago para volver a operar.",
      code: "TENANT_READ_ONLY"
    });
  }
  return next();
}

function requireSuperadmin(req, res, next) {
  if (!req.user || !isSuperadminRole(req.user.role)) {
    return res.status(403).json({ message: "Este modulo requiere permisos de superadministrador" });
  }

  return next();
}

function requirePushDailyJobToken(req, res, next) {
  if (!PUSH_DAILY_SUMMARY_JOB_TOKEN) {
    return res.status(503).json({ message: "Job de push no configurado." });
  }

  const authHeader = String(req.get("authorization") || "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const headerToken = String(req.get("x-job-token") || "").trim();
  const token = bearer || headerToken;

  if (!token || token !== PUSH_DAILY_SUMMARY_JOB_TOKEN) {
    return res.status(401).json({ message: "Token de job invalido." });
  }

  return next();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "credisync-api" });
});

app.get("/api/public/platform", async (req, res, next) => {
  try {
    const settings = await ensurePlatformSettings();
    return res.json({
      platformName: settings.platformName,
      allowAdminRegistration: Boolean(settings.allowAdminRegistration)
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/register-admin", async (req, res, next) => {
  try {
    const platformSettings = await ensurePlatformSettings();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contrasena son obligatorios" });
    }

    if (!platformSettings.allowAdminRegistration && email !== DEFAULT_SUPERADMIN_EMAIL) {
      return res.status(403).json({ message: "El registro de administradores esta deshabilitado por configuracion global" });
    }

    const role = email === DEFAULT_SUPERADMIN_EMAIL ? SUPERADMIN_ROLE : ADMIN_ROLE;
    let authData = null;
    let authError = null;

    if (HAS_SUPABASE_SERVICE_ROLE_KEY) {
      const result = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: nameFromEmail(email),
          role
        }
      });
      authData = result.data;
      authError = result.error;
    } else {
      const result = await supabasePublic.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: nameFromEmail(email),
            role
          }
        }
      });
      authData = result.data;
      authError = result.error;
    }

    if (authError) {
      if (String(authError.message || "").toLowerCase().includes("already")) {
        return res.status(409).json({ message: "Ese correo ya existe. Inicia sesion." });
      }
      throw authError;
    }

    if (!authData || !authData.user) {
      throw new Error("No se pudo crear el usuario en Supabase Auth");
    }

    if (!HAS_SUPABASE_SERVICE_ROLE_KEY && !authData.session && !authData.user.email_confirmed_at) {
      return res.status(403).json({
        message: "Usuario creado en Supabase Auth. Verifica tu correo para activar la cuenta."
      });
    }

    const user = await upsertAppUserFromAuth(authData.user, role, {
      role,
      status: "active"
    });

    const token = signToken(user);
    res.cookie(JWT_COOKIE_NAME, token, cookieOptions());

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contrasena son obligatorios" });
    }

    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData || !authData.user) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    const fallbackRole = email === DEFAULT_SUPERADMIN_EMAIL ? SUPERADMIN_ROLE : ADMIN_ROLE;
    let user = await upsertAppUserFromAuth(authData.user, fallbackRole);

    if (normalizeAccountStatus(user.status) !== "active") {
      return res.status(403).json({ message: "Tu cuenta esta desactivada. Contacta al superadministrador." });
    }

    if (!isSuperadminRole(user.role) && user.tenantId) {
      const tenant = await getTenantById(user.tenantId);
      if (!tenant || normalizeAccountStatus(tenant.status) !== "active") {
        return res.status(403).json({ message: "Tu espacio de trabajo esta desactivado." });
      }
      user = { ...user, tenantName: tenant.name, tenantStatus: tenant.status };
    }

    await updateAppUserLogin(user.id);
    user = await getAppUserById(user.id);

    const token = signToken(user);
    res.cookie(JWT_COOKIE_NAME, token, cookieOptions());

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(JWT_COOKIE_NAME, cookieOptions());
  res.status(204).end();
});

app.get("/api/auth/supabase-client-config", (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      message: "Supabase Auth no esta configurado para recuperacion de contrasena."
    });
  }

  return res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "La contrasena actual y la nueva contrasena son obligatorias" });
    }

    if (newPassword.length < PASSWORD_CHANGE_MIN_LENGTH) {
      return res.status(400).json({ message: `La nueva contrasena debe tener al menos ${PASSWORD_CHANGE_MIN_LENGTH} caracteres` });
    }

    if (!req.user?.email || !req.user?.id) {
      return res.status(401).json({ message: "Sesion invalida. Inicia sesion nuevamente." });
    }

    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email: String(req.user.email).trim().toLowerCase(),
      password: currentPassword
    });

    if (authError || !authData?.user) {
      return res.status(401).json({ message: "La contrasena actual no es correcta" });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: newPassword
    });

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ message: "Contrasena actualizada correctamente" });
  } catch (error) {
    return next(error);
  }
});

// Google OAuth redirect endpoint
app.get("/api/auth/google", (req, res) => {
  // For staging: redirect to Google OAuth
  // In production, you would implement full OAuth flow
  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID || ''}&redirect_uri=${encodeURIComponent(APP_PUBLIC_URL + '/api/auth/google/callback')}&response_type=code&scope=openid%20email%20profile`;

  if (!process.env.GOOGLE_CLIENT_ID) {
    // Si no hay Google Client ID, mostrar mensaje informativo
    return res.json({
      message: 'Google OAuth no configurado. Para usar esta funcionalidad, configura GOOGLE_CLIENT_ID en las variables de entorno.',
      info: 'Por ahora, usa Sign In con email y password.'
    });
  }

  res.redirect(googleOAuthUrl);
});

// Google OAuth callback endpoint
app.get("/api/auth/google/callback", async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ message: 'Codigo de Google no valido o configuracion incompleta' });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        redirect_uri: APP_PUBLIC_URL + '/api/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(400).json({ message: 'No se pudo obtener token de Google' });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userInfoResponse.json();

    if (!googleUser.email) {
      return res.status(400).json({ message: 'No se pudo obtener email de Google' });
    }

    // Find or create user in Supabase
    let authUser = await findAuthUserByEmail(googleUser.email);

    if (!authUser) {
      // Create new user
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const { data, error } = await supabase.auth.admin.createUser({
        email: googleUser.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          name: googleUser.name || googleUser.email,
          role: ADMIN_ROLE,
          provider: 'google'
        }
      });

      if (error) throw error;
      authUser = data?.user || null;
    }

    // Get or create app user
    let appUser = await getAppUserById(authUser.id);

    if (!appUser) {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          id: authUser.id,
          email: googleUser.email,
          name: googleUser.name || googleUser.email,
          role: ADMIN_ROLE,
          status: 'active',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      appUser = data;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', appUser.id);

    // Generate JWT
    const token = jwt.sign(
      { sub: appUser.id, email: appUser.email, role: appUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie(JWT_COOKIE_NAME, token, cookieOptions());
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/?error=google-auth-failed');
  }
});

// Biometric authentication registration (after successful login)
app.post("/api/auth/biometric/register", requireAuth, async (req, res, next) => {
  try {
    const { publicKey } = req.body;

    // Generate credential creation options
    const challenge = crypto.randomBytes(32);
    const userId = req.user.id;

    const options = {
      challenge: challenge.toString('base64'),
      user: {
        id: userId,
        name: req.user.email,
        displayName: req.user.name
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      }
    };

    // Store challenge temporarily (in production, use Redis or similar)
    req.session = req.session || {};
    req.session.challenge = challenge.toString('base64');

    res.json({ options });
  } catch (error) {
    next(error);
  }
});

// Biometric authentication endpoint
app.post("/api/auth/biometric", async (req, res, next) => {
  try {
    const { id, rawId, response } = req.body;

    // Verify the biometric assertion
    // In production, you would verify the signature against stored public key

    // For now, we'll look up user by credential ID stored in localStorage
    // This is a simplified implementation

    // Get user from credential (stored in userHandle)
    const userHandle = response.userHandle;

    if (!userHandle) {
      return res.status(400).json({ message: 'Credencial biometrica invalida' });
    }

    // Decode userHandle to get user ID
    const userId = atob(userHandle);

    // Get user from database
    const appUser = await getAppUserById(userId);

    if (!appUser || normalizeAccountStatus(appUser.status) !== 'active') {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo' });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', appUser.id);

    // Generate JWT
    const token = jwt.sign(
      { sub: appUser.id, email: appUser.email, role: appUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie(JWT_COOKIE_NAME, token, cookieOptions());
    res.json({ user: sanitizeUser(appUser) });
  } catch (error) {
    console.error('Biometric auth error:', error);
    next(error);
  }
});

// Request password reset - sends 6-digit code via email
app.post("/api/auth/request-password-reset", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email es requerido' });
    }

    const rateLimit = enforcePasswordResetRateLimit(req, buildPasswordResetLimitScopes(req, email, "request"));
    if (!rateLimit.allowed) {
      return res.status(429).json({ message: rateLimit.message, retryAfterSeconds: rateLimit.retryAfterSeconds });
    }

    // Find user by email
    const authUser = await findAuthUserByEmail(email);

    if (!authUser) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({ message: 'Si el correo existe, recibirás un código de verificación' });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();

    // Store code in Supabase with expiration (15 minutes)
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS).toISOString();

    await supabase
      .from('password_reset_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    const { error: insertError } = await supabase
      .from('password_reset_codes')
      .insert([{
        email,
        code: code,
        expires_at: expiresAt,
        used: false,
        user_id: authUser.id
      }]);

    if (insertError) {
      console.error('Error storing reset code:', insertError);
      return res.status(500).json({ message: 'Error generando código de verificación' });
    }

    // Send reset email using native Supabase Auth flow (no Edge Function dependency)
    const appUrl = APP_PUBLIC_URL || 'https://credisync-727b6-staging.web.app';
    const redirectTo = `${appUrl}/reset-password`;

    const { error: resetEmailError } = await supabasePublic.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (resetEmailError) {
      console.error('Error sending reset email via Supabase Auth:', resetEmailError);
      await supabase
        .from('password_reset_codes')
        .update({ used: true })
        .eq('email', email)
        .eq('code', code);

      return res.status(503).json({
        message: 'No se pudo enviar el correo de recuperacion. Verifica la configuracion de Supabase Auth o contacta soporte.'
      });
    }

    console.log(`Password reset email requested for ${email} via Supabase Auth.`);

    res.status(200).json({
      message: 'Codigo generado. Revisa tu correo electronico.',
      // Don't send code in production response
      code: IS_PROD ? undefined : code
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    next(error);
  }
});

// Verify password reset code
app.post("/api/auth/verify-password-reset-code", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: 'Email y código son requeridos' });
    }

    const rateLimit = enforcePasswordResetRateLimit(req, buildPasswordResetLimitScopes(req, email, "verify"));
    if (!rateLimit.allowed) {
      return res.status(429).json({ message: rateLimit.message, retryAfterSeconds: rateLimit.retryAfterSeconds });
    }

    // Find valid code
    const { data, error } = await supabase
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(400).json({ message: 'Código inválido o expirado' });
    }

    res.status(200).json({ message: 'Código verificado', email: data.email });
  } catch (error) {
    console.error('Verify reset code error:', error);
    next(error);
  }
});

// Reset password with code
app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const password = String(req.body.password || "").trim();

    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    if (password.length < PASSWORD_CHANGE_MIN_LENGTH) {
      return res.status(400).json({ message: `La contrasena debe tener al menos ${PASSWORD_CHANGE_MIN_LENGTH} caracteres` });
    }

    const rateLimit = enforcePasswordResetRateLimit(req, buildPasswordResetLimitScopes(req, email, "reset"));
    if (!rateLimit.allowed) {
      return res.status(429).json({ message: rateLimit.message, retryAfterSeconds: rateLimit.retryAfterSeconds });
    }

    // Verify code is still valid and unused
    const { data, error } = await supabase
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(400).json({ message: 'Codigo invalido o expirado' });
    }

    // Update password in Supabase Auth
    const userId = data.user_id || (await findAuthUserByEmail(email))?.id;
    if (!userId) {
      return res.status(404).json({ message: 'No se encontro la cuenta asociada a este correo' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updateError) {
      return res.status(500).json({ message: 'Error actualizando contraseña' });
    }

    await supabase
      .from('password_reset_codes')
      .update({ used: true })
      .eq('email', email);

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ state });
  } catch (error) {
    next(error);
  }
});

app.get("/api/superadmin/users", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const [appUsersResult, tenantsResult, authUsers] = await Promise.all([
      supabase
        .from("users")
        .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenants")
        .select("id,name,status,created_at"),
      listAuthUsers()
    ]);

    if (appUsersResult.error) throw appUsersResult.error;
    if (tenantsResult.error) throw tenantsResult.error;

    const tenantsById = new Map((tenantsResult.data || []).map((tenant) => [tenant.id, tenant]));
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const authByEmail = new Map(authUsers.map((user) => [String(user.email || "").toLowerCase(), user]));

    const users = (appUsersResult.data || []).map((row) => {
      const authUser = authById.get(row.id) || authByEmail.get(String(row.email || "").toLowerCase()) || null;
      const tenant = row.tenant_id ? tenantsById.get(row.tenant_id) || null : null;
      const metadata = authUser && authUser.user_metadata ? authUser.user_metadata : {};

      return {
        id: authUser ? authUser.id : row.id,
        email: authUser && authUser.email ? authUser.email : row.email,
        name: row.name || String(metadata.name || nameFromEmail(row.email || "usuario")),
        role: normalizeRole(row.role || (String(row.email || "").toLowerCase() === DEFAULT_SUPERADMIN_EMAIL ? SUPERADMIN_ROLE : ADMIN_ROLE)),
        status: normalizeAccountStatus(row.status),
        tenantId: row.tenant_id || null,
        tenantName: tenant ? tenant.name : null,
        tenantStatus: tenant ? tenant.status : null,
        createdAt: row.created_at || (authUser && authUser.created_at ? authUser.created_at : null),
        lastSignInAt: authUser && authUser.last_sign_in_at ? authUser.last_sign_in_at : row.last_login_at || null,
        lastLoginAt: row.last_login_at || null,
        emailConfirmed: Boolean(authUser ? authUser.email_confirmed_at : true)
      };
    });

    authUsers.forEach((authUser) => {
      const exists = users.some((user) => user.id === authUser.id || user.email === authUser.email);
      if (exists) {
        return;
      }

      users.push({
        id: authUser.id,
        email: authUser.email,
        name:
          authUser.user_metadata && authUser.user_metadata.name
            ? String(authUser.user_metadata.name)
            : nameFromEmail(authUser.email || "usuario"),
        role: String(authUser.email || "").toLowerCase() === DEFAULT_SUPERADMIN_EMAIL ? SUPERADMIN_ROLE : ADMIN_ROLE,
        status: DEFAULT_ACCOUNT_STATUS,
        tenantId: null,
        tenantName: null,
        tenantStatus: null,
        createdAt: authUser.created_at || null,
        lastSignInAt: authUser.last_sign_in_at || null,
        lastLoginAt: null,
        emailConfirmed: Boolean(authUser.email_confirmed_at)
      });
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

app.get("/api/superadmin/settings", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const settings = await ensurePlatformSettings();
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/superadmin/settings", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const defaults = defaultPlatformSettings();
    const settings = {
      platformName: String(req.body.platformName || defaults.platformName).trim() || defaults.platformName,
      supportEmail: String(req.body.supportEmail || defaults.supportEmail).trim().toLowerCase(),
      supportPhone: String(req.body.supportPhone || defaults.supportPhone).trim(),
      allowAdminRegistration: parseBooleanInput(req.body.allowAdminRegistration, defaults.allowAdminRegistration),
      newTenantStatus: "active",
      tenantDefaults: {
        personalLoanRate: parseNumericInput(req.body.tenantDefaults?.personalLoanRate, defaults.tenantDefaults.personalLoanRate),
        businessLoanRate: parseNumericInput(req.body.tenantDefaults?.businessLoanRate, defaults.tenantDefaults.businessLoanRate),
        mortgageLoanRate: parseNumericInput(req.body.tenantDefaults?.mortgageLoanRate, defaults.tenantDefaults.mortgageLoanRate),
        autoLoanRate: parseNumericInput(req.body.tenantDefaults?.autoLoanRate, defaults.tenantDefaults.autoLoanRate),
        latePenaltyRate: parseNumericInput(req.body.tenantDefaults?.latePenaltyRate, defaults.tenantDefaults.latePenaltyRate),
        graceDays: parseNumericInput(req.body.tenantDefaults?.graceDays, defaults.tenantDefaults.graceDays),
        autoApprovalScore: parseNumericInput(req.body.tenantDefaults?.autoApprovalScore, defaults.tenantDefaults.autoApprovalScore),
        maxDebtToIncome: parseNumericInput(req.body.tenantDefaults?.maxDebtToIncome, defaults.tenantDefaults.maxDebtToIncome),
        capitalBudget: Math.max(parseNumericInput(req.body.tenantDefaults?.capitalBudget, defaults.tenantDefaults.capitalBudget), 0)
      },
      riskModel: {
        initialScore: parseNumericInput(req.body.riskModel?.initialScore, defaults.riskModel.initialScore),
        onTimePaymentReward: parseNumericInput(req.body.riskModel?.onTimePaymentReward, defaults.riskModel.onTimePaymentReward),
        keptPromiseReward: parseNumericInput(req.body.riskModel?.keptPromiseReward, defaults.riskModel.keptPromiseReward),
        paymentActivityReward: parseNumericInput(req.body.riskModel?.paymentActivityReward, defaults.riskModel.paymentActivityReward),
        paymentActivityCap: Math.max(parseNumericInput(req.body.riskModel?.paymentActivityCap, defaults.riskModel.paymentActivityCap), 0),
        latePaymentPenalty: Math.max(parseNumericInput(req.body.riskModel?.latePaymentPenalty, defaults.riskModel.latePaymentPenalty), 0),
        brokenPromisePenalty: Math.max(parseNumericInput(req.body.riskModel?.brokenPromisePenalty, defaults.riskModel.brokenPromisePenalty), 0),
        pendingPromisePenalty: Math.max(parseNumericInput(req.body.riskModel?.pendingPromisePenalty, defaults.riskModel.pendingPromisePenalty), 0),
        overdueDayPenalty: Math.max(parseNumericInput(req.body.riskModel?.overdueDayPenalty, defaults.riskModel.overdueDayPenalty), 0),
        overdueDayCap: Math.max(parseNumericInput(req.body.riskModel?.overdueDayCap, defaults.riskModel.overdueDayCap), 0),
        overdueAccumulatedPenalty: Math.max(parseNumericInput(req.body.riskModel?.overdueAccumulatedPenalty, defaults.riskModel.overdueAccumulatedPenalty), 0),
        overdueAccumulatedCap: Math.max(parseNumericInput(req.body.riskModel?.overdueAccumulatedCap, defaults.riskModel.overdueAccumulatedCap), 0),
        lagInstallmentPenalty: Math.max(parseNumericInput(req.body.riskModel?.lagInstallmentPenalty, defaults.riskModel.lagInstallmentPenalty), 0),
        noPaymentHistoryPenalty: Math.max(parseNumericInput(req.body.riskModel?.noPaymentHistoryPenalty, defaults.riskModel.noPaymentHistoryPenalty), 0)
      }
    };

    const payload = {
      id: "global",
      platform_name: settings.platformName,
      support_email: settings.supportEmail,
      support_phone: settings.supportPhone,
      allow_admin_registration: settings.allowAdminRegistration,
      new_tenant_status: settings.newTenantStatus,
      default_personal_loan_rate: settings.tenantDefaults.personalLoanRate,
      default_business_loan_rate: settings.tenantDefaults.businessLoanRate,
      default_mortgage_loan_rate: settings.tenantDefaults.mortgageLoanRate,
      default_auto_loan_rate: settings.tenantDefaults.autoLoanRate,
      default_late_penalty_rate: settings.tenantDefaults.latePenaltyRate,
      default_grace_days: settings.tenantDefaults.graceDays,
      default_auto_approval_score: settings.tenantDefaults.autoApprovalScore,
      default_max_debt_to_income: settings.tenantDefaults.maxDebtToIncome,
      default_capital_budget: settings.tenantDefaults.capitalBudget,
      risk_initial_score: settings.riskModel.initialScore,
      risk_on_time_payment_reward: settings.riskModel.onTimePaymentReward,
      risk_kept_promise_reward: settings.riskModel.keptPromiseReward,
      risk_payment_activity_reward: settings.riskModel.paymentActivityReward,
      risk_payment_activity_cap: settings.riskModel.paymentActivityCap,
      risk_late_payment_penalty: settings.riskModel.latePaymentPenalty,
      risk_broken_promise_penalty: settings.riskModel.brokenPromisePenalty,
      risk_pending_promise_penalty: settings.riskModel.pendingPromisePenalty,
      risk_overdue_day_penalty: settings.riskModel.overdueDayPenalty,
      risk_overdue_day_cap: settings.riskModel.overdueDayCap,
      risk_overdue_accumulated_penalty: settings.riskModel.overdueAccumulatedPenalty,
      risk_overdue_accumulated_cap: settings.riskModel.overdueAccumulatedCap,
      risk_lag_installment_penalty: settings.riskModel.lagInstallmentPenalty,
      risk_no_payment_history_penalty: settings.riskModel.noPaymentHistoryPenalty
    };

    let { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });

    if (error && String(error.code || "") === "42703") {
      Object.keys(payload)
        .filter((key) => key.startsWith("risk_"))
        .forEach((key) => delete payload[key]);
      ({ error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" }));
    }

    if (error) {
      throw error;
    }

    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/audit-logs", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.query.tenantId || "").trim();
    const limit = Math.min(Math.max(Math.trunc(parseNumericInput(req.query.limit, 80)), 1), 300);
    let query = supabase
      .from("platform_audit_logs")
      .select("id,actor_user_id,actor_role,action,entity_type,entity_id,tenant_id,before_data,after_data,meta,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;
    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.json({ logs: [] });
      }
      throw error;
    }

    return res.json({
      logs: (data || []).map((row) => ({
        id: row.id,
        actorUserId: row.actor_user_id || null,
        actorRole: row.actor_role || "",
        action: row.action || "",
        entityType: row.entity_type || "",
        entityId: row.entity_id || "",
        tenantId: row.tenant_id || null,
        beforeData: row.before_data || {},
        afterData: row.after_data || {},
        meta: row.meta || {},
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/users/:id/audit", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const target = await getAppUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!target.tenantId) {
      return res.status(400).json({ message: "El usuario no tiene tenant asignado para auditoria" });
    }

    const tenant = await getTenantById(target.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const state = await readStateForTenant(target.tenantId);

    return res.json({
      user: target,
      tenant,
      state
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/tenants/:tenantId/audit", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant invalido" });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const { data: tenantUserRow, error: tenantUserError } = await supabase
      .from("users")
      .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (tenantUserError) {
      throw tenantUserError;
    }

    const tenantUser = tenantUserRow ? mapAppUserRow(tenantUserRow, tenant) : null;
    const state = await readStateForTenant(tenantId);

    return res.json({
      user: tenantUser,
      tenant,
      state
    });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/superadmin/tenants/:tenantId", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant invalido" });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const usersResult = await supabase
      .from("users")
      .select("id,email,name,role,tenant_id")
      .eq("tenant_id", tenantId);

    if (usersResult.error) {
      throw usersResult.error;
    }

    const tenantUsers = usersResult.data || [];
    const protectedTenant = tenantUsers.some((user) => isSuperadminRole(user.role || ""));

    if (protectedTenant || String(req.user.tenantId || "") === tenantId) {
      return res.status(400).json({ message: "El tenant del superadministrador esta protegido y no puede eliminarse" });
    }

    const beforeData = {
      tenant,
      usersCount: tenantUsers.length
    };

    await deleteRowsByTenant("billing_payments", tenantId);
    await deleteRowsByTenant("billing_invoices", tenantId);
    await deleteRowsByTenant("tenant_subscriptions", tenantId);
    await deleteRowsByTenant("notifications", tenantId);
    await deleteRowsByTenant("payment_promises", tenantId);
    await deleteRowsByTenant("payments", tenantId);
    await deleteRowsByTenant("user_calendar_integrations", tenantId);
    await deleteRowsByTenant("push_subscriptions", tenantId);

    if (tenantUsers.length > 0) {
      const { error: deleteUsersError } = await supabase
        .from("users")
        .delete()
        .eq("tenant_id", tenantId);

      if (deleteUsersError) {
        throw deleteUsersError;
      }

      if (HAS_SUPABASE_SERVICE_ROLE_KEY) {
        for (const user of tenantUsers) {
          const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
          if (authError) {
            console.warn(`[AUTH DELETE WARNING] Could not delete tenant user ${user.id}:`, authError.message);
          }
        }
      }
    }

    const { error: deleteTenantError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenantId);

    if (deleteTenantError) {
      throw deleteTenantError;
    }

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "tenant_deleted",
      entityType: "tenant",
      entityId: tenantId,
      tenantId: null,
      beforeData,
      afterData: {},
      meta: {
        deletedUsers: tenantUsers.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role
        }))
      }
    });

    return res.json({ ok: true, tenantId });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/superadmin/users/:id/status", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const status = normalizeAccountStatus(req.body.status);

    if (!userId) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (req.user.id === userId && status === "inactive") {
      return res.status(400).json({ message: "No puedes desactivar tu propia cuenta de superadministrador" });
    }

    const target = await getAppUserById(userId);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    if (target.tenantId) {
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ status })
        .eq("id", target.tenantId);

      if (tenantError) {
        throw tenantError;
      }
    }

    await setAuthUserBanStatus(userId, status);
    const updatedUser = await getAppUserById(userId);

    return res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/superadmin/users/:id/role", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const role = normalizeRole(req.body.role, "");

    if (!userId) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (!role || ![ADMIN_ROLE, SUPERADMIN_ROLE].includes(role)) {
      return res.status(400).json({ message: "Rol no permitido" });
    }

    const targetRow = await getAppUserRowById(userId);
    if (!targetRow) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    let tenantId = targetRow.tenant_id || null;
    if (!isSuperadminRole(role) && !tenantId) {
      const platformSettings = await ensurePlatformSettings();
      tenantId = buildTenantId();
      await ensureTenantRecord(tenantId, buildTenantName(targetRow.name, targetRow.email), "active");
      await ensureTenantSettings(tenantId);
    }

    const { error } = await supabase
      .from("users")
      .update({ role, tenant_id: tenantId })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    await updateAuthUserMetadata(userId, { role });
    const updatedUser = await getAppUserById(userId);

    return res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/superadmin/users/:id/reset-password", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const password = String(req.body.password || "").trim();

    if (!userId || !password) {
      return res.status(400).json({ message: "Usuario y nueva contrasena son obligatorios" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "La nueva contrasena debe tener al menos 8 caracteres" });
    }

    const target = await getAppUserById(userId);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await resetAuthUserPassword(userId, password);
    return res.json({ ok: true, userId: target.id });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/superadmin/users/:id", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (req.user.id === userId) {
      return res.status(400).json({ message: "No puedes eliminar tu propia cuenta de superadministrador" });
    }

    const target = await getAppUserById(userId);
    if (!target) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // 1. Soft delete user (marca como eliminado, no borra permanentemente)
    const { error: dbError } = await supabase
      .from("users")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId)
      .is("deleted_at", null); // Solo si no está ya eliminado

    if (dbError) {
      console.error("[DB SOFT DELETE USER ERROR]", dbError);
      return res.status(400).json({ message: "No se puede eliminar el usuario. Intente nuevamente." });
    }

    // 2. Marcar datos relacionados como eliminados (best-effort: no bloquear respuesta si falla)
    try {
      const { error: calendarDeleteError } = await supabase
        .from("user_calendar_integrations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (calendarDeleteError) {
        console.warn(`[USER DELETE WARNING] user_calendar_integrations cleanup failed for ${userId}:`, calendarDeleteError.message);
      }
    } catch (calendarCleanupError) {
      console.warn(`[USER DELETE WARNING] user_calendar_integrations cleanup exception for ${userId}:`, calendarCleanupError?.message || calendarCleanupError);
    }

    try {
      const { error: pushDeleteError } = await supabase
        .from("push_subscriptions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (pushDeleteError) {
        console.warn(`[USER DELETE WARNING] push_subscriptions cleanup failed for ${userId}:`, pushDeleteError.message);
      }
    } catch (pushCleanupError) {
      console.warn(`[USER DELETE WARNING] push_subscriptions cleanup exception for ${userId}:`, pushCleanupError?.message || pushCleanupError);
    }

    // 3. Eliminar de Supabase Auth (opcional, esto sí es permanente)
    // Nota: Si necesitas restaurar el usuario, deberás crearlo nuevamente en Auth
    if (HAS_SUPABASE_SERVICE_ROLE_KEY) {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.warn(`[AUTH DELETE WARNING] Could not delete user ${userId} from Auth:`, authError.message);
      }
    }

    return res.json({ ok: true, message: "Usuario eliminado correctamente. Los datos permanecen en la base de datos para recuperación." });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/customers", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ customers: state.customers });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Completa la informacion del cliente" });
    }

    const currentState = await readStateForUser(req.user);
    const customerLimit = parseNumericInput(req.subscription?.limits?.maxCustomers, 0);
    if (exceedsLimit(customerLimit, currentState.customers.length)) {
      return res.status(400).json({
        message: `Tu plan alcanzo el limite de clientes (${customerLimit}). Actualiza tu suscripcion para continuar.`
      });
    }

    const customer = {
      id: `CUS-${numericId()}`,
      tenantId: req.user.tenantId,
      name,
      email,
      phone,
      status: "active",
      joinedAt: isoToday()
    };

    const payload = {
      id: customer.id,
      tenant_id: customer.tenantId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      joined_at: customer.joinedAt
    };

    const { error } = await supabase.from("customers").insert([payload]);

    if (error) {
      throw error;
    }

    return res.status(201).json({ customer });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/customers/:id", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const customerId = String(req.params.id || "").trim();
    if (!customerId) {
      return res.status(400).json({ message: "Cliente invalido" });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id,name")
      .eq("id", customerId)
      .eq("tenant_id", req.user.tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Soft delete: marcar como eliminado en lugar de borrar permanentemente
    const { error: deleteError } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("tenant_id", req.user.tenantId)
      .is("deleted_at", null);

    if (deleteError) {
      throw deleteError;
    }

    return res.json({
      ok: true,
      customer: {
        id: customer.id,
        name: customer.name
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/loans", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ loans: state.loans });
  } catch (error) {
    next(error);
  }
});

app.get("/api/loans/:id", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("loans")
      .select("id,tenant_id,customer_id,type,principal,interest_rate,term_months,start_date,paid_amount,status")
      .eq("id", req.params.id)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Prestamo no encontrado" });
    }

    // Attempt to get optional loan columns
    const { data: modeData } = await supabase
      .from("loans")
      .select("interest_rate_mode,payment_model,principal_outstanding")
      .eq("id", req.params.id)
      .maybeSingle();

    return res.json({
      loan: {
        id: data.id,
        tenantId: data.tenant_id,
        customerId: data.customer_id,
        type: data.type,
        principal: Number(data.principal || 0),
        interestRate: Number(data.interest_rate || 0),
        interestRateMode: (modeData && modeData.interest_rate_mode) || 'annual',
        paymentModel: normalizePaymentModel(modeData?.payment_model),
        termMonths: Number(data.term_months || 0),
        startDate: data.start_date,
        paidAmount: Number(data.paid_amount || 0),
        principalOutstanding: Number.isFinite(Number(modeData?.principal_outstanding)) ? Number(modeData.principal_outstanding) : null,
        status: data.status || "active"
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/loans", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const loan = {
      id: `LN-${numericId()}`,
      tenantId: req.user.tenantId,
      customerId: String(req.body.customerId || "").trim(),
      type: String(req.body.type || "").trim(),
      principal: parseNumericInput(req.body.principal, NaN),
      interestRate: parseNumericInput(req.body.interestRate, NaN),
      interestRateMode: String(req.body.interestRateMode || "annual").trim().toLowerCase() === "monthly" ? "monthly" : "annual",
      paymentModel: normalizePaymentModel(req.body.paymentModel),
      termMonths: parseNumericInput(req.body.termMonths, NaN),
      startDate: String(req.body.startDate || "").trim(),
      paidAmount: 0,
      principalOutstanding: parseNumericInput(req.body.principal, NaN),
      status: "active"
    };

    if (!loan.customerId || !loan.type || !loan.startDate || loan.principal <= 0 || loan.termMonths <= 0) {
      return res.status(400).json({ message: "Completa todos los campos del prestamo" });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", loan.customerId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return res.status(400).json({ message: "Selecciona un cliente valido de tu espacio de trabajo" });
    }

    const tenantState = await readStateForTenant(req.user.tenantId);
    const activeLoans = (tenantState.loans || []).filter((item) => item.status !== "paid").length;
    const activeLoanLimit = parseNumericInput(req.subscription?.limits?.maxActiveLoans, 0);
    if (exceedsLimit(activeLoanLimit, activeLoans)) {
      return res.status(400).json({
        message: `Tu plan alcanzo el limite de prestamos activos (${activeLoanLimit}). Actualiza tu suscripcion para continuar.`
      });
    }

    const budget = Math.max(Number(tenantState.settings.capitalBudget) || 0, 0);
    if (budget > 0) {
      const committed = capitalCommittedFromLoans(tenantState.loans);
      const available = round2(Math.max(budget - committed, 0));
      if (loan.principal > available + 0.01) {
        return res.status(400).json({
          message: `Capital insuficiente. Disponible: $${available.toFixed(2)}`
        });
      }
    }

    const loanPayload = {
      id: loan.id,
      tenant_id: loan.tenantId,
      customer_id: loan.customerId,
      type: loan.type,
      principal: loan.principal,
      interest_rate: loan.interestRate,
      term_months: loan.termMonths,
      start_date: loan.startDate,
      paid_amount: loan.paidAmount,
      principal_outstanding: loan.principalOutstanding,
      status: loan.status
    };

    // Try to insert with interest_rate_mode, fallback if column missing
    const { error: insertError } = await supabase
      .from("loans")
      .insert([
        {
          ...loanPayload,
          interest_rate_mode: loan.interestRateMode,
          payment_model: loan.paymentModel
        }
      ]);

    if (insertError) {
      // If error is missing optional columns, retry with baseline payload
      const fallbackPayload = {
        id: loan.id,
        tenant_id: loan.tenantId,
        customer_id: loan.customerId,
        type: loan.type,
        principal: loan.principal,
        interest_rate: loan.interestRate,
        term_months: loan.termMonths,
        start_date: loan.startDate,
        paid_amount: loan.paidAmount,
        status: loan.status
      };
      const { error: retryError } = await supabase
        .from("loans")
        .insert([fallbackPayload]);

      if (retryError) throw retryError;
    }

    return res.status(201).json({ loan });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/loans/:id", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const loanId = String(req.params.id || "").trim();
    if (!loanId) {
      return res.status(400).json({ message: "Prestamo invalido" });
    }

    const { data: loanRow, error: loanError } = await supabase
      .from("loans")
      .select("id,tenant_id,customer_id,type,principal,interest_rate,term_months,start_date,paid_amount,status")
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (loanError) {
      throw loanError;
    }

    if (!loanRow) {
      return res.status(404).json({ message: "Prestamo no encontrado" });
    }

    const { data: modeData } = await supabase
      .from("loans")
      .select("interest_rate_mode,payment_model,principal_outstanding")
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    const existingLoan = {
      id: loanRow.id,
      tenantId: loanRow.tenant_id,
      customerId: loanRow.customer_id,
      type: loanRow.type,
      principal: Number(loanRow.principal || 0),
      interestRate: Number(loanRow.interest_rate || 0),
      interestRateMode: modeData && modeData.interest_rate_mode === "monthly" ? "monthly" : "annual",
      paymentModel: normalizePaymentModel(modeData && modeData.payment_model),
      termMonths: Number(loanRow.term_months || 0),
      startDate: loanRow.start_date,
      paidAmount: Number(loanRow.paid_amount || 0),
      principalOutstanding: Number.isFinite(Number(modeData && modeData.principal_outstanding))
        ? Number(modeData.principal_outstanding)
        : null,
      status: loanRow.status || "active"
    };

    const hasCustomerId = Object.prototype.hasOwnProperty.call(req.body || {}, "customerId");
    const hasType = Object.prototype.hasOwnProperty.call(req.body || {}, "type");
    const hasPrincipal = Object.prototype.hasOwnProperty.call(req.body || {}, "principal");
    const hasInterestRate = Object.prototype.hasOwnProperty.call(req.body || {}, "interestRate");
    const hasInterestRateMode = Object.prototype.hasOwnProperty.call(req.body || {}, "interestRateMode");
    const hasPaymentModel = Object.prototype.hasOwnProperty.call(req.body || {}, "paymentModel");
    const hasTermMonths = Object.prototype.hasOwnProperty.call(req.body || {}, "termMonths");
    const hasStartDate = Object.prototype.hasOwnProperty.call(req.body || {}, "startDate");

    const nextLoan = {
      ...existingLoan,
      customerId: hasCustomerId ? String(req.body.customerId || "").trim() : existingLoan.customerId,
      type: hasType ? String(req.body.type || "").trim() : existingLoan.type,
      principal: hasPrincipal ? parseNumericInput(req.body.principal, NaN) : existingLoan.principal,
      interestRate: hasInterestRate ? parseNumericInput(req.body.interestRate, NaN) : existingLoan.interestRate,
      interestRateMode: hasInterestRateMode
        ? (String(req.body.interestRateMode || "").trim().toLowerCase() === "monthly" ? "monthly" : "annual")
        : existingLoan.interestRateMode,
      paymentModel: hasPaymentModel ? normalizePaymentModel(req.body.paymentModel) : existingLoan.paymentModel,
      termMonths: hasTermMonths ? parseNumericInput(req.body.termMonths, NaN) : existingLoan.termMonths,
      startDate: hasStartDate ? String(req.body.startDate || "").trim() : existingLoan.startDate
    };

    if (!nextLoan.customerId || !nextLoan.type || !nextLoan.startDate || nextLoan.principal <= 0 || nextLoan.termMonths <= 0) {
      return res.status(400).json({ message: "Completa todos los campos del prestamo" });
    }

    if (!Number.isFinite(nextLoan.interestRate) || nextLoan.interestRate < 0) {
      return res.status(400).json({ message: "La tasa de interes no es valida" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextLoan.startDate)) {
      return res.status(400).json({ message: "Fecha de inicio invalida" });
    }

    if (nextLoan.principal + 0.01 < existingLoan.paidAmount) {
      return res.status(400).json({
        message: `El monto principal no puede ser menor al capital ya recuperado (${existingLoan.paidAmount.toFixed(2)}).`
      });
    }

    const { data: loanPayments, error: loanPaymentsError } = await supabase
      .from("payments")
      .select("id")
      .eq("loan_id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .limit(1);

    if (loanPaymentsError) {
      throw loanPaymentsError;
    }

    const hasPayments = Array.isArray(loanPayments) && loanPayments.length > 0;
    if (nextLoan.paymentModel !== existingLoan.paymentModel && hasPayments) {
      return res.status(400).json({
        message: "No puedes cambiar el modelo de cobro de un prestamo que ya tiene pagos registrados."
      });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", nextLoan.customerId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return res.status(400).json({ message: "Selecciona un cliente valido de tu espacio de trabajo" });
    }

    if (isInterestOnlyBalloonLoan(nextLoan)) {
      nextLoan.principalOutstanding = Math.max(round2(nextLoan.principal - existingLoan.paidAmount), 0);
    } else {
      nextLoan.principalOutstanding = Number.isFinite(Number(existingLoan.principalOutstanding))
        ? Math.max(round2(existingLoan.principalOutstanding), 0)
        : null;
      const nextTotalPayable = loanTotalPayable(nextLoan);
      if (existingLoan.paidAmount > nextTotalPayable + 0.01) {
        return res.status(400).json({
          message: `La configuracion propuesta deja pagos aplicados por encima del total del prestamo (${nextTotalPayable.toFixed(2)}).`
        });
      }
    }

    const tenantState = await readStateForTenant(req.user.tenantId);
    const projectedLoans = (tenantState.loans || []).map((loan) => (
      String(loan.id) === loanId
        ? {
          ...loan,
          customerId: nextLoan.customerId,
          type: nextLoan.type,
          principal: nextLoan.principal,
          interestRate: nextLoan.interestRate,
          interestRateMode: nextLoan.interestRateMode,
          paymentModel: nextLoan.paymentModel,
          termMonths: nextLoan.termMonths,
          startDate: nextLoan.startDate,
          principalOutstanding: nextLoan.principalOutstanding
        }
        : loan
    ));

    const budget = Math.max(Number(tenantState.settings?.capitalBudget) || 0, 0);
    if (budget > 0) {
      const projectedCommitted = capitalCommittedFromLoans(projectedLoans);
      if (projectedCommitted > budget + 0.01) {
        return res.status(400).json({
          message: `Capital insuficiente con esta actualizacion. Disponible: $${Math.max(round2(budget - projectedCommitted), 0).toFixed(2)}`
        });
      }
    }

    const basePayload = {
      customer_id: nextLoan.customerId,
      type: nextLoan.type,
      principal: nextLoan.principal,
      interest_rate: nextLoan.interestRate,
      term_months: nextLoan.termMonths,
      start_date: nextLoan.startDate
    };

    const payloadWithOptional = {
      ...basePayload,
      interest_rate_mode: nextLoan.interestRateMode,
      payment_model: nextLoan.paymentModel,
      principal_outstanding: nextLoan.principalOutstanding
    };

    const { error: updateError } = await supabase
      .from("loans")
      .update(payloadWithOptional)
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId);

    if (updateError) {
      const { error: retryError } = await supabase
        .from("loans")
        .update(basePayload)
        .eq("id", loanId)
        .eq("tenant_id", req.user.tenantId);

      if (retryError) {
        throw retryError;
      }
    }

    if (nextLoan.customerId !== existingLoan.customerId) {
      const { error: paymentsCustomerError } = await supabase
        .from("payments")
        .update({ customer_id: nextLoan.customerId })
        .eq("loan_id", loanId)
        .eq("tenant_id", req.user.tenantId);

      if (paymentsCustomerError) {
        throw paymentsCustomerError;
      }

      const { error: promisesCustomerError } = await supabase
        .from("payment_promises")
        .update({ customer_id: nextLoan.customerId })
        .eq("loan_id", loanId)
        .eq("tenant_id", req.user.tenantId);

      if (promisesCustomerError) {
        throw promisesCustomerError;
      }

      const { error: notesCustomerError } = await supabase
        .from("collection_notes")
        .update({ customer_id: nextLoan.customerId })
        .eq("loan_id", loanId)
        .eq("tenant_id", req.user.tenantId);

      if (notesCustomerError) {
        throw notesCustomerError;
      }
    }

    const nextState = await readStateForUser(req.user);
    const updatedLoan = (nextState.loans || []).find((item) => String(item.id) === loanId);

    return res.json({
      loan: updatedLoan || {
        ...nextLoan,
        paidAmount: existingLoan.paidAmount,
        status: existingLoan.status
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/payments", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ payments: state.payments });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const loanId = String(req.body.loanId || "").trim();
    const date = String(req.body.date || "").trim();
    const rawAmount = round2(parseNumericInput(req.body.amount, NaN));
    const rawBaseAmount = round2(parseNumericInput(req.body.baseAmount, NaN));
    const rawPrincipalAmount = round2(parseNumericInput(req.body.principalAmount, NaN));
    const rawInterestAmount = round2(parseNumericInput(req.body.interestAmount, NaN));
    const rawLateFeeAmount = round2(parseNumericInput(req.body.lateFeeAmount, NaN));
    const hasSplitRequest = Number.isFinite(rawBaseAmount) || Number.isFinite(rawLateFeeAmount);
    const hasInterestOnlySplitRequest = Number.isFinite(rawPrincipalAmount) || Number.isFinite(rawInterestAmount) || Number.isFinite(rawLateFeeAmount) || Number.isFinite(rawBaseAmount);
    let baseRequested = Number.isFinite(rawBaseAmount) ? Math.max(rawBaseAmount, 0) : 0;
    let principalRequested = Number.isFinite(rawPrincipalAmount)
      ? Math.max(rawPrincipalAmount, 0)
      : (Number.isFinite(rawBaseAmount) ? Math.max(rawBaseAmount, 0) : 0);
    let interestRequested = Number.isFinite(rawInterestAmount) ? Math.max(rawInterestAmount, 0) : 0;
    let lateFeeRequested = Number.isFinite(rawLateFeeAmount) ? Math.max(rawLateFeeAmount, 0) : 0;
    let amount = hasInterestOnlySplitRequest
      ? round2(principalRequested + interestRequested + lateFeeRequested)
      : rawAmount;
    const method = String(req.body.method || "").trim();
    const note = String(req.body.note || "").trim();

    if (!loanId || !date || !Number.isFinite(amount) || amount <= 0 || !method) {
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }

    const { data: loanRow, error: loanError } = await supabase
      .from("loans")
      .select("id,tenant_id,customer_id,type,principal,interest_rate,term_months,start_date,paid_amount,status,created_at")
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    // Check optional loan columns separately
    const { data: modeResult } = await supabase
      .from("loans")
      .select("interest_rate_mode,payment_model,principal_outstanding")
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (loanError) {
      throw loanError;
    }

    if (!loanRow) {
      return res.status(404).json({ message: "Selecciona un prestamo valido" });
    }

    const loan = {
      id: loanRow.id,
      tenantId: loanRow.tenant_id,
      customerId: loanRow.customer_id,
      type: loanRow.type,
      principal: Number(loanRow.principal || 0),
      interestRate: Number(loanRow.interest_rate || 0),
      interestRateMode: modeResult && modeResult.interest_rate_mode === "monthly" ? "monthly" : "annual",
      paymentModel: normalizePaymentModel(modeResult?.payment_model),
      termMonths: Number(loanRow.term_months || 0),
      startDate: loanRow.start_date,
      paidAmount: Number(loanRow.paid_amount || 0),
      principalOutstanding: Number.isFinite(Number(modeResult?.principal_outstanding)) ? Number(modeResult.principal_outstanding) : null,
      status: loanRow.status || "active"
    };

    const { data: customerRow } = await supabase
      .from("customers")
      .select("name")
      .eq("id", loan.customerId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();
    const customerName = String(customerRow?.name || "").trim() || "Cliente";

    const { data: tenantSettingsRow, error: tenantSettingsError } = await supabase
      .from("tenant_settings")
      .select("late_penalty_rate,grace_days")
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (tenantSettingsError && tenantSettingsError.code !== "PGRST116") {
      throw tenantSettingsError;
    }

    const loanSettings = {
      latePenaltyRate: Number(tenantSettingsRow?.late_penalty_rate || 0),
      graceDays: Number(tenantSettingsRow?.grace_days || 0)
    };

    const { data: existingPayments, error: existingPaymentsError } = await supabase
      .from("payments")
      .select("id,date,amount,note,created_at")
      .eq("loan_id", loan.id)
      .eq("tenant_id", req.user.tenantId);

    if (existingPaymentsError) {
      throw existingPaymentsError;
    }

    const referenceDate = startOfDay(toDate(date));
    if (Number.isNaN(referenceDate.getTime())) {
      return res.status(400).json({ message: "Fecha de pago invalida" });
    }

    const mappedPayments = (existingPayments || []).map((paymentRow) => mapPaymentRow({
      ...paymentRow,
      tenant_id: req.user.tenantId,
      loan_id: loan.id,
      customer_id: loan.customerId
    }));

    if (isInterestOnlyBalloonLoan(loan)) {
      const snapshotBefore = interestOnlySnapshotAtDate(loan, loanSettings, mappedPayments, referenceDate);
      if (!snapshotBefore) {
        return res.status(400).json({ message: "No se pudo calcular el estado del prestamo para aplicar el pago." });
      }

      const principalOutstanding = Math.max(round2(snapshotBefore.principalOutstanding), 0);
      const interestDue = Math.max(round2(snapshotBefore.interestOutstanding), 0);
      const interestLateFeeDue = Math.max(round2(snapshotBefore.interestLateFeeOutstanding || 0), 0);
      const principalLateFeeDue = Math.max(round2(snapshotBefore.principalLateFeeOutstanding || 0), 0);
      const lateFeeDue = Math.max(round2(snapshotBefore.lateFeeOutstanding), 0);
      const maturityPrincipalDue = Math.max(round2(snapshotBefore.maturityPrincipalDue), 0);

      if (!hasInterestOnlySplitRequest) {
        let remaining = Math.max(round2(amount), 0);
        lateFeeRequested = round2(Math.min(remaining, lateFeeDue));
        remaining = round2(remaining - lateFeeRequested);
        interestRequested = round2(Math.min(remaining, interestDue));
        remaining = round2(remaining - interestRequested);
        principalRequested = round2(Math.min(remaining, principalOutstanding));
      } else {
        amount = round2(principalRequested + interestRequested + lateFeeRequested);
      }

      if (interestRequested > interestDue + 0.01) {
        return res.status(400).json({ message: `El interes excede el pendiente de intereses vencidos (${interestDue.toFixed(2)}).` });
      }

      if (lateFeeRequested > lateFeeDue + 0.01) {
        return res.status(400).json({ message: `La mora excede el pendiente de mora (${lateFeeDue.toFixed(2)}).` });
      }

      if (principalRequested > principalOutstanding + 0.01) {
        return res.status(400).json({ message: `El abono a capital excede el capital pendiente (${principalOutstanding.toFixed(2)}).` });
      }

      amount = round2(principalRequested + interestRequested + lateFeeRequested);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "El pago no tiene monto aplicable" });
      }

      const principalApplied = round2(Math.min(principalRequested, principalOutstanding));
      const interestApplied = round2(Math.min(interestRequested, interestDue));
      const lateFeeApplied = round2(Math.min(lateFeeRequested, lateFeeDue));
      const targetPrincipalOutstanding = Math.max(round2(principalOutstanding - principalApplied), 0);
      const targetPaidAmount = round2(Math.max(Number(loan.principal || 0) - targetPrincipalOutstanding, 0));

      const paymentMeta = {
        v: 1,
        alloc: {
          paymentModel: PAYMENT_MODEL_INTEREST_ONLY_BALLOON,
          baseAmount: principalApplied,
          principalAmount: principalApplied,
          interestAmount: interestApplied,
          lateFeeAmount: lateFeeApplied
        }
      };
      const storedNote = encodePaymentMeta(note, paymentMeta);

      const payment = {
        id: `PAY-${numericId()}`,
        tenantId: req.user.tenantId,
        loanId: loan.id,
        customerId: loan.customerId,
        date,
        amount,
        method,
        note,
        baseAmount: principalApplied,
        principalAmount: principalApplied,
        interestAmount: interestApplied,
        lateFeeAmount: lateFeeApplied,
        paymentModel: PAYMENT_MODEL_INTEREST_ONLY_BALLOON
      };

      const { error } = await supabase.from("payments").insert([
        {
          id: payment.id,
          tenant_id: payment.tenantId,
          loan_id: payment.loanId,
          customer_id: payment.customerId,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          note: storedNote
        }
      ]);

      if (error) {
        throw error;
      }

      const syncPayload = {
        paid_amount: targetPaidAmount,
        status: targetPrincipalOutstanding <= 0.5 ? "paid" : loan.status
      };

      let syncResult = await supabase
        .from("loans")
        .update({
          ...syncPayload,
          principal_outstanding: targetPrincipalOutstanding
        })
        .eq("id", loan.id)
        .eq("tenant_id", req.user.tenantId);

      if (syncResult.error) {
        syncResult = await supabase
          .from("loans")
          .update(syncPayload)
          .eq("id", loan.id)
          .eq("tenant_id", req.user.tenantId);
      }

      if (syncResult.error) {
        throw syncResult.error;
      }

      await sendPushPayloadToTenant(req.user.tenantId, buildPaymentReceivedPushPayload(payment, {
        customerName,
        loanId: loan.id,
        customerId: loan.customerId
      }), {
        deliveryType: PUSH_DELIVERY_TYPE_PAYMENT_RECEIVED,
        eventKey: payment.id,
        deliveryDate: date
      });

      return res.status(201).json({
        payment,
        allocation: {
          paymentModel: PAYMENT_MODEL_INTEREST_ONLY_BALLOON,
          principalOutstandingBefore: principalOutstanding,
          principalOutstandingAfter: targetPrincipalOutstanding,
          interestDueBefore: interestDue,
          interestLateFeeDueBefore: interestLateFeeDue,
          principalLateFeeDueBefore: principalLateFeeDue,
          lateFeeDueBefore: lateFeeDue,
          maturityPrincipalDueBefore: maturityPrincipalDue,
          principalRequested,
          interestRequested,
          lateFeeRequested,
          principalApplied,
          interestApplied,
          lateFeeApplied
        }
      });
    }

    const penaltyBefore = loanPenaltySnapshotAtDate(loan, loanSettings, existingPayments || [], referenceDate);
    const lateFeeDue = Math.max(round2(penaltyBefore.lateFeeOutstanding), 0);

    const outstanding = loanOutstanding(loan);
    const totalDue = round2(outstanding + lateFeeDue);

    if (!hasSplitRequest) {
      baseRequested = Math.min(Math.max(amount, 0), outstanding);
      lateFeeRequested = round2(Math.max(amount - baseRequested, 0));
    }

    if (baseRequested > outstanding + 0.01) {
      return res.status(400).json({ message: `La cuota/base excede el saldo pendiente (${outstanding.toFixed(2)}).` });
    }

    if (lateFeeRequested > lateFeeDue + 0.01) {
      return res.status(400).json({ message: `La mora excede el pendiente de mora (${lateFeeDue.toFixed(2)}).` });
    }

    if (amount > totalDue + 0.01) {
      return res.status(400).json({
        message: `El monto excede el saldo total pendiente (${totalDue.toFixed(2)}), incluyendo mora.`
      });
    }

    const baseApplied = round2(Math.min(baseRequested, outstanding));
    const lateFeeAppliedToCarry = round2(Math.min(lateFeeRequested, penaltyBefore.carryOutstanding));
    const lateFeeAppliedToCurrent = round2(Math.min(lateFeeRequested - lateFeeAppliedToCarry, penaltyBefore.currentEpisodeLateFeeOutstanding));
    const lateFeeApplied = round2(lateFeeAppliedToCarry + lateFeeAppliedToCurrent);
    amount = round2(baseApplied + lateFeeApplied);

    if (amount <= 0) {
      return res.status(400).json({ message: "El pago no tiene monto aplicable" });
    }

    const targetPaidAmount = round2(Math.min(Number(loan.paidAmount || 0) + baseApplied, loanTotalPayable(loan)));
    const loanAfterPayment = {
      ...loan,
      paidAmount: targetPaidAmount
    };

    const carryAfterLatePayment = Math.max(round2(penaltyBefore.carryOutstanding - lateFeeAppliedToCarry), 0);
    const currentEpisodeLateFeePaidAfterPayment = round2(penaltyBefore.currentEpisodeLateFeePaid + lateFeeAppliedToCurrent);
    const currentEpisodeOutstandingAfterPayment = Math.max(round2(penaltyBefore.currentEpisodeAccrued - currentEpisodeLateFeePaidAfterPayment), 0);
    const episodeAfter = loanInstallmentNumber(loanAfterPayment);
    const episodeClosed = episodeAfter !== penaltyBefore.episodeNumber;
    const lateFeeCarryAfter = episodeClosed
      ? round2(carryAfterLatePayment + currentEpisodeOutstandingAfterPayment)
      : carryAfterLatePayment;
    const lateFeeEpisodeLatePaidAfter = episodeClosed ? 0 : currentEpisodeLateFeePaidAfterPayment;

    const paymentMeta = {
      v: 1,
      alloc: {
        paymentModel: PAYMENT_MODEL_LEGACY,
        baseAmount: baseApplied,
        principalAmount: baseApplied,
        interestAmount: 0,
        lateFeeAmount: lateFeeApplied
      },
      penalty: {
        carryAfter: lateFeeCarryAfter,
        episodeNumberAfter: episodeAfter,
        episodeLateFeePaidAfter: lateFeeEpisodeLatePaidAfter
      }
    };
    const storedNote = encodePaymentMeta(note, paymentMeta);

    const payment = {
      id: `PAY-${numericId()}`,
      tenantId: req.user.tenantId,
      loanId: loan.id,
      customerId: loan.customerId,
      date,
      amount,
      method,
      note,
      baseAmount: baseApplied,
      lateFeeAmount: lateFeeApplied,
      lateFeeCarryAfter,
      lateFeeEpisodeNumberAfter: episodeAfter,
      lateFeeEpisodeLatePaidAfter
    };

    const { error } = await supabase.from("payments").insert([
      {
        id: payment.id,
        tenant_id: payment.tenantId,
        loan_id: payment.loanId,
        customer_id: payment.customerId,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        note: storedNote
      }
    ]);

    if (error) {
      throw error;
    }

    const { data: updatedLoan, error: updatedLoanError } = await supabase
      .from("loans")
      .select("paid_amount")
      .eq("id", loan.id)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (updatedLoanError) {
      throw updatedLoanError;
    }

    const paidAfterInsert = Number((updatedLoan && updatedLoan.paid_amount) || 0);
    if (Math.abs(paidAfterInsert - targetPaidAmount) > 0.01) {
      const { error: syncError } = await supabase
        .from("loans")
        .update({ paid_amount: targetPaidAmount })
        .eq("id", loan.id)
        .eq("tenant_id", req.user.tenantId);

      if (syncError) {
        throw syncError;
      }
    }

    await sendPushPayloadToTenant(req.user.tenantId, buildPaymentReceivedPushPayload(payment, {
      customerName,
      loanId: loan.id,
      customerId: loan.customerId
    }), {
      deliveryType: PUSH_DELIVERY_TYPE_PAYMENT_RECEIVED,
      eventKey: payment.id,
      deliveryDate: date
    });

    return res.status(201).json({
      payment,
      allocation: {
        paymentModel: PAYMENT_MODEL_LEGACY,
        totalDueBefore: totalDue,
        outstandingBefore: outstanding,
        lateFeeDueBefore: lateFeeDue,
        carryBefore: penaltyBefore.carryOutstanding,
        currentEpisodeLateFeeBefore: penaltyBefore.currentEpisodeLateFeeOutstanding,
        baseRequested,
        lateFeeRequested,
        lateFeeApplied,
        baseApplied,
        lateFeeCarryAfter,
        episodeClosed
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/payments/:id/receipt.pdf", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const paymentId = String(req.params.id || "").trim();
    if (!paymentId) {
      return res.status(400).json({ message: "Pago invalido" });
    }

    const receiptContext = await buildPaymentReceiptContext(req.user, paymentId);
    if (!receiptContext) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const pdfBuffer = await generatePaymentReceiptPdfBuffer(receiptContext);
    const fileName = `comprobante-${paymentId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/payments/:id/send-receipt", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const paymentId = String(req.params.id || "").trim();
    if (!paymentId) {
      return res.status(400).json({ message: "Pago invalido" });
    }

    if (!HAS_RESEND_CONFIG) {
      return res.status(503).json({
        message: "El envio de comprobantes no esta configurado. Falta RESEND_API_KEY o RESEND_FROM_EMAIL."
      });
    }

    const receiptContext = await buildPaymentReceiptContext(req.user, paymentId);
    if (!receiptContext) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const customerEmail = String(receiptContext?.customer?.email || "").trim();
    if (!customerEmail) {
      return res.status(400).json({ message: "El deudor no tiene un email registrado" });
    }

    const pdfBuffer = await generatePaymentReceiptPdfBuffer(receiptContext);
    const fileName = `comprobante-${paymentId}.pdf`;
    const emailHtml = buildPaymentReceiptEmailHtml(receiptContext);
    const subject = `Comprobante de pago ${paymentId}`;

    await sendEmailViaResend({
      to: [customerEmail],
      subject,
      html: emailHtml,
      text: `Adjuntamos tu comprobante de pago ${paymentId}.`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer.toString("base64")
        }
      ]
    });

    return res.status(200).json({
      ok: true,
      sentTo: customerEmail,
      paymentId,
      message: "Comprobante enviado al deudor"
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/payment-promises", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ paymentPromises: state.paymentPromises || [] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payment-promises", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const loanId = String(req.body.loanId || "").trim();
    const customerId = String(req.body.customerId || "").trim();
    const promisedDate = String(req.body.promisedDate || "").trim();
    const promisedAmount = round2(parseNumericInput(req.body.promisedAmount, NaN));
    const note = String(req.body.note || "").trim();
    const status = normalizePromiseStatus(req.body.status || "pending");

    if (!loanId || !customerId || !promisedDate || promisedAmount <= 0) {
      return res.status(400).json({ message: "Completa los datos de la promesa de pago" });
    }

    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select("id,customer_id")
      .eq("id", loanId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (loanError) {
      throw loanError;
    }

    if (!loan || String(loan.customer_id) !== customerId) {
      return res.status(400).json({ message: "Selecciona un prestamo valido para el cliente" });
    }

    const promise = {
      id: `PRM-${numericId()}`,
      tenantId: req.user.tenantId,
      loanId,
      customerId,
      promisedDate,
      promisedAmount,
      status,
      note,
      createdBy: req.user.id,
      resolvedAt: status === "pending" ? null : isoNow()
    };

    const { error } = await supabase
      .from("payment_promises")
      .insert([
        {
          id: promise.id,
          tenant_id: promise.tenantId,
          loan_id: promise.loanId,
          customer_id: promise.customerId,
          promised_date: promise.promisedDate,
          promised_amount: promise.promisedAmount,
          status: promise.status,
          note: promise.note,
          created_by: promise.createdBy,
          resolved_at: promise.resolvedAt
        }
      ]);

    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.status(503).json({ message: "Tabla de promesas no encontrada. Ejecuta supabase_schema.sql para habilitar Fase 2." });
      }
      throw error;
    }

    return res.status(201).json({ paymentPromise: promise });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/payment-promises/:id/status", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const promiseId = String(req.params.id || "").trim();
    const rawStatus = String(req.body.status || "").trim().toLowerCase();
    const status = normalizePromiseStatus(rawStatus);

    if (!promiseId || !PAYMENT_PROMISE_STATUSES.has(rawStatus)) {
      return res.status(400).json({ message: "Actualizacion de promesa invalida" });
    }

    const patch = {
      status,
      resolved_at: status === "pending" ? null : isoNow(),
      updated_at: isoNow()
    };

    const { data, error } = await supabase
      .from("payment_promises")
      .update(patch)
      .eq("id", promiseId)
      .eq("tenant_id", req.user.tenantId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.status(503).json({ message: "Tabla de promesas no encontrada. Ejecuta supabase_schema.sql para habilitar Fase 2." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Promesa de pago no encontrada" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/collection-notes", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const customerId = String(req.query.customerId || "").trim();
    const loanId = String(req.query.loanId || "").trim();
    let query = supabase
      .from("collection_notes")
      .select("id,tenant_id,customer_id,loan_id,body,created_by,created_at")
      .eq("tenant_id", req.user.tenantId)
      .order("created_at", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (loanId) {
      query = query.eq("loan_id", loanId);
    }

    const { data, error } = await query;
    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.json({ notes: [] });
      }
      throw error;
    }

    const notes = (data || []).map((entry) => ({
      id: entry.id,
      tenantId: entry.tenant_id,
      customerId: entry.customer_id,
      loanId: entry.loan_id || "",
      body: entry.body,
      createdBy: entry.created_by || "",
      createdAt: entry.created_at
    }));

    return res.json({ notes });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/collection-notes", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const customerId = String(req.body.customerId || "").trim();
    const loanId = String(req.body.loanId || "").trim();
    const body = String(req.body.body || "").trim();

    if (!customerId || !body) {
      return res.status(400).json({ message: "Completa el cliente y la nota" });
    }

    if (body.length > 1200) {
      return res.status(400).json({ message: "La nota es demasiado extensa" });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return res.status(400).json({ message: "Selecciona un cliente valido" });
    }

    if (loanId) {
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .select("id")
        .eq("id", loanId)
        .eq("tenant_id", req.user.tenantId)
        .eq("customer_id", customerId)
        .maybeSingle();

      if (loanError) {
        throw loanError;
      }

      if (!loan) {
        return res.status(400).json({ message: "El prestamo no coincide con el cliente seleccionado" });
      }
    }

    const note = {
      id: `NOT-${numericId()}`,
      tenantId: req.user.tenantId,
      customerId,
      loanId: loanId || null,
      body,
      createdBy: req.user.id
    };

    const { error } = await supabase
      .from("collection_notes")
      .insert([
        {
          id: note.id,
          tenant_id: note.tenantId,
          customer_id: note.customerId,
          loan_id: note.loanId,
          body: note.body,
          created_by: note.createdBy
        }
      ]);

    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.status(503).json({ message: "Tabla de notas no encontrada. Ejecuta supabase_schema.sql para habilitar Fase 2." });
      }
      throw error;
    }

    return res.status(201).json({ note: { ...note, loanId: note.loanId || "" } });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/notifications", requireAuth, async (req, res, next) => {
  try {
    const status = String(req.query.status || "all").trim().toLowerCase();
    const severity = String(req.query.severity || "all").trim().toLowerCase();
    const limit = Math.min(Math.max(parseNumericInput(req.query.limit, 60), 1), 200);

    const state = await readStateForUser(req.user);
    const allNotifications = Array.isArray(state.notifications) ? state.notifications : [];

    const notifications = allNotifications
      .filter((notification) => {
        if (status !== "all" && notification.status !== status) {
          return false;
        }

        if (severity !== "all" && notification.severity !== severity) {
          return false;
        }

        return true;
      })
      .slice(0, limit);

    const unread = allNotifications.filter((notification) => notification.status === "unread").length;
    const criticalUnread = allNotifications.filter(
      (notification) => notification.status === "unread" && notification.severity === "critical"
    ).length;

    return res.json({ notifications, unread, criticalUnread });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) {
      return res.status(400).json({ message: "Notificacion invalida" });
    }

    const now = isoNow();
    let query = supabase
      .from("notifications")
      .update({ status: "read", read_at: now, updated_at: now })
      .eq("id", notificationId);

    query = isSuperadminRole(req.user.role)
      ? query
      : query
        .eq("tenant_id", req.user.tenantId)
        .neq("type", "tenant_signup_alert");

    const { data, error } = await query.select("id").maybeSingle();

    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.status(503).json({ message: "Tabla de notificaciones no encontrada. Ejecuta supabase_schema.sql para habilitar Fase 3." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Notificacion no encontrada" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/notifications/read-all", requireAuth, async (req, res, next) => {
  try {
    const now = isoNow();
    let query = supabase
      .from("notifications")
      .update({ status: "read", read_at: now, updated_at: now })
      .eq("status", "unread");

    query = isSuperadminRole(req.user.role)
      ? query.or("tenant_id.is.null,type.eq.tenant_signup_alert")
      : query
        .eq("tenant_id", req.user.tenantId)
        .neq("type", "tenant_signup_alert");

    const { error } = await query;

    if (error) {
      if (String(error.code || "") === "42P01") {
        return res.status(503).json({ message: "Tabla de notificaciones no encontrada. Ejecuta supabase_schema.sql para habilitar Fase 3." });
      }
      throw error;
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/push/status", requireAuth, async (req, res, next) => {
  try {
    const scopedTenantId = await resolvePreferredPushTenantScopeForUser(req.user);
    let query = supabase
      .from("push_subscriptions")
      .select("id,timezone,updated_at")
      .eq("user_id", req.user.id)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(3);

    query = scopedTenantId ? query.eq("tenant_id", scopedTenantId) : query.is("tenant_id", null);
    const { data, error } = await query;

    if (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({
          message: "Tablas de push no encontradas. Ejecuta supabase_schema.sql para habilitar notificaciones push.",
          push: {
            configured: HAS_WEB_PUSH_CONFIG,
            supportedByDevice: isPushSubscriptionCompatible(req),
            enabled: false,
            subscriptionCount: 0,
            timezone: "America/Santo_Domingo",
            vapidPublicKey: HAS_WEB_PUSH_CONFIG ? PUSH_VAPID_PUBLIC_KEY : ""
          }
        });
      }
      throw error;
    }

    const active = Array.isArray(data) ? data : [];
    return res.json({
      push: {
        configured: HAS_WEB_PUSH_CONFIG,
        supportedByDevice: isPushSubscriptionCompatible(req),
        enabled: active.length > 0,
        subscriptionCount: active.length,
        timezone: sanitizePushTimezone(active[0]?.timezone, "America/Santo_Domingo"),
        vapidPublicKey: HAS_WEB_PUSH_CONFIG ? PUSH_VAPID_PUBLIC_KEY : ""
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/push/subscribe", requireAuth, async (req, res, next) => {
  try {
    if (!HAS_WEB_PUSH_CONFIG) {
      return res.status(503).json({ message: "Push no configurado en el servidor. Define PUSH_VAPID_PUBLIC_KEY y PUSH_VAPID_PRIVATE_KEY." });
    }

    const subscription = sanitizePushSubscriptionInput(req.body?.subscription || req.body);
    if (!subscription) {
      return res.status(400).json({ message: "Suscripcion push invalida." });
    }

    const timezone = sanitizePushTimezone(req.body?.timezone, "America/Santo_Domingo");
    const deviceLabel = sanitizeDeviceLabel(req.body?.deviceLabel);
    const userAgent = String(req.get("user-agent") || "").slice(0, 255);
    const endpointHash = pushSubscriptionDeviceHash(subscription);
    const now = isoNow();
    const scopedTenantId = await resolvePreferredPushTenantScopeForUser(req.user);
    const id = `PSH-${crypto
      .createHash("sha256")
      .update(`${scopedTenantId || "platform"}|${req.user.id}|${endpointHash}`)
      .digest("hex")
      .slice(0, 24)}`;

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        [
          {
            id,
            tenant_id: scopedTenantId,
            user_id: req.user.id,
            endpoint: subscription.endpoint,
            endpoint_hash: endpointHash,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            expiration_time: subscription.expirationTime,
            user_agent: userAgent,
            device_label: deviceLabel,
            timezone,
            enabled: true,
            last_seen_at: now,
            updated_at: now
          }
        ],
        { onConflict: "id" }
      );

    if (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ message: "Tablas de push no encontradas. Ejecuta supabase_schema.sql para habilitar notificaciones push." });
      }
      throw error;
    }

    return res.status(201).json({
      ok: true,
      push: {
        configured: true,
        enabled: true,
        timezone,
        vapidPublicKey: PUSH_VAPID_PUBLIC_KEY
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/push/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint || "").trim();
    const now = isoNow();
    const scopedTenantId = await resolvePreferredPushTenantScopeForUser(req.user);
    let query = supabase
      .from("push_subscriptions")
      .update({ enabled: false, updated_at: now })
      .eq("user_id", req.user.id)
      .eq("enabled", true);

    query = scopedTenantId ? query.eq("tenant_id", scopedTenantId) : query.is("tenant_id", null);

    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    const { data, error } = await query.select("id");
    if (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ message: "Tablas de push no encontradas. Ejecuta supabase_schema.sql para habilitar notificaciones push." });
      }
      throw error;
    }

    return res.json({ ok: true, disabled: Array.isArray(data) ? data.length : 0 });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/push/test", requireAuth, async (req, res, next) => {
  try {
    if (!HAS_WEB_PUSH_CONFIG) {
      return res.status(503).json({ message: "Push no configurado en el servidor. Define PUSH_VAPID_PUBLIC_KEY y PUSH_VAPID_PRIVATE_KEY." });
    }

    const scopedTenantId = await resolvePreferredPushTenantScopeForUser(req.user);
    const subscriptions = await listPushSubscriptionsForUser(scopedTenantId, req.user.id);
    if (subscriptions === null) {
      return res.status(503).json({ message: "Tablas de push no encontradas. Ejecuta supabase_schema.sql para habilitar notificaciones push." });
    }
    if (subscriptions.length === 0) {
      return res.status(400).json({ message: "No hay dispositivos push activos para este usuario." });
    }

    const timezone = sanitizePushTimezone(req.body?.timezone || subscriptions[0]?.timezone, "America/Santo_Domingo");
    let payload;
    if (isSuperadminRole(req.user.role)) {
      payload = buildPushPayloadFromNotification({
        code: `push-test-${Date.now()}`,
        type: "tenant_signup_alert",
        title: "Prueba push de superadmin",
        message: "Las notificaciones push para nuevos clientes estan activas en este dispositivo.",
        entityId: "TEN-DEMO",
        meta: {
          tenantId: "TEN-DEMO",
          tenantName: "Cliente de prueba",
          ownerEmail: req.user.email || ""
        }
      });
    } else {
      const state = await readStateForUser(req.user);
      const summary = buildDailyCollectionSummaryFromState(state, timezone, new Date());
      payload = buildPushPayload(summary, req.user.tenantName || "CrediSync");
    }

    const results = await Promise.all(subscriptions.map((entry) => sendPushToSubscription(entry, payload)));
    const counters = summarizePushSendResults(results);

    return res.json({
      ok: counters.sent > 0,
      sent: counters.sent,
      failed: counters.failed,
      message: counters.sent > 0 ? "Notificacion de prueba enviada." : "No se pudo enviar la notificacion de prueba."
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/jobs/push-daily-summary", requirePushDailyJobToken, async (req, res, next) => {
  try {
    const result = await runPushDailySummaryJob({ now: req.body?.at ? new Date(req.body.at) : undefined });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/user-calendar", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    if (!parseBooleanInput(req.subscription?.features?.calendarIcsEnabled, true)) {
      return res.status(403).json({
        message: "Tu plan actual no incluye sincronizacion de calendario ICS."
      });
    }

    const integration = await ensureUserCalendarIntegration(req.user.id, req.user.tenantId);
    if (!integration) {
      return res.status(503).json({
        message: "Tabla de calendario por usuario no encontrada. Ejecuta supabase_schema.sql para habilitar sincronizacion ICS."
      });
    }

    const urls = buildCalendarFeedUrls(req, integration.feedToken);
    return res.json({
      calendar: {
        enabled: integration.enabled,
        timezone: integration.timezone
      },
      feedUrl: urls.feedUrl,
      webcalUrl: urls.webcalUrl
    });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/user-calendar", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    if (!parseBooleanInput(req.subscription?.features?.calendarIcsEnabled, true)) {
      return res.status(403).json({
        message: "Tu plan actual no incluye sincronizacion de calendario ICS."
      });
    }

    const current = await ensureUserCalendarIntegration(req.user.id, req.user.tenantId);
    if (!current) {
      return res.status(503).json({
        message: "Tabla de calendario por usuario no encontrada. Ejecuta supabase_schema.sql para habilitar sincronizacion ICS."
      });
    }

    const payload = sanitizeUserCalendarIntegrationInput(
      {
        enabled: req.body.enabled,
        timezone: req.body.timezone,
        feedToken: current.feedToken
      },
      current
    );

    const { data, error } = await supabase
      .from("user_calendar_integrations")
      .upsert(
        {
          user_id: req.user.id,
          tenant_id: req.user.tenantId,
          enabled: payload.enabled,
          timezone: payload.timezone,
          feed_token: payload.feedToken,
          updated_at: isoNow()
        },
        { onConflict: "user_id" }
      )
      .select("enabled,timezone,feed_token")
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({
          message: "Tabla de calendario por usuario no encontrada. Ejecuta supabase_schema.sql para habilitar sincronizacion ICS."
        });
      }
      throw error;
    }

    const integration = sanitizeUserCalendarIntegrationInput(
      {
        enabled: data?.enabled,
        timezone: data?.timezone,
        feedToken: data?.feed_token || payload.feedToken
      },
      payload
    );

    const urls = buildCalendarFeedUrls(req, integration.feedToken);
    return res.json({
      calendar: {
        enabled: integration.enabled,
        timezone: integration.timezone
      },
      feedUrl: urls.feedUrl,
      webcalUrl: urls.webcalUrl
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/user-calendar/rotate-token", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    if (!parseBooleanInput(req.subscription?.features?.calendarIcsEnabled, true)) {
      return res.status(403).json({
        message: "Tu plan actual no incluye sincronizacion de calendario ICS."
      });
    }

    const current = await ensureUserCalendarIntegration(req.user.id, req.user.tenantId);
    if (!current) {
      return res.status(503).json({
        message: "Tabla de calendario por usuario no encontrada. Ejecuta supabase_schema.sql para habilitar sincronizacion ICS."
      });
    }

    const newToken = buildCalendarFeedToken();
    const { data, error } = await supabase
      .from("user_calendar_integrations")
      .upsert(
        {
          user_id: req.user.id,
          tenant_id: req.user.tenantId,
          enabled: current.enabled,
          timezone: current.timezone,
          feed_token: newToken,
          updated_at: isoNow()
        },
        { onConflict: "user_id" }
      )
      .select("enabled,timezone,feed_token")
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({
          message: "Tabla de calendario por usuario no encontrada. Ejecuta supabase_schema.sql para habilitar sincronizacion ICS."
        });
      }
      throw error;
    }

    const integration = sanitizeUserCalendarIntegrationInput(
      {
        enabled: data?.enabled,
        timezone: data?.timezone,
        feedToken: data?.feed_token || newToken
      },
      current
    );

    const urls = buildCalendarFeedUrls(req, integration.feedToken);
    return res.json({
      calendar: {
        enabled: integration.enabled,
        timezone: integration.timezone
      },
      feedUrl: urls.feedUrl,
      webcalUrl: urls.webcalUrl
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/subscription/summary", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    const subscription = state.subscription || (await ensureTenantSubscription(req.user.tenantId));
    const [invoices, payments] = await Promise.all([
      listInvoicesForTenant(req.user.tenantId, 12),
      listPaymentsForTenant(req.user.tenantId, 25)
    ]);

    return res.json({
      subscription,
      invoices,
      payments
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/subscription/current", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const subscription = await ensureTenantSubscription(req.user.tenantId);
    return res.json({ subscription });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/subscription/payments", requireAuth, requireTenantUser, async (req, res, next) => {
  return res.status(410).json({
    message: "El reporte de pagos por tenant esta deshabilitado. Contacta al superadministrador para gestionar cambios de plan."
  });
});

app.get("/api/superadmin/plans", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const plans = await ensureDefaultSubscriptionPlans();
    return res.json({ plans });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/superadmin/plans", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const priceMonthly = round2(parseNumericInput(req.body.priceMonthly, NaN));
    const currency = normalizeCurrency(req.body.currency, DEFAULT_SUBSCRIPTION_CURRENCY);
    const isActive = parseBooleanInput(req.body.isActive, true);
    const billingCycle = String(req.body.billingCycle || DEFAULT_SUBSCRIPTION_CYCLE).trim().toLowerCase() || DEFAULT_SUBSCRIPTION_CYCLE;
    const features = normalizePlanFeatures(req.body.features || {});
    const limits = normalizePlanLimits(req.body.limits || {});

    if (!code || !name || priceMonthly < 0) {
      return res.status(400).json({ message: "Completa codigo, nombre y precio del plan" });
    }

    const payload = {
      id: `PLAN-${numericId()}`,
      code,
      name,
      description,
      price_monthly: priceMonthly,
      currency,
      billing_cycle: billingCycle,
      is_active: isActive,
      features,
      limits
    };

    const { data, error } = await supabase
      .from("subscription_plans")
      .insert([payload])
      .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      if (String(error.code || "") === "23505") {
        return res.status(409).json({ message: "Ya existe un plan con ese codigo" });
      }
      throw error;
    }

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "subscription_plan_created",
      entityType: "subscription_plan",
      entityId: payload.id,
      afterData: payload
    });

    invalidateSubscriptionPlanCache();

    return res.status(201).json({ plan: mapPlanRow(data, payload) });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/superadmin/plans/:id", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const planId = String(req.params.id || "").trim();
    if (!planId) {
      return res.status(400).json({ message: "Plan invalido" });
    }

    const { data: previousRow, error: previousError } = await supabase
      .from("subscription_plans")
      .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
      .eq("id", planId)
      .maybeSingle();

    if (previousError) {
      if (["42P01", "42703"].includes(String(previousError.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw previousError;
    }

    if (!previousRow) {
      return res.status(404).json({ message: "Plan no encontrado" });
    }

    const previousPlan = mapPlanRow(previousRow);
    const nextPlan = {
      ...previousPlan,
      code: String(req.body.code || previousPlan.code).trim().toLowerCase(),
      name: String(req.body.name || previousPlan.name).trim(),
      description: String(req.body.description || previousPlan.description || "").trim(),
      priceMonthly: round2(parseNumericInput(req.body.priceMonthly, previousPlan.priceMonthly)),
      currency: normalizeCurrency(req.body.currency, previousPlan.currency),
      billingCycle: String(req.body.billingCycle || previousPlan.billingCycle).trim().toLowerCase() || DEFAULT_SUBSCRIPTION_CYCLE,
      isActive: parseBooleanInput(req.body.isActive, previousPlan.isActive),
      features: normalizePlanFeatures(req.body.features || previousPlan.features),
      limits: normalizePlanLimits(req.body.limits || previousPlan.limits)
    };

    if (!nextPlan.code || !nextPlan.name || nextPlan.priceMonthly < 0) {
      return res.status(400).json({ message: "Completa codigo, nombre y precio del plan" });
    }

    const { data, error } = await supabase
      .from("subscription_plans")
      .update({
        code: nextPlan.code,
        name: nextPlan.name,
        description: nextPlan.description,
        price_monthly: nextPlan.priceMonthly,
        currency: nextPlan.currency,
        billing_cycle: nextPlan.billingCycle,
        is_active: nextPlan.isActive,
        features: nextPlan.features,
        limits: nextPlan.limits,
        updated_at: isoNow()
      })
      .eq("id", planId)
      .select("id,code,name,description,price_monthly,currency,billing_cycle,is_active,features,limits,created_at,updated_at")
      .maybeSingle();

    if (error) {
      if (String(error.code || "") === "23505") {
        return res.status(409).json({ message: "Ya existe un plan con ese codigo" });
      }
      throw error;
    }

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "subscription_plan_updated",
      entityType: "subscription_plan",
      entityId: planId,
      beforeData: previousPlan,
      afterData: nextPlan
    });

    invalidateSubscriptionPlanCache();
    await syncAllTenantSubscriptionsToUnifiedPlan();

    return res.json({ plan: mapPlanRow(data, nextPlan) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/subscriptions", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    await syncAllTenantSubscriptionLifecycles({ force: true });

    const [tenantsResult, usersResult, invoicesResult, plans] = await Promise.all([
      supabase.from("tenants").select("id,name,status,created_at"),
      supabase
        .from("users")
        .select("id,email,name,role,status,tenant_id,created_at,last_login_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("billing_invoices")
        .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      ensureDefaultSubscriptionPlans()
    ]);

    if (tenantsResult.error) throw tenantsResult.error;
    if (usersResult.error) throw usersResult.error;
    if (invoicesResult.error && !["42P01", "42703"].includes(String(invoicesResult.error.code || ""))) {
      throw invoicesResult.error;
    }

    const usersByTenant = new Map();

    (usersResult.data || []).forEach((row) => {
      const tenantId = row.tenant_id || null;
      if (!tenantId) {
        return;
      }
      const bucket = usersByTenant.get(tenantId) || [];
      bucket.push(row);
      usersByTenant.set(tenantId, bucket);
    });

    const latestInvoiceByTenant = new Map();
    const billingByTenant = new Map();
    (invoicesResult.data || []).forEach((row) => {
      const invoice = mapInvoiceRow(row);
      if (!latestInvoiceByTenant.has(invoice.tenantId)) {
        latestInvoiceByTenant.set(invoice.tenantId, invoice);
      }

      const bucket = billingByTenant.get(invoice.tenantId) || {
        outstandingBalance: 0,
        overdueBalance: 0,
        unpaidInvoicesCount: 0,
        overdueInvoicesCount: 0
      };

      if (OUTSTANDING_BILLING_INVOICE_STATUSES.has(invoice.status)) {
        bucket.outstandingBalance += Number(invoice.amount || 0);
        bucket.unpaidInvoicesCount += 1;
      }

      if (invoice.status === "overdue") {
        bucket.overdueBalance += Number(invoice.amount || 0);
        bucket.overdueInvoicesCount += 1;
      }

      billingByTenant.set(invoice.tenantId, bucket);
    });

    const subscriptions = [];
    for (const tenant of tenantsResult.data || []) {
      const tenantUsers = usersByTenant.get(tenant.id) || [];
      const isProtected = tenantUsers.some((user) => isSuperadminRole(user.role || ""));
      const ownerUser =
        tenantUsers.find((user) => !isSuperadminRole(user.role || "")) ||
        tenantUsers[0] ||
        null;
      await syncTenantSubscriptionToUnifiedPlan(tenant.id);
      const summary = await ensureTenantSubscription(tenant.id);

      subscriptions.push({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status,
          createdAt: tenant.created_at,
          usersCount: tenantUsers.length,
          ownerName: ownerUser ? ownerUser.name : null,
          ownerEmail: ownerUser ? ownerUser.email : null,
          ownerLastLoginAt: ownerUser ? ownerUser.last_login_at || null : null,
          isProtected
        },
        subscription: summary,
        latestInvoice: latestInvoiceByTenant.get(tenant.id) || null,
        billing: billingByTenant.get(tenant.id) || {
          outstandingBalance: 0,
          overdueBalance: 0,
          unpaidInvoicesCount: 0,
          overdueInvoicesCount: 0
        }
      });
    }

    subscriptions.sort((a, b) => {
      const byName = String(a.tenant.name || "").localeCompare(String(b.tenant.name || ""));
      if (byName !== 0) {
        return byName;
      }

      const byOwner = String(a.tenant.ownerEmail || "").localeCompare(String(b.tenant.ownerEmail || ""));
      if (byOwner !== 0) {
        return byOwner;
      }

      return String(a.tenant.id || "").localeCompare(String(b.tenant.id || ""));
    });

    return res.json({ subscriptions, plans });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/tenants/:tenantId/subscription", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant invalido" });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const [subscription, plans, invoices, payments, usersResult] = await Promise.all([
      ensureTenantSubscription(tenantId),
      ensureDefaultSubscriptionPlans(),
      listInvoicesForTenant(tenantId, 36),
      listPaymentsForTenant(tenantId, 80),
      supabase
        .from("users")
        .select("id,email,name,role,status,last_login_at,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
    ]);

    if (usersResult.error) {
      throw usersResult.error;
    }

    const tenantUsers = usersResult.data || [];
    const ownerUser =
      tenantUsers.find((user) => !isSuperadminRole(user.role || "")) ||
      tenantUsers[0] ||
      null;

    return res.json({
      tenant: {
        ...tenant,
        usersCount: tenantUsers.length,
        ownerName: ownerUser ? ownerUser.name : null,
        ownerEmail: ownerUser ? ownerUser.email : null,
        ownerLastLoginAt: ownerUser ? ownerUser.last_login_at || null : null
      },
      subscription,
      plans,
      invoices,
      payments
    });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/superadmin/tenants/:tenantId/subscription", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant invalido" });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const current = await ensureTenantSubscription(tenantId);
    const selectedPlan = (await ensureDefaultSubscriptionPlans())[0] || defaultSubscriptionPlans()[0];

    const nextStatus = normalizeSubscriptionStatus(req.body.status, current.status);
    const fallbackPeriodStart = String(current.currentPeriodStart || isoToday()).trim() || isoToday();
    const fallbackPeriodEnd = String(current.currentPeriodEnd || buildBillingWindow(fallbackPeriodStart).end).trim()
      || buildBillingWindow(fallbackPeriodStart).end;
    const fallbackNextBilling = String(current.nextBillingDate || fallbackPeriodEnd).trim() || fallbackPeriodEnd;

    const currentPeriodStart = String(req.body.currentPeriodStart || fallbackPeriodStart).trim() || fallbackPeriodStart;
    const currentPeriodEnd = String(req.body.currentPeriodEnd || fallbackPeriodEnd).trim() || fallbackPeriodEnd;
    const nextBillingDate = String(req.body.nextBillingDate || fallbackNextBilling).trim() || fallbackNextBilling;
    const notes = String(req.body.notes == null ? current.notes : req.body.notes).trim();
    const suspendedAt = nextStatus === "suspended" ? (current.suspendedAt || isoNow()) : null;

    const payload = {
      id: current.id || `SUB-${numericId()}`,
      tenant_id: tenantId,
      plan_id: selectedPlan.id,
      status: nextStatus,
      billing_cycle: selectedPlan.billingCycle,
      currency: selectedPlan.currency,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      next_billing_date: nextBillingDate,
      trial_ends_at: null,
      suspended_at: suspendedAt,
      cancelled_at: null,
      notes,
      updated_at: isoNow()
    };

    const { error } = await supabase
      .from("tenant_subscriptions")
      .upsert(payload, { onConflict: "tenant_id" });

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "tenant_subscription_updated",
      entityType: "tenant_subscription",
      entityId: payload.id,
      tenantId,
      beforeData: current,
      afterData: {
        planId: payload.plan_id,
        status: payload.status,
        nextBillingDate: payload.next_billing_date,
        notes: payload.notes
      }
    });

    const updated = await ensureTenantSubscription(tenantId);
    return res.json({ subscription: updated });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/superadmin/tenants/:tenantId/invoices", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant invalido" });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const subscription = await ensureTenantSubscription(tenantId);
    const amount = round2(parseNumericInput(req.body.amount, subscription.priceMonthly || 0));
    const dueDate = String(req.body.dueDate || subscription.nextBillingDate || addDaysToDateKey(isoToday(), 5)).trim();
    const periodStart = String(req.body.periodStart || subscription.currentPeriodStart || isoToday()).trim();
    const periodEnd = String(req.body.periodEnd || subscription.currentPeriodEnd || addDaysToDateKey(periodStart, DEFAULT_BILLING_PERIOD_DAYS)).trim();
    const notes = String(req.body.notes || "").trim() || DEFAULT_BILLING_INVOICE_NOTE;
    const initialInvoiceStatus = dueDate && dueDate < isoToday() ? "overdue" : "pending";

    if (amount <= 0) {
      return res.status(400).json({ message: "El monto de la factura debe ser mayor a cero" });
    }

    const invoicePayload = {
      id: `INV-${numericId()}`,
      tenant_id: tenantId,
      subscription_id: subscription.id || null,
      plan_id: subscription.planId || null,
      period_start: periodStart,
      period_end: periodEnd,
      amount,
      currency: normalizeCurrency(subscription.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
      status: initialInvoiceStatus,
      due_date: dueDate,
      issued_at: isoNow(),
      reference: "",
      notes
    };

    const { data, error } = await supabase
      .from("billing_invoices")
      .insert([invoicePayload])
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "billing_invoice_created",
      entityType: "billing_invoice",
      entityId: invoicePayload.id,
      tenantId,
      afterData: invoicePayload
    });

    const invoice = mapInvoiceRow(data);
    let emailDelivery = {
      attempted: false,
      sent: false,
      sentTo: null,
      message: "Envio automatico deshabilitado"
    };

    if (BILLING_AUTO_EMAIL_ENABLED) {
      try {
        const invoiceEmailContext = await buildBillingInvoiceEmailContext(tenantId, data);
        emailDelivery = {
          attempted: true,
          sent: false,
          sentTo: invoiceEmailContext.ownerEmail || null,
          message: "No se pudo resolver el correo del propietario del tenant"
        };

        if (invoiceEmailContext.ownerEmail) {
          await sendBillingInvoiceEmail(invoiceEmailContext);
          emailDelivery = {
            attempted: true,
            sent: true,
            sentTo: invoiceEmailContext.ownerEmail,
            message: "Factura enviada correctamente al propietario del tenant"
          };
        }
      } catch (emailError) {
        emailDelivery = {
          attempted: true,
          sent: false,
          sentTo: emailDelivery.sentTo,
          message: emailError?.message || "No se pudo enviar la factura por correo"
        };
      }
    }

    return res.status(201).json({ invoice, emailDelivery });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/invoices/:invoiceId/pdf", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      return res.status(400).json({ message: "Factura invalida" });
    }

    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const invoiceContext = await buildBillingInvoiceEmailContext(data.tenant_id, data);
    const pdfBuffer = await generateBillingInvoicePdfBuffer(invoiceContext);
    const fileName = `factura-${invoiceId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/invoice-pdf/:invoiceId", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      return res.status(400).json({ message: "Factura invalida" });
    }

    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const invoiceContext = await buildBillingInvoiceEmailContext(data.tenant_id, data);
    const pdfBuffer = await generateBillingInvoicePdfBuffer(invoiceContext);
    const fileName = `factura-${invoiceId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/invoice-pdf/:invoiceId", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      return res.status(400).json({ message: "Factura invalida" });
    }

    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const invoiceContext = await buildBillingInvoiceEmailContext(data.tenant_id, data);
    const pdfBuffer = await generateBillingInvoicePdfBuffer(invoiceContext);
    const fileName = `factura-${invoiceId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/superadmin/invoices-pdf/:invoiceId", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      return res.status(400).json({ message: "Factura invalida" });
    }

    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id,tenant_id,subscription_id,plan_id,period_start,period_end,amount,currency,status,due_date,issued_at,paid_at,reference,notes,created_at,updated_at")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      if (["42P01", "42703"].includes(String(error.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const invoiceContext = await buildBillingInvoiceEmailContext(data.tenant_id, data);
    const pdfBuffer = await generateBillingInvoicePdfBuffer(invoiceContext);
    const fileName = `factura-${invoiceId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/superadmin/invoices/:invoiceId/payments", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      return res.status(400).json({ message: "Factura invalida" });
    }

    const settlementBefore = await summarizeInvoiceBalance(invoiceId);
    if (!settlementBefore) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const invoiceRow = settlementBefore.invoice;
    const normalizedInvoiceStatus = normalizeInvoiceStatus(invoiceRow.status, "pending");
    if (normalizedInvoiceStatus === "void") {
      return res.status(400).json({ message: "No puedes registrar pagos sobre una factura anulada" });
    }

    if (settlementBefore.isFullyPaid || normalizedInvoiceStatus === "paid") {
      return res.status(400).json({ message: "La factura ya esta liquidada" });
    }

    const amount = round2(parseNumericInput(req.body.amount, NaN));
    const method = normalizeBillingPaymentMethod(req.body.method);
    const proofPayload = method === "Transferencia" ? parseBillingPaymentProofPayload(req.body) : null;
    const reference = method === "Efectivo"
      ? DEFAULT_CASH_PAYMENT_REFERENCE
      : String(proofPayload?.proofImageName || req.body.reference || DEFAULT_TRANSFER_PAYMENT_REFERENCE).trim();
    const notes = buildBillingPaymentStoredNotes({
      publicNote: "",
      proofImageData: proofPayload?.proofImageData || "",
      proofImageName: proofPayload?.proofImageName || "",
      proofImageType: proofPayload?.proofImageType || ""
    });

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "El monto del pago debe ser mayor a cero" });
    }

    if (amount - settlementBefore.outstandingAmount > 0.009) {
      return res.status(400).json({
        message: `El pago excede el saldo pendiente de la factura (${settlementBefore.outstandingAmount.toFixed(2)} ${normalizeCurrency(invoiceRow.currency, DEFAULT_SUBSCRIPTION_CURRENCY)})`
      });
    }

    const paymentPayload = {
      id: `BPM-${numericId()}`,
      invoice_id: invoiceRow.id,
      tenant_id: invoiceRow.tenant_id,
      amount,
      currency: normalizeCurrency(invoiceRow.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
      method,
      reference,
      status: "confirmed",
      source: "superadmin",
      received_at: isoNow(),
      recorded_by: req.user.id,
      notes
    };

    const { data: paymentRow, error: paymentError } = await supabase
      .from("billing_payments")
      .insert([paymentPayload])
      .select("id,invoice_id,tenant_id,amount,currency,method,reference,status,source,received_at,recorded_by,notes,created_at,updated_at")
      .maybeSingle();

    if (paymentError) {
      if (isBillingSchemaMissingError(paymentError)) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw paymentError;
    }

    const settlementAfter = await summarizeInvoiceBalance(invoiceId);
    const settlementResult = await applyInvoiceSettlement(invoiceRow.tenant_id, settlementAfter, {
      activateOnPaid: true,
      suspendWhenUnpaid: false
    });

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "billing_payment_confirmed",
      entityType: "billing_payment",
      entityId: paymentPayload.id,
      tenantId: invoiceRow.tenant_id,
      afterData: {
        invoiceId: invoiceRow.id,
        amount,
        method,
        reference,
        confirmedPaidAmount: settlementAfter ? settlementAfter.confirmedPaidAmount : amount,
        outstandingAmount: settlementAfter ? settlementAfter.outstandingAmount : 0,
        invoiceStatus: settlementAfter ? settlementAfter.expectedStatus : "pending"
      }
    });

    const updatedInvoice = settlementResult.invoice || invoiceRow;
    const updatedSubscription = await ensureTenantSubscription(invoiceRow.tenant_id);
    let emailDelivery = {
      attempted: false,
      sent: false,
      sentTo: null,
      message: "Envio automatico deshabilitado"
    };

    if (BILLING_AUTO_EMAIL_ENABLED) {
      try {
        const paymentEmailContext = await buildBillingPaymentEmailContext(
          invoiceRow.tenant_id,
          updatedInvoice,
          paymentRow,
          settlementAfter
        );
        emailDelivery = {
          attempted: true,
          sent: false,
          sentTo: paymentEmailContext.ownerEmail || null,
          message: "No se pudo resolver el correo del propietario del tenant"
        };

        if (paymentEmailContext.ownerEmail) {
          await sendBillingPaymentConfirmationEmail(paymentEmailContext);
          emailDelivery = {
            attempted: true,
            sent: true,
            sentTo: paymentEmailContext.ownerEmail,
            message: "Confirmacion de pago enviada correctamente al propietario del tenant"
          };
        }
      } catch (emailError) {
        emailDelivery = {
          attempted: true,
          sent: false,
          sentTo: emailDelivery.sentTo,
          message: emailError?.message || "No se pudo enviar la confirmacion de pago por correo"
        };
      }
    }

    return res.status(201).json({
      payment: mapBillingPaymentRow(paymentRow),
      invoice: mapInvoiceRow(updatedInvoice),
      settlement: settlementAfter
        ? {
          amount: settlementAfter.amount,
          confirmedPaidAmount: settlementAfter.confirmedPaidAmount,
          outstandingAmount: settlementAfter.outstandingAmount,
          status: settlementAfter.expectedStatus
        }
        : null,
      subscription: updatedSubscription,
      emailDelivery
    });
  } catch (error) {
    if (error && error.status === 503) {
      return res.status(503).json({ message: error.message });
    }
    return next(error);
  }
});

app.patch("/api/superadmin/payments/:paymentId/status", requireAuth, requireSuperadmin, async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId || "").trim();
    const nextStatus = normalizePaymentRecordStatus(req.body.status, "reported");

    if (!paymentId) {
      return res.status(400).json({ message: "Pago invalido" });
    }

    if (!["confirmed", "rejected"].includes(nextStatus)) {
      return res.status(400).json({ message: "Estado de pago no permitido" });
    }

    const { data: paymentRow, error: paymentError } = await supabase
      .from("billing_payments")
      .select("id,invoice_id,tenant_id,amount,currency,method,reference,status,source,received_at,recorded_by,notes,created_at,updated_at")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) {
      if (["42P01", "42703"].includes(String(paymentError.code || ""))) {
        return res.status(503).json({ message: "Facturacion no habilitada. Ejecuta supabase_schema.sql." });
      }
      throw paymentError;
    }

    if (!paymentRow) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    if (String(paymentRow.status || "") === nextStatus) {
      return res.json({ payment: mapBillingPaymentRow(paymentRow) });
    }

    const { data: updatedPaymentRow, error: updateError } = await supabase
      .from("billing_payments")
      .update({ status: nextStatus, recorded_by: req.user.id, updated_at: isoNow() })
      .eq("id", paymentId)
      .select("id,invoice_id,tenant_id,amount,currency,method,reference,status,source,received_at,recorded_by,notes,created_at,updated_at")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    const settlementAfter = await summarizeInvoiceBalance(paymentRow.invoice_id);
    const settlementResult = await applyInvoiceSettlement(paymentRow.tenant_id, settlementAfter, {
      activateOnPaid: true,
      suspendWhenUnpaid: String(paymentRow.status || "").toLowerCase() === "confirmed" && nextStatus === "rejected"
    });

    await recordPlatformAuditLog({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "billing_payment_status_updated",
      entityType: "billing_payment",
      entityId: paymentId,
      tenantId: paymentRow.tenant_id,
      beforeData: { status: paymentRow.status },
      afterData: {
        status: nextStatus,
        invoiceStatus: settlementAfter ? settlementAfter.expectedStatus : null,
        outstandingAmount: settlementAfter ? settlementAfter.outstandingAmount : null
      }
    });

    const subscription = await ensureTenantSubscription(paymentRow.tenant_id);
    return res.json({
      payment: mapBillingPaymentRow(updatedPaymentRow || paymentRow),
      invoice: settlementResult.invoice ? mapInvoiceRow(settlementResult.invoice) : null,
      settlement: settlementAfter
        ? {
          amount: settlementAfter.amount,
          confirmedPaidAmount: settlementAfter.confirmedPaidAmount,
          outstandingAmount: settlementAfter.outstandingAmount,
          status: settlementAfter.expectedStatus
        }
        : null,
      subscription
    });
  } catch (error) {
    if (error && error.status === 503) {
      return res.status(503).json({ message: error.message });
    }
    return next(error);
  }
});

app.get("/api/settings", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const state = await readStateForUser(req.user);
    res.json({ settings: state.settings });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", requireAuth, requireTenantUser, requireTenantWriteAccess, async (req, res, next) => {
  try {
    const settings = {
      personalLoanRate: parseNumericInput(req.body.personalLoanRate, 0),
      businessLoanRate: parseNumericInput(req.body.businessLoanRate, 0),
      mortgageLoanRate: parseNumericInput(req.body.mortgageLoanRate, 0),
      autoLoanRate: parseNumericInput(req.body.autoLoanRate, 0),
      latePenaltyRate: parseNumericInput(req.body.latePenaltyRate, 0),
      graceDays: parseNumericInput(req.body.graceDays, 0),
      autoApprovalScore: parseNumericInput(req.body.autoApprovalScore, 0),
      maxDebtToIncome: parseNumericInput(req.body.maxDebtToIncome, 0),
      capitalBudget: Math.max(parseNumericInput(req.body.capitalBudget, 0), 0),
      currency: normalizeCurrency(req.body.currency, DEFAULT_SUBSCRIPTION_CURRENCY)
    };

    // Primero obtener los settings actuales para mantener standard_annual_rate si existe
    const { data: currentSettings } = await supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", req.user.tenantId)
      .maybeSingle();

    const upsertData = {
      tenant_id: req.user.tenantId,
      personal_loan_rate: settings.personalLoanRate,
      business_loan_rate: settings.businessLoanRate,
      mortgage_loan_rate: settings.mortgageLoanRate,
      auto_loan_rate: settings.autoLoanRate,
      late_penalty_rate: settings.latePenaltyRate,
      grace_days: settings.graceDays,
      auto_approval_score: settings.autoApprovalScore,
      max_debt_to_income: settings.maxDebtToIncome,
      capital_budget: settings.capitalBudget,
      currency: settings.currency,
      deleted_at: null
    };

    // Mantener standard_annual_rate si ya existe en la BD
    if (currentSettings && currentSettings.standard_annual_rate !== undefined) {
      upsertData.standard_annual_rate = currentSettings.standard_annual_rate;
    }

    let { error } = await supabase.from("tenant_settings").upsert(upsertData, { onConflict: "tenant_id" });
    if (error && String(error.code || "") === "42703") {
      const legacyUpsertData = { ...upsertData };
      delete legacyUpsertData.deleted_at;
      ({ error } = await supabase.from("tenant_settings").upsert(legacyUpsertData, { onConflict: "tenant_id" }));
    }

    if (error) {
      throw error;
    }

    return res.json({ settings });
  } catch (error) {
    console.error('Error guardando settings:', error);
    return next(error);
  }
});

app.get("/api/reports/overview", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    if (!parseBooleanInput(req.subscription?.features?.advancedReportsEnabled, true)) {
      return res.status(403).json({
        message: "Tu plan actual no incluye reportes avanzados."
      });
    }

    const state = await readStateForUser(req.user);

    const totalPayable = state.loans.reduce((acc, loan) => acc + loanTotalPayable(loan), 0);
    const collected = state.loans.reduce((acc, loan) => acc + loan.paidAmount, 0);
    const overdueBalance = state.loans
      .filter((loan) => loan.status === "overdue")
      .reduce((acc, loan) => acc + loanOutstanding(loan), 0);
    const recovery = totalPayable > 0 ? (collected / totalPayable) * 100 : 0;

    return res.json({
      report: {
        recovery: round2(recovery),
        totalPayable: round2(totalPayable),
        overdueBalance: round2(overdueBalance)
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/calendar/:token.ics", async (req, res, next) => {
  try {
    const token = String(req.params.token || "").replace(/\.ics$/i, "").trim();
    if (!token) {
      return res.status(404).type("text/plain").send("Calendar feed not found");
    }

    const calendarInfo = await loadUserCalendarIntegrationByToken(token);
    if (!calendarInfo || !calendarInfo.integration.enabled) {
      return res.status(404).type("text/plain").send("Calendar feed not found");
    }

    const tenantSubscription = await ensureTenantSubscription(calendarInfo.tenantId);
    if (!parseBooleanInput(tenantSubscription?.features?.calendarIcsEnabled, true)) {
      return res.status(404).type("text/plain").send("Calendar feed not found");
    }

    const { tenantName, events, dateKey } = await listDueTodayCalendarEvents(
      calendarInfo.tenantId,
      calendarInfo.integration.timezone
    );
    const ics = buildCalendarIcsContent(tenantName, events, dateKey, ICS_LOOKAHEAD_DAYS);
    const etag = crypto.createHash("sha1").update(ics).digest("hex");

    const currentEtag = `W/\"${etag}\"`;
    if (String(req.get("if-none-match") || "").trim() === currentEtag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="credisync-cobros.ics"');
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.setHeader("ETag", currentEtag);
    res.setHeader("X-Published-TTL", "PT30M");
    return res.status(200).send(ics);
  } catch (error) {
    return next(error);
  }
});

if (IS_PROD && HAS_CLIENT_DIST) {
  app.use(express.static(CLIENT_DIST_DIR, {
    index: false,
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
  });
}

app.use("/api", (req, res, next) => {
  res.status(404).json({ message: `Ruta API no encontrada (${req.method} ${req.originalUrl || req.url})` });
});

app.use((req, res, next) => {
  if (!IS_PROD) {
    res.status(404).json({ message: `Ruta no encontrada (${req.method} ${req.originalUrl || req.url})` });
    return;
  }

  res.status(404).json({ message: "Recurso no encontrado" });
});

app.use((error, req, res, next) => {
  const rawStatus = Number(error && (error.status || error.statusCode || error.code));
  const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const message =
    status >= 500
      ? "Ha ocurrido un error interno. Intenta nuevamente."
      : error && error.message
        ? String(error.message)
        : "Solicitud invalida";

  if (!IS_PROD || status >= 500) {
    console.error("[API ERROR]", error);
  }

  res.status(status).json({ message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CrediSync API listening on http://0.0.0.0:${PORT}`);

  if (IS_PROD && !HAS_CLIENT_DIST) {
    console.warn("[STARTUP WARNING] dist/index.html not found. Run `npm run build` before production start.");
  }

  if (IS_PROD && ENABLE_SUPERADMIN_BOOTSTRAP) {
    console.warn("[STARTUP WARNING] ENABLE_SUPERADMIN_BOOTSTRAP is enabled in production. Disable it after initial provisioning.");
  }

  ensureDefaultSuperadmin().then(() => {
    if (!IS_PROD && ENABLE_SUPERADMIN_BOOTSTRAP && DEFAULT_SUPERADMIN_EMAIL) {
      console.log(`[SUPERADMIN READY] ${DEFAULT_SUPERADMIN_EMAIL}`);
    }
  });

  startLocalPushScheduler();
});
