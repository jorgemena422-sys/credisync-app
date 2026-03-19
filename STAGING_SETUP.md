# CrediSync - Staging Environment Summary

## 📊 Estado del Entorno Staging

**Fecha de configuración:** 16 de Marzo, 2026

---

## ✅ Componentes Desplegados

### 1. Supabase Staging
- **Project ID:** `objmhdwsckpekjolbkov`
- **URL:** https://objmhdwsckpekjolbkov.supabase.co
- **Estado:** ✅ Creado y configurado

### 2. Firebase Hosting
- **Project ID:** `credisync-727b6`
- **Site Staging:** `credisync-727b6-staging`
- **URL Pública:** https://credisync-727b6-staging.web.app
- **Estado:** ✅ Desplegado

### 3. Cloud Run Backend
- **Servicio:** `credisync-api-staging`
- **Región:** `us-central1`
- **URL:** https://credisync-api-staging-549719951105.us-central1.run.app
- **Estado:** ✅ Desplegado

### 4. Cloud Scheduler
- **Job:** `credisync-push-daily-summary-staging`
- **Región:** `us-central1`
- **Schedule:** `*/15 * * * *` (cada 15 minutos)
- **Timezone:** `Etc/UTC`
- **Estado:** ✅ Configurado

---

## 🔐 Variables de Entorno (.env.staging)

El archivo `.env.staging` contiene:

```env
SUPABASE_URL=https://objmhdwsckpekjolbkov.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=staging-credisync-secret-2026-change-in-prod-32chars
APP_PUBLIC_URL=https://credisync-727b6-staging.web.app
CORS_ORIGIN=https://credisync-727b6-staging.web.app
PUSH_VAPID_PUBLIC_KEY=BNYcdxdBvIjP8-cAYdUnxpVNBLh-6BIl5ghuKID8e0PlatZQ...
PUSH_VAPID_PRIVATE_KEY=tv6S2UNi6yD-vHg9qILsu9fE2KpV-jWQwBko9sdoplg
PUSH_DAILY_SUMMARY_JOB_TOKEN=staging-daily-summary-token-2026
ENABLE_SUPERADMIN_BOOTSTRAP=true
SUPERADMIN_EMAIL=superadmin@credisync-staging.app
SUPERADMIN_PASSWORD=hbViHpJC4VOePo!L*nCR
```

**⚠️ Importante:** Las credenciales del superadmin son temporales. Debes cambiarlas después del primer login y desactivar `ENABLE_SUPERADMIN_BOOTSTRAP`.

Ver `SUPERADMIN_SECURITY.md` para la guía completa de seguridad.

---

## 🚀 Comandos de Deploy

### Deploy completo de staging
```bash
npm run deploy:staging
```

### Deploy solo backend
```bash
npm run deploy:staging:backend
```

### Deploy solo frontend
```bash
npm run deploy:hosting:staging
```

Este comando genera un build aislado en `dist-staging`, por lo que no reutiliza artefactos de produccion ni el build local de `dist/`.

### Deploy scheduler
```bash
npm run deploy:staging:scheduler
```

---

## 🔍 URLs de Acceso

| Componente | URL |
|------------|-----|
| **Frontend Staging** | https://credisync-727b6-staging.web.app |
| **Backend API** | https://credisync-api-staging-549719951105.us-central1.run.app |
| **Supabase Staging** | https://objmhdwsckpekjolbkov.supabase.co |
| **Firebase Console** | https://console.firebase.google.com/project/credisync-727b6/overview |
| **Google Cloud Console** | https://console.cloud.google.com/run?project=credisync-727b6 |

---

## ⚠️ Aislamiento de Datos

El entorno staging está **completamente aislado** de producción:

| Elemento | Producción | Staging |
|----------|------------|---------|
| Supabase | `ntgazmqyuovongbkofub` | `objmhdwsckpekjolbkov` |
| Cloud Run | `credisync-api` | `credisync-api-staging` |
| Firebase Hosting | `credisync-727b6` | `credisync-727b6-staging` |
| Cloud Scheduler | `credisync-push-daily-summary` | `credisync-push-daily-summary-staging` |
| JWT Secret | Producción | Staging (único) |
| VAPID Keys | Producción | Staging (únicas) |

---

## 📝 Próximos Pasos Recomendados

### 1. Ejecutar schema en Supabase staging (PRIMERO)
   - Ir a: https://supabase.com/dashboard/project/objmhdwsckpekjolbkov
   - Abrir **SQL Editor**
   - Ejecutar `supabase_schema.sql` completo
   - Verificar en **Table Editor** que las tablas se crearon

### 2. Redeploy del backend con credenciales seguras
   ```bash
   npm run deploy:staging:backend
   ```
   Esto aplicará las nuevas credenciales del superadmin.

### 3. Iniciar sesión como superadmin
   - URL: https://credisync-727b6-staging.web.app
   - Email: `superadmin@credisync-staging.app`
   - Password: `hbViHpJC4VOePo!L*nCR`

### 4. Cambiar contraseña y desactivar bootstrap
   - Cambia la contraseña desde la UI después del primer login
   - Edita `.env.staging`: `ENABLE_SUPERADMIN_BOOTSTRAP=false`
   - Ejecuta: `npm run deploy:staging:backend`

**Ver `SUPERADMIN_SECURITY.md` para la guía completa de seguridad.**

---

## 🧪 Testing

### Verificar backend
```bash
curl https://credisync-api-staging-549719951105.us-central1.run.app/api/health
```

### Verificar scheduler
```bash
gcloud scheduler jobs describe credisync-push-daily-summary-staging --location us-central1
```

### Ejecutar scheduler manualmente
```bash
gcloud scheduler jobs run credisync-push-daily-summary-staging --location us-central1
```

---

## 📄 Archivos de Configuración

- `.env.staging` - Variables de entorno de staging
- `.firebaserc` - Configuración de Firebase (targets prod y staging)
- `firebase.json` - Configuración de Hosting con rewrited a Cloud Run
- `scripts/setup-firebase-staging.mjs` - Script de setup de Firebase staging
- `scripts/deploy-push-scheduler.mjs` - Script de deploy del scheduler

---

**Importante:** Los cambios en staging NO afectan producción.
