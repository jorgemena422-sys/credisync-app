const API_BASE = (process.env.SMOKE_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const ADMIN_EMAIL = String(process.env.SMOKE_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || "").trim();
const SUPERADMIN_EMAIL = String(process.env.SMOKE_SUPERADMIN_EMAIL || "").trim().toLowerCase();
const SUPERADMIN_PASSWORD = String(process.env.SMOKE_SUPERADMIN_PASSWORD || "").trim();

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function parseSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const cookie = response.headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

function formatError(prefix, status, body) {
  const payload = body && typeof body === "object" ? JSON.stringify(body) : String(body || "");
  return `${prefix} [${status}] ${payload}`;
}

function createClient() {
  let cookieHeader = "";

  async function request(path, options = {}) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const setCookies = parseSetCookies(response);
    if (setCookies.length > 0) {
      cookieHeader = setCookies.map((item) => item.split(";")[0]).join("; ");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    return { response, body };
  }

  return { request };
}

async function assertHealth() {
  const { response, body } = await createClient().request("/api/health");
  if (!response.ok || !body?.ok) {
    throw new Error(formatError("Healthcheck failed", response.status, body));
  }
  console.log("[OK] /api/health");
}

async function assertUnauthorizedMe() {
  const { response } = await createClient().request("/api/auth/me");
  if (response.status !== 401) {
    throw new Error(`Expected /api/auth/me to return 401 without session, got ${response.status}`);
  }
  console.log("[OK] /api/auth/me unauthorized check");
}

async function runTenantFlow() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("[SKIP] Tenant smoke flow (set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD)");
    return;
  }

  const client = createClient();
  let loginResult = await client.request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  if (!loginResult.response.ok) {
    loginResult = await client.request("/api/auth/register-admin", {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
  }

  if (!loginResult.response.ok) {
    throw new Error(formatError("Unable to login/register admin", loginResult.response.status, loginResult.body));
  }

  const boot = await client.request("/api/bootstrap");
  if (!boot.response.ok || !boot.body?.state) {
    throw new Error(formatError("Bootstrap failed", boot.response.status, boot.body));
  }

  const seed = Date.now().toString().slice(-6);
  const customerName = `Smoke Cliente ${seed}`;
  const customerEmail = `smoke-${seed}@example.com`;

  const newCustomer = await client.request("/api/customers", {
    method: "POST",
    body: {
      name: customerName,
      email: customerEmail,
      phone: `55${seed}`,
      joinedAt: isoToday()
    }
  });

  if (!newCustomer.response.ok || !newCustomer.body?.customer?.id) {
    throw new Error(formatError("Create customer failed", newCustomer.response.status, newCustomer.body));
  }

  const loan = await client.request("/api/loans", {
    method: "POST",
    body: {
      customerId: newCustomer.body.customer.id,
      principal: 1000,
      interestRate: 12,
      interestRateMode: "monthly",
      termMonths: 2,
      startDate: isoToday(),
      type: "personal"
    }
  });

  if (!loan.response.ok || !loan.body?.loan?.id) {
    throw new Error(formatError("Create loan failed", loan.response.status, loan.body));
  }

  const payment = await client.request("/api/payments", {
    method: "POST",
    body: {
      loanId: loan.body.loan.id,
      amount: 560,
      method: "transfer",
      date: isoToday()
    }
  });

  if (!payment.response.ok) {
    throw new Error(formatError("Register payment failed", payment.response.status, payment.body));
  }

  const reports = await client.request("/api/reports/overview");
  if (!reports.response.ok || !reports.body?.report) {
    throw new Error(formatError("Reports overview failed", reports.response.status, reports.body));
  }

  console.log("[OK] Tenant smoke flow");
}

async function runSuperadminFlow() {
  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    console.log("[SKIP] Superadmin smoke flow (set SMOKE_SUPERADMIN_EMAIL and SMOKE_SUPERADMIN_PASSWORD)");
    return;
  }

  const client = createClient();
  const login = await client.request("/api/auth/login", {
    method: "POST",
    body: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }
  });

  if (!login.response.ok) {
    throw new Error(formatError("Superadmin login failed", login.response.status, login.body));
  }

  const users = await client.request("/api/superadmin/users");
  if (!users.response.ok || !Array.isArray(users.body?.users)) {
    throw new Error(formatError("Superadmin users endpoint failed", users.response.status, users.body));
  }

  const settings = await client.request("/api/superadmin/settings");
  if (!settings.response.ok || !settings.body?.settings) {
    throw new Error(formatError("Superadmin settings endpoint failed", settings.response.status, settings.body));
  }

  console.log("[OK] Superadmin smoke flow");
}

async function main() {
  try {
    console.log(`[INFO] Running smoke checks against ${API_BASE}`);
    await assertHealth();
    await assertUnauthorizedMe();
    await runTenantFlow();
    await runSuperadminFlow();
    console.log("[DONE] Fase 1 smoke checks completed");
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
  }
}

main();
