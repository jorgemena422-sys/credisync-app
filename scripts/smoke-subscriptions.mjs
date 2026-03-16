const API_BASE = (process.env.SMOKE_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const ADMIN_EMAIL = String(process.env.SMOKE_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || "").trim();
const SUPERADMIN_EMAIL = String(process.env.SMOKE_SUPERADMIN_EMAIL || "").trim().toLowerCase();
const SUPERADMIN_PASSWORD = String(process.env.SMOKE_SUPERADMIN_PASSWORD || "").trim();
const ALLOW_SMOKE_REGISTER = String(process.env.SMOKE_ALLOW_REGISTER || "").trim() === "1";

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

async function assertApiHealth() {
  const client = createClient();
  const { response, body } = await client.request("/api/health");
  if (!response.ok || !body?.ok) {
    throw new Error(formatError("Healthcheck failed", response.status, body));
  }
}

async function loginTenantAdmin(client) {
  const login = await client.request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  if (login.response.ok) {
    return;
  }

  if (!ALLOW_SMOKE_REGISTER) {
    throw new Error(
      formatError(
        "Tenant admin login failed (set SMOKE_ALLOW_REGISTER=1 to auto-create)",
        login.response.status,
        login.body
      )
    );
  }

  const register = await client.request("/api/auth/register-admin", {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  if (!register.response.ok) {
    throw new Error(formatError("Unable to register tenant admin", register.response.status, register.body));
  }
}

async function loginSuperadmin(client) {
  const login = await client.request("/api/auth/login", {
    method: "POST",
    body: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }
  });

  if (!login.response.ok) {
    throw new Error(formatError("Superadmin login failed", login.response.status, login.body));
  }
}

async function main() {
  try {
    console.log(`[INFO] Running subscription smoke checks against ${API_BASE}`);
    await assertApiHealth();
    console.log("[OK] /api/health");

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
      console.log(
        "[SKIP] Subscription smoke flow (set SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD, SMOKE_SUPERADMIN_EMAIL, SMOKE_SUPERADMIN_PASSWORD)"
      );
      console.log("[DONE] Subscription smoke checks completed");
      return;
    }

    const tenantClient = createClient();
    const superadminClient = createClient();

    await loginTenantAdmin(tenantClient);
    await loginSuperadmin(superadminClient);

    const me = await tenantClient.request("/api/auth/me");
    if (!me.response.ok || !me.body?.user?.tenantId) {
      throw new Error(formatError("Unable to resolve tenant user", me.response.status, me.body));
    }

    const tenantId = me.body.user.tenantId;
    const before = await tenantClient.request("/api/subscription/current");
    if (!before.response.ok || !before.body?.subscription?.planId) {
      throw new Error(formatError("Unable to load tenant subscription", before.response.status, before.body));
    }

    const plansResponse = await superadminClient.request("/api/superadmin/plans");
    const plans = Array.isArray(plansResponse.body?.plans) ? plansResponse.body.plans : [];
    if (!plansResponse.response.ok || plans.length === 0) {
      throw new Error(formatError("Unable to load plans", plansResponse.response.status, plansResponse.body));
    }

    const currentPlanId = before.body.subscription.planId;
    const targetPlan = plans.find((plan) => plan.id !== currentPlanId) || plans[0];
    const update = await superadminClient.request(`/api/superadmin/tenants/${encodeURIComponent(tenantId)}/subscription`, {
      method: "PUT",
      body: {
        planId: targetPlan.id,
        status: "active",
        notes: "Smoke subscriptions plan update"
      }
    });

    if (!update.response.ok || !update.body?.subscription?.planId) {
      throw new Error(formatError("Unable to update tenant plan", update.response.status, update.body));
    }

    const after = await tenantClient.request("/api/subscription/current");
    if (!after.response.ok || !after.body?.subscription?.planId) {
      throw new Error(formatError("Unable to read subscription after update", after.response.status, after.body));
    }

    const changed = String(after.body.subscription.planId || "") === String(targetPlan.id || "");
    if (!changed) {
      throw new Error(
        `Expected plan '${targetPlan.id}' after superadmin change, got '${String(after.body.subscription.planId || "unknown")}'`
      );
    }

    console.log("[OK] Superadmin plan change reflected for tenant");
    console.log("[DONE] Subscription smoke checks completed");
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
  }
}

main();
