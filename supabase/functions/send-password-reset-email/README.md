# 📧 Supabase Edge Function: Send Password Reset Email

## 📋 **Descripción**

Edge Function que envía emails de password reset usando **SendGrid** como proveedor de email.

**Ubicación:** `supabase/functions/send-password-reset-email/index.ts`

---

## 🚀 **Deploy Rápido**

### **Opción 1: Usar Script PowerShell (Recomendado)**

```powershell
# Ejecutar script de deploy
.\deploy-edge-function.ps1
```

### **Opción 2: Manual**

```bash
# 1. Instalar Supabase CLI (si no la tienes)
npm install -g supabase

# 2. Login
supabase login

# 3. Deploy
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov

# 4. Setear secreto
supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX SENDGRID_FROM_EMAIL=noreply@tu-dominio.com --project-ref objmhdwsckpekjolbkov
```

---

## 📝 **Configuración**

### **Variables de Entorno Requeridas**

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | API Key de SendGrid | `SG.XXXXXXXX...` |
| `SENDGRID_FROM_EMAIL` | Remitente verificado en SendGrid | `noreply@tu-dominio.com` |
| `SUPABASE_PROJECT_REF` | Project ID de Supabase | `objmhdwsckpekjolbkov` |

### **Setear Variables**

```bash
# En Supabase (producción)
supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXX SENDGRID_FROM_EMAIL=noreply@tu-dominio.com --project-ref objmhdwsckpekjolbkov

# En .env.staging (local)
SENDGRID_API_KEY=SG.XXXXXXXX
SENDGRID_FROM_EMAIL=noreply@tu-dominio.com
SUPABASE_PROJECT_REF=objmhdwsckpekjolbkov
```

---

## 🧪 **Testing**

### **Test Local**

```bash
# Correr Edge Function localmente
supabase functions serve send-password-reset-email

# En otra terminal, hacer POST
curl -X POST http://localhost:54321/functions/v1/send-password-reset-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456",
    "resetUrl": "http://localhost:5173/reset-password-code"
  }'
```

### **Test en Supabase**

```bash
curl -X POST https://objmhdwsckpekjolbkov.supabase.co/functions/v1/send-password-reset-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "email": "test@example.com",
    "code": "123456",
    "resetUrl": "https://credisync-727b6-staging.web.app/reset-password-code"
  }'
```

---

## 📧 **Email Template**

La Edge Function usa una plantilla HTML profesional con:

- ✅ Header con gradiente azul (brand)
- ✅ Código de verificación grande y centrado
- ✅ Botón de "Restablecer Contraseña"
- ✅ Notas de seguridad
- ✅ Footer con información de contacto

**Preview del email:**
```
┌─────────────────────────────────────┐
│     CrediSync (azul gradiente)      │
│     Gestión de Préstamos            │
├─────────────────────────────────────┤
│                                     │
│  Restablecer Contraseña             │
│                                     │
│  Hola,                              │
│                                     │
│  Hemos recibido una solicitud para  │
│  restablecer tu contraseña...       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      1 2 3 4 5 6            │   │
│  └─────────────────────────────┘   │
│                                     │
│  Este código expirará en 15 min     │
│                                     │
│     [Restablecer Contraseña]        │
│                                     │
├─────────────────────────────────────┤
│  © 2026 CrediSync                   │
│  soporte@credisync.app              │
└─────────────────────────────────────┘
```

---

## 🔧 **Personalización**

### **Cambiar Remitente**

En `index.ts`, modificar:

```typescript
from: 'CrediSync <noreply@tu-dominio.com>',
```

### **Cambiar Colores**

En `index.ts`, modificar el HTML template:

```typescript
// Header gradiente
background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);

// Código azul
color: #3b82f6;

// Botón azul
background-color: #3b82f6;
```

### **Cambiar Remitente Verificado en SendGrid**

En SendGrid Dashboard:
1. Ve a **Settings > Sender Authentication**
2. Verifica tu dominio o Single Sender
3. Configura DNS records
4. Actualiza en `index.ts`:

```typescript
from: 'CrediSync <noreply@crediscync.app>',
```

---

## 📊 **Logs y Monitoreo**

### **Ver Logs**

```bash
# Logs en tiempo real
supabase functions logs send-password-reset-email --project-ref objmhdwsckpekjolbkov

# Logs con tail
supabase functions logs send-password-reset-email --project-ref objmhdwsckpekjolbkov --tail
```

### **Ver Emails Enviados**

1. **SendGrid Email Activity:** https://app.sendgrid.com/email_activity
2. **Supabase Logs:** Dashboard → Logs → Edge Functions

---

## 🔒 **Seguridad**

### **Rate Limiting**

La función incluye validación básica. Para producción, agregar:

```typescript
// Rate limit por IP
const { data: recentRequests } = await supabase
  .from('email_rate_limit')
  .select('count')
  .eq('ip_address', ipAddress)
  .gt('created_at', new Date(Date.now() - 60000).toISOString())

if (recentRequests && recentRequests.length >= 5) {
  throw new Error('Demasiadas solicitudes')
}
```

### **Validar Origen**

```typescript
const origin = req.headers.get('origin')
if (!origin?.includes('credisync')) {
  throw new Error('Origen no autorizado')
}
```

---

## 💰 **Costos (SendGrid)**

| Plan | Precio | Emails/mes | Suficiente para |
|------|--------|------------|-----------------|
| **Free** | $0 | 3,000 | Staging / Testing |
| **Pro** | $20 | 50,000 | Producción (pequeño) |
| **Business** | $50 | 150,000 | Producción (mediano) |

---

## 🐛 **Troubleshooting**

### **Error: "SENDGRID_API_KEY no configurada"**

```bash
supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXX SENDGRID_FROM_EMAIL=noreply@tu-dominio.com --project-ref objmhdwsckpekjolbkov
```

### **Error: "Function not found"**

```bash
supabase functions deploy send-password-reset-email --project-ref objmhdwsckpekjolbkov
```

### **Email no llega**

1. Revisa spam folder
2. Verifica en SendGrid Email Activity si fue enviado
3. Revisa logs de la Edge Function
4. Confirma que el remitente/dominio esté verificado en SendGrid

---

## 📁 **Estructura del Proyecto**

```
CREDISYNC/
├── supabase/
│   └── functions/
│       └── send-password-reset-email/
│           └── index.ts          # Edge Function code
├── deploy-edge-function.ps1      # Script de deploy
├── RESEND_SETUP.md               # Guía completa
└── README.md                     # Este archivo
```

---

## 🔗 **Recursos**

- **SendGrid Docs:** https://docs.sendgrid.com
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **SendGrid Dashboard:** https://app.sendgrid.com
- **Supabase Dashboard:** https://app.supabase.com/project/objmhdwsckpekjolbkov

---

## ✅ **Checklist de Deploy**

- [ ] Supabase CLI instalada
- [ ] Cuenta SendGrid creada
- [ ] API Key obtenida de SendGrid
- [ ] Dominio/remitente verificado
- [ ] Edge Function deployed
- [ ] Secreto configurado en Supabase
- [ ] Test de email enviado
- [ ] Logs verificados
- [ ] Backend actualizado

---

**¿Listo para desplegar? Ejecuta `.\deploy-edge-function.ps1`**
