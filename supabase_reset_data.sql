-- CrediSync - limpia datos multi-tenant
-- Ejecuta este script en SQL Editor para dejar el proyecto limpio.

truncate table public.payments restart identity cascade;
truncate table public.payment_promises restart identity cascade;
truncate table public.collection_notes restart identity cascade;
truncate table public.notifications restart identity cascade;
truncate table public.user_calendar_integrations restart identity cascade;
truncate table public.billing_payments restart identity cascade;
truncate table public.billing_invoices restart identity cascade;
truncate table public.tenant_subscriptions restart identity cascade;
truncate table public.subscription_plans restart identity cascade;
truncate table public.platform_audit_logs restart identity cascade;
truncate table public.loans restart identity cascade;
truncate table public.customers restart identity cascade;
truncate table public.tenant_settings restart identity cascade;
truncate table public.users restart identity cascade;
truncate table public.tenants restart identity cascade;
