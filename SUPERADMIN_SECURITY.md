# 🔐 Seguridad del Super Administrador - Staging

## ⚠️ IMPORTANTE: Lee esto antes de proceder

---

## 📋 Configuración Actual de Staging

### Credenciales del Super Administrador

| Campo | Valor |
|-------|-------|
| **Email** | `superadmin@credisync-staging.app` |
| **Password** | `hbViHpJC4VOePo!L*nCR` |
| **Nombre** | `Super Administrador Staging` |
| **Rol** | `SuperAdministrador` |

---

## 🚀 PASOS PARA INICIALIZAR EL SUPERADMIN

### 1. Ejecutar el Schema en Supabase (PRIMERO)

Antes de nada, debes ejecutar el schema:

1. Ve a: https://supabase.com/dashboard/project/objmhdwsckpekjolbkov
2. Haz clic en **SQL Editor**
3. Copia y pega el contenido de `supabase_schema.sql`
4. Ejecuta el script completo
5. Verifica en **Table Editor** que las tablas se crearon

### 2. Redeploy del Backend con las Nuevas Credenciales

El backend necesita reiniciarse para leer las nuevas variables:

```bash
npm run deploy:staging:backend
```

Esto actualizará Cloud Run con:
- `ENABLE_SUPERADMIN_BOOTSTRAP=true`
- `SUPERADMIN_EMAIL=superadmin@credisync-staging.app`
- `SUPERADMIN_PASSWORD=hbViHpJC4VOePo!L*nCR`

### 3. Esperar a que el Bootstrap se Ejecute

Al iniciar, el backend automáticamente:
- Verifica si existe el usuario `superadmin@credisync-staging.app`
- Si NO existe → Lo crea con el rol `SuperAdministrador`
- Si YA existe → Actualiza sus datos

### 4. Iniciar Sesión

1. Ve a: https://credisync-727b6-staging.web.app
2. Ingresa las credenciales del superadmin
3. Deberías poder acceder al panel de administración

### 5. DESACTIVAR Bootstrap (CRÍTICO)

**Después del primer login**, debes desactivar el bootstrap:

1. Edita `.env.staging`:
   ```env
   ENABLE_SUPERADMIN_BOOTSTRAP=false
   ```

2. Haz redeploy del backend:
   ```bash
   npm run deploy:staging:backend
   ```

---

## 🔒 MEJORES PRÁCTICAS DE SEGURIDAD

### ✅ Lo que HICIMOS para proteger el staging:

1. **Contraseña fuerte generada aleatoriamente** (20 caracteres)
   - Mayúsculas, minúsculas, números y símbolos
   - No es predecible ni está en diccionarios

2. **Email exclusivo de staging**
   - `@credisync-staging.app` en lugar de un email personal
   - Previene confusión con producción

3. **Bootstrap solo para inicialización**
   - Se desactiva después del primer uso
   - No permanece activo en producción

4. **Aislamiento total de producción**
   - Supabase diferente
   - Backend diferente
   - Credenciales únicas

### ⚠️ Lo que DEBES HACER:

1. **Cambiar la contraseña después del primer login**
   - Aunque el bootstrap es seguro, cambia la contraseña desde la UI
   - Usa un password manager para guardarla

2. **Nunca commitear `.env.staging`**
   - Está en `.gitignore`
   - No lo subas al repositorio bajo ninguna circunstancia

3. **Rotar credenciales periódicamente**
   - Cada 30-90 días en staging
   - Inmediatamente si hay sospecha de compromiso

4. **Monitorear logs de acceso**
   - Revisa `audit_logs` en Supabase
   - Configura alertas de accesos inusuales

---

## 🛡️ Cómo Funciona el Bootstrap Seguro

### El Código (`server/index.js`)

```javascript
async function ensureDefaultSuperadmin() {
  if (!ENABLE_SUPERADMIN_BOOTSTRAP) {
    return; // No hace nada si está desactivado
  }

  // 1. Busca si el usuario ya existe
  let authUser = await findAuthUserByEmail(DEFAULT_SUPERADMIN_EMAIL);

  if (!authUser) {
    // 2. Si NO existe → Lo crea
    await supabase.auth.admin.createUser({
      email: DEFAULT_SUPERADMIN_EMAIL,
      password: DEFAULT_SUPERADMIN_PASSWORD,
      email_confirm: true, // Confirmado automáticamente
      user_metadata: {
        name: DEFAULT_SUPERADMIN_NAME,
        role: SUPERADMIN_ROLE
      }
    });
  } else {
    // 3. Si YA existe → Solo actualiza metadata
    await supabase.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
      user_metadata: {
        role: SUPERADMIN_ROLE,
        name: DEFAULT_SUPERADMIN_NAME
      }
    });
  }

  // 4. Crea/actualiza el usuario en la tabla app.users
  await upsertAppUserFromAuth(authUser, SUPERADMIN_ROLE, {...});
}
```

### ¿Por qué es seguro?

1. **Solo corre UNA VEZ** al iniciar el servidor
2. **Requiere SERVICE_ROLE_KEY** (solo backend lo tiene)
3. **No expone la contraseña** en logs (en producción)
4. **Idempotente**: No falla si el usuario ya existe

---

## 🚨 Posibles Vulnerabilidades y Cómo las Prevenimos

| Vulnerabilidad | Prevención |
|----------------|------------|
| **Contraseña débil** | Generada con `crypto.randomBytes()` |
| **Bootstrap activo en prod** | Warning en logs + debe setearse manualmente |
| **Credenciales en repo** | `.env.staging` en `.gitignore` |
| **Email personal expuesto** | Email exclusivo de staging |
| **Service Role Key expuesto** | Solo en Cloud Run (env vars) |
| **Usuario sin confirmar** | `email_confirm: true` en el bootstrap |

---

## 📝 Checklist de Seguridad

- [ ] Schema ejecutado en Supabase staging
- [ ] Backend redeployado con nuevas credenciales
- [ ] Login de superadmin exitoso
- [ ] Contraseña cambiada desde la UI
- [ ] `ENABLE_SUPERADMIN_BOOTSTRAP=false`
- [ ] Redeploy con bootstrap desactivado
- [ ] Credenciales guardadas en password manager
- [ ] `.env.staging` NO está en git

---

## 🔍 Verificación Post-Configuración

### 1. Verificar que el usuario existe

En Supabase Dashboard → Authentication → Users:
- Deberías ver `superadmin@credisync-staging.app`
- Estado: `email_confirmed`

### 2. Verificar el rol

En Supabase SQL Editor:
```sql
SELECT email, role, status, name 
FROM users 
WHERE email = 'superadmin@credisync-staging.app';
```

Debería mostrar:
- `role`: `SuperAdministrador`
- `status`: `active`

### 3. Verificar bootstrap desactivado

En Google Cloud Console → Cloud Run → credisync-api-staging:
- Variables de entorno → `ENABLE_SUPERADMIN_BOOTSTRAP` = `false`

---

## 🆘 Solución de Problemas

### Error: "User already registered"

**Causa:** El usuario ya fue creado previamente.

**Solución:**
1. Inicia sesión con las credenciales configuradas
2. Si olvidaste la contraseña, usa el reset desde Supabase

### Error: "Invalid credentials"

**Causa:** Las credenciales en Cloud Run no coinciden con `.env.staging`.

**Solución:**
```bash
# Redeploy para aplicar las variables
npm run deploy:staging:backend
```

### Error: "Table does not exist"

**Causa:** El schema no se ejecutó en Supabase.

**Solución:** Ejecuta `supabase_schema.sql` en el SQL Editor.

---

**¿Listo para proceder? Sigue los pasos en orden.**
