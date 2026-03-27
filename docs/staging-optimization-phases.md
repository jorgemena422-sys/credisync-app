# Plan de optimizacion por fases (staging)

## Estado actual
- Fase 1: completada y validada en `staging`.
- Fase 2: completada en `staging` (lazy routes, prefetch, drawers diferidos, transiciones estables y ajustes mobile base).
- Fase 3: iniciada (selectores derivados compartidos y reduccion de recomputaciones en vistas pesadas).
- Fase 4: iniciada (persistencia parcial de formularios en drawers y guardado no bloqueante).
- Fase 5: iniciada (reduccion de efectos pesados en mobile y soporte de reduced motion).
- Produccion: no promover cambios de estas fases hasta cierre de QA en `staging`.

## Reglas de ejecucion
- Implementar primero en `staging`.
- Validar rendimiento y estabilidad por fase.
- Solo promover a produccion cuando la fase este cerrada y aprobada.

## Fase 1 - Velocidad real base
Estado: Completada

### Objetivo
Reducir bloqueos y mejorar respuesta en acciones frecuentes.

### Implementado
- Guardas de runtime por entorno (`staging` vs `prod`).
- Bootstrap inicial mas estable.
- Actualizacion local + sincronizacion en background para operaciones de alta frecuencia.
- Memoizacion de calculos en vistas pesadas (clientes, prestamos, cobros).
- Menor montaje innecesario de drawers en `staging`.

### Validacion
- Build `staging`.
- Deploy `hosting:staging`.
- Pruebas de login, alertas, reset password, ajustes y panel superadmin.

## Fase 2 - Navegacion y carga percibida
Estado: Completada

### Objetivo
Disminuir saltos visuales y tiempos de espera al navegar entre modulos.

### Alcance
- Code splitting de rutas con carga diferida.
- Prefetch de vistas frecuentes en idle.
- Carga diferida de drawers y precarga en segundo plano.
- Mantener layout estable durante transiciones.

### Avance actual
- Rutas internas cargadas con `React.lazy`.
- Prefetch por rol (`admin` y `superadmin`) en idle.
- Drawers con carga diferida y precarga inicial en idle.
- Fallback de vista con contenedor estable para evitar parpadeos.

### Notas de cierre
- Skeletons finos por modulo quedan para fase siguiente de UX.
- Medicion formal de primer render por ruta queda registrada para seguimiento en QA de fase 3/4.

## Fase 3 - Optimizacion profunda de vistas pesadas
Estado: En progreso

### Objetivo
Mejorar rendimiento con volumen alto de datos.

### Alcance
- Selectores derivados compartidos.
- Reduccion de recomputaciones repetitivas.
- Evaluacion de virtualizacion para tablas largas.

### Avance actual
- Hook compartido `usePortfolioDerivedData` para mapas y agrupaciones reutilizables.
- Dashboard movido a snapshot memoizado con joins derivados precomputados.
- Vistas de clientes y prestamos alineadas al selector compartido para reducir filtros repetitivos.

## Fase 4 - Fluidez de formularios y drawers
Estado: En progreso

### Objetivo
Reducir friccion en flujos de trabajo diarios.

### Alcance
- Feedback de guardado no bloqueante.
- Persistencia parcial de formularios cuando aplique.
- Mejora de transiciones de apertura/cierre.

### Avance actual
- Drawers de cliente, prestamo y pago con borrador persistente en `staging` (recupera datos al reabrir).
- Envio de formularios con cierre inmediato del drawer y sincronizacion en background para reducir bloqueo percibido.

## Fase 5 - Pulido visual y motion eficiente
Estado: En progreso

### Objetivo
Mejorar dinamismo sin castigar rendimiento.

### Alcance
- Revisar efectos pesados en mobile.
- Homogeneizar animaciones de entrada y cambios de estado.
- Unificar patrones visuales de carga y vacios.

### Avance actual
- Mobile: reduccion progresiva de blur/backdrop y fondos fijos para mejorar fluidez.
- Ajustes de movimiento en pantallas pequenas para evitar sensacion de salto.
- Soporte `prefers-reduced-motion` para accesibilidad y rendimiento en dispositivos sensibles.

## Checklist de salida a produccion
- QA funcional completo en `staging`.
- Verificacion mobile y desktop.
- Sin regresiones en login, reset, alertas, ajustes, superadmin.
- Validacion de performance en navegacion principal.
