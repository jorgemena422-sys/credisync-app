# Script simplificado para actualizar variables de entorno en Cloud Run

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CrediSync Staging - Actualizar Variables de Entorno" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Función para leer variables del archivo .env
function Get-EnvVar {
    param($name)
    $line = Select-String -Path ".env.staging" -Pattern "^$name=" | Select-Object -First 1
    if ($line) {
        return ($line -split '=', 2)[1]
    }
    return $null
}

# Leer variables críticas
$superadminEmail = Get-EnvVar "SUPERADMIN_EMAIL"
$superadminPassword = Get-EnvVar "SUPERADMIN_PASSWORD"
$superadminName = Get-EnvVar "SUPERADMIN_NAME"
$bootstrapEnabled = Get-EnvVar "ENABLE_SUPERADMIN_BOOTSTRAP"
$supabaseUrl = Get-EnvVar "SUPABASE_URL"
$supabaseServiceKey = Get-EnvVar "SUPABASE_SERVICE_ROLE_KEY"
$supabaseAnonKey = Get-EnvVar "SUPABASE_ANON_KEY"
$jwtSecret = Get-EnvVar "JWT_SECRET"
$appPublicUrl = Get-EnvVar "APP_PUBLIC_URL"
$corsOrigin = Get-EnvVar "CORS_ORIGIN"
$pushVapidPublic = Get-EnvVar "PUSH_VAPID_PUBLIC_KEY"
$pushVapidPrivate = Get-EnvVar "PUSH_VAPID_PRIVATE_KEY"
$pushVapidSubject = Get-EnvVar "PUSH_VAPID_SUBJECT"
$pushJobToken = Get-EnvVar "PUSH_DAILY_SUMMARY_JOB_TOKEN"
$enableLocalScheduler = Get-EnvVar "ENABLE_LOCAL_PUSH_SCHEDULER"
$nodeEnv = Get-EnvVar "NODE_ENV"

Write-Host "Actualizando variables en Cloud Run..." -ForegroundColor Yellow
Write-Host ""

# Usar gcloud con update --set-env-vars (formato correcto)
$envString = "SUPERADMIN_EMAIL=$superadminEmail,SUPERADMIN_PASSWORD=$superadminPassword,SUPERADMIN_NAME=$superadminName,ENABLE_SUPERADMIN_BOOTSTRAP=$bootstrapEnabled,SUPABASE_URL=$supabaseUrl,SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKey,SUPABASE_ANON_KEY=$supabaseAnonKey,JWT_SECRET=$jwtSecret,APP_PUBLIC_URL=$appPublicUrl,CORS_ORIGIN=$corsOrigin,PUSH_VAPID_PUBLIC_KEY=$pushVapidPublic,PUSH_VAPID_PRIVATE_KEY=$pushVapidPrivate,PUSH_VAPID_SUBJECT=$pushVapidSubject,PUSH_DAILY_SUMMARY_JOB_TOKEN=$pushJobToken,ENABLE_LOCAL_PUSH_SCHEDULER=$enableLocalScheduler,NODE_ENV=$nodeEnv"

Write-Host "Ejecutando gcloud..." -ForegroundColor Gray
Write-Host ""

gcloud run services update credisync-api-staging `
    --region us-central1 `
    --project credisync-727b6 `
    --set-env-vars $envString

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  Variables actualizadas exitosamente!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Esperando ~30 segundos para que Cloud Run se actualice..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    Write-Host ""
    Write-Host "Ahora puedes probar login en:" -ForegroundColor Cyan
    Write-Host "  https://credisync-727b6-staging.web.app" -ForegroundColor White
    Write-Host ""
    Write-Host "Credenciales:" -ForegroundColor Cyan
    Write-Host "  Email: $superadminEmail" -ForegroundColor White
    Write-Host "  Password: $superadminPassword" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  Error al actualizar variables" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
