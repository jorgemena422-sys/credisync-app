-- CrediSync - Soft Delete Implementation (PRODUCTION)
-- Este script agrega columnas deleted_at para soft-delete
-- Ejecuta este script en SQL Editor de Supabase PRODUCCION
-- URL: https://app.supabase.com/project/ntgazmqyuovongbkofub

-- ========================================
-- 1. Agregar columnas deleted_at
-- ========================================

-- Tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Users (app users table, not auth.users)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Loans
ALTER TABLE public.loans
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Payments
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Payment Promises
ALTER TABLE public.payment_promises
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Collection Notes
ALTER TABLE public.collection_notes
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Tenant Settings
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Tenant Subscriptions
ALTER TABLE public.tenant_subscriptions
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Billing Invoices
ALTER TABLE public.billing_invoices
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Billing Payments
ALTER TABLE public.billing_payments
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- User Calendar Integrations
ALTER TABLE public.user_calendar_integrations
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Push Subscriptions
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Push Delivery Logs
ALTER TABLE public.push_delivery_logs
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Platform Audit Logs
ALTER TABLE public.platform_audit_logs
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ========================================
-- 2. Crear vistas filtradas (sin registros eliminados)
-- ========================================

-- Vista de tenants activos
CREATE OR REPLACE VIEW public.active_tenants AS
SELECT * FROM public.tenants
WHERE deleted_at IS NULL;

-- Vista de usuarios activos
CREATE OR REPLACE VIEW public.active_users AS
SELECT * FROM public.users
WHERE deleted_at IS NULL;

-- Vista de clientes activos
CREATE OR REPLACE VIEW public.active_customers AS
SELECT * FROM public.customers
WHERE deleted_at IS NULL;

-- Vista de préstamos activos
CREATE OR REPLACE VIEW public.active_loans AS
SELECT * FROM public.loans
WHERE deleted_at IS NULL;

-- Vista de pagos activos
CREATE OR REPLACE VIEW public.active_payments AS
SELECT * FROM public.payments
WHERE deleted_at IS NULL;

-- ========================================
-- 3. Funciones utilitarias
-- ========================================

-- Función para eliminar suavemente un tenant y todos sus datos
CREATE OR REPLACE FUNCTION public.soft_delete_tenant(p_tenant_id text)
RETURNS void AS $$
BEGIN
    -- Marcar tenant como eliminado
    UPDATE public.tenants SET deleted_at = now() WHERE id = p_tenant_id;

    -- Marcar todos los datos relacionados como eliminados
    UPDATE public.users SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.tenant_settings SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.customers SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.loans SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.payments SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.payment_promises SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.collection_notes SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.notifications SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.user_calendar_integrations SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.push_subscriptions SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.push_delivery_logs SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.tenant_subscriptions SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.billing_invoices SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.billing_payments SET deleted_at = now() WHERE tenant_id = p_tenant_id;
    UPDATE public.platform_audit_logs SET deleted_at = now() WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Función para eliminar suavemente un usuario
CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id text)
RETURNS void AS $$
DECLARE
    v_tenant_id text;
BEGIN
    -- Obtener tenant_id del usuario
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = p_user_id;

    -- Marcar usuario como eliminado
    UPDATE public.users SET deleted_at = now() WHERE id = p_user_id;

    -- Marcar datos relacionados del usuario como eliminados
    UPDATE public.user_calendar_integrations SET deleted_at = now() WHERE user_id = p_user_id;
    UPDATE public.push_subscriptions SET deleted_at = now() WHERE user_id = p_user_id;
    UPDATE public.push_delivery_logs SET deleted_at = now() WHERE user_id = p_user_id;
    UPDATE public.collection_notes SET deleted_at = now() WHERE created_by = p_user_id;
    UPDATE public.payment_promises SET deleted_at = now() WHERE created_by = p_user_id;
    UPDATE public.platform_audit_logs SET deleted_at = now() WHERE actor_user_id = p_user_id;
    UPDATE public.billing_payments SET deleted_at = now() WHERE recorded_by = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función para restaurar un tenant eliminado
CREATE OR REPLACE FUNCTION public.restore_tenant(p_tenant_id text)
RETURNS void AS $$
BEGIN
    -- Restaurar tenant
    UPDATE public.tenants SET deleted_at = NULL WHERE id = p_tenant_id;

    -- Restaurar todos los datos relacionados
    UPDATE public.users SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.tenant_settings SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.customers SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.loans SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.payments SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.payment_promises SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.collection_notes SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.notifications SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.user_calendar_integrations SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.push_subscriptions SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.push_delivery_logs SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.tenant_subscriptions SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.billing_invoices SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.billing_payments SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
    UPDATE public.platform_audit_logs SET deleted_at = NULL WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Función para restaurar un usuario eliminado
CREATE OR REPLACE FUNCTION public.restore_user(p_user_id text)
RETURNS void AS $$
BEGIN
    -- Restaurar usuario
    UPDATE public.users SET deleted_at = NULL WHERE id = p_user_id;

    -- Restaurar datos relacionados del usuario
    UPDATE public.user_calendar_integrations SET deleted_at = NULL WHERE user_id = p_user_id;
    UPDATE public.push_subscriptions SET deleted_at = NULL WHERE user_id = p_user_id;
    UPDATE public.push_delivery_logs SET deleted_at = NULL WHERE user_id = p_user_id;
    UPDATE public.collection_notes SET deleted_at = NULL WHERE created_by = p_user_id;
    UPDATE public.payment_promises SET deleted_at = NULL WHERE created_by = p_user_id;
    UPDATE public.platform_audit_logs SET deleted_at = NULL WHERE actor_user_id = p_user_id;
    UPDATE public.billing_payments SET deleted_at = NULL WHERE recorded_by = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. Índices para mejorar rendimiento de consultas
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON public.tenants(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_loans_deleted_at ON public.loans(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_deleted_at ON public.tenant_subscriptions(deleted_at);

-- ========================================
-- 5. Función de limpieza permanente (opcional)
-- ========================================

-- Función para eliminar permanentemente registros antiguos (más de 90 días)
-- SOLO USAR CUANDO ESTÉS 100% SEGURO
CREATE OR REPLACE FUNCTION public.hard_delete_old_records(p_days_old int DEFAULT 90)
RETURNS TABLE(table_name text, deleted_count int) AS $$
DECLARE
    v_count int;
BEGIN
    -- Tenants
    EXECUTE format('SELECT COUNT(*) FROM public.tenants WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval ''%s days''', p_days_old) INTO v_count;
    IF v_count > 0 THEN
        EXECUTE format('DELETE FROM public.tenants WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval ''%s days''', p_days_old);
        RETURN NEXT;
        RETURN QUERY SELECT 'tenants'::text, v_count;
    END IF;

    -- Users (solo si no tienen datos asociados)
    EXECUTE format('SELECT COUNT(*) FROM public.users WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval ''%s days''', p_days_old) INTO v_count;
    IF v_count > 0 THEN
        EXECUTE format('DELETE FROM public.users WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval ''%s days''', p_days_old);
        RETURN NEXT;
        RETURN QUERY SELECT 'users'::text, v_count;
    END IF;
END;
$$ LANGUAGE plpgsql;
