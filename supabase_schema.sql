-- CrediSync - multi-tenant schema
-- Ejecuta este script completo en SQL Editor de Supabase.

create table if not exists public.tenants (
  id text primary key,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint tenants_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password text not null,
  name text not null,
  role text not null,
  status text not null default 'active',
  tenant_id text references public.tenants(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  constraint users_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.tenant_settings (
  tenant_id text primary key references public.tenants(id) on delete cascade,
  personal_loan_rate numeric(8,2) not null default 12,
  business_loan_rate numeric(8,2) not null default 15,
  mortgage_loan_rate numeric(8,2) not null default 10,
  auto_loan_rate numeric(8,2) not null default 14,
  late_penalty_rate numeric(8,2) not null default 5,
  grace_days int not null default 3,
  auto_approval_score int not null default 720,
  max_debt_to_income numeric(8,2) not null default 40,
  capital_budget numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id text primary key,
  platform_name text not null default 'CrediSync',
  support_email text not null default 'ijorgemena@outlook.com',
  support_phone text not null default '',
  allow_admin_registration boolean not null default true,
  new_tenant_status text not null default 'active',
  default_personal_loan_rate numeric(8,2) not null default 12,
  default_business_loan_rate numeric(8,2) not null default 15,
  default_mortgage_loan_rate numeric(8,2) not null default 10,
  default_auto_loan_rate numeric(8,2) not null default 14,
  default_late_penalty_rate numeric(8,2) not null default 5,
  default_grace_days int not null default 3,
  default_auto_approval_score int not null default 720,
  default_max_debt_to_income numeric(8,2) not null default 40,
  default_capital_budget numeric(14,2) not null default 0,
  risk_initial_score numeric(8,2) not null default 70,
  risk_on_time_payment_reward numeric(8,2) not null default 2.2,
  risk_kept_promise_reward numeric(8,2) not null default 3.8,
  risk_payment_activity_reward numeric(8,2) not null default 0.45,
  risk_payment_activity_cap int not null default 12,
  risk_late_payment_penalty numeric(8,2) not null default 3.4,
  risk_broken_promise_penalty numeric(8,2) not null default 11.5,
  risk_pending_promise_penalty numeric(8,2) not null default 2.4,
  risk_overdue_day_penalty numeric(8,2) not null default 0.75,
  risk_overdue_day_cap numeric(8,2) not null default 20,
  risk_overdue_accumulated_penalty numeric(8,2) not null default 0.14,
  risk_overdue_accumulated_cap numeric(8,2) not null default 14,
  risk_lag_installment_penalty numeric(8,2) not null default 3.8,
  risk_no_payment_history_penalty numeric(8,2) not null default 6,
  updated_at timestamptz not null default now(),
  constraint platform_settings_new_tenant_status_check check (new_tenant_status in ('active', 'inactive'))
);

create table if not exists public.customers (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  status text not null default 'active',
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  constraint customers_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.loans (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  type text not null,
  principal numeric(12,2) not null,
  principal_outstanding numeric(12,2),
  interest_rate numeric(8,2) not null,
  interest_rate_mode text not null default 'annual',
  payment_model text not null default 'legacy_add_on',
  term_months int not null,
  start_date date not null,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint loans_status_check check (status in ('active', 'overdue', 'paid')),
  constraint loans_principal_check check (principal > 0),
  constraint loans_term_check check (term_months > 0),
  constraint loans_rate_mode_check check (interest_rate_mode in ('annual', 'monthly')),
  constraint loans_payment_model_check check (payment_model in ('legacy_add_on', 'interest_only_balloon'))
);

create table if not exists public.payments (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  loan_id text not null references public.loans(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  date date not null,
  amount numeric(12,2) not null,
  method text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount > 0)
);

create table if not exists public.payment_promises (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  loan_id text not null references public.loans(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  promised_date date not null,
  promised_amount numeric(12,2) not null,
  status text not null default 'pending',
  note text,
  created_by text references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_promises_amount_check check (promised_amount > 0),
  constraint payment_promises_status_check check (status in ('pending', 'kept', 'broken', 'cancelled'))
);

create table if not exists public.collection_notes (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  loan_id text references public.loans(id) on delete set null,
  body text not null,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null unique,
  type text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  event_date date not null default current_date,
  status text not null default 'unread',
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_severity_check check (severity in ('info', 'success', 'warning', 'critical')),
  constraint notifications_status_check check (status in ('unread', 'read'))
);

create table if not exists public.user_calendar_integrations (
  user_id text primary key references public.users(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete cascade,
  enabled boolean not null default true,
  timezone text not null default 'America/Santo_Domingo',
  feed_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text,
  device_label text,
  timezone text not null default 'America/Santo_Domingo',
  enabled boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_delivery_logs (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  subscription_id text references public.push_subscriptions(id) on delete set null,
  delivery_type text not null,
  delivery_date date not null,
  delivery_key text not null,
  status text not null default 'sent',
  response_code int,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_delivery_logs_status_check check (status in ('sent', 'failed', 'skipped'))
);

create table if not exists public.subscription_plans (
  id text primary key,
  code text not null unique,
  name text not null,
  description text,
  price_monthly numeric(12,2) not null default 0,
  currency text not null default 'USD',
  billing_cycle text not null default 'monthly',
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_price_check check (price_monthly >= 0),
  constraint subscription_plans_cycle_check check (billing_cycle in ('monthly'))
);

create table if not exists public.tenant_subscriptions (
  id text primary key,
  tenant_id text not null unique references public.tenants(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'trial',
  billing_cycle text not null default 'monthly',
  currency text not null default 'USD',
  current_period_start date not null,
  current_period_end date not null,
  next_billing_date date not null,
  trial_ends_at date,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_status_check check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  constraint tenant_subscriptions_cycle_check check (billing_cycle in ('monthly'))
);

create table if not exists public.billing_invoices (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  subscription_id text references public.tenant_subscriptions(id) on delete set null,
  plan_id text references public.subscription_plans(id) on delete set null,
  period_start date not null,
  period_end date not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  due_date date not null,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_amount_check check (amount > 0),
  constraint billing_invoices_status_check check (status in ('pending', 'overdue', 'paid', 'void'))
);

create table if not exists public.billing_payments (
  id text primary key,
  invoice_id text not null references public.billing_invoices(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  method text not null,
  reference text,
  status text not null default 'reported',
  source text not null default 'tenant',
  received_at timestamptz,
  recorded_by text references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_payments_amount_check check (amount > 0),
  constraint billing_payments_status_check check (status in ('reported', 'confirmed', 'rejected')),
  constraint billing_payments_source_check check (source in ('tenant', 'superadmin'))
);

create table if not exists public.platform_audit_logs (
  id text primary key,
  actor_user_id text references public.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  tenant_id text references public.tenants(id) on delete set null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop table if exists public.message_deliveries cascade;
drop table if exists public.message_templates cascade;
drop table if exists public.tenant_channel_connections cascade;
drop table if exists public.tenant_calendar_integrations cascade;
drop table if exists public.tenant_reminder_settings cascade;
alter table public.customers drop constraint if exists customers_channel_check;
alter table public.customers drop column if exists preferred_channel;
alter table public.customers drop column if exists email_opt_in;
alter table public.customers drop column if exists whatsapp_opt_in;
alter table public.customers drop column if exists phone_e164;

alter table public.users add column if not exists status text not null default 'active';
alter table public.users add column if not exists tenant_id text;
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.platform_settings add column if not exists platform_name text not null default 'CrediSync';
alter table public.platform_settings add column if not exists support_email text not null default 'ijorgemena@outlook.com';
alter table public.platform_settings add column if not exists support_phone text not null default '';
alter table public.platform_settings add column if not exists allow_admin_registration boolean not null default true;
alter table public.platform_settings add column if not exists new_tenant_status text not null default 'active';
alter table public.platform_settings add column if not exists default_personal_loan_rate numeric(8,2) not null default 12;
alter table public.platform_settings add column if not exists default_business_loan_rate numeric(8,2) not null default 15;
alter table public.platform_settings add column if not exists default_mortgage_loan_rate numeric(8,2) not null default 10;
alter table public.platform_settings add column if not exists default_auto_loan_rate numeric(8,2) not null default 14;
alter table public.platform_settings add column if not exists default_late_penalty_rate numeric(8,2) not null default 5;
alter table public.platform_settings add column if not exists default_grace_days int not null default 3;
alter table public.platform_settings add column if not exists default_auto_approval_score int not null default 720;
alter table public.platform_settings add column if not exists default_max_debt_to_income numeric(8,2) not null default 40;
alter table public.platform_settings add column if not exists default_capital_budget numeric(14,2) not null default 0;
alter table public.platform_settings add column if not exists risk_initial_score numeric(8,2) not null default 70;
alter table public.platform_settings add column if not exists risk_on_time_payment_reward numeric(8,2) not null default 2.2;
alter table public.platform_settings add column if not exists risk_kept_promise_reward numeric(8,2) not null default 3.8;
alter table public.platform_settings add column if not exists risk_payment_activity_reward numeric(8,2) not null default 0.45;
alter table public.platform_settings add column if not exists risk_payment_activity_cap int not null default 12;
alter table public.platform_settings add column if not exists risk_late_payment_penalty numeric(8,2) not null default 3.4;
alter table public.platform_settings add column if not exists risk_broken_promise_penalty numeric(8,2) not null default 11.5;
alter table public.platform_settings add column if not exists risk_pending_promise_penalty numeric(8,2) not null default 2.4;
alter table public.platform_settings add column if not exists risk_overdue_day_penalty numeric(8,2) not null default 0.75;
alter table public.platform_settings add column if not exists risk_overdue_day_cap numeric(8,2) not null default 20;
alter table public.platform_settings add column if not exists risk_overdue_accumulated_penalty numeric(8,2) not null default 0.14;
alter table public.platform_settings add column if not exists risk_overdue_accumulated_cap numeric(8,2) not null default 14;
alter table public.platform_settings add column if not exists risk_lag_installment_penalty numeric(8,2) not null default 3.8;
alter table public.platform_settings add column if not exists risk_no_payment_history_penalty numeric(8,2) not null default 6;
alter table public.platform_settings add column if not exists updated_at timestamptz not null default now();
alter table public.tenant_settings add column if not exists capital_budget numeric(14,2) not null default 0;
alter table public.tenant_settings add column if not exists personal_loan_rate numeric(8,2) not null default 12;
alter table public.tenant_settings add column if not exists business_loan_rate numeric(8,2) not null default 15;
alter table public.tenant_settings add column if not exists mortgage_loan_rate numeric(8,2) not null default 10;
alter table public.tenant_settings add column if not exists auto_loan_rate numeric(8,2) not null default 14;

alter table public.customers add column if not exists tenant_id text;
alter table public.loans add column if not exists tenant_id text;
alter table public.loans add column if not exists interest_rate_mode text not null default 'annual';
alter table public.loans add column if not exists payment_model text not null default 'legacy_add_on';
alter table public.loans add column if not exists principal_outstanding numeric(12,2);
update public.loans set principal_outstanding = principal - coalesce(paid_amount, 0) where principal_outstanding is null;
alter table public.payments add column if not exists tenant_id text;
alter table public.payment_promises add column if not exists tenant_id text;
alter table public.collection_notes add column if not exists tenant_id text;
alter table public.notifications add column if not exists tenant_id text;
alter table public.notifications add column if not exists updated_at timestamptz not null default now();
alter table public.user_calendar_integrations add column if not exists user_id text;
alter table public.user_calendar_integrations add column if not exists tenant_id text;
alter table public.user_calendar_integrations add column if not exists enabled boolean not null default true;
alter table public.user_calendar_integrations add column if not exists timezone text not null default 'America/Santo_Domingo';
alter table public.user_calendar_integrations add column if not exists feed_token text;
alter table public.user_calendar_integrations add column if not exists updated_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists id text;
alter table public.push_subscriptions add column if not exists tenant_id text;
alter table public.push_subscriptions add column if not exists user_id text;
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists endpoint_hash text;
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists expiration_time bigint;
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists device_label text;
alter table public.push_subscriptions add column if not exists timezone text not null default 'America/Santo_Domingo';
alter table public.push_subscriptions add column if not exists enabled boolean not null default true;
alter table public.push_subscriptions add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_payment_model_check'
      and conrelid = 'public.loans'::regclass
  ) then
    alter table public.loans
      add constraint loans_payment_model_check check (payment_model in ('legacy_add_on', 'interest_only_balloon'));
  end if;
end $$;
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();
alter table public.push_delivery_logs add column if not exists id text;
alter table public.push_delivery_logs add column if not exists tenant_id text;
alter table public.push_delivery_logs add column if not exists user_id text;
alter table public.push_delivery_logs add column if not exists subscription_id text;
alter table public.push_delivery_logs add column if not exists delivery_type text;
alter table public.push_delivery_logs add column if not exists delivery_date date;
alter table public.push_delivery_logs add column if not exists delivery_key text;
alter table public.push_delivery_logs add column if not exists status text not null default 'sent';
alter table public.push_delivery_logs add column if not exists response_code int;
alter table public.push_delivery_logs add column if not exists error_message text;
alter table public.push_delivery_logs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.push_delivery_logs add column if not exists sent_at timestamptz not null default now();
alter table public.push_delivery_logs add column if not exists updated_at timestamptz not null default now();
alter table public.subscription_plans add column if not exists code text;
alter table public.subscription_plans add column if not exists name text;
alter table public.subscription_plans add column if not exists description text;
alter table public.subscription_plans add column if not exists price_monthly numeric(12,2) not null default 0;
alter table public.subscription_plans add column if not exists currency text not null default 'USD';
alter table public.subscription_plans add column if not exists billing_cycle text not null default 'monthly';
alter table public.subscription_plans add column if not exists is_active boolean not null default true;
alter table public.subscription_plans add column if not exists features jsonb not null default '{}'::jsonb;
alter table public.subscription_plans add column if not exists limits jsonb not null default '{}'::jsonb;
alter table public.subscription_plans add column if not exists updated_at timestamptz not null default now();
alter table public.tenant_subscriptions add column if not exists tenant_id text;
alter table public.tenant_subscriptions add column if not exists plan_id text;
alter table public.tenant_subscriptions add column if not exists status text not null default 'trial';
alter table public.tenant_subscriptions add column if not exists billing_cycle text not null default 'monthly';
alter table public.tenant_subscriptions add column if not exists currency text not null default 'USD';
alter table public.tenant_subscriptions add column if not exists current_period_start date;
alter table public.tenant_subscriptions add column if not exists current_period_end date;
alter table public.tenant_subscriptions add column if not exists next_billing_date date;
alter table public.tenant_subscriptions add column if not exists trial_ends_at date;
alter table public.tenant_subscriptions add column if not exists suspended_at timestamptz;
alter table public.tenant_subscriptions add column if not exists cancelled_at timestamptz;
alter table public.tenant_subscriptions add column if not exists notes text;
alter table public.tenant_subscriptions add column if not exists updated_at timestamptz not null default now();
alter table public.billing_invoices add column if not exists tenant_id text;
alter table public.billing_invoices add column if not exists subscription_id text;
alter table public.billing_invoices add column if not exists plan_id text;
alter table public.billing_invoices add column if not exists period_start date;
alter table public.billing_invoices add column if not exists period_end date;
alter table public.billing_invoices add column if not exists amount numeric(12,2) not null default 0;
alter table public.billing_invoices add column if not exists currency text not null default 'USD';
alter table public.billing_invoices add column if not exists status text not null default 'pending';
alter table public.billing_invoices add column if not exists due_date date;
alter table public.billing_invoices add column if not exists issued_at timestamptz not null default now();
alter table public.billing_invoices add column if not exists paid_at timestamptz;
alter table public.billing_invoices add column if not exists reference text;
alter table public.billing_invoices add column if not exists notes text;
alter table public.billing_invoices add column if not exists updated_at timestamptz not null default now();
alter table public.billing_payments add column if not exists invoice_id text;
alter table public.billing_payments add column if not exists tenant_id text;
alter table public.billing_payments add column if not exists amount numeric(12,2) not null default 0;
alter table public.billing_payments add column if not exists currency text not null default 'USD';
alter table public.billing_payments add column if not exists method text;
alter table public.billing_payments add column if not exists reference text;
alter table public.billing_payments add column if not exists status text not null default 'reported';
alter table public.billing_payments add column if not exists source text not null default 'tenant';
alter table public.billing_payments add column if not exists received_at timestamptz;
alter table public.billing_payments add column if not exists recorded_by text;
alter table public.billing_payments add column if not exists notes text;
alter table public.billing_payments add column if not exists updated_at timestamptz not null default now();
alter table public.platform_audit_logs add column if not exists actor_user_id text;
alter table public.platform_audit_logs add column if not exists actor_role text;
alter table public.platform_audit_logs add column if not exists action text;
alter table public.platform_audit_logs add column if not exists entity_type text;
alter table public.platform_audit_logs add column if not exists entity_id text;
alter table public.platform_audit_logs add column if not exists tenant_id text;
alter table public.platform_audit_logs add column if not exists before_data jsonb not null default '{}'::jsonb;
alter table public.platform_audit_logs add column if not exists after_data jsonb not null default '{}'::jsonb;
alter table public.platform_audit_logs add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists idx_users_tenant_id on public.users(tenant_id);
create index if not exists idx_customers_tenant_id on public.customers(tenant_id);
create index if not exists idx_loans_tenant_id on public.loans(tenant_id);
create index if not exists idx_loans_customer_id on public.loans(customer_id);
create index if not exists idx_payments_tenant_id on public.payments(tenant_id);
create index if not exists idx_payments_loan_id on public.payments(loan_id);
create index if not exists idx_payments_customer_id on public.payments(customer_id);
create index if not exists idx_payments_date on public.payments(date);
create index if not exists idx_promises_tenant_id on public.payment_promises(tenant_id);
create index if not exists idx_promises_loan_id on public.payment_promises(loan_id);
create index if not exists idx_promises_customer_id on public.payment_promises(customer_id);
create index if not exists idx_promises_date on public.payment_promises(promised_date);
create index if not exists idx_notes_tenant_id on public.collection_notes(tenant_id);
create index if not exists idx_notes_customer_id on public.collection_notes(customer_id);
create index if not exists idx_notes_loan_id on public.collection_notes(loan_id);
create index if not exists idx_notifications_tenant_id on public.notifications(tenant_id);
create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_notifications_created_at on public.notifications(created_at);
create index if not exists idx_notifications_code on public.notifications(code);
create unique index if not exists idx_user_calendar_user_id on public.user_calendar_integrations(user_id);
create unique index if not exists idx_user_calendar_feed_token on public.user_calendar_integrations(feed_token);
create index if not exists idx_user_calendar_tenant_id on public.user_calendar_integrations(tenant_id);
create unique index if not exists idx_push_subscriptions_id on public.push_subscriptions(id);
create index if not exists idx_push_subscriptions_tenant_user on public.push_subscriptions(tenant_id, user_id);
create index if not exists idx_push_subscriptions_enabled on public.push_subscriptions(enabled);
create unique index if not exists idx_push_subscriptions_endpoint_hash on public.push_subscriptions(tenant_id, user_id, endpoint_hash);
create unique index if not exists idx_push_delivery_logs_delivery_key on public.push_delivery_logs(delivery_key);
create index if not exists idx_push_delivery_logs_tenant_user_date on public.push_delivery_logs(tenant_id, user_id, delivery_date);
create index if not exists idx_push_delivery_logs_status on public.push_delivery_logs(status);
create unique index if not exists idx_subscription_plans_code on public.subscription_plans(code);
create index if not exists idx_tenant_subscriptions_tenant_id on public.tenant_subscriptions(tenant_id);
create index if not exists idx_tenant_subscriptions_status on public.tenant_subscriptions(status);
create index if not exists idx_tenant_subscriptions_plan_id on public.tenant_subscriptions(plan_id);
create index if not exists idx_billing_invoices_tenant_id on public.billing_invoices(tenant_id);
create index if not exists idx_billing_invoices_status on public.billing_invoices(status);
create index if not exists idx_billing_invoices_due_date on public.billing_invoices(due_date);
create index if not exists idx_billing_payments_tenant_id on public.billing_payments(tenant_id);
create index if not exists idx_billing_payments_invoice_id on public.billing_payments(invoice_id);
create index if not exists idx_billing_payments_status on public.billing_payments(status);
create index if not exists idx_platform_audit_logs_tenant_id on public.platform_audit_logs(tenant_id);
create index if not exists idx_platform_audit_logs_created_at on public.platform_audit_logs(created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_settings_updated_at on public.tenant_settings;
create trigger trg_tenant_settings_updated_at
before update on public.tenant_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_platform_settings_updated_at on public.platform_settings;
create trigger trg_platform_settings_updated_at
before update on public.platform_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_payment_promises_updated_at on public.payment_promises;
create trigger trg_payment_promises_updated_at
before update on public.payment_promises
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_calendar_integrations_updated_at on public.user_calendar_integrations;
create trigger trg_user_calendar_integrations_updated_at
before update on public.user_calendar_integrations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_push_delivery_logs_updated_at on public.push_delivery_logs;
create trigger trg_push_delivery_logs_updated_at
before update on public.push_delivery_logs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_subscription_plans_updated_at on public.subscription_plans;
create trigger trg_subscription_plans_updated_at
before update on public.subscription_plans
for each row
execute function public.set_updated_at();

drop trigger if exists trg_tenant_subscriptions_updated_at on public.tenant_subscriptions;
create trigger trg_tenant_subscriptions_updated_at
before update on public.tenant_subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_billing_invoices_updated_at on public.billing_invoices;
create trigger trg_billing_invoices_updated_at
before update on public.billing_invoices
for each row
execute function public.set_updated_at();

drop trigger if exists trg_billing_payments_updated_at on public.billing_payments;
create trigger trg_billing_payments_updated_at
before update on public.billing_payments
for each row
execute function public.set_updated_at();

create or replace function public.apply_payment_to_loan()
returns trigger
language plpgsql
as $$
declare
  next_paid numeric(12,2);
  total_payable numeric(12,2);
  loan_rate_mode text;
  loan_payment_model text;
begin
  update public.loans
  set paid_amount = coalesce(paid_amount, 0) + coalesce(new.amount, 0)
  where id = new.loan_id
    and tenant_id = new.tenant_id
  returning paid_amount, interest_rate_mode, payment_model
  into next_paid, loan_rate_mode, loan_payment_model;

  -- Calculate total payable based on loan mode
  select
    case when coalesce(loan_payment_model, 'legacy_add_on') = 'interest_only_balloon'
      then principal
      when coalesce(loan_rate_mode, 'annual') = 'monthly'
        then principal * (1 + (interest_rate / 100) * term_months::numeric)
      else principal * (1 + (interest_rate / 100) * (term_months::numeric / 12))
    end
  into total_payable
  from public.loans
  where id = new.loan_id
    and tenant_id = new.tenant_id;

  if next_paid is not null and total_payable is not null and next_paid >= total_payable - 0.5 then
    update public.loans
    set status = 'paid'
    where id = new.loan_id
      and tenant_id = new.tenant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_payment_to_loan on public.payments;
create trigger trg_apply_payment_to_loan
after insert on public.payments
for each row
execute function public.apply_payment_to_loan();

do $$
declare
  table_name text;
begin
  -- Production-safe baseline:
  -- the application uses Supabase from the backend with a service-role key.
  -- direct access from anon/authenticated clients is denied by default.
  foreach table_name in array array[
    'tenants',
    'users',
    'tenant_settings',
    'platform_settings',
    'customers',
    'loans',
    'payments',
    'payment_promises',
    'collection_notes',
    'notifications',
    'user_calendar_integrations',
    'push_subscriptions',
    'push_delivery_logs',
    'subscription_plans',
    'tenant_subscriptions',
    'billing_invoices',
    'billing_payments',
    'platform_audit_logs'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'Skipping RLS setup for missing table public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_demo_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_app_block_direct', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_app_block_direct',
      table_name
    );
  end loop;
end;
$$;
