// Supabase Edge Function para enviar emails de password reset
// Usa SendGrid como proveedor de email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, code, resetUrl } = await req.json()

    // Validar datos requeridos
    if (!email || !code) {
      throw new Error('Email y código son requeridos')
    }

    // Obtener SendGrid API Key desde variables de entorno
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')
    const sendgridFromEmail = Deno.env.get('SENDGRID_FROM_EMAIL')
    const sendgridFromName = Deno.env.get('SENDGRID_FROM_NAME') || 'CrediSync'
    const sendgridReplyToEmail = Deno.env.get('SENDGRID_REPLY_TO_EMAIL') || sendgridFromEmail
    
    if (!sendgridApiKey) {
      console.error('SENDGRID_API_KEY no configurada')
      throw new Error('Configuración de email incompleta')
    }

    if (sendgridApiKey.startsWith('re_')) {
      console.error('SENDGRID_API_KEY invalida: parece una API key de Resend')
      throw new Error('SENDGRID_API_KEY invalida para SendGrid')
    }

    if (!sendgridFromEmail) {
      console.error('SENDGRID_FROM_EMAIL no configurada')
      throw new Error('Remitente de email no configurado')
    }

    // URL de reset (si no se proporciona, usar el código directamente)
    const resetLink = resetUrl || `https://credisync-727b6-staging.web.app/reset-password-code?email=${encodeURIComponent(email)}&code=${code}`

    // Plantilla del email (se mantiene igual)
    const emailTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codigo de Verificacion - CrediSync</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">CrediSync</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Gestión de Préstamos</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Codigo de Verificacion</h2>
              
              <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hola,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer tu contrasena. Usa el siguiente codigo de verificacion:
              </p>
              
              <!-- Código -->
              <table role="presentation" style="margin: 0 auto 24px auto;">
                <tr>
                  <td style="background-color: #f3f4f6; border-radius: 8px; padding: 20px 40px; text-align: center;">
                    <span style="font-size: 32px; font-weight: 700; color: #3b82f6; letter-spacing: 8px;">${code}</span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                Este código expirará en <strong>15 minutos</strong>
              </p>
              
              <!-- Botón -->
              <table role="presentation" style="margin: 32px auto;">
                <tr>
                  <td style="background-color: #3b82f6; border-radius: 8px;">
                    <a href="${resetLink}" 
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Continuar recuperacion
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              
              <!-- Notas de seguridad -->
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>¿No solicitaste este cambio?</strong>
              </p>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                 Si no solicitaste restablecer tu contrasena, puedes ignorar este email de forma segura. Tu contrasena permanecera sin cambios.
              </p>
              
              <!-- Soporte -->
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                ¿Necesitas ayuda? Contacta a nuestro equipo de soporte en 
                <a href="mailto:soporte@credisync.app" style="color: #3b82f6; text-decoration: none;">soporte@credisync.app</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} CrediSync. Todos los derechos reservados.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Este email fue enviado a ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Enviar email usando SendGrid API v3
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
             subject: 'Codigo de verificacion - CrediSync',
          },
        ],
        from: {
          email: sendgridFromEmail,
          name: sendgridFromName,
        },
        content: [
          {
            type: 'text/html',
            value: emailTemplate,
          },
        ],
        reply_to: {
          email: sendgridReplyToEmail,
        },
      }),
    })

    if (!sendgridResponse.ok) {
      const sendgridErrorText = await sendgridResponse.text()
      let sendgridErrorMessage = `Error enviando email via SendGrid (${sendgridResponse.status})`

      if (sendgridErrorText) {
        try {
          const sendgridData = JSON.parse(sendgridErrorText)
          console.error('Error enviando email via SendGrid:', sendgridData)

          const detailedMessage = sendgridData?.errors?.[0]?.message || sendgridData?.message
          if (detailedMessage) {
            sendgridErrorMessage = detailedMessage
          }
        } catch {
          console.error('Error enviando email via SendGrid:', sendgridErrorText)
          sendgridErrorMessage = sendgridErrorText
        }
      }

      throw new Error(sendgridErrorMessage)
    }

    console.log('Email enviado exitosamente vía SendGrid')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email enviado exitosamente vía SendGrid' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error en send-password-reset-email:', error.message)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
