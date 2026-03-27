# Checklist de salida a produccion - 2026-03-26

## Alcance de esta liberacion

- Cambios del perfil `Administrador`.
- Cambios del perfil `Superadministrador`.
- Modelo SaaS de suscripcion mensual unica.
- Ajustes de cobros, tenants, notificaciones y push PWA.
- Mejoras de UX/responsive aplicadas y validadas primero en `staging`.

## Verificaciones previas

- [x] Build de `staging` validado.
- [x] Deploy de `staging` validado.
- [x] Flujos criticos probados en `staging`:
  - registro de nuevo tenant,
  - notificacion interna de nuevo tenant,
  - push de nuevo tenant para superadmin,
  - ocultar `tenant_signup_alert` para tenants normales,
  - eliminacion de tenant sin falso error,
  - eliminacion de usuario sin falso error,
  - responsive mobile en `Cobros` y `Tenants`.
- [x] Produccion apunta al proyecto Supabase correcto.
- [x] Produccion conserva tablas criticas:
  - `notifications`,
  - `push_subscriptions`,
  - `tenant_subscriptions`,
  - `billing_invoices`,
  - `platform_audit_logs`,
  - `user_calendar_integrations`.

## Riesgos detectados antes del deploy

- [ ] `PUSH_DAILY_SUMMARY_JOB_TOKEN` sigue vacio en `.env.production`.
  Impacto: el job diario de push continuara deshabilitado en produccion.
  No rompe la app principal.

- [ ] El superadmin productivo no tiene `push_subscriptions` activas actualmente.
  Impacto: las altas nuevas no enviaran push al superadmin hasta activar push en un dispositivo real desde `Superadmin > Ajustes`.
  No rompe la app principal.

## Cambios incluidos

### Administrador

- [x] Suscripcion mensual unica.
- [x] Bloqueo de acceso por suscripcion suspendida.
- [x] Cuentas nuevas arrancan activas.
- [x] Suspension automatica por falta de pago al cierre del ciclo.
- [x] Mejoras de rendimiento por fases ya validadas en `staging`.

### Superadministrador

- [x] Dashboard modernizado.
- [x] Ajustes de mensualidad base y moneda.
- [x] Unificacion de tenants al plan unico.
- [x] Gestion de tenants y proteccion del tenant superadmin.
- [x] Drawer operativo en `Suscripciones y cobros`.
- [x] Acciones de facturacion, suspension y reactivacion.
- [x] Notificaciones internas y push por nuevo tenant.
- [x] Correccion de falsos errores al crear/eliminar.
- [x] Correccion para que solo superadmin vea `tenant_signup_alert`.
- [x] Correccion responsive mobile en `Cobros` y `Tenants`.

## Checklist de deploy

- [x] Ejecutar build de produccion.
- [x] Desplegar backend `credisync-api`.
- [x] Desplegar hosting `prod`.
- [x] Verificar login tecnico / sesion superadmin (`/api/auth/me`).
- [x] Verificar `bootstrap`.
- [x] Verificar panel superadmin base.
- [x] Verificar `Tenants`.
- [x] Verificar `Suscripciones y cobros`.
- [ ] Verificar alta de nuevo tenant.
- [ ] Verificar que el tenant nuevo no vea alerta `tenant_signup_alert`.
- [ ] Verificar que superadmin si vea la alerta interna.
- [ ] Reactivar push en un dispositivo de superadmin en produccion.

## Checklist posterior al deploy

- [x] Confirmar revision nueva de Cloud Run en produccion.
- [x] Confirmar hosting publicado en `https://credisync-727b6.web.app`.
- [x] Hacer smoke test funcional rapido.
- [ ] Programar configuracion futura del token `PUSH_DAILY_SUMMARY_JOB_TOKEN`.

## Ajustes posteriores

- [x] Se reforzo la verificacion de vencimientos de suscripciones durante trafico autenticado y antes de cargar el panel global de suscripciones.
- [x] `Pendiente estimado` en el dashboard superadmin ahora usa el saldo pendiente agregado por tenant y no solo la ultima factura encontrada.

## Estado del deploy

- Backend desplegado en produccion:
  - Servicio: `credisync-api`
  - Revision: `credisync-api-00022-62z`
- Hosting publicado en:
  - `https://credisync-727b6.web.app`
- Smoke test de lectura validado:
  - `/api/health` -> `200`
  - `/api/public/platform` -> `200`
  - Smoke autenticado pendiente de verificacion manual desde sesion real superadmin.
