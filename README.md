# CrediSync

Aplicacion web de gestion de prestamos con frontend en Vite y backend en Node.js (Express).

## Arquitectura actual

- Frontend: `index.html` + `src/main.jsx` + `src/styles.css`
- Backend API: `server/index.js`
- Base de datos: Supabase PostgreSQL
- Sesion: JWT en cookie HttpOnly (`__session`)
- Registro/login: usuarios en Supabase Authentication (`auth.users`)
- Aislamiento de datos: multi-tenant por usuario (`tenants` + `tenant_settings`)

## Configuracion

1. Instala dependencias:

```bash
npm install
```

2. Crea un archivo `.env` en la raiz del proyecto con:

```env
PORT=3001
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=TU_ANON_KEY
JWT_SECRET=usa-un-secreto-largo-aleatorio-de-32-o-mas-caracteres
CORS_ORIGIN=http://localhost:5173
APP_PUBLIC_URL=http://localhost:3001
RESEND_API_KEY=re_placeholder
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=CrediSync
RESEND_REPLY_TO_EMAIL=soporte@tu-dominio.com
BILLING_AUTO_EMAIL_ENABLED=true
PUSH_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
PUSH_VAPID_PRIVATE_KEY=TU_CLAVE_PRIVADA_VAPID
PUSH_VAPID_SUBJECT=mailto:soporte@tu-dominio.com
PUSH_DAILY_SUMMARY_JOB_TOKEN=un-token-largo-para-cloud-scheduler
ENABLE_SUPERADMIN_BOOTSTRAP=false
SUPERADMIN_EMAIL=superadmin@tu-dominio.com
SUPERADMIN_PASSWORD=password-temporal-solo-para-bootstrap
SUPERADMIN_NAME=Super Administrador
```

Para despliegue productivo puedes usar como base `./.env.production.example`.

> Si no tienes `SUPABASE_SERVICE_ROLE_KEY`, temporalmente puedes usar `SUPABASE_ANON_KEY`. En ese modo, el alta usa `supabase.auth.signUp` y puede requerir verificacion de correo segun tu configuracion de Auth.
>
> `ENABLE_SUPERADMIN_BOOTSTRAP` debe permanecer en `false` en produccion. Activalo solo para crear el primer superadministrador y vuelve a apagarlo.
>
> Para envio de comprobantes y facturas por correo, configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL`. Si `BILLING_AUTO_EMAIL_ENABLED=true`, las facturas creadas desde superadmin se intentaran enviar automaticamente al correo propietario del tenant.

3. En Supabase, ejecuta `supabase_schema.sql` (y opcionalmente `supabase_reset_data.sql`).

> Importante: esta version ya usa multi-tenant. Si vienes de la version anterior, vuelve a ejecutar `supabase_schema.sql` para crear `tenants`, `tenant_settings` y las columnas `tenant_id`/`status` necesarias.

## Como ejecutar

- Desarrollo (frontend + backend):

```bash
npm run dev
```

- Solo API Node:

```bash
npm run start
```

## Deploy productivo

1. Genera assets del frontend:

```bash
npm run build
```

2. Levanta el servidor en modo produccion:

```bash
NODE_ENV=production npm run start
```

En produccion, Express servira `dist/` automaticamente si existe `dist/index.html`.

## Fase 2 (Firebase mismo dominio)

Objetivo: servir frontend y backend bajo un unico dominio para mantener cookies de sesion estables.

1. Define dominio final en `.env` de produccion:

```env
APP_PUBLIC_URL=https://tu-dominio-final.com
CORS_ORIGIN=https://tu-dominio-final.com
```

2. Configura Firebase Hosting con rewrite a backend:
   - archivo: `firebase.json`
   - rewrite API: `/api/**`
   - rewrite calendario ICS: `/calendar/**`
   - fallback SPA: `** -> /index.html`

3. Ajusta `serviceId` and `region` en `firebase.json` para tu backend real.

4. Crea `.firebaserc` local desde `.firebaserc.example` y coloca tu project id.

5. Build + deploy de Hosting:

```bash
npm run build
firebase deploy --only hosting
```

Nota: el backend debe estar desplegado en el servicio indicado por `hosting.rewrites.run.serviceId`.

## Push diario (PWA iPhone)

- Para habilitar push en staging, `.env.staging` debe incluir `PUSH_VAPID_PUBLIC_KEY` y `PUSH_VAPID_PRIVATE_KEY`.
- Verificacion rapida: `GET /api/push/status` debe responder `push.configured=true` y `push.vapidPublicKey` no vacio.
- El envio del resumen diario corre por endpoint protegido: `POST /api/jobs/push-daily-summary`.
- Programa Cloud Scheduler para llamar ese endpoint cada 15 minutos con header:

```text
Authorization: Bearer <PUSH_DAILY_SUMMARY_JOB_TOKEN>
```

- El backend envia una sola vez por usuario cuando detecta `8:00 AM` en su zona horaria local.
- Si no hay cobros del dia, tambien envia push con mensaje "no hay cobros programados".

## Seguridad minima antes de deploy

- Nunca publiques claves reales en el repositorio (`.env` debe estar en `.gitignore`).
- Usa `JWT_SECRET` largo y unico por ambiente.
- Define `CORS_ORIGIN` explicito para tu dominio final.
- Revisa politicas RLS en Supabase antes de abrir la plataforma a usuarios reales.
- Desactiva `ENABLE_SUPERADMIN_BOOTSTRAP` tras crear el superadmin inicial.

## Fase 0 (obligatoria antes de publicar)

1. Rota secretos comprometidos en Supabase/Auth:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `JWT_SECRET`
   - `SUPERADMIN_PASSWORD`
2. Usa un unico dominio de entrada (recomendado para Firebase):
   - `APP_PUBLIC_URL=https://TU_DOMINIO_FINAL`
   - `CORS_ORIGIN=https://TU_DOMINIO_FINAL`
3. Confirma que `ENABLE_SUPERADMIN_BOOTSTRAP=false` en produccion.
4. Ejecuta validacion automatica:

```bash
npm run check:phase0
```

## Smoke tests Fase 1

Con API levantada puedes ejecutar:

```bash
npm run smoke:phase1
```

Variables opcionales para pruebas end-to-end:

```env
SMOKE_API_BASE=http://localhost:3001
SMOKE_ADMIN_EMAIL=admin@tu-dominio.com
SMOKE_ADMIN_PASSWORD=tu-password
SMOKE_SUPERADMIN_EMAIL=superadmin@tu-dominio.com
SMOKE_SUPERADMIN_PASSWORD=tu-password
SMOKE_ALLOW_REGISTER=0
```

Si no defines credenciales, el smoke test valida solo salud de API y control de sesion.

`SMOKE_ALLOW_REGISTER=1` permite que el smoke cree un admin/tenant si no existe. Por seguridad, por defecto esta desactivado.

## Smoke tests suscripciones (cambio de plan)

Con API levantada puedes ejecutar:

```bash
npm run smoke:subscriptions
```

Este smoke valida el flujo simplificado:
- superadmin cambia el plan del tenant,
- el tenant refleja el plan actualizado en su sesion.

Usa las mismas variables `SMOKE_*` del bloque anterior. Si faltan credenciales, el script ejecuta healthcheck y marca el flujo como `SKIP`.

## Smoke test integridad de facturacion (Fase 3)

Con API levantada puedes ejecutar:

```bash
npm run smoke:billing
```

Este smoke valida que:
- un pago parcial no liquide la factura,
- la factura solo pase a `paid` cuando se completa el monto,
- el estado persistido de la factura quede consistente.

## Limpieza segura de tenants huerfanos

Script SQL listo para ejecutar en Supabase SQL Editor:

- `scripts/cleanup-orphan-tenants-safe.sql`

Incluye:
- snapshot y preview de tenants huerfanos,
- dry-run de borrado seguro,
- borrado final con valvula de seguridad,
- opcion para desactivar registro publico de nuevos workspaces.

## Documentos de despliegue

- `docs/FASE1_CHECKLIST.md`
- `docs/RLS_PRODUCCION.md`
- `docs/ROADMAP_FASES.md`

## Funcionalidades

- Login / logout con cookie segura.
- Creacion de usuario administrador desde el login.
- Separacion de datos por usuario/tenant.
- Capital budget manual por tenant con monitoreo en tiempo real.
- Dashboard de cartera (KPIs y proximos vencimientos).
- Modulo de prestamos, clientes y pagos.
- Reportes de recuperacion y riesgo.
- Vista de superadministrador para gestionar cuentas de plataforma.
- Planes y suscripciones SaaS por tenant (trial, activa, pendiente, suspendida, cancelada).
- Gestion manual de cobro fuera de la plataforma (sin pantalla de pago para tenant).
- Modo solo lectura automatico por suspension con reactivacion administrada por superadmin.
- Parametros de configuracion del sistema.
- Sincronizacion ICS por usuario interno para recibir alertas de cobro del dia en calendario personal.
- Push web diario por usuario (PWA) a las 8:00 AM hora local, con resumen general del dia.

## Endpoints principales

- `POST /api/auth/register-admin`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/bootstrap`
- `GET /api/superadmin/users`
- `GET /api/superadmin/plans`
- `POST /api/superadmin/plans`
- `PUT /api/superadmin/plans/:id`
- `GET /api/superadmin/subscriptions`
- `GET /api/superadmin/tenants/:tenantId/subscription`
- `PUT /api/superadmin/tenants/:tenantId/subscription`
- `POST /api/superadmin/tenants/:tenantId/invoices`
- `POST /api/superadmin/invoices/:invoiceId/payments`
- `PATCH /api/superadmin/payments/:paymentId/status`
- `GET /api/superadmin/audit-logs`
- `GET /api/superadmin/users/:id/audit`
- `GET /api/superadmin/tenants/:tenantId/audit`
- `PATCH /api/superadmin/users/:id/status`
- `PATCH /api/superadmin/users/:id/role`
- `POST /api/superadmin/users/:id/reset-password`
- `GET/POST /api/customers`
- `GET/POST /api/loans`
- `GET /api/loans/:id`
- `GET/POST /api/payments`
- `GET/POST /api/payment-promises`
- `PATCH /api/payment-promises/:id/status`
- `GET/POST /api/collection-notes`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `GET /api/subscription/summary`
- `GET /api/subscription/current`
- `GET/PUT /api/user-calendar`
- `POST /api/user-calendar/rotate-token`
- `GET /calendar/:token.ics`
- `GET /api/push/status`
- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `POST /api/push/test`
- `POST /api/jobs/push-daily-summary` (token interno)
- `GET/PUT /api/settings`
- `GET /api/reports/overview`
