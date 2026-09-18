# Traspaso actual

**Este archivo es el estado vivo del proyecto.** Lo actualiza quien cierra una
sesión de trabajo y lo lee quien abre la siguiente, sea JP o Tomás. Reemplaza al
mecanismo de pedirle a la IA un resumen para pegárselo a la IA del otro: acá el
canal es git.

**Cómo se usa:**

1. Al abrir la sesión: `git pull` y leer este archivo.
2. Al cerrarla: reescribir las secciones 1 a 4 con el estado nuevo, commitear y
   pushear.
3. Cuando un traspaso queda históricamente interesante, se archiva como
   `docs/traspaso-DD-MM-tema.md` y acá queda solo lo vigente.

**Qué NO va acá:** el detalle de qué archivo se tocó (eso está en el diff), la
conversación con la IA, ni nada que ya diga el `README.md` o el `CLAUDE.md`. Va lo
que el otro no puede deducir leyendo el repo.

---

**Última actualización:** 18/09/2026 · Codex, por pedido de JP
**Traspasos que continúa:** `traspaso-07-09-autenticacion.md` (Tomás),
`traspaso-04-09-supabase-en-vivo.md` (JP)

---

## 1. Dónde está parado el portal

### Rama en desarrollo: plantillas de Reportes

Reportes abre con el panel de filtros plegado y ofrece la plantilla fija
**Informe de Secretaría**. La plantilla conserva el orden acordado de temas,
incluye proyectos comunes y estratégicos, y agrega Monitoreos como bloque
imprimible. Si un tema de la plantilla no existe todavía como proyecto, el
informe lo declara como pendiente de cargar; no se inventa ni se omite en
silencio.

Los Rusos, Intervención en puntos estratégicos, Suministro de cartelería, CAPS
10, SISU, Bunker Libertador y Movilización de suelo quedan disponibles en sus
áreas confirmadas bajo el programa explícito «Sin programa», hasta que se
clasifiquen. El cargador conserva el área al resolver programas homónimos y
normaliza tildes para no duplicar proyectos entre fuentes. Falta definir el
origen de Legales y Senado de la Nación. Validación local: 410 pruebas, build y
humo/accesibilidad (132 renderizados, 29 rutas) aprobados.

### Rama en desarrollo: responsables y reuniones

**Preferencia vigente de JP:** seguir trabajando sólo en la rama local. No
pushear, fusionar con `main` ni publicar en Vercel mientras se revisan los cambios.

Vista privada: `node scripts/vista-equipo.mjs`, en
`http://127.0.0.1:5191/mi-seguimiento`. Usa cuentas y datos ficticios con el cliente
Supabase reemplazado; cada recarga reinicia la demo. Se comprobó en Chrome que
Mi seguimiento carga con sus compromisos. Esto no reemplaza la prueba completa
de interacciones pendiente.

`feat/compromisos-equipo-reunion-lunes` contiene la primera implementación de
responsables por cuenta, Mi seguimiento y reuniones de Secretaría / Dirección.
**No está desplegada y no se aplicó `0037` a producción.** Reglas y activación:
`docs/decisiones/2026-09-18-equipo-y-reuniones.md`.

Validación: 408 pruebas de lógica aprobadas y prueba de la migración en PostgreSQL
temporal aprobada. Build intermedio aprobado; falta repetir verificación completa
sobre la versión final y ejecutar `scripts/verificar-equipo.mjs` para revisar
interacciones y aspecto. La ejecución en Chrome se bloqueó por límite de uso del
servicio de revisión automática. No dar por terminada la validación visual.

El cambio previo de `scripts/supabase_toolkit.py` y `scripts/__pycache__/` pertenece
a otro trabajo: se conservó y no forma parte de esta implementación.

### Estado de producción documentado al 15/09

**La persistencia está cerrada.** No queda nada de gestión viviendo en el
navegador. Verificado el 14/09 recorriendo el repo y consultando la base, no de
memoria.

| Qué | Estado |
|---|---|
| Migraciones `0001` a `0031` | **Aplicadas en la base real.** `0027` a `0030` verificadas por REST el 14/09; `0031` verificada llamando a su RPC, que responde |
| Migraciones `0032` a `0036` | **Escritas, sin aplicar.** `0032` limpia los saltos de línea que dejó `0031`; `0033`-`0035` son notas de proyecto y el programa de estratégicos; `0036` suma la reunión de agenda de eventos como cuarto origen de compromisos |
| `0001_esquema.sql` | Describe el esquema **tal como está corrido**, y no se edita. Lo nuevo va siempre en una migración propia — el 14/09 se revirtió un cambio que se le había hecho encima y pasó a `0036` |
| Colecciones | Las 18 del esquema leen de Supabase. `actualizaciones_compromisos` es la excepción deliberada: se pide por compromiso, no se hidrata entera |
| Catálogos | Los 12 administrables se guardan en la base. Lo que agrega una persona lo ven todas |
| Escrituras | Ninguna operación del repositorio se saltea Supabase |
| RLS | Las 47 tablas con política. Las 9 que todavía no usa nadie niegan todo hasta que alguien defina su acceso (`0026`) |
| Concurrencia | El Layout refresca al cambiar de ruta, con piso de 30 s. Antes sólo Proyectos y Eventos lo hacían, así que lo que cargaba un compañero no aparecía hasta recargar la página |
| Errores de guardado | Barrido completo: queda un solo `try` sin `catch` en el repo, en `enLote`, y ahí es correcto |
| Organigrama | Subsecretaría y dirección en cada compromiso, en cascada (`0027`) |
| Mesas | Agendar y editar reuniones, carpeta de Drive por mesa y por reunión, color por mesa |
| Base cartográfica del Mapa | OpenFreeMap con estilo Liberty queda como base predeterminada; el Geoportal conserva el callejero municipal alternativo y sigue aportando límites y cuadras oficiales |
| Posicionamiento | Ficha propia por programa, con su carpeta de Drive |
| Compromisos | La novedad va a `actualizaciones_compromisos`, ya no se concatena a `descripcion`. En Seguimiento, el detalle desplegable usa un panel operativo compacto: última novedad e historial a la izquierda, carga de estado/comentario a la derecha, edición de unidad responsable plegada y metadatos al pie |
| Eventos | Rediseñado como agenda ejecutiva y, desde el 14/09, ya no es un módulo propio: es una pestaña de Mesas de trabajo. `/eventos` redirige conservando sus parámetros |
| Cobertura de Monitoreo | Gráfico apilado semana a semana del mes en curso, por secretaría. Coordinación y Secretaría General quedan afuera: no tienen Monitoreo propio |
| Cierre de Monitoreo | «Finalizar monitoreo» cuenta también las actualizaciones de compromiso, no sólo las de proyecto — un área sin proyectos cargados no podía cerrar nunca su monitoreo |
| Mis áreas | «Compromisos pendientes» dejó de ser tabla: agrupado por vencimiento, con los días que faltan. El CSV sigue siendo el mismo |
| Filtros de Monitoreo | Arrancan plegados (`desplegable` en `TarjetaFiltros`, opt-in). Plegados siguen diciendo cuántos hay aplicados |
| `npm run verificar` | Pasa: 396 tests, build, humo y accesibilidad |

## 2. Lo próximo, en orden de lo que más desbloquea

**Nota de cartografía (JP, 14/09):** el mapa vacío en producción se debía a
importar el worker de MapLibre con `?url`: Vite omitía `maplibre-gl-shared.mjs`.
Debe usarse `?worker&url`. Probar en desarrollo o comprobar que existe un canvas
no detecta esta regresión. `node scripts/verificar-mapa.mjs` compila el portal,
usa los dobles de sesión/datos de humo y comprueba el callejero en Chrome; requiere
conexión a OpenFreeMap. No accede a datos de gestión reales.

**Navegación del mapa:** restringida al rectángulo del límite oficial de Tres de
Febrero con 6 % de margen para calles limítrofes; el alejamiento máximo se adapta
al tamaño del panel. Se aplica también al formulario y al callejero municipal.

1. **Aplicar las migraciones pendientes desde el SQL Editor**, en orden. Ninguna
   se puede correr por REST: la red del municipio bloquea Postgres directo.

   - `0032_limpiar_novedades_rescatadas.sql` — cosmética, no bloquea nada: una
     de las tres novedades rescatadas quedó con dos saltos de línea al final,
     porque el `trim()` de Postgres saca espacios pero no saltos. En pantalla
     son dos renglones vacíos colgando del comentario.
   - `0033` a `0035` — notas de proyecto y el programa de proyectos
     estratégicos.
   - `0036_compromisos_de_evento.sql` — la reunión de agenda de eventos como
     cuarto origen de compromisos. Decisión de JP del 14/09: el diseño va como
     está. Si el editor se queja del `alter type ... add value`, correr la
     sección 1 sola y después el resto. Después conviene verificar por REST que
     `reuniones_evento` responde y que `compromisos?origen_tipo=eq.evento` deja
     de dar 400.

   El front todavía no usa nada de `0036`: la migración habilita el esquema, las
   pantallas de la reunión de eventos están por hacerse.

2. **Probar contra datos reales lo que entró entre el 11 y el 14/09.** Es
   bastante y casi nada se usó todavía: el alta de un compromiso con
   subsecretaría y dirección, agendar y editar una reunión de mesa, la ficha de
   un programa de posicionamiento, la agenda de Eventos, y guardar una novedad
   ahora que la RPC existe.

3. **Actualizar `README.md` y la sección de persistencia de `CLAUDE.md`.**
   Los dos describen un portal que todavía guardaba en el navegador.

## 3. Decisiones pendientes (necesitan que alguien defina, no que alguien programe)

1. **Si el repositorio debería seguir siendo público.** Es un sistema de gestión
   municipal: no hay nada que ganar con que sea abierto, y sí bastante que
   perder. Hoy los mails del equipo se mantienen fuera del repo a mano
   (`supabase/datos/usuarios-autorizados.local.sql`, excluido por `.gitignore`),
   que es una defensa que depende de que nadie se olvide.
2. **El `tipo_id` de 8 proyectos de Obras** que quedaron con `tipo_id = 'Obra'` y
   `es_obra = false`: Cartelería, Cuadrilla Municipal, Intervenciones
   Contratadas, Obras Particulares, Restauración casona Bosch, OC, Licencias de
   conducir, Obras de mantenimiento. ¿Servicio? ¿Gestión interna? Es una
   decisión por proyecto.
3. **De qué programa cuelgan los 15 proyectos sin cargar** (`02b` y `02c` en
   `supabase/datos/carga-inicial/`). Los tres de Salud —Presentismo, Turnos
   efectivos, Uso de Agenda— parecen colgar de un programa real, no de "Agenda".
4. **Dónde entran los contenedores sin lugar en el modelo**: `Reportes MI3F`,
   `Agenda Roco`, `Informe de Estadísticas Generales`.

## 4. Deudas anotadas, ninguna urgente

1. **79 de los 99 compromisos no tienen fecha límite.** Como la alerta por
   vencimiento se deduce de esa fecha, el motor de alertas no opera sobre el 80%
   de los datos. Quedan sin fecha Seguridad (37 de 37), Ambiente (33 de 45) y
   Salud (9 de 9); Obras, Capital Humano y Trabajo y Producción ya no tienen
   ninguno.

   El 13/09/2026, por decisión de JP, se **borraron definitivamente** los 46
   compromisos sin fecha límite de **Obras (13), Capital Humano (24) y Trabajo y
   Producción (9)** — todos del histórico cargado el 04/09 desde los `_db`, sin
   proyecto asociado y mudos para el motor de alertas. El borrado arrastró en
   cascada sus 46 filas de `actualizaciones_compromisos`; ningún
   `temas_monitoreo` los referenciaba. Backup previo en el repo de trabajo de JP:
   `archivos_varios/backup_compromisos_sin_fecha_obras_th_cap-humano_2026-09-13.csv`
   (y el `.json` con las actualizaciones). Trabajo y Producción quedó sin ningún
   compromiso cargado.
2. **Los 130 compromisos están sin responsable.** El `_db` de origen no lo registra.
3. **Un proyecto tiene comillas dobles espurias en el nombre**, arrastradas del
   CSV: `"Plan Estratégico de los Espacios de Primera Infancia (EPIs)"`.
4. **La rama `feat/autenticacion` en GitHub** ya está fusionada en `main`. Se
   puede borrar.
5. **El remoto `origin` (`Sr4312/Coordinacion3F2.0`) quedó abandonado** en el
   commit del 19/08. O se lo actualiza, o se lo saca de la copia local para que
   nadie pushee ahí por reflejo. Ver `CLAUDE.md`.
6. **Compatibilidad temporal de rangos de evento:** se puede retirar la marca
   `[[portal_fecha_hasta:...]]` de `supabaseEventos.js`, ahora que `0011` está
   aplicada, cuando se confirme que no quedan clientes con el build anterior.
7. **Los catálogos los edita sólo `admin`** (`0025`). Es lo correcto —renombrar
   una secretaría se propaga a todos los informes— pero significa que jefatura
   de gabinete e intendencia no pueden corregir un nombre sin pedirlo.

### Deudas que se saldaron y por qué se sacan de la lista

- *"`marcarEstrategico()` escribe dos campos que no existen"* — `0024` agregó
  `id_origen_estrategico` y extendió la RPC. El front los manda y los lee.
- *"El front manda `origen_estrategico: 'base'` y el enum no lo acepta"* — el
  traductor ahora manda `null`, que es lo que significa "base maestra". El enum
  no necesita un tercer miembro para decir "ninguno de los dos".

---

## Plantilla, para la próxima vez

```markdown
**Última actualización:** DD/MM/AAAA · quién
**Traspasos que continúa:** archivo(s)

## 1. Dónde está parado el portal
Tabla de estado verificado — no "debería andar", comprobado.

## 2. Lo próximo, en orden de lo que más desbloquea
Numerado. Cada punto dice qué desbloquea, no solo qué es.

## 3. Decisiones pendientes
Lo que necesita criterio humano, no programación. Con las opciones sobre la mesa.

## 4. Deudas anotadas
Lo encontrado de paso que no se arregló, para no perderlo.
```

Dos reglas que hacen que esto funcione:

- **Estado verificado, no supuesto.** Si decís que una migración está aplicada,
  comprobalo contra la base antes de escribirlo. Media hora de la sesión del 07/09
  se fue en descubrir que tres cosas del traspaso anterior no coincidían con la
  realidad.
- **No dupliques el diff.** Si se entiende leyendo el código, no va acá.
