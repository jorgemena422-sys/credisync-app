# Roadmap De Implementacion (Fases 1-7)

Este documento define el plan integral para llevar CrediSync a un despliegue productivo estable y escalarlo por etapas.

## Fase 1 - Base Productiva (En ejecucion)

Objetivo: dejar la plataforma lista para deploy controlado y operacion segura.

Entregables clave:
- Hardening de configuracion (`.env`, secretos, CORS, bootstrap superadmin).
- Deploy productivo backend + frontend compilado (`dist/`).
- Flujos criticos estables (login, clientes, prestamos, pagos, liquidacion).
- Validaciones de negocio consistentes entre frontend y backend.
- Checklist de smoke tests predeploy.

Checklist operativo:
- [ ] Rotar claves reales y actualizar secretos por ambiente.
- [ ] Revisar y endurecer politicas RLS de Supabase.
- [ ] Confirmar alta de superadmin con `ENABLE_SUPERADMIN_BOOTSTRAP=false` tras bootstrap.
- [ ] Verificar smoke tests manuales de modulos tenant y superadmin.

## Fase 2 - Operacion De Cobranza

Objetivo: optimizar trabajo diario del equipo de cobranza.

Entregables clave:
- Bandeja de cobranza diaria priorizada.
- Filtros por estado (hoy, proximos, vencidos, promesas).
- Registro de notas internas por cliente y prestamo.
- Promesas de pago (fecha compromiso, estado y seguimiento).

## Fase 3 - Notificaciones Internas Y Automatizacion Basica

Objetivo: que el sistema empuje la operacion de forma proactiva.

Entregables clave:
- Centro de notificaciones in-app para administradores.
- Alertas por mora, capital bajo y pagos aplicados.
- Resumen diario operativo.

## Fase 4 - Canales Externos

Objetivo: robustecer la operacion de superadministrador como panel de control de plataforma.

Entregables clave:
- Vista ejecutiva de tenants, estados y acciones operativas.
- Gestion avanzada de tenants con acciones (activar, suspender, reactivar, auditoria).
- Registro de auditoria administrativa para acciones sensibles.
- Gestion centralizada de planes y parametros comerciales.

## Fase 5 - Reglas De Riesgo Y Motor De Decision

Objetivo: convertir CrediSync en SaaS con suscripciones y beneficios por plan.

Entregables clave:
- Catalogo de planes (Starter/Growth/Pro) con limites y beneficios.
- Suscripcion por tenant con estados (trial, active, past_due, suspended, cancelled).
- Facturacion manual mensual con registro de pagos y validacion.
- Modo solo lectura por suspension con acceso a pantalla de regularizacion.

## Fase 6 - Auditoria Y Cumplimiento

Objetivo: trazabilidad completa para operacion y supervision.

Entregables clave:
- Log de eventos de usuario (alta, edicion, eliminacion, cobro).
- Auditoria de acciones sensibles de superadmin.
- Reversion/anulacion controlada de pagos.
- Historial de cambios por entidad con fecha y actor.

## Fase 7 - Escalamiento Premium

Objetivo: evolucionar a una plataforma de gestion avanzada.

Entregables clave:
- Timeline 360 del cliente (interacciones, pagos, promesas, notas).
- Adjuntos/documentos por cliente y prestamo.
- Analitica avanzada por cohortes y rendimiento de cartera.
- Comparativa multi-tenant para supervision ejecutiva.

## Orden Recomendado

1. Completar Fase 1 antes de abrir nuevos frentes.
2. Ejecutar Fases 2 y 3 en paralelo controlado.
3. Implementar Fases 4 y 5 para fortalecer monetizacion y gobierno de plataforma.
4. Cerrar con Fases 6 y 7 para compliance y escalamiento.

## Criterio De Cierre Por Fase

Una fase se considera cerrada cuando cumple:
- Entregables funcionales validados.
- Smoke tests completos sin regresiones criticas.
- Documentacion actualizada.
- Riesgos abiertos registrados con plan de mitigacion.
