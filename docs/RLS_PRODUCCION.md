# RLS En Produccion

Este proyecto usa Supabase desde el backend (server-side) con `SUPABASE_SERVICE_ROLE_KEY`.
Por seguridad, el acceso directo de clientes `anon/authenticated` a las tablas de negocio debe permanecer bloqueado.

## Politica aplicada

En `supabase_schema.sql` se definen politicas `*_app_block_direct` con:

- `using (false)`
- `with check (false)`

para tablas:

- `tenants`
- `users`
- `tenant_settings`
- `platform_settings`
- `customers`
- `loans`
- `payments`
- `payment_promises`
- `collection_notes`
- `notifications`
- `user_calendar_integrations`
- `subscription_plans`
- `tenant_subscriptions`
- `billing_invoices`
- `billing_payments`
- `platform_audit_logs`

## Como validar en Supabase SQL Editor

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
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
    'subscription_plans',
    'tenant_subscriptions',
    'billing_invoices',
    'billing_payments',
    'platform_audit_logs'
  )
order by tablename, policyname;
```

Debes ver solo las politicas `*_app_block_direct` para `anon` y `authenticated`.

## Regla de operacion

- El frontend NO debe usar `supabase-js` para lectura/escritura directa de estas tablas.
- Todo acceso de negocio debe pasar por la API Express (`/api/*`).
- Si en una fase futura agregas acceso directo por cliente, crea politicas especificas por tenant/usuario, nunca `using (true)` global.
