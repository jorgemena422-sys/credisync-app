# ⚠️ IMPORTANTE: Ejecutar Schema en Supabase Staging

## El entorno staging está desplegado, pero necesitas ejecutar el schema en Supabase.

---

## 📋 Pasos para Ejecutar el Schema

### 1. Abre Supabase Staging
Ve a: https://supabase.com/dashboard/project/objmhdwsckpekjolbkov

### 2. Abre SQL Editor
En el menú lateral, haz clic en **SQL Editor**

### 3. Ejecuta el Schema
Copia y pega el contenido de `supabase_schema.sql` en el editor y ejecútalo.

O usa este comando desde tu máquina local si tienes la CLI de Supabase:

```bash
# Si tienes supabase CLI instalada
supabase db push --db-url "postgresql://postgres:[SERVICE_ROLE_KEY]@db.objmhdwsckpekjolbkov.supabase.co:5432/postgres"
```

---

## 🔑 Credenciales de Supabase Staging

- **Project URL:** https://objmhdwsckpekjolbkov.supabase.co
- **Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iam1oZHdzY2twZWtqb2xia292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3Mzg3MCwiZXhwIjoyMDg5MjQ5ODcwfQ.ljCn3fpWg00ljUowzydzCxjMhDP9uyirsAOEEoiSm80`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iam1oZHdzY2twZWtqb2xia292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzM4NzAsImV4cCI6MjA4OTI0OTg3MH0.5sNHdlbMgO2Xhx5l5x0Oeu-KxJP8iyuqQwanTYr9-Mw`

---

## ✅ Verificación Después de Ejecutar el Schema

1. **Verifica las tablas creadas:**
   - Ve a **Table Editor** en Supabase
   - Deberías ver las tablas:
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
     - `subscriptions`
     - `subscription_plans`
     - `invoices`
     - `billing_payments`
     - `audit_logs`
     - `user_calendar_integrations`
     - `push_subscriptions`
     - `push_delivery_logs`

2. **Verifica el API:**
   ```bash
   # Test health endpoint
   curl https://credisync-api-staging-549719951105.us-central1.run.app/api/health
   
   # Debería responder: {"ok":true,"service":"credisync-api"}
   ```

3. **Prueba el registro de usuario:**
   - Ve a https://credisync-727b6-staging.web.app
   - Registra un nuevo usuario
   - Debería funcionar sin errores

---

## 🚨 Posible Error y Solución

**Error común:** "relation does not exist"

**Causa:** El schema no se ha ejecutado o falló.

**Solución:**
1. Verifica que todas las tablas estén creadas en Table Editor
2. Revisa el SQL Editor para ver si hubo errores en la ejecución
3. Ejecuta el schema nuevamente si es necesario

---

## 📄 Archivo SQL

El archivo `supabase_schema.sql` contiene todo el schema necesario. Está ubicado en:
```
j:\Mio\Apps\GESTION DE PRESTAMOS\CREDISYNC\supabase_schema.sql
```
