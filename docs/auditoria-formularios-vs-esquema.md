# Auditoría formularios del front vs. esquema — 21/08/2026

Paso pendiente de la reunión del 18/08 con Salva: "por cada módulo, listar los
campos del formulario, cruzarlos contra las columnas del esquema, y anotar
los tres casos posibles — campo que sobra, campo que falta, campo que existe
con otro nombre." Se hizo leyendo directamente cada componente de formulario
real en `src/modulos/` contra `supabase/migrations/0001_esquema.sql`.

**Conclusión adelantada:** confirma que la decisión de NO migrar todavía fue
la correcta. Hay un choque de fondo en el módulo `proyectos` (no solo nombres
distintos) y el módulo `posicionamiento` necesita reescribirse por completo.

---

## Hallazgo transversal — antes de ir módulo por módulo

En **todos** los formularios, el front guarda área/programa/eje/tipo/
categoría/organismo/ítem como **texto libre** (el nombre elegido en un
`<select>`), mientras el esquema espera el **uuid** del catálogo
(`area_id`, `programa_id`, etc.). Hoy esto se resuelve a mano y parcial
—`FormularioProyecto.jsx` busca el `id` del área elegida antes de guardar—
pero no es un patrón generalizado: falta decidir un mecanismo único (una
función de resolución nombre→id, reusable en los diez módulos) antes de
escribir contra Supabase.

---

## 1 · `proyectos` — el choque más grande de todo el esquema

**Formulario:** `src/modulos/proyectos/FormularioProyecto.jsx`
**Tablas:** `proyectos`, `programas`, `areas`, `actualizaciones`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `proyecto` | `nombre` | nombre distinto |
| `area` (string) | — (no existe `area_id` en `proyectos`) | **el esquema no tiene acceso directo al área**: solo llega vía `programa_id → programas.area_id`. Hoy el front guarda `area` de más |
| `programa` (string) | `programa_id` (FK) | resolver a id |
| `eje` (string, **no obligatorio en el front**) | `eje_id` (FK, **`not null`**) | discrepancia de obligatoriedad — el esquema exige lo que el front no exige |
| `tipo` (string) | `tipo_id` (FK) | resolver a id |
| `cantidad`, `objetivo`, `avance`, `unidad` | — (no existen en `proyectos`) | **choque conceptual, no solo de nombre** — ver más abajo |
| `estado` (planificado/en ejecución/demorado/finalizado/suspendido) | `estado_general` (enum `vigente`/`finalizado`, mucho más grueso) | **choque conceptual** — ver más abajo |
| `fecha_fin_prevista` | `fecha_fin_proyectada` | nombre distinto |
| — | `fecha_fin_real`, `causa_atraso` | **campo que falta en el front**: no hay dónde cargarlos |
| `id_proyecto` (id legible) | `id_legible` | mismo concepto, nombre distinto |
| `es_obra`, `monto_planificado`, `monto_ejecutado`, `zona`, `latitud`, `longitud`, `observaciones`, `responsable`, `prioridad` | ídem | ✓ coinciden bien |

### Los dos choques conceptuales (no son un simple rename)

**a) `objetivo`/`avance`/`cantidad`/`unidad` viven en el proyecto en el front, no en el esquema.**
Hoy `FormularioProyecto` trata "objetivo 100 cuadras, avance 40" como un
atributo fijo del proyecto que se pisa cada vez que se actualiza (ver
`CargarSeguimiento.jsx`: `acciones.actualizarProyecto(id, { avance, estado })`
sobreescribe el avance directo sobre el maestro). En el esquema fusionado,
`cantidad`/`objetivo`/`unidad_id` viven en `act_cuantitativas`, colgada de
**cada `actualizacion`** — una fila nueva por observación, nunca se pisa la
anterior. Es exactamente la razón de ser de la serie histórica de v1 (punto 4
del DER). Migrar este módulo no es copiar columnas: es decidir que cada
carga de avance se vuelve una fila de `actualizaciones` + `act_cuantitativas`,
no un `UPDATE` sobre `proyectos`.

**b) El estado operativo vive en el proyecto en el front, no en el esquema.**
Mismo problema: `proyectos.estado_general` en el esquema es un campo binario
(vigente/finalizado) heredado de v1, para saber si el proyecto sigue activo
en el sistema. El estado operativo real (en ejecución/alerta/crítico/
pendiente/finalizado) vive en `actualizaciones.estado_id`, una foto por
observación. El front de hoy no distingue estos dos niveles: tiene un solo
`estado` en el proyecto.

---

## 2 · `seguimiento`

**Formulario:** `src/modulos/seguimiento/CargarSeguimiento.jsx`
**Tablas:** `seguimientos`, `seguimientos_proyectos`, `compromisos`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `area` (string) | `area_id` (FK) | resolver a id |
| `avances`, `problemas` (arrays de texto) | — (no existen columnas) | **campo que sobra**: no modelados en el esquema. Hay que decidir si van como `jsonb` en `seguimientos` o se pierden al migrar |
| `temas` (string, hoy siempre `''`) | — | no se usa en la práctica, revisar si sacarlo |
| `ids_proyecto` (array) | `seguimientos_proyectos` (tabla puente) | ✓ coincide, es la forma esperada |
| Compromiso: `id_origen` (un campo genérico) | `id_seguimiento_origen` / `id_tema_origen` / `id_reunion_origen` (tres FK, exactamente una no nula) | **transformación de forma**, no un rename — el front modela el origen polimórfico distinto de como lo pide el esquema |
| Compromiso: `area` (string) | `area_id` (FK) | resolver a id |
| `fecha`, `hora`, `tipo`, `participantes`, `texto_crudo`, `resumen`, `estado_reportado` | ídem | ✓ coinciden bien |

---

## 3 · `monitoreo`

**Formulario:** `src/modulos/monitoreo/CargarMonitoreo.jsx`
**Tablas:** `monitoreos`, `temas_monitoreo`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `area` (string) | `area_id` (FK) | resolver a id |
| `categoria` (string) | `categoria_id` (FK) | resolver a id |
| `fecha`, `cerrado`, `descripcion`, `criticidad`, `requiere_accion`, `responsable`, `id_proyecto`, `fecha_limite`, `resuelto` | ídem | ✓ el módulo con mejor alineación de todos |

---

## 4 · `planificacion`

**Formulario:** `src/modulos/planificacion/CargarPlanificacion.jsx`
**Tablas:** `planificacion_anual`, `planificacion_trimestres`, `hitos_planificacion`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `metas_trimestrales` (array de 4 valores, un solo objeto) | `planificacion_trimestres` (una fila por trimestre) | **transformación de forma**: hay que expandir el array en 4 filas al guardar |
| Hito: `descripcion` | `nombre` | nombre distinto |
| Hito: — | `cumplido` (boolean) | **campo que falta en el front**: no hay checkbox para marcar un hito cumplido |
| `meta_anual`, `monto_planificado`, `anio`, `id_proyecto`, hito `fecha` | ídem | ✓ coinciden bien |

---

## 5 · `mesas`

**Formularios:** `src/modulos/mesas/FormularioMesa.jsx`, `RegistrarReunion.jsx`
**Tablas:** `mesas`, `reuniones_mesa`, `mesas_proyectos`

Es el módulo con **menos divergencia** de los diez: `nombre`, `tipo`,
`descripcion`, `referente`, `periodicidad` (texto libre en ambos lados, no
catálogo FK), `estado`, `proyectos_vinculados` → `mesas_proyectos`, y la
reunión (`fecha`, `asistentes`, `temas`) coinciden todos 1 a 1. Solo el
`area` (string) del compromiso generado en `RegistrarReunion.jsx` necesita
resolverse a `area_id`, mismo patrón que el resto.

---

## 6 · `eventos`

**Formulario:** `src/modulos/eventos/FormularioEvento.jsx`
**Tablas:** `eventos`, `requerimientos_evento`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `area_organizadora` (string) | `area_organizadora_id` (FK) | resolver a id |
| Requerimiento: `item` (string) | `item_id` (FK) | resolver a id |
| Requerimiento: `area_responsable` (string) | `area_responsable_id` (FK) | resolver a id |
| `nombre`, `fecha`, `hora`, `lugar`, `tipo`, `id_proyecto`, `estado`, `cantidad` | ídem | ✓ coinciden bien |

---

## 7 · `estrategicos` — bug real encontrado

**Formulario:** `src/modulos/estrategicos/FormularioEstrategico.jsx`
**Tablas:** `proyectos` (marca), `motivos_estrategicos`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `motivo_estrategico` (string) | `motivo_estrategico_id` (FK) | resolver a id |
| `origen_estrategico` puede ser **`'base'`** | `public.origen_carga` = enum **`('monitoreo', 'seguimiento')`** | **🐛 bug de diseño**: el enum del esquema no contempla `'base'`. Si un proyecto se declara estratégico directo desde la base maestra (el camino más común, según el propio formulario), guardar `origen_estrategico = 'base'` rompe contra Postgres. Hay que agregar `'base'` al enum antes de migrar este módulo |
| — | `estrategico_nota` (text) | **campo que falta en el front**: existe la columna, no hay dónde cargarla en el formulario |
| `prioridad_estrategica`, `responsable_politico`, `compromiso_publico`, `fecha_compromiso` | ídem | ✓ coinciden bien |

---

## 8 · `posicionamiento` — necesita reescribirse por completo

**Formulario:** `src/modulos/posicionamiento/FormularioAccion.jsx` (+ `SelectorODS.jsx`)
**Tablas nuevas (21/08/2026):** `proyectos_posicionamiento`, `actualizaciones_posicionamiento`

Este es, por lejos, el módulo con mayor divergencia — porque el formulario
real todavía es el de la versión **vieja** (`acciones_internacionales`), de
antes del rediseño de hoy con JP.

**Sobran en el front (ya no existen en el esquema nuevo):** `tipo`, `pais`,
`alcance`, `fecha_limite`, `fecha_resolucion`, `ods[]` (con su
`SelectorODS.jsx` entero), `ids_proyecto[]` (el vínculo M:N con la cartera
general), `resultado`, `referente`, `descripcion`.

**Falta en el front:** el campo `objetivo` (texto, nuevo del rediseño), y
sobre todo, **el mecanismo de actualización por fecha** — el formulario
actual es un único alta/edición del registro entero (como una ficha), no
tiene manera de cargar una observación fechada nueva sin pisar la anterior,
que es justo el patrón que se decidió para `actualizaciones_posicionamiento`.

**Conclusión:** no es un ajuste de nombres. Hay que reescribir
`FormularioAccion.jsx` desde cero (probablemente en dos pantallas, como
`CargarSeguimiento.jsx`: una para el alta del proyecto de posicionamiento, y
otra —nueva— para cargar sus actualizaciones fechadas) y borrar
`SelectorODS.jsx`, que ya no tiene catálogo detrás.

---

## 9 · `obras` — falta el formulario de `actividades`

**Formulario:** reutiliza `src/modulos/proyectos/FormularioProyecto.jsx`
(mismos hallazgos que el punto 1) filtrando por `es_obra`.
**Tablas:** `proyectos` + `actividades`

La tabla `actividades` (frentes de obra: `nombre`, `direccion`, `barrio`,
`lat`, `lng`, `fecha_inicio`, `fecha_fin`, `estado_cronograma`) **no tiene
ningún formulario en el front hoy**. El módulo de Obras solo muestra y
ubica la obra como proyecto entero — no hay manera de cargar múltiples
frentes/actividades por obra. Hay que escribir este formulario de cero si
se quiere usar esa tabla; si no se va a usar en el corto plazo, conviene
decirlo explícitamente en vez de dejarla vacía sin más.

---

## 10 · `reportes`

**Formulario:** `src/modulos/reportes/Reportes.jsx` (`guardarReporte`)
**Tablas:** solo lectura sobre el resto + `reportes_guardados`

| Campo del front | Columna del esquema | Caso |
|---|---|---|
| `bloques` | `bloques_incluidos` | nombre distinto |
| `nombre`, `filtros` | ídem | ✓ coinciden bien |

El módulo más simple de los diez — un solo ajuste de nombre.

---

## Resumen ejecutivo — qué hay que resolver antes de migrar

1. **Decidir el mecanismo genérico de resolución nombre→id** (área, programa,
   eje, tipo, categoría, organismo, ítem) — hoy es ad-hoc y parcial.
2. **Decidir qué pasa con objetivo/avance/cantidad/estado de `proyectos`**:
   ¿el front pasa a escribir una `actualizacion` en cada carga (como pide el
   esquema), o el esquema se ablanda para tolerar que se pisen en el
   maestro? Es la decisión de mayor impacto de toda la auditoría.
3. **Agregar `'base'` al enum `origen_carga`** antes de tocar el módulo de
   estratégicos — si no, se rompe al guardar.
4. **Reescribir `FormularioAccion.jsx` de Posicionamiento** desde cero,
   sobre el esquema nuevo (`proyectos_posicionamiento` +
   `actualizaciones_posicionamiento`).
5. **Decidir si se implementa el formulario de `actividades`** (Obras) o se
   saca esa tabla del alcance por ahora.
6. Ajustes de nombre menores, sin impacto de fondo: `proyecto`→`nombre`,
   `fecha_fin_prevista`→`fecha_fin_proyectada`, hito `descripcion`→`nombre`,
   `bloques`→`bloques_incluidos`.
7. Revisar `eje_id` `not null` en el esquema vs. campo opcional en el front
   — o se relaja la restricción, o se hace obligatorio en el formulario.
8. Decidir qué hacer con `avances`/`problemas` de `seguimientos` (¿`jsonb`?)
   y con `estrategico_nota` (¿agregar el campo al formulario?).
