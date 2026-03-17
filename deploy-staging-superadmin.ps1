# Script para desplegar backend staging con configuración segura del Superadmin
# Uso: .\deploy-staging-superadmin.ps1

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CrediSync Staging - Deploy Seguro de Superadmin" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que .env.staging existe
if (-not (Test-Path ".env.staging")) {
    Write-Host "ERROR: No se encontro .env.staging" -ForegroundColor Red
    Write-Host "Asegurate de ejecutar este script desde la raiz del proyecto." -ForegroundColor Yellow
    exit 1
}

# Leer credenciales actuales (solo para mostrar)
Write-Host "Leyendo configuración de .env.staging..." -ForegroundColor Yellow
$superadminEmail = Select-String -Path ".env.staging" -Pattern "^SUPERADMIN_EMAIL=" | ForEach-Object { ($_ -split '=')[1] }
$bootstrapEnabled = Select-String -Path ".env.staging" -Pattern "^ENABLE_SUPERADMIN_BOOTSTRAP=" | ForEach-Object { ($_ -split '=')[1] }

Write-Host ""
Write-Host "Configuración actual:" -ForegroundColor Cyan
Write-Host "  SUPERADMIN_EMAIL: $superadminEmail" -ForegroundColor White
Write-Host "  ENABLE_SUPERADMIN_BOOTSTRAP: $bootstrapEnabled" -ForegroundColor White
Write-Host ""

# Confirmación
if ($bootstrapEnabled -eq "true") {
    Write-Host "⚠️  ADVERTENCIA: Bootstrap está ACTIVADO" -ForegroundColor Yellow
    Write-Host "   Esto creará/actualizará el superadmin al iniciar el backend." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Después del primer login, DEBES:" -ForegroundColor Yellow
    Write-Host "   1. Cambiar la contraseña desde la UI" -ForegroundColor Yellow
    Write-Host "   2. Setear ENABLE_SUPERADMIN_BOOTSTRAP=false" -ForegroundColor Yellow
    Write-Host "   3. Ejecutar este script nuevamente" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✓ Bootstrap está DESACTIVADO (configuración segura)" -ForegroundColor Green
    Write-Host ""
}

$confirm = Read-Host "¿Continuar con el deploy? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Iniciando deploy del backend staging..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar deploy
npm run deploy:staging:backend

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  ✓ Deploy completado exitosamente!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    
    if ($bootstrapEnabled -eq "true") {
        Write-Host "Siguientes pasos:" -ForegroundColor Cyan
        Write-Host "  1. Espera ~1 minuto a que Cloud Run se actualice" -ForegroundColor White
        Write-Host "  2. Inicia sesión en: https://credisync-727b6-staging.web.app" -ForegroundColor White
        Write-Host "  3. Cambia la contraseña después del login" -ForegroundColor White
        Write-Host "  4. Edita .env.staging y setea ENABLE_SUPERADMIN_BOOTSTRAP=false" -ForegroundColor White
        Write-Host "  5. Ejecuta este script nuevamente para aplicar cambios" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "El backend está configurado de forma segura." -ForegroundColor Green
        Write-Host "URL: https://credisync-api-staging-549719951105.us-central1.run.app" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  ✗ Error en el deploy" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
