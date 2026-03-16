const API_BASE = (process.env.SMOKE_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const ADMIN_EMAIL = String(process.env.SMOKE_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || "").trim();
const SUPERADMIN_EMAIL = String(process.env.SMOKE_SUPERADMIN_EMAIL || "").trim().toLowerCase();
const SUPERADMIN_PASSWORD = String(process.env.SMOKE_SUPERADMIN_PASSWORD || "").trim();

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

function isoDatePlus(days) {
  const base = new Date();
  base.setDate(base.getDate() + Number(days || 0));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
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

function assertApproxEqual(actual, expected, tolerance = 0.01) {
  return Math.abs(Number(actual || 0) - Number(expected || 0)) <= tolerance;
}

async function assertApiHealth() {
  const client = createClient();
  const { response, body } = await client.request("/api/health");
  if (!response.ok || !body?.ok) {
    throw new Error(formatError("Healthcheck failed", response.status, body));
  }
  console.log("[OK] /api/health");
}

async function login(client, email, password, label) {
  const result = await client.request("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });

  if (!result.response.ok) {
    throw new Error(formatError(`${label} login failed`, result.response.status, result.body));
  }
}

async function main() {
  try {
    console.log(`[INFO] Running billing integrity smoke against ${API_BASE}`);
    await assertApiHealth();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
      console.log(
        "[SKIP] Billing smoke flow (set SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD, SMOKE_SUPERADMIN_EMAIL, SMOKE_SUPERADMIN_PASSWORD)"
      );
      console.log("[DONE] Billing integrity smoke checks completed");
      return;
    }

    const tenantClient = createClient();
    const superadminClient = createClient();

    await login(tenantClient, ADMIN_EMAIL, ADMIN_PASSWORD, "Tenant admin");
    await login(superadminClient, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, "Superadmin");

    const me = await tenantClient.request("/api/auth/me");
    if (!me.response.ok || !me.body?.user?.tenantId) {
      throw new Error(formatError("Unable to resolve tenant user", me.response.status, me.body));
    }

    const tenantId = me.body.user.tenantId;
    const invoiceAmount = 100;
    const partialAmount = 40;
    const remainingAmount = invoiceAmount - partialAmount;

    const createInvoice = await superadminClient.request(`/api/superadmin/tenants/${encodeURIComponent(tenantId)}/invoices`, {
      method: "POST",
      body: {
        amount: invoiceAmount,
        dueDate: isoDatePlus(7),
        notes: "Smoke billing integrity"
      }
    });

    if (!createInvoice.response.ok || !createInvoice.body?.invoice?.id) {
      throw new Error(formatError("Unable to create invoice", createInvoice.response.status, createInvoice.body));
    }

    const invoiceId = createInvoice.body.invoice.id;
    console.log(`[OK] Invoice created: ${invoiceId}`);

    const firstPayment = await superadminClient.request(`/api/superadmin/invoices/${encodeURIComponent(invoiceId)}/payments`, {
      method: "POST",
      body: {
        amount: partialAmount,
        method: "transfer",
        reference: "SMOKE-PARTIAL"
      }
    });

    if (!firstPayment.response.ok) {
      throw new Error(formatError("Partial payment request failed", firstPayment.response.status, firstPayment.body));
    }

    if (String(firstPayment.body?.settlement?.status || "") === "paid") {
      throw new Error("Expected invoice to remain unpaid after partial payment");
    }

    if (!assertApproxEqual(firstPayment.body?.settlement?.outstandingAmount, remainingAmount)) {
      throw new Error(
        `Expected outstanding amount ${remainingAmount}, got ${String(firstPayment.body?.settlement?.outstandingAmount || "unknown")}`
      );
    }
    console.log("[OK] Partial payment keeps invoice unpaid");

    const secondPayment = await superadminClient.request(`/api/superadmin/invoices/${encodeURIComponent(invoiceId)}/payments`, {
      method: "POST",
      body: {
        amount: remainingAmount,
        method: "transfer",
        reference: "SMOKE-FINAL"
      }
    });

    if (!secondPayment.response.ok) {
      throw new Error(formatError("Final payment request failed", secondPayment.response.status, secondPayment.body));
    }

    if (String(secondPayment.body?.settlement?.status || "") !== "paid") {
      throw new Error(`Expected invoice to be paid after final payment, got ${String(secondPayment.body?.settlement?.status || "unknown")}`);
    }

    if (!assertApproxEqual(secondPayment.body?.settlement?.outstandingAmount, 0)) {
      throw new Error(
        `Expected outstanding amount 0 after final payment, got ${String(secondPayment.body?.settlement?.outstandingAmount || "unknown")}`
      );
    }
    console.log("[OK] Final payment closes invoice");

    const subscriptionDetail = await superadminClient.request(`/api/superadmin/tenants/${encodeURIComponent(tenantId)}/subscription`);
    if (!subscriptionDetail.response.ok) {
      throw new Error(formatError("Unable to read tenant subscription detail", subscriptionDetail.response.status, subscriptionDetail.body));
    }

    const invoices = Array.isArray(subscriptionDetail.body?.invoices) ? subscriptionDetail.body.invoices : [];
    const persistedInvoice = invoices.find((item) => String(item.id || "") === invoiceId) || null;
    if (!persistedInvoice) {
      throw new Error(`Invoice ${invoiceId} not found in tenant detail list`);
    }

    if (String(persistedInvoice.status || "") !== "paid") {
      throw new Error(`Expected persisted invoice status 'paid', got '${String(persistedInvoice.status || "unknown")}'`);
    }
    console.log("[OK] Persisted invoice status is paid");

    console.log("[DONE] Billing integrity smoke checks completed");
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
  }
}

main();
