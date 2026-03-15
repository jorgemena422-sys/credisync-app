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
PUSH_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
PUSH_VAPID_PRIVATE_KEY=TU_CLAVE_PRIVADA_VAPID
PUSH_VAPID_SUBJECT=mailto:soporte@tu-dominio.com
PUSH_DAILY_SUMMARY_JOB_TOKEN=un-token-largo-para-cloud-scheduler
ENABLE_SUPERADMIN_BOOTSTRAP=false
SUPERADMIN_EMAIL=superadmin@tu-dominio.com
SUPERADMIN_PASSWORD=password-temporal-solo-para-bootstrap
SUPERADMIN_NAME=Super Administrador
```
