# ⚠️ Documento Histórico (Resend)

> Este documento quedó obsoleto. La integración activa del proyecto usa **SendGrid**.
>
> Usa esta guía actualizada: `EMAIL_SETUP_QUICK.md`.

# 📧 Configuración de Email con Supabase Edge Functions + Resend

## 📋 **Resumen**

Esta guía te permitirá configurar el envío de emails para password reset usando:
- **Supabase Edge Functions** (Deno)
- **Resend** (proveedor de email moderno y económico)

---

## 🚀 **PASOS DE CONFIGURACIÓN**

### **PASO 1: Crear Cuenta en Resend**

1. Ve a https://resend.com
2. Regístrate con tu cuenta de Google o GitHub
3. Verifica tu email

**Plan Free:**
- ✅ 100 emails/día
- ✅ 3,000 emails/mes
- ✅ Dominio verificado incluido
- ✅ API moderna y fácil de usar

---

### **PASO 2: Obtener API Key de Resend**

1. En Resend Dashboard, ve a **API Keys**
2. Click en **Create API Key**
3. Nombre: `CrediSync Staging`
4. Permisos: `Full Access`
5. Copia la API Key (empieza con `re_`)

```
re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### **PASO 3: Configurar Dominio en Resend**

#### **Opción A: Usar dominio de Resend (Rápido para testing)**

Resend provee dominios temporales:
```
onboarding@resend.dev
```

#### **Opción B: Configurar tu dominio (Recomendado para producción)**

1. En Resend Dashboard, ve a **Domains**
2. Click en **Add Domain**
3. Ingresa tu dominio: `tu-dominio.com`
4. Agrega los DNS records en tu proveedor de dominio:

```dns
; Type: TXT
; Name: resend._domainkey.tu-dominio.com
; Value: k1=resend._domainkey.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

; Type: MX
; Name: tu-dominio.com
; Value: feedback-smtp.us-east-1.amazonses.com
; Priority: 10

; Type: TXT
; Name: tu-dominio.com
; Value: v=spf1 include:amazonses.com ~all
```

5. Espera propagación DNS (5-10 minutos)
6. Verifica el dominio en Resend

---

### **PASO 4: Instalar Supabase CLI**

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login a Supabase
supabase login
```

---

### **PASO 5: Configurar Secrets en Supabase**

```bash
# Navega al proyecto
cd j:\Mio\Apps\GESTION DE PRESTAMOS\CREDISYNC

# Setear Resend API Key como secreto
supabase secrets set RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Verificar secretos
supabase secrets list
```

---

### **PASO 6: Deploy de la Edge Function**

```bash
# Deploy a staging
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov

# Verificar deploy
supabase functions list --project-ref objmhdwsckpekjolbkov
```

---

### **PASO 7: Actualizar Backend para Usar Edge Function**

El backend ahora llamará a la Edge Function en lugar de solo loguear el código.

**Archivo:** `server/index.js`

**Endpoint:** `/api/auth/request-password-reset`

**Cambio:** En lugar de:
```javascript
console.log(`Password reset code for ${email}: ${code}`);
```

Usar:
```javascript
// Llamar a Supabase Edge Function
const edgeFunctionUrl = 'https://objmhdwsckpekjolbkov.supabase.co/functions/v1/send-password-reset-email';

await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify({ email, code })
});
```

---

## 🧪 **TESTING**

### **Test Local de la Edge Function**

```bash
# Correr localmente
supabase functions serve send-password-reset-email

# Testear
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-password-reset-email' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

### **Test en Producción**

```bash
curl -i --location --request POST 'https://objmhdwsckpekjolbkov.supabase.co/functions/v1/send-password-reset-email' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --data-raw '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

---

## 📊 **MONITOREO**

### **Ver Logs de la Edge Function**

```bash
# Logs en tiempo real
supabase functions logs send-password-reset-email --project-ref objmhdwsckpekjolbkov

# Logs con tail
supabase functions logs send-password-reset-email --project-ref objmhdwsckpekjolbkov --tail
```

### **Ver Logs en Resend**

1. Ve a Resend Dashboard
2. **Emails** → Ver emails enviados
3. Estado: `sent`, `delivered`, `opened`, `clicked`

---

## 🔒 **SEGURIDAD**

### **Rate Limiting**

La Edge Function debe incluir rate limiting para prevenir abuso:

```typescript
// Verificar rate limit por IP
const { data: recentRequests } = await supabase
  .from('email_rate_limit')
  .select('count')
  .eq('ip_address', ipAddress)
  .gt('created_at', new Date(Date.now() - 60000).toISOString())

if (recentRequests && recentRequests.length > 5) {
  throw new Error('Demasiadas solicitudes. Intenta en 1 minuto.')
}
```

### **Validar Origen**

```typescript
// Solo permitir llamadas desde tu dominio
const origin = req.headers.get('origin')
if (origin !== 'https://credisync-727b6-staging.web.app') {
  throw new Error('Origen no autorizado')
}
```

---

## 💰 **COSTOS RESEND**

| Plan | Precio | Emails/mes | Emails/día |
|------|--------|------------|------------|
| **Free** | $0 | 3,000 | 100 |
| **Pro** | $20 | 50,000 | 2,000 |
| **Business** | $50 | 150,000 | 6,000 |

**Para staging:** Plan Free es suficiente

**Para producción:** Depende del volumen de usuarios

---

## 📁 **ESTRUCTURA DE ARCHIVOS**

```
CREDISYNC/
├── supabase/
│   ├── functions/
│   │   └── send-password-reset-email/
│   │       └── index.ts          # Edge Function
│   └── config.toml               # Configuración de Supabase
├── server/
│   └── index.js                  # Backend (actualizar para llamar Edge Function)
└── .env.staging                  # Variables de entorno
```

---

## 🔧 **SOLUCIÓN DE PROBLEMAS**

### **Error: "RESEND_API_KEY no configurada"**

```bash
# Verificar secretos
supabase secrets list

# Re-setear secreto
supabase secrets set RESEND_API_KEY=re_XXXXXXXX
```

### **Error: "Domain not verified"**

1. Verifica que el dominio esté verificado en Resend
2. Revisa los DNS records
3. Espera propagación DNS (puede tomar hasta 48 horas)

### **Error: "Function not found"**

```bash
# Redeploy
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov
```

---

## 📞 **SOPORTE**

- **Resend Docs:** https://resend.com/docs
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Resend Discord:** https://resend.com/discord

---

## ✅ **CHECKLIST FINAL**

- [ ] Cuenta Resend creada
- [ ] API Key obtenida
- [ ] Dominio verificado (o usando resend.dev)
- [ ] Supabase CLI instalada
- [ ] Secrets configurados en Supabase
- [ ] Edge Function deployed
- [ ] Backend actualizado para llamar Edge Function
- [ ] Test de email enviado exitosamente
- [ ] Logs verificados

---

**¿Listo para configurar? Sigue los pasos en orden.**
