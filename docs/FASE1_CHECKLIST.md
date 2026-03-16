# Fase 1 - Checklist De Cierre

Objetivo: dejar CrediSync lista para despliegue productivo inicial.

## 1) Seguridad y configuracion

- [x] Eliminar defaults inseguros en backend (credenciales hardcodeadas).
- [x] Exigir variables de entorno criticas (`SUPABASE_URL`, `SUPABASE_*_KEY`, `JWT_SECRET`).
- [x] Validar longitud minima de `JWT_SECRET` en produccion.
- [x] Restringir CORS por lista de origenes permitidos (`CORS_ORIGIN`).
- [x] Desactivar bootstrap automatico de superadmin por defecto en produccion.

## 2) Deploy productivo

- [x] Servir frontend compilado (`dist/`) desde Express en produccion.
- [x] Agregar fallback SPA para rutas no API.
- [x] Mantener respuesta JSON clara para rutas API inexistentes.

## 3) Estabilidad operativa

- [x] Corregir inconsistencias de calculo de pagos en liquidacion (`interestRateMode`).
- [x] Ejecutar smoke test tenant completo (login -> cliente -> prestamo -> pago -> reportes).
- [x] Ejecutar smoke test superadmin (summary -> users -> audit -> settings).

## 4) Base de documentacion

- [x] Actualizar `README.md` con configuracion segura y flujo de deploy.
- [x] Publicar roadmap de fases en `docs/ROADMAP_FASES.md`.
- [x] Documentar politicas RLS definitivas para produccion (`docs/RLS_PRODUCCION.md`).
- [ ] Aplicar/validar politicas RLS en el proyecto Supabase productivo.

## Comandos recomendados de validacion

```bash
npm run build
NODE_ENV=production npm run start
```

## Definicion de listo (DoD) Fase 1

- Todos los checks de seguridad y deploy marcados.
- Smoke tests manuales de tenant y superadmin completados.
- Sin bloqueantes criticos en autenticacion, prestamos o pagos.
