# Contexto del portal y su base de datos — 24/08/2026

Pensado para pasarse a otra sesión de Claude sin depender del resto de las
conversaciones en las que se construyó. Cubre cómo está armado el portal HOY
(front + modelo de datos) y, en particular, un choque estructural que hay
que resolver ANTES de intentar cargar el histórico completo de observaciones
de los `_db` — es la razón por la que este documento existe.

---

## 1. Qué es esto

**Coordinacion3F2.0** es el portal que reemplaza siete Sheets (`_db`, uno por
secretaría) por una sola herramienta de seguimiento de gestión municipal.
Hay dos repos históricos:

- **`Coordinacion-3f` (v1)** — Next.js + Supabase, abandonado como frontend,
  pero con un núcleo de modelo de datos relacional sólido (catálogos
  normalizados, actualizaciones fechadas, serie histórica, auditoría).
- **`Coordinacion3F2.0` (v2)** — el repo activo hoy. Vite + React.
  **Corre 100% sobre `localStorage` del navegador — no hay backend real
  todavía.** No hay login, no hay servidor, no hay base de datos compartida:
  cada persona que abre el portal en su propio navegador tiene su propia
  copia de los datos, aislada de la de cualquier otra persona.

Esto último es importante para lo que se viene: **una simulación de carga
que corra en el navegador de una persona no la ve nadie más**, ni siquiera
otra sesión del mismo portal en otra computadora.

---

## 2. Arquitectura del front — las cinco capas

```
componentes de UI (src/modulos/*)
        │  llaman a
        ▼
acciones (src/estado/tienda.js)  ── re-exporta repositorio.js entero
        │
        ▼
repositorio.js (src/datos/repositorio.js)  ── ÚNICA puerta de lectura/escritura
        │
        ▼
esquema.js + almacenamiento.js
        │
        ▼
localStorage del navegador
```

- **`src/datos/repositorio.js`** — la capa de acceso a datos. Ningún
  componente toca `localStorage` directo ni muta la base a mano: todo pasa
  por acá. Todas las funciones son `async` desde el día uno, aunque hoy
  resuelven sincrónicamente, **a propósito**: el día que haya un backend
  real, migrar es reemplazar el CUERPO de cada función por un `fetch`, sin
  tocar un solo componente de la UI.
- **`src/datos/almacenamiento.js`** — el único archivo que toca
  `localStorage` literalmente.
- **`src/datos/esquema.js`** — define `COLECCIONES` (la lista de qué
  colecciones existen en la base), `bdVacia()` (la semilla de un sistema
  nuevo) y `normalizarBD()` (completa colecciones que falten al leer una
  base vieja, para que agregar una colección no rompa lo ya guardado).
- **`src/estado/tienda.js`** — store de Zustand. `useBD()` da la base
  completa reactiva; `acciones` es literalmente el `repositorio.js`
  reexportado entero, así los componentes no lo importan aparte.
- **`src/datos/selectores.js`** — toda la derivación (agregados, filtros,
  semáforos) es pura: recibe `bd` y devuelve datos nuevos, nunca lee el
  store ni el reloj directamente.

## 3. Las colecciones que existen HOY (`COLECCIONES` en `esquema.js`)

```
proyectos · seguimientos · compromisos · monitoreos · temas_monitoreo ·
mesas · reuniones_mesa · eventos · requerimientos_evento ·
planificacion_anual · acciones_internacionales · historial ·
reportes_guardados · asignaciones_monitoreo
```

Más `catalogos` (áreas, programas, ejes, tipos, unidades, etc.) y `config`
(usuario actual).

### 3.1. El punto crítico — leer esto antes de cargar nada histórico

**`proyectos` es una colección de UNA FILA POR PROYECTO, no un histórico.**
Cada proyecto tiene un `estado`, un `avance`, una `cantidad`, un `objetivo`
como atributos fijos — y cargar una novedad nueva **pisa** esos valores
(`acciones.actualizarProyecto(id, { avance, estado })`, literal, en
`CargarSeguimiento.jsx`). No existe hoy, en el prototipo, una colección tipo
"actualizaciones" que guarde una fila nueva por cada observación fechada sin
pisar la anterior.

Esto importa muchísimo para "cargar todas las observaciones de los sheets":
los `_db` reales SÍ son históricos — cada semana se agrega una fila nueva en
`1. Cualitativo`/`2. Cuantitativo`/`3. Comparativo` con su propia
`Fecha de actualización`, sin borrar las anteriores (ver sección 6). El
modelo actual del PORTAL no tiene dónde poner ese histórico completo: solo
tiene lugar para la foto más reciente de cada proyecto.

**Dos caminos posibles, ninguno implementado todavía — es una decisión a
tomar, no algo ya resuelto:**

1. **Extender el prototipo** con una colección nueva tipo
   `actualizaciones_proyecto` (una fila por observación, con su fecha,
   nunca se pisa), y adaptar los selectores que hoy asumen que
   `proyecto.avance`/`proyecto.estado` son la única fuente de verdad.
2. **Simular la carga directo contra el esquema de Supabase**
   (`supabase/migrations/0001_esquema.sql`, que SÍ está diseñado para esto
   — ver sección 7), como ejercicio para validar ese esquema con datos
   reales, sin tocar el prototipo de `localStorage` en absoluto. Esto
   requiere un proyecto de Supabase real desplegado, que hoy no existe (ver
   sección 7.1).

Ninguno de los dos está armado. Vale la pena decidir esto ANTES de escribir
código de carga masiva, para no tener que rehacerlo.

### 3.2. Lo que SÍ está cargado hoy: la foto actual, no el histórico

El 19/08/2026 se cargó, para las 7 secretarías, el **maestro actual** —la
pestaña oculta `Estado de proyectos` de cada `_db` (ver 6.6), que es UNA
fila por proyecto con su estado más reciente, no el log semanal completo.
Quedó armado como un patrón aditivo e idempotente, reusable:

- `src/datos/proyectos-reales-secretarias.js` — los datos crudos relevados
  (92 proyectos reales entre las 7 secretarías, con `programa`/`proyecto`/
  `estado`/`comentarios`/`fechaActualizacion`, tal como estaban en el
  sheet).
- `src/datos/posicionamiento-real.js` — lo mismo para Posicionamiento
  (Coordinación), separado porque el módulo tiene su propio modelo (ver
  3.4).
- `repositorio.js` → `cargarProyectosRealesSecretarias()` +
  `cargarProyectosPosicionamientoReales()` + `cargarTodosLosProyectosReales()`
  — resuelven catálogos (`asegurarCatalogo`), traducen el `Estado` crudo del
  sheet al vocabulario cerrado del sistema (`mapearEstado()`, nunca en
  silencio: lo que no matchea queda anotado en observaciones), y dan de
  alta cada proyecto una sola vez (no duplica si ya está).
- Botón en Configuración → "Cargar datos reales de las secretarías".

**Esto es exactamente la foto que hoy pisa `proyectos`, no el histórico.**
Cargar TODAS las observaciones (todas las filas de `1. Cualitativo` desde
que se empezó a cargar, no solo la última) es un problema distinto y más
grande — es lo que motiva este documento.

### 3.3. Datos reales vs. datos de prueba — separación estricta

`src/datos/demo.js` y `src/datos/base-completa.js` generan datos
**sintéticos, evidentemente ficticios** (áreas, proyectos, personas
inventados) para probar la interfaz a distinta escala. Nunca se mezclan con
`proyectos-reales-secretarias.js` ni con nada relevado de un sheet real —
están documentados así en el propio código, y es una regla que se sostuvo
en todas las cargas de datos reales de esta sesión.

### 3.4. Posicionamiento — modelo propio, no la cartera general

El módulo de Posicionamiento (acciones internacionales: hermanamientos,
postulaciones, premios) usa hoy, en el PROTOTIPO de `localStorage`, la
colección genérica `acciones_internacionales`. En el ESQUEMA de Supabase
(sección 7) fue rediseñado el 21/08/2026 a dos tablas propias
(`proyectos_posicionamiento` + `actualizaciones_posicionamiento`), separadas
de la cartera general de `proyectos` — un hermanamiento no tiene objetivo
físico ni coordenadas. **El formulario real del front
(`FormularioAccion.jsx`) todavía es el de la versión vieja**, no se
actualizó a la par del esquema — es una divergencia conocida, documentada
en `docs/auditoria-formularios-vs-esquema.md`.

### 3.5. Compromisos — el vínculo a proyecto es opcional y es del compromiso

Un compromiso puede o no pertenecer a un proyecto puntual ("hablar con
Sistemas porque un CAPS no tiene internet" no es de ningún proyecto;
"hablar con Legales por el suministro del túnel Hornos" sí lo es). Desde el
21/08/2026, ese vínculo se decide **compromiso por compromiso** (cada fila
de compromiso tiene su propio selector opcional de proyecto), no
declarando de entrada "de qué proyectos habla" todo un seguimiento. Lo que
sí es obligatorio siempre es el `area`.

---

## 4. Los 7 módulos operativos + 2 de apoyo

| Módulo | Colección(es) que toca | Formulario de carga |
|---|---|---|
| Proyectos | `proyectos` | `FormularioProyecto.jsx` |
| Obras | `proyectos` (filtrado por `es_obra`) | reusa `FormularioProyecto.jsx` |
| Seguimiento | `seguimientos`, `compromisos` | `CargarSeguimiento.jsx` |
| Monitoreo | `monitoreos`, `temas_monitoreo` | `CargarMonitoreo.jsx` |
| Proyectos estratégicos | `proyectos` (marca `es_estrategico`) | `FormularioEstrategico.jsx` |
| Posicionamiento | `acciones_internacionales` (ver 3.4) | `FormularioAccion.jsx` |
| Planificación | `planificacion_anual` | `CargarPlanificacion.jsx` |
| Mesas de trabajo | `mesas`, `reuniones_mesa` | `FormularioMesa.jsx` / `RegistrarReunion.jsx` |
| Eventos | `eventos`, `requerimientos_evento` | `FormularioEvento.jsx` |
| Reportes | solo lectura + `reportes_guardados` | — |
| **Mis áreas** (nuevo, 21/08) | `asignaciones_monitoreo` | check-list propio |
| Configuración | `catalogos`, `config` | — |

**Mis áreas** es una vista personal: cada integrante de Coordinación elige
qué secretarías monitorea (identidad = el nombre libre de
`config.usuario`, no hay login real) y ve, filtrado a esas áreas, las
alertas y compromisos pendientes — reusa las mismas piezas que Monitoreo,
sin duplicar código.

---

## 5. Catálogos — dos familias

- **Administrables** (`bd.catalogos`) — áreas, programas, ejes, tipos,
  unidades, etc. Se editan desde Configuración, se dan de baja lógica
  (nunca borrado físico). La semilla real (`CATALOGOS_SEMILLA` en
  `src/datos/catalogos.js`) trae ya cargadas las **siete secretarías
  reales** (Coordinación, Ambiente y Servicios Públicos, Capital Humano,
  Obras, Salud, Seguridad, Trabajo y Producción) — no hay más placeholders
  genéricos ahí desde el 20/08/2026 (se sacaron 8 áreas inventadas que
  usaba el generador de demo, porque convivían sin distinguirse de las
  reales y confundían la pantalla de catálogos).
- **Congelados** (constantes en `catalogos.js`) — `ESTADOS_PROYECTO`
  (planificado / en ejecución / demorado / finalizado / suspendido),
  `PRIORIDADES`, `ESTADOS_COMPROMISO`, umbrales de alerta, etc. Tienen
  semántica atada al código (el motor de alertas), no se editan desde la
  interfaz.

`base-completa.js` (el generador de datos de prueba a escala) sí sigue
usando 14 áreas enteramente ficticias, con su propio catálogo autocontenido
que reemplaza `bd.catalogos` entero al cargarse — nunca convive con la
semilla real, así que no genera la misma confusión.

---

## 6. Anatomía real de un `_db` — lo que hay que saber para leer los sheets

*(relevado el 28/07/2026, verificado en profundidad sobre `Ambiente_db`;
detalle completo en `Informes/fuentes-y-proceso.md` del repo `Trabajo`, que
puede no estar accesible desde este repo si se trabaja solo con
`Coordinacion3F2.0` — por eso se copia acá lo esencial).

### 6.1. Los 7 sheets reales

| Secretaría | ID del sheet |
|---|---|
| Ambiente_db | `1A3VdCSM5M2rzOf2kcWeNgET2trfKcsCxTr-YVHc9vZI` |
| Capital_humano_db | `1IwbJSCdpo8y3WKN6rKqCYPpDLqsIb9j5LpDCFfKRjtQ` |
| Obras_db | `1g7yeNVr01QxJhnsrF9kdGMdnxjAom4VoNjQtzXoKjOI` |
| Salud_db | `1izAozVURxZdI90fHVFeauGisRBtuPLiBi1VYSyRLK8k` |
| Seguridad_db | `1QYEa8h9vcMA6naQ31xfoc0p2kaJ9lQ3MLjkEGMmYSnQ` |
| Trabajo_y_Produccion_db | `1d5yFOKxNhn_sUoF8PM8FgHfTEVl4OQP7Ux584_6yczE` |
| Coordinacion_db | `1MqLANtoQPduz6RID9ZvGiiArZmDh7_ZscxoklD2-MaM` |

Son los **IDs reales del sheet**, no del shortcut de la carpeta de accesos
directos (`1hBu5ppweCGhSWln2QjPqrIFkBy5rOsmu`) — para leer contenido hay
que usar estos.

### 6.2. Tres pestañas alimentan los informes semanales

En las tres: **fila 1 = títulos de grupo, fila 2 = encabezados reales,
datos desde la fila 3.**

**`1. Cualitativo`** (proyectos sin métrica numérica): Fecha de
actualización · Programa · Proyecto · **Eje** (POA / Mesa Esperanza / Mesa
EDLA / Mesa Favelita-El Libertador / Compromisos / Puntual) · Fecha de fin
· Finaliza en · **Estado** (En ejecución / Alerta / Crítico / Pendiente /
Finalizado) · **Estado General** (Vigente / Finalizado) · Comentarios ·
**Derivación** (Dirección / Secretaría).

**`2. Cuantitativo`** (con indicador numérico): mismo inicio + Período ·
Fecha de final · Cantidad · Cantidad 2025 · Unidad · Comentarios · Objetivo
· % de avance · Estado · Derivación.

**`3. Comparativo`** (ingresados vs. resueltos contra 2025): mismo inicio +
Período · Ingresados · Resueltos · Ingresados 2025 · Resueltos 2025 ·
Comentarios · % de resolución · Estado · Derivación.

**Cada fila es una observación fechada, no un estado que se pisa** — así
es como los sheets sostienen el histórico semanal que el portal, hoy, no
tiene dónde guardar (ver 3.1).

### 6.3. `Derivación` decide a qué informe va cada fila

`Dirección` o `Secretaría`, desde un desplegable. El Informe Secretaría
solo trae filas con `Derivación contains 'Secretaría'`; el Informe
Dirección no mira esta columna, filtra por `Eje = 'POA'` o no. Una fila
puede ir a los dos informes a la vez.

### 6.4. Riesgos conocidos del circuito real (para tener en cuenta al leer)

1. **Estructura acoplada por posición de columna** en los `IMPORTRANGE` de
   los informes — si un área inserta una columna, el dato se corre sin
   error visible. No debería afectar una lectura por nombre de columna
   (que es como se leyó hasta ahora, vía la API de Sheets), pero es la
   razón por la que **no conviene asumir que las 7 secretarías tienen
   exactamente el mismo orden de columnas** sin verificarlo.
2. **Solo se verificó a fondo la estructura de `Ambiente_db`** en el
   relevamiento original. Las otras 6 se asumen iguales, pero no están
   confirmadas columna por columna.
3. El campo **`Fecha de actualización`** es el que marca cada observación
   en el tiempo — es la columna a mirar para reconstruir el histórico real.

### 6.5. Otras pestañas del `_db` (no alimentan los informes, pero importan)

| Pestaña | Contenido |
|---|---|
| `Objetivos` | Objetivo y umbrales por proyecto — crítico <65%, mínimo <80%, cumplido, supera >110%. |
| `Actividades` | Actividades del POA con coordenadas y estado de cronograma. |
| **`Estado de proyectos`** (oculta) | Maestro: un proyecto por fila, estado más reciente. **Es lo que ya se cargó el 19/08** (ver 3.2) — NO el histórico. |
| `Desplegables` (oculta) | Listas de validación (Programas, Estados, Ejes, etc.). |
| `Historico` (oculta) | Serie mensual 2025 de ingresados/resueltos. |

---

## 7. El backend real diseñado — Supabase, no desplegado

`supabase/migrations/0001_esquema.sql` (41 tablas, 14 tipos enum) es el
esquema relacional pensado para reemplazar `localStorage` — fusiona el
núcleo de v1 (catálogos, actualizaciones fechadas, serie histórica,
auditoría) con los módulos que solo tiene v2. Documentado en detalle,
incluidas las decisiones de diseño no obvias y el diagrama ER completo, en
[`docs/der-esquema-datos.md`](der-esquema-datos.md) — leer ese archivo
antes de tocar el esquema.

**Ahí SÍ existe una tabla `actualizaciones`** (una fila por observación
fechada, nunca se pisa, con `act_cuantitativas`/`act_comparativas` colgando
según el tipo) — es el lugar natural para el histórico completo que este
documento dice que el prototipo de `localStorage` no tiene.

### 7.1. Por qué no está desplegado

Decisión explícita de la reunión del 18/08/2026 con Salva (documentada en
`docs/decisiones/2026-08-18-despliegue-del-modelo.md`): **primero cerrar
los formularios de carga módulo por módulo contra el esquema, recién
después migrar** — para no aplicar el esquema y tener que rehacerlo si un
formulario revela que falta o sobra una columna.

Ese trabajo se hizo el 21/08/2026:
[`docs/auditoria-formularios-vs-esquema.md`](auditoria-formularios-vs-esquema.md)
cruza los 10 formularios reales contra las columnas del esquema. Hallazgo
principal, el mismo que este documento viene marcando: **el choque entre
"el proyecto pisa su estado" (front) y "cada actualización es una fila
nueva" (esquema)** es real y de fondo, no un detalle de nombres. También
hay un bug de enum real (`origen_carga` no contempla `'base'`, y el
formulario de Proyectos Estratégicos sí puede mandarlo) y el módulo de
Posicionamiento necesita reescribirse contra las tablas nuevas.

**Conclusión para la simulación de carga:** si se simula contra Supabase
directamente (opción 2 de la sección 3.1), hay que desplegar un proyecto
de Supabase primero (no existe ninguno todavía, ni siquiera de prueba) y
tener presente que el esquema puede seguir cambiando — no es un piso
100% firme todavía, aunque sí es sustancialmente más maduro que el modelo
del prototipo para este propósito específico.

---

## 8. Despliegue y control de versiones

- Repo activo: `Coordinacion3F2.0`, rama `main`.
- Dos remotos en el clon de JP: `fork` (`JuanPablo0620/Portal-de-Coordinacion-V2`,
  conectado a Vercel, `https://portal-de-coordinacion-v2.vercel.app`) y
  `origin` (`Sr4312/Coordinacion3F2.0`, el repo de Salva — no se pushea ahí
  sin confirmar antes).
- `npm run verificar` = tests (`node --test`) + `vite build` +
  `scripts/humo.mjs` (smoke test de render + auditoría de accesibilidad
  sobre docenas de rutas, con demo/base completa/sistema vacío).
- **Recordatorio del punto 1**: lo que se carga en `localStorage` vive
  únicamente en el navegador de quien lo cargó. Una simulación de carga
  corrida por Salva no aparece en el portal de JP ni viceversa, hasta que
  haya un backend compartido real.

---

## 9. Dónde está cada cosa (mapa rápido)

| Qué | Dónde |
|---|---|
| Esquema real de Supabase (fuente de verdad del backend) | `supabase/migrations/0001_esquema.sql` |
| DER completo con decisiones de diseño explicadas | `docs/der-esquema-datos.md` |
| Auditoría formularios del front vs. ese esquema | `docs/auditoria-formularios-vs-esquema.md` |
| Decisiones de la reunión que fija el orden de trabajo | `docs/decisiones/2026-08-18-despliegue-del-modelo.md` |
| Bitácora de cada cambio de interfaz, con el porqué | `docs/registro-de-cambios.md` |
| Datos reales ya cargados (la foto, no el histórico) | `src/datos/proyectos-reales-secretarias.js`, `src/datos/posicionamiento-real.js` |
| Estructura real de los `_db` y los dos informes semanales | `Informes/fuentes-y-proceso.md` (repo `Trabajo`, puede no estar accesible desde acá) |
| Vocabulario institucional (áreas, siglas, programas reales) | `contexto/glosario.md`, `contexto/programas-municipales.md` (repo `Trabajo`) |
