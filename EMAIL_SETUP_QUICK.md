# 📧 EMAIL SETUP CON SENDGRID - GUÍA RÁPIDA

## 🎯 **Objetivo**

Configurar el envío de emails para password reset usando **Supabase Edge Functions + SendGrid**.

---

## ⚡ **SETUP EN 5 MINUTOS**

### **1. Crear Cuenta en SendGrid** (2 min)

```
1. Ve a https://sendgrid.com
2. Click en "Get Started" o "Sign Up"
3. Login con Google o GitHub
4. Verifica tu email
```

---

### **2. Obtener API Key** (1 min)

```
1. En SendGrid Dashboard → Settings → API Keys
2. Click "Create API Key"
3. Nombre: "CrediSync Staging"
4. Permisos: "Full Access"
5. Copia la API Key (SG.XXXXXXXX...)
```

**Guarda la API Key en un lugar seguro!**

---

### **3. Instalar Supabase CLI** (1 min)

```bash
npm install -g supabase
supabase login
```

---

### **4. Configurar API Key** (30 sec)

**Opción A: En Supabase (Recomendado)**

```bash
supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX --project-ref objmhdwsckpekjolbkov
```

**Opción B: En .env.staging (Local)**

Edita `.env.staging`:
```env
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
SENDGRID_FROM_EMAIL=noreply@tu-dominio.com
```

---

### **5. Deploy de la Edge Function** (30 sec)

```bash
# Usando el script PowerShell
.\deploy-edge-function.ps1

# O manual
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov
```

---

## ✅ **LISTO!**

La Edge Function está desplegada y configurada.

---

## 🧪 **TESTING**

### **Opción 1: Desde la App**

1. Ve a https://credisync-727b6-staging.web.app
2. Click en "Forgot Password?"
3. Ingresa email: `superadmin@credisync-staging.app`
4. Click "Enviar Clave"
5. Revisa tu email

### **Opción 2: curl**

```bash
curl -X POST https://objmhdwsckpekjolbkov.supabase.co/functions/v1/send-password-reset-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "email": "tu-email@ejemplo.com",
    "code": "123456"
  }'
```

---

## 📊 **VERIFICACIÓN**

### **Ver Logs**

```bash
supabase functions logs send-password-reset-email --project-ref objmhdwsckpekjolbkov --tail
```

### **Ver Actividad en SendGrid**

1. Ve a https://app.sendgrid.com/email_activity
2. Busca el destinatario del test
3. Verifica estado `processed` / `delivered`

---

## 🔧 **CONFIGURACIÓN ADICIONAL (Opcional)**

### **Usar Dominio Propio**

Para producción, configura tu dominio en SendGrid:

```
1. SendGrid Dashboard → Settings → Sender Authentication
2. Add Domain: tudominio.com
3. Agrega DNS records en tu proveedor
4. Espera propagación (5-10 min)
5. Actualiza en index.ts: from: 'CrediSync <noreply@tudominio.com>'
```

### **Cambiar Email de Soporte**

En `supabase/functions/send-password-reset-email/index.ts`:

```typescript
reply_to: 'tu-email@tudominio.com',
```

---

## 💰 **COSTOS**

| Uso | Plan | Precio |
|-----|------|--------|
| **Staging** | Free | $0/mes (3,000 emails) |
| **Producción (pequeño)** | Pro | $20/mes (50,000 emails) |
| **Producción (grande)** | Business | $50/mes (150,000 emails) |

---

## 🐛 **PROBLEMAS COMUNES**

### **Email no llega**

✅ Revisa spam folder  
✅ Verifica en SendGrid Email Activity  
✅ Revisa logs de la Edge Function  
✅ Confirma que la API Key es correcta  

### **Error: "SENDGRID_API_KEY no configurada"**

```bash
supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXX --project-ref objmhdwsckpekjolbkov
```

### **Error: "Function not found"**

```bash
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov
```

---

## 📁 **ARCHIVOS CREADOS**

| Archivo | Propósito |
|---------|-----------|
| `supabase/functions/send-password-reset-email/index.ts` | Edge Function |
| `deploy-edge-function.ps1` | Script de deploy |
| `RESEND_SETUP.md` | Guía histórica (pendiente de renombre) |
| `.env.staging` | Variables de entorno (actualizado) |

---

## 🔗 **LINKS ÚTILES**

- **SendGrid Dashboard:** https://app.sendgrid.com
- **Supabase Dashboard:** https://app.supabase.com/project/objmhdwsckpekjolbkov
- **SendGrid Docs:** https://docs.sendgrid.com
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions

---

## 📞 **SOPORTE**

- **SendGrid Support:** https://support.sendgrid.com
- **Supabase Discord:** https://discord.supabase.com
- **Email:** soporte@credisync.app

---

**¿Listo? Comienza con el paso 1 ahora mismo!**
