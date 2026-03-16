-- CrediSync - limpieza segura de tenants huerfanos
-- Ejecutar en Supabase SQL Editor.
--
-- Objetivo:
-- 1) Identificar tenants sin usuarios asociados (huerfanos).
-- 2) Separar los que estan totalmente vacios (seguros para borrar).
-- 3) Borrar SOLO los seguros, con vista previa y valvula de seguridad.

-- ============================================================
-- Paso 0 (opcional): cerrar registro publico de workspaces
-- ============================================================
-- update public.platform_settings
-- set allow_admin_registration = false,
--     updated_at = now()
-- where id = 'global';


-- ============================================================
-- Paso 1: generar snapshot de candidatos
-- ============================================================
drop table if exists tmp_tenant_cleanup_candidates;

create temporary table tmp_tenant_cleanup_candidates as
with usage as (
  select
    t.id as tenant_id,
    t.name as tenant_name,
    t.status as tenant_status,
    t.created_at,
    (select count(*) from public.users u where u.tenant_id = t.id) as users_count,
    (select count(*) from public.customers c where c.tenant_id = t.id) as customers_count,
    (select count(*) from public.loans l where l.tenant_id = t.id) as loans_count,
    (select count(*) from public.payments p where p.tenant_id = t.id) as payments_count,
    (select count(*) from public.payment_promises pp where pp.tenant_id = t.id) as promises_count,
    (select count(*) from public.collection_notes cn where cn.tenant_id = t.id) as notes_count,
    (select count(*) from public.notifications n where n.tenant_id = t.id) as notifications_count,
    (select count(*) from public.billing_invoices bi where bi.tenant_id = t.id) as billing_invoices_count,
    (select count(*) from public.billing_payments bp where bp.tenant_id = t.id) as billing_payments_count
  from public.tenants t
)
select
  tenant_id,
  tenant_name,
  tenant_status,
  created_at,
  users_count,
  customers_count,
  loans_count,
  payments_count,
  promises_count,
  notes_count,
  notifications_count,
  billing_invoices_count,
  billing_payments_count,
  (
    customers_count = 0
    and loans_count = 0
    and payments_count = 0
    and promises_count = 0
    and notes_count = 0
    and billing_invoices_count = 0
    and billing_payments_count = 0
  ) as hard_delete_safe
from usage
where users_count = 0;


-- ============================================================
-- Paso 2: revisar antes de tocar datos
-- ============================================================

-- 2.1 Resumen rapido
select
  count(*) as orphan_tenants,
  count(*) filter (where hard_delete_safe) as safe_to_delete,
  count(*) filter (where not hard_delete_safe) as orphan_with_activity
from tmp_tenant_cleanup_candidates;

-- 2.2 Lista completa
select
  tenant_id,
  tenant_name,
  tenant_status,
  created_at,
  users_count,
  customers_count,
  loans_count,
  payments_count,
  promises_count,
  notes_count,
  notifications_count,
  billing_invoices_count,
  billing_payments_count,
  hard_delete_safe
from tmp_tenant_cleanup_candidates
order by created_at desc;

-- 2.3 Solo huerfanos con actividad (NO borrar)
select
  tenant_id,
  tenant_name,
  created_at,
  customers_count,
  loans_count,
  payments_count,
  promises_count,
  notes_count,
  billing_invoices_count,
  billing_payments_count
from tmp_tenant_cleanup_candidates
where not hard_delete_safe
order by created_at desc;


-- ============================================================
-- Paso 3A (opcional): desactivar huerfanos con actividad
-- ============================================================
-- update public.tenants t
-- set status = 'inactive'
-- from tmp_tenant_cleanup_candidates c
-- where t.id = c.tenant_id
--   and c.hard_delete_safe = false
--   and t.status <> 'inactive'
-- returning t.id, t.name, t.status;


-- ============================================================
-- Paso 3B: DRY RUN de borrado seguro (recomendado primero)
-- ============================================================
begin;

with to_delete as (
  select tenant_id, tenant_name, created_at
  from tmp_tenant_cleanup_candidates
  where hard_delete_safe = true
)
select * from to_delete order by created_at desc;

-- Mantener rollback en la primera corrida.
rollback;


-- ============================================================
-- Paso 3C: aplicar borrado seguro (cuando confirmes)
-- ============================================================
-- begin;
--
-- -- Valvula de seguridad: ajusta este limite si necesitas.
-- do $$
-- declare
--   safe_count int;
-- begin
--   select count(*) into safe_count
--   from tmp_tenant_cleanup_candidates
--   where hard_delete_safe = true;
--
--   if safe_count > 150 then
--     raise exception 'Abortado: % tenants para borrar exceden el limite de seguridad (150).', safe_count;
--   end if;
-- end $$;
--
-- delete from public.tenants t
-- using tmp_tenant_cleanup_candidates c
-- where t.id = c.tenant_id
--   and c.hard_delete_safe = true
--   and not exists (select 1 from public.users u where u.tenant_id = t.id)
-- returning t.id, t.name, t.created_at;
--
-- commit;
