# Sistema de Coordinación y Seguimiento de Proyectos — Municipio de Tres de Febrero

**Fecha:** 08/08/2026 · **Etapa:** prototipo funcional · **Estado:** diseño aprobado

---

## 1. Objetivo

Aplicación web interna para el Área de Coordinación del Municipio de Tres de Febrero, que
permite coordinar con las áreas municipales sus proyectos y hacerles seguimiento
sistemático, reemplazando el circuito disperso en planillas, minutas sueltas y mensajería.

**Principio rector:** todo dato se carga una sola vez y se reutiliza en todos los módulos.
La base maestra de proyectos alimenta dashboard, seguimientos, monitoreo, planificación,
mesas, eventos y reportes. No hay carga duplicada ni entidades paralelas que representen
lo mismo.

**Usuarios:** únicamente el equipo de Coordinación, con acceso completo. Las áreas son un
atributo de los datos, no usuarios del sistema. Sin login, sin roles, sin gestión de usuarios.

### No objetivos

- No es un sistema de expedientes ni reemplaza RAFAM.
- No gestiona presupuesto ejecutado a nivel de partida; sólo montos planificados y
  ejecutados a nivel proyecto.
- No requiere integración en vivo con sistemas municipales existentes.

---

## 2. Stack y restricciones

| Aspecto | Decisión |
|---|---|
| Framework | React 18 + Vite 5, SPA |
| Estilos | Tailwind 4 vía `@tailwindcss/vite`, tokens en bloque `@theme` |
| Ruteo | React Router 6 |
| Gráficos | Recharts |
| Iconos | lucide-react |
| Estado | Zustand (caché en memoria) |
| Persistencia | `localStorage`, espejado desde un único módulo |
| Backend | Ninguno. Toda la lógica corre en el navegador |
| Autenticación | Ninguna |

**Sin dependencias adicionales.** El parser CSV, el generador CSV y el separador de minutas
se escriben a mano. No se incorpora SheetJS (`.xlsx` queda fuera de alcance).

**Idioma:** español rioplatense. Fechas `DD/MM/AAAA`. Montos en pesos argentinos con
separador de miles. Identificadores de código en español, siguiendo los nombres de campo
del modelo de datos.

**Responsive:** escritorio como uso principal, legible en tablet.

**Prioridad de la etapa:** ante disyuntiva entre robustez técnica y claridad visual del
prototipo, prevalece la claridad visual.

---

## 3. Arquitectura

### 3.1 Estructura de carpetas

```
src/
  datos/                      ← toda la lógica de datos, cero JSX
    almacenamiento.js         ← ÚNICO archivo del repo que toca localStorage
    esquema.js                ← colecciones, defaults, versión de esquema
    repositorio.js            ← API pública de datos (async)
    selectores.js             ← derivación pura sobre las colecciones
    alertas.js                ← motor único de alertas
    catalogos.js              ← catálogos cerrados administrables
    bitacora.js               ← registro append-only de cambios
    ids.js                    ← generación de SEC-AAAA-NNN
    csv.js                    ← importar y exportar CSV
    demo.js                   ← generador de datos de demostración
    minutas/
      separarMinuta.js        ← AISLADO: reemplazable por modelo real
  estado/
    tienda.js                 ← Zustand: caché + recargar()
  componentes/                ← UI compartida
  modulos/                    ← un directorio por módulo
  estilos/
    index.css                 ← tokens @theme
    impresion.css             ← hoja de estilos de impresión (PDF)
```

### 3.2 Capa de acceso a datos — requisito duro

El objetivo es que el paso a persistencia real sea un cambio localizado y no una
reescritura. Se cumple con tres reglas:

1. **`almacenamiento.js` es el único archivo del repositorio que menciona `localStorage`.**
   Expone `leerBD()`, `escribirBD(bd)` y `limpiar()`. Nada más lo importa salvo
   `repositorio.js`.

2. **Todas las funciones de `repositorio.js` son `async` desde el día uno**, aunque hoy
   resuelvan sincrónicamente. Firma estable del tipo `getProyectos(filtros)`,
   `crearSeguimiento(datos)`, `actualizarCompromiso(id, cambios)`. Migrar a una API real
   es reemplazar el cuerpo de cada función por un `fetch`, sin tocar ningún componente.

3. **Ningún componente importa `almacenamiento.js`.** Los componentes leen del store
   (hidratado al arranque) y escriben llamando al repositorio, que persiste y refresca
   el store. Se verifica automáticamente con un chequeo en `npm run verificar`.

### 3.3 Flujo de datos

```
Arranque       almacenamiento.leerBD() → repositorio.hidratar() → tienda (Zustand)
Lectura        componente → selector puro sobre la tienda
Escritura      componente → repositorio.crearX() → bitácora + almacenamiento → tienda
```

Los selectores son funciones puras sobre las colecciones, sin acceso a la tienda ni al
almacenamiento: reciben `bd` y devuelven derivaciones. Esto los hace testeables solos.

---

## 4. Modelo de datos

### 4.1 Tabla maestra — `proyectos`

| Campo | Tipo | Notas |
|---|---|---|
| `id_proyecto` | texto, único | Clave canónica. Formato `SEC-AAAA-NNN` |
| `area` | catálogo | Secretaría / Subsecretaría / Dirección responsable |
| `programa` | catálogo | |
| `proyecto` | texto | Nombre del proyecto |
| `eje` | catálogo | Eje estratégico de gestión |
| `tipo` | catálogo | Obra, servicio, programa social, gestión interna, adquisición |
| `cantidad` | numérico | Magnitud cargada en el período |
| `objetivo` | numérico | Meta comprometida |
| `avance` | numérico | Acumulado a la fecha |
| `unidad` | catálogo | m², beneficiarios, cuadras, unidades, % |
| `estado` | catálogo | `planificado` / `en ejecución` / `demorado` / `finalizado` / `suspendido` |
| `responsable` | texto | Referente del área |
| `prioridad` | catálogo | `alta` / `media` / `baja` |
| `fecha_carga` | fecha | |
| `fecha_inicio` | fecha | |
| `fecha_fin_prevista` | fecha | Base del cálculo de vencimientos |
| `es_obra` | booleano | Permite contar obras activas por separado |
| `monto_planificado` | numérico | |
| `monto_ejecutado` | numérico | |
| `activo` | booleano | Borrado lógico |
| `creado_por`, `creado_en` | | Trazabilidad |

**Campos derivados — nunca persistidos:**

- `porcentaje_avance = min(avance / objetivo × 100, 100)`. Se muestra con barra de progreso
  en todas las vistas.
- `ultima_actualizacion`: fecha del último asiento de bitácora que toca ese proyecto,
  directamente o a través de una entidad vinculada.

Ambos se calculan en `selectores.js`. Persistirlos abriría la puerta a que queden
desincronizados del dato que los origina.

### 4.2 Entidades relacionadas

Todas se vinculan a `proyectos` por `id_proyecto`, y todas llevan `activo`, `creado_por`
y `creado_en`.

- **`seguimientos`** — `id`, `ids_proyecto[]`, `area`, `fecha`, `hora`, `tipo`
  (`programado` / `realizado`), `participantes`, `temas`, `texto_crudo`, `resumen`,
  `avances[]`, `problemas[]`, `estado_reportado`.
- **`compromisos`** — `id`, `origen_tipo`, `id_origen`, `id_proyecto`, `area`,
  `descripcion`, `responsable`, `fecha_limite`, `estado`, `fecha_cumplimiento`.
- **`monitoreos`** — `id`, `fecha`, `area`, `cerrado` (booleano).
- **`temas_monitoreo`** — `id`, `id_monitoreo`, `id_proyecto` (opcional), `categoria`
  (catálogo), `descripcion`, `criticidad` (`alta`/`media`/`baja`), `requiere_accion`,
  `responsable`, `fecha_limite`, `resuelto`.
- **`mesas`** — `id`, `nombre`, `tipo` (`temática`/`barrial`/`otros proyectos`),
  `descripcion`, `referente`, `periodicidad`, `estado` (`activa`/`latente`/`cerrada`),
  `proyectos_vinculados[]`.
- **`reuniones_mesa`** — `id`, `id_mesa`, `fecha`, `asistentes`, `temas`.
- **`eventos`** — `id`, `nombre`, `fecha`, `hora`, `lugar`, `area_organizadora`, `tipo`,
  `id_proyecto` (opcional), `estado`.
- **`requerimientos_evento`** — `id`, `id_evento`, `item` (catálogo), `cantidad`,
  `area_responsable`, `estado` (`solicitado`/`confirmado`/`entregado`).
- **`planificacion_anual`** — `id`, `id_proyecto`, `anio`, `meta_anual`,
  `metas_trimestrales[4]`, `monto_planificado`, `hitos[]`.
- **`historial`** — bitácora append-only (ver §4.4).

### 4.3 Desvíos deliberados respecto del pedido original

Los tres son necesarios para que los flujos especificados cierren. Están acordados con
el área.

**a) `compromisos` con origen polimórfico.** El pedido original le da a `compromisos` un
campo `id_seguimiento`, pero los temas de monitoreo con acción requerida y las mesas de
trabajo también generan compromisos hacia la misma lista. Un solo campo no lo expresa.
Se reemplaza por `origen_tipo` (`seguimiento` / `monitoreo` / `mesa`) + `id_origen`.
Así la lista de compromisos es una sola y cada fila puede linkear a su registro de origen,
como exige el panel de alertas.

**b) El estado `vencido` es calculado, no persistido.** Sin backend no hay proceso que
marque vencimientos al cambiar el día; un estado guardado quedaría desactualizado apenas
pasa una jornada. El estado persistido es `pendiente` / `en curso` / `cumplido`, y
`vencido` se deriva en el selector como `fecha_limite < hoy && estado ≠ cumplido`.
Se presenta al usuario como un cuarto estado, indistinguible de uno persistido.

**c) `porcentaje_avance` y `ultima_actualizacion` son derivados** (ver §4.1).

Además, `seguimientos` lleva `ids_proyecto[]` en lugar de `id_proyecto`: el formulario de
carga especifica selección múltiple de proyectos, que un campo escalar no puede representar.

### 4.4 Trazabilidad — bitácora append-only

Toda alta, edición y baja lógica escribe un asiento en `historial`:

```js
{
  id, entidad: 'proyectos', id_entidad: 'OBR-2026-014',
  accion: 'edicion',                        // alta | edicion | baja
  cambios: [ { campo: 'avance', antes: 120, despues: 180 } ],
  creado_por: 'M. López', creado_en: '2026-08-08T14:22:00'
}
```

Un único mecanismo cubre tres requisitos a la vez: el versionado exigido por las
convenciones, el feed «Última actualización» del dashboard, y la pestaña de historial de
cada ficha. No se guardan snapshots completos: inflarían el `localStorage` (~5 MB) y
ningún flujo del sistema requiere restaurar una versión anterior.

### 4.5 Convenciones obligatorias

1. **Catálogos cerrados.** Área, programa, eje, tipo, unidad, estado, categoría de tema y
   tipo de requerimiento se cargan siempre desde listas administrables, nunca como texto
   libre. Existe una pantalla de administración de catálogos.
2. **Nada de texto libre donde puede haber selección.** El texto libre queda reservado a
   descripciones y minutas.
3. **Trazabilidad.** Toda entidad guarda `creado_por` y `creado_en`. `creado_por` sale del
   nombre configurado en la pantalla de Configuración; al llegar el login real se cambia
   la fuente del nombre y nada más.
4. **Nunca borrar.** El borrado es lógico (`activo = false`) y todos los selectores lo
   filtran por defecto.

### 4.6 Identificadores

`SEC-AAAA-NNN`: prefijo tomado del campo `prefijo` de la entrada de catálogo del área,
año de alta, correlativo de tres dígitos por prefijo y año. El formato queda encapsulado
en `ids.js` porque su validación contra la nomenclatura del POA está diferida.

---

## 5. Módulos

### 5.1 Inicio (Dashboard)

Vista de una sola pantalla, sin scroll infinito, con la información accionable del momento.

1. **Próximos vencimientos importantes** — compromisos, hitos y fechas de fin previstas que
   vencen en los próximos 15 días, orden ascendente. Semáforo: rojo (vencido), naranja
   (≤ 3 días), amarillo (≤ 15 días).
2. **Próximos seguimientos** — seguimientos agendados, con área, proyecto y fecha.
3. **Proyectos prioritarios** — `prioridad = alta`, con barra de avance y estado.
4. **Última actualización** — feed cronológico de las últimas 10 cargas, leído de la
   bitácora: qué se cargó, en qué proyecto, quién y cuándo.
5. **Calendario** — vista mensual unificada, con capas diferenciadas por color:
   seguimientos, eventos, reuniones de mesa y vencimientos. Filtro para encender y apagar
   cada capa.
6. **Contadores** — tarjetas de proyectos activos y obras activas, clickeables hacia el
   listado filtrado correspondiente.

### 5.2 Seguimiento

- **Calendario de próximos seguimientos** — vistas de calendario y de lista, conmutables.
- **Agendar seguimiento** — área, proyecto/s, fecha, hora, participantes previstos, temas.
- **Cargar seguimiento realizado** — en este orden: (1) selector de proyecto con búsqueda
  y selección múltiple; (2) última actualización registrada de ese proyecto mostrada como
  referencia, con avance confirmable o corregible; (3) texto libre extenso para la minuta;
  (4) separación automática en tres bloques editables antes de confirmar.
- **Lista de compromisos** — todos los compromisos vigentes, con filtro por área,
  responsable, estado y rango de fechas. Permite marcar cumplimiento. Los vencidos se
  destacan y alimentan las alertas.
- **Historial por área** — línea de tiempo completa de un área: seguimientos, compromisos
  cumplidos y pendientes, y evolución del avance de sus proyectos. Exportable.

#### Separación automática de minutas

`separarMinuta(texto)` devuelve `{ compromisos[], avances[], problemas[] }`. En el
prototipo se resuelve con reglas locales:

- Partición del texto en oraciones.
- Verbos de acción en futuro o perífrasis (*enviar, presentar, coordinar, definir,
  relevar, contratar…*) → candidato a compromiso.
- Extracción de fechas en varios formatos (`15/09`, `el viernes`, `antes de fin de mes`).
- Nombres propios como responsable candidato.
- Marcadores de traba (*falta, no se pudo, está trabado, demora, pendiente de…*) → problema.
- Marcadores de avance (*se terminó, se ejecutó, ya está, avanzamos*) → avance informado.

Todo lo devuelto es **propuesta**. La pantalla muestra los tres bloques editables y cada
compromiso como fila con `descripción` / `responsable` / `fecha_limite` corregibles.
**El sistema nunca persiste compromisos sin confirmación humana.** La interfaz queda
construida exactamente como funcionaría con procesamiento real: al conectar un modelo,
sólo se reemplaza el cuerpo de esa función, aislada en un único archivo con el comentario
que lo indica.

### 5.3 Monitoreo

- **Últimos monitoreos** — listado cronológico con fecha, área, cantidad de temas y
  criticidad máxima.
- **Monitoreos por área** — tabla y gráfico de barras por período, para detectar áreas
  sin cobertura.
- **Carga incremental de temas** — al crear un monitoreo (fecha + área) se habilita el
  formulario de un tema; al confirmarlo queda fijado en pantalla como tarjeta y se habilita
  automáticamente el formulario del siguiente, sin límite. Cierra con «Finalizar
  monitoreo». Cada tema usa siempre la misma estructura: categoría, proyecto vinculado
  (opcional), descripción, criticidad, ¿requiere acción?, y si requiere acción responsable
  y fecha límite. Los temas con acción requerida generan un compromiso con
  `origen_tipo = 'monitoreo'`.
- **Panel de alertas** — sección visualmente destacada, siempre visible en el módulo.

### 5.4 Planificación

- **Carga de planificación anual** por proyecto: meta anual, desagregación trimestral,
  monto planificado, hitos con fecha. Con importación masiva por CSV (§7).
- **Tablero de estadísticas:** proyectos por área/eje/tipo/estado · avance agregado
  planificado vs. ejecutado por área y eje · distribución del gasto planificado por área,
  eje y tipo · ejecución presupuestaria con desvío · evolución temporal del avance ·
  ranking de proyectos por desvío respecto de la meta trimestral.
- **Comparativo planificado vs. real** — tabla con semáforo por proyecto según
  cumplimiento de meta al trimestre en curso.

### 5.5 Mesas de trabajo

Mesas temáticas, barriales y otros proyectos, **separadas en pestañas con color
distintivo**, no por filtro. Por cada mesa: ficha completa, historial de reuniones con
fecha, asistentes y temas, compromisos generados (integrados a la lista general), próxima
reunión agendada reflejada en el calendario del dashboard, e indicador de mesas sin reunión
en el último período según su periodicidad declarada.

### 5.6 Eventos

- **Calendario de eventos** — vista mensual y lista de próximos.
- **Cargar evento** — nombre, fecha, hora, lugar, área organizadora, tipo, proyecto
  vinculado (opcional), estado.
- **Requerimientos estandarizados** — desde catálogo cerrado y administrable (sonido,
  escenario, sillas, vallado, baños químicos, seguridad, limpieza, gacebos, energía,
  difusión). Por cada uno: cantidad, área responsable y estado.
- **Checklist de evento** — vista consolidada con porcentaje de requerimientos confirmados
  y alerta si quedan ítems sin confirmar a menos de 5 días del evento.

### 5.7 Reportes

Constructor con filtros combinables: área · programa · proyecto · eje · tipo · estado ·
prioridad · responsable · rango temporal (semana / mes / trimestre / año / personalizado) ·
módulo de origen · sólo con alertas activas · sólo obras · sólo prioritarios.

El contenido se arma según lo filtrado, con vista previa en pantalla y selección de qué
bloques incluir (tablas, gráficos, listado de compromisos, minutas). Exportación a PDF vía
impresión del navegador, con encabezado institucional, fecha de emisión y filtros aplicados
explicitados al pie; y a CSV con los datos crudos. Las combinaciones de filtros se pueden
guardar con nombre y reutilizar.

---

## 6. Motor de alertas centralizado

Una única función `calcularAlertas(bd, hoy)` devuelve un array tipado:

```js
{ tipo, severidad, titulo, area, id_proyecto, responsable, dias_atraso, ruta_origen }
```

Cubre: compromisos vencidos · compromisos que vencen en ≤ 7 días · proyectos con
`fecha_fin_prevista` vencida y estado distinto de `finalizado` · proyectos sin actualización
hace más de 30 días · temas de criticidad alta sin resolver · requerimientos de evento sin
confirmar a ≤ 5 días · vencimientos a 15 días para el dashboard.

**Dashboard, panel de monitoreo y reportes consumen esta función y no reimplementan nada.**
De ahí sale, sin esfuerzo adicional, el criterio de que un compromiso vencido aparezca
simultáneamente en el dashboard, en el panel de alertas y en el historial del área.

---

## 7. Importación y exportación

**Exportación CSV:** disponible desde el encabezado de todo listado y todo reporte,
generada en el navegador con `csv.js`. Separador coma, comillas escapadas, BOM UTF-8 para
que Excel abra bien los acentos.

**Exportación PDF:** vía impresión del navegador con `impresion.css`.

**Importación CSV:** parser propio. Flujo: subir archivo o pegar contenido → mapeo de
columnas → vista previa con validación contra catálogos → reporte de filas aceptadas y
rechazadas con el motivo. Disponible para proyectos y para planificación anual.
`.xlsx` queda fuera de alcance: requeriría una dependencia pesada sin beneficio para el
prototipo.

---

## 8. Reglas transversales

1. **Navegación:** barra lateral fija con los 7 módulos, más Proyectos (base maestra) y
   Configuración. El dashboard es la ruta raíz.
2. **Filtros persistentes:** los filtros aplicados viven en `searchParams`, se mantienen al
   navegar dentro de un módulo y permiten compartir una vista pegando la URL.
3. **Todo listado es exportable** a CSV desde su propio encabezado.
4. **Cálculo de alertas centralizado:** §6. No se duplica la lógica.
5. **Estados vacíos:** toda vista sin datos usa el componente `<Vacio>` con mensaje claro y
   el atajo de carga correspondiente. Nunca una pantalla en blanco.
6. **Validaciones:** `avance` no puede superar `objetivo` sin confirmación explícita; las
   fechas límite no pueden ser anteriores a la fecha de carga; no se puede cerrar un
   monitoreo sin al menos un tema.

---

## 9. Datos de demostración

Botón «Cargar datos de demostración» en Configuración, junto a «Vaciar sistema». El set es
sintético y evidentemente ficticio: áreas y proyectos inventados, nunca datos reales del
municipio.

Volumen: ~40 proyectos sobre 8 áreas, suficiente para que se vean poblados los siete
módulos, con gráficos, calendarios, alertas y reportes con contenido.

Casos de borde incluidos a propósito:

- Compromisos vencidos.
- Proyectos sin actualizar hace más de 30 días.
- Un evento con requerimientos incompletos a menos de 5 días.
- Mesas de los tres tipos, alguna sin reunión en su período declarado.
- Monitoreos con temas de criticidad alta sin resolver.
- Planificación con desvíos en ambos sentidos (adelantado y atrasado).

«Vaciar sistema» deja el sistema limpio y navegable, con estados vacíos correctos en todas
las vistas.

---

## 10. Criterios de aceptación

- [ ] Un proyecto cargado en la base maestra se refleja automáticamente en dashboard,
      planificación y reportes.
- [ ] Un seguimiento con texto libre produce compromisos revisables y confirmables, que
      aparecen en la lista de compromisos y en las alertas.
- [ ] Un monitoreo permite cargar temas encadenados indefinidamente con estructura idéntica.
- [ ] Un compromiso vencido aparece simultáneamente en dashboard, panel de alertas e
      historial del área.
- [ ] Las mesas se visualizan separadas por tipo sin aplicar filtros.
- [ ] Un evento con requerimientos incompletos a 5 días genera alerta.
- [ ] El constructor de reportes produce un documento distinto según los filtros, con los
      filtros explicitados al pie.
- [ ] Ningún dato requiere doble carga en dos módulos distintos.
- [ ] El botón de demostración puebla los siete módulos de forma coherente; el de vaciado
      deja el sistema limpio y navegable.
- [ ] Toda lectura y escritura pasa por la capa de acceso: ningún componente llama a
      `localStorage` directamente. Verificado automáticamente.
- [ ] Cada módulo se ve terminado: sin placeholders, sin secciones sin estilar, sin
      pantallas en blanco.

---

## 11. Identidad visual

Institucional sobria, aplicada por tokens en el bloque `@theme` de `src/estilos/index.css`:
cambiar un valor ahí propaga a toda la app, sin hardcodear color, radio ni sombra en
componentes.

- **Superficies claras:** fondo `paper`, tarjetas blancas, sidebar clara.
- **Acento institucional** para navegación activa, botones primarios y enlaces.
- **Semáforo diferencial de cuatro niveles**, distinguibles de un vistazo: vencido /
  crítico · próximo · atención · en regla. Los niveles claros llevan texto oscuro, nunca
  blanco, por contraste.
- **Tipografía sans legible**, radios sobrios y sombras suaves.

Los colores institucionales reales del Municipio de Tres de Febrero se cargan reemplazando
los tokens cuando el área los provea.

---

## 12. Orden de implementación

1. Estructura del proyecto, capa de acceso a datos, store, catálogos y navegación general
2. Base maestra de proyectos: alta, edición, listado y generador de demostración
3. Módulo 1 — Dashboard
4. Módulo 2 — Seguimiento, con carga manual de los tres bloques
5. Módulo 3 — Monitoreo + motor de alertas centralizado
6. Separación automática simulada del Módulo 2
7. Módulo 4 — Planificación
8. Módulos 5 y 6 — Mesas y Eventos
9. Módulo 7 — Reportes

Cada etapa se entrega funcionando de punta a punta antes de pasar a la siguiente.

---

## 13. Diferido a la etapa posterior

Explícitamente fuera de alcance. No se implementa, pero ninguna decisión de arquitectura lo
bloquea.

1. Persistencia real y despliegue.
2. Usuarios y permisos.
3. Catálogos institucionales reales.
4. Formato definitivo del identificador de proyecto (validar `SEC-AAAA-NNN` contra la
   nomenclatura del POA).
5. Migración de datos existentes e importación desde `.xlsx`.
6. Período fiscal: si la planificación anual sigue el año calendario o el ejercicio
   presupuestario.
7. Procesamiento real de minutas por modelo de lenguaje.

La única exigencia hacia adelante es la capa de acceso a datos aislada (§3.2), para que el
paso a persistencia real sea un cambio localizado y no una reescritura.
