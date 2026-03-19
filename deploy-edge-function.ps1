# Script para desplegar Supabase Edge Function de Password Reset Email
# Requiere: Supabase CLI instalada y autenticada

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CrediSync - Deploy Supabase Edge Function + SendGrid" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Supabase CLI
Write-Host "Verificando Supabase CLI..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version 2>&1
    Write-Host "Supabase CLI encontrada: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Supabase CLI no encontrada. Instalala con Scoop: scoop bucket add supabase https://github.com/supabase/scoop-bucket.git ; scoop install supabase" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar autenticación
Write-Host "Verificando autenticación con Supabase..." -ForegroundColor Yellow
try {
    $supabaseStatus = supabase status 2>&1
    Write-Host "Autenticación OK" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No estás autenticado con Supabase. Ejecuta: supabase login" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Leer .env.staging para obtener SENDGRID_API_KEY
Write-Host "Leyendo configuración de .env.staging..." -ForegroundColor Yellow
if (-not (Test-Path ".env.staging")) {
    Write-Host "ERROR: .env.staging no encontrado" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content ".env.staging"
$sendgridApiKey = $envContent | Where-Object { $_ -match "^SENDGRID_API_KEY=" } | ForEach-Object { ($_ -split '=', 2)[1] }
$sendgridFromEmail = $envContent | Where-Object { $_ -match "^SENDGRID_FROM_EMAIL=" } | ForEach-Object { ($_ -split '=', 2)[1] }
$supabaseProjectRef = $envContent | Where-Object { $_ -match "^SUPABASE_PROJECT_REF=" } | ForEach-Object { ($_ -split '=', 2)[1] }

if (-not $sendgridApiKey -or $sendgridApiKey -eq "replace-with-your-sendgrid-api-key") {
    Write-Host ""
    Write-Host "⚠️  SENDGRID_API_KEY no configurada en .env.staging" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para obtener tu API Key:" -ForegroundColor Cyan
    Write-Host "  1. Ve a https://app.sendgrid.com/settings/api_keys" -ForegroundColor White
    Write-Host "  2. Crea una nueva API Key" -ForegroundColor White
    Write-Host "  3. Copia la API Key (empieza con 'SG.')" -ForegroundColor White
    Write-Host "  4. Agrega al .env.staging: SENDGRID_API_KEY=SG.XXXXXXXX" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "¿Quieres continuar sin configurar SENDGRID_API_KEY? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Deploy cancelado." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Configuración:" -ForegroundColor Cyan
Write-Host "  Supabase Project: $supabaseProjectRef" -ForegroundColor White
Write-Host "  SendGrid API Key: $(if ($sendgridApiKey -and $sendgridApiKey -ne "replace-with-your-sendgrid-api-key") { 'Configurada ✓' } else { 'No configurada ✗' })" -ForegroundColor White
Write-Host "  SendGrid From Email: $(if ($sendgridFromEmail) { $sendgridFromEmail } else { 'No configurado ✗' })" -ForegroundColor White
Write-Host ""

# Confirmar deploy
$confirm = Read-Host "¿Continuar con el deploy de la Edge Function? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Desplegando Edge Function a Supabase..." -ForegroundColor Cyan
Write-Host ""

# Deploy de la Edge Function
try {
    supabase functions deploy send-password-reset-email --project-ref $supabaseProjectRef
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "  ✓ Edge Function desplegada exitosamente!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "URL de la Edge Function:" -ForegroundColor Cyan
        Write-Host "  https://$supabaseProjectRef.supabase.co/functions/v1/send-password-reset-email" -ForegroundColor White
        Write-Host ""
        Write-Host "Siguientes pasos:" -ForegroundColor Cyan
        Write-Host "  1. Configura secretos de SendGrid en Supabase:" -ForegroundColor White
        Write-Host "     supabase secrets set SENDGRID_API_KEY=SG.XXXXXXXX SENDGRID_FROM_EMAIL=noreply@tu-dominio.com SENDGRID_FROM_NAME=CrediSync SENDGRID_REPLY_TO_EMAIL=soporte@tu-dominio.com --project-ref $supabaseProjectRef" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  2. Testea la Edge Function:" -ForegroundColor White
        Write-Host "     curl -X POST https://$supabaseProjectRef.supabase.co/functions/v1/send-password-reset-email ..." -ForegroundColor Gray
        Write-Host ""
        Write-Host "  3. Redeploy del backend para aplicar cambios:" -ForegroundColor White
        Write-Host "     npm run deploy:staging:backend" -ForegroundColor Gray
        Write-Host ""
    } else {
        throw "Deploy falló con código $LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  ✗ Error en el deploy" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
