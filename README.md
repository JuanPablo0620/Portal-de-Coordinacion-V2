# Sistema de Coordinación y Seguimiento de Proyectos

**Municipio de Tres de Febrero · Área de Coordinación**

Herramienta interna para coordinar con las áreas municipales sus proyectos y hacerles
seguimiento sistemático, reemplazando el circuito disperso en planillas, minutas sueltas y
mensajería.

**Etapa actual: prototipo funcional.** Sin backend, sin base de datos real y sin datos
institucionales cargados. El objetivo es validar el diseño, la navegación y que todos los
flujos funcionen de punta a punta.

---

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
```

El sistema arranca vacío. Para verlo funcionando, entrá a **Configuración → Datos del
sistema → Cargar datos de demostración**: genera un set sintético y evidentemente ficticio
que puebla los siete módulos, incluidos los casos de borde (compromisos vencidos, proyectos
sin actualizar hace más de 30 días, un evento con requerimientos incompletos). El botón
**Vaciar sistema** deja todo limpio y navegable.

Al lado hay un segundo botón, **Cargar base completa**: el mismo set ficticio pero a escala
real —catorce áreas, tres años de proyectos, veinticuatro meses de seguimiento y monitoreo,
más de ocho mil registros contando la bitácora—. Sirve para lo que el set chico no puede
mostrar: cómo se comportan las tablas, los filtros, los tableros y la impresión con el
volumen que van a tener en uso. Los dos se generan con azar de semilla fija, así que dos
cargas producen exactamente la misma base.

| | Demostración | Base completa |
|---|---|---|
| Áreas | 8 | 14 |
| Proyectos | ~30 (1 año) | ~270 (3 años) |
| Seguimientos · monitoreos | ~30 · ~12 | ~250 · ~190 |
| Compromisos | ~70 | ~900 |
| Total con bitácora | ~700 | ~8.500 |
| Para qué | mostrar el sistema | probarlo con carga |

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run test` | Tests de los módulos de lógica pura (`node --test`) |
| `npm run humo` | Renderiza todas las rutas en Node —con la demo, con la base completa y con el sistema vacío— y audita accesibilidad |
| `npm run verificar` | **Antes de cerrar cualquier tanda:** todo lo anterior más los chequeos estructurales |

`npm run verificar` corre, en este orden: aislamiento de la capa de datos · ausencia de
importaciones circulares · ausencia de importaciones sin uso · 257 tests · build ·
78 comprobaciones de render · 16 rutas auditadas por accesibilidad.

---

## Módulos

| Ruta | Módulo | Qué resuelve |
|---|---|---|
| `/` | **Inicio** | Vencimientos a 15 días, próximos seguimientos, proyectos prioritarios, feed de últimas cargas, calendario unificado con capas y contadores clickeables |
| `/proyectos` | **Base maestra** | Alta, edición, ficha con historial e importación CSV. Es la tabla que alimenta todo lo demás |
| `/seguimiento` | **Módulo 2** | Calendario de seguimientos, carga de minutas con separación automática, lista de compromisos e historial por área |
| `/monitoreo` | **Módulo 3** | Carga incremental de temas, cobertura por área y panel de alertas |
| `/planificacion` | **Módulo 4** | Metas anuales y trimestrales, tablero de estadísticas y comparativo planificado vs. real |
| `/mesas` | **Módulo 5** | Mesas temáticas, barriales y otros proyectos, separadas en pestañas con color propio |
| `/eventos` | **Módulo 6** | Agenda, requerimientos desde catálogo cerrado y checklist con alerta a 5 días |
| `/reportes` | **Módulo 7** | Constructor con filtros combinables, vista previa, PDF por impresión y configuraciones guardadas |
| `/configuracion` | | Usuario que firma las cargas, catálogos administrables, demo y vaciado |

---

## Arquitectura

```
src/
  datos/                      ← toda la lógica de datos, cero JSX
    almacenamiento.js         ← ÚNICO archivo que toca localStorage
    esquema.js                ← colecciones, bdVacia(), versión de esquema
    repositorio.js            ← API pública de datos, toda async
    selectores.js             ← derivación pura sobre la base
    alertas.js                ← motor único de alertas
    demo.js                   ← set chico para mostrar el sistema
    base-completa.js          ← set a escala real: cuánto y cómo se genera
    base-completa-vocabulario.js ← y qué: áreas, plantillas, frases de minuta
    sintetico.js              ← piezas comunes de los dos sets
    importacion.js            ← forma de los CSV importables, para ambos lados
    catalogos.js · ids.js · bitacora.js · csv.js · reportes.js
    minutas/separarMinuta.js  ← aislado, reemplazable por un modelo real
  estado/tienda.js            ← caché Zustand hidratada desde el repositorio
  componentes/                ← UI compartida
  modulos/                    ← un directorio por módulo
  estilos/                    ← tokens @theme e impresión
```

### Tres decisiones que conviene conocer

**1 · `vencido` es un estado calculado, no guardado.** Sin backend no hay proceso que marque
vencimientos al cambiar el día; un estado persistido quedaría desactualizado apenas pasa una
jornada. Se persiste `pendiente` / `en curso` / `cumplido` y `vencido` se deriva en el
selector. El usuario lo ve como un cuarto estado, indistinguible de uno guardado.

**2 · Los compromisos tienen origen polimórfico.** Nacen de seguimientos, de temas de
monitoreo con acción requerida y de reuniones de mesa, y van todos a la misma lista. Por eso
llevan `origen_tipo` + `id_origen` en lugar de un `id_seguimiento`: es lo que permite que
cada fila linkee a su registro de origen.

**3 · La bitácora es append-only.** Un único mecanismo cubre el versionado exigido, el feed
«Última actualización» del inicio y la pestaña de historial de cada ficha. No se guardan
snapshots completos: inflarían el almacenamiento y ningún flujo requiere restaurar una
versión anterior.

### El motor de alertas es uno solo

`calcularAlertas(bd, hoy)` en `src/datos/alertas.js` es la **única** fuente de alertas del
sistema. La consumen el inicio, el panel de monitoreo, el checklist de eventos y los
reportes. De ahí sale, sin esfuerzo adicional, que un compromiso vencido aparezca
simultáneamente en los tres lugares con los mismos días de atraso. Una alerta nueva se
agrega ahí y aparece sola en todos.

---

## Cómo conectar un backend

Es el único requisito de arquitectura que la etapa actual tenía hacia adelante, y está
cumplido. El paso a persistencia real es un cambio localizado:

1. **Reemplazar los cuerpos de las funciones de `src/datos/repositorio.js`** por llamadas
   HTTP. Ya son todas `async` —aunque hoy resuelvan sincrónicamente— justamente para que la
   firma no cambie.
2. **Borrar `src/datos/almacenamiento.js`.** Es el único archivo del repositorio que
   menciona `localStorage`, y `npm run verificar` falla si aparece en cualquier otro.
3. **No tocar ningún componente.** Ninguno importa el almacenamiento ni muta la base: leen
   del store y escriben llamando al repositorio.

Un detalle a tener en cuenta al hacerlo: `enLote(fn)` agrupa varias operaciones en una sola
escritura y una sola notificación —lo usan la importación de planillas, el guardado de una
minuta con sus compromisos y la carga de un tema con acción—. Contra una API real es el punto
natural para una transacción o un endpoint de alta masiva, en lugar de una llamada por fila.

El chequeo de aislamiento está automatizado, así que el contrato no se degrada en silencio.

### Procesamiento real de minutas

`src/datos/minutas/separarMinuta.js` está aislado a propósito y no importa nada del resto del
sistema. Hoy separa la minuta en compromisos, avances y problemas con reglas locales (verbos
de acción, nombres propios, fechas, marcadores de traba). Al conectar un modelo de lenguaje
se reemplaza **sólo el cuerpo de esa función**: la firma, la forma del valor devuelto y toda
la interfaz de revisión quedan igual. El sistema nunca persiste compromisos sin confirmación
humana, ni ahora ni después.

---

## Fuera de alcance de esta etapa

Nada de lo siguiente está implementado, y ninguna decisión de arquitectura lo bloquea:

1. **Persistencia real y despliegue** — servidor municipal, nube o herramienta local.
2. **Usuarios y permisos** — eventual acceso de las áreas para carga directa. Hoy no hay
   login ni roles: el nombre que firma las cargas se configura en Configuración.
3. **Catálogos institucionales reales** — las listas cargadas son de muestra y evidentemente
   provisorias.
4. **Formato definitivo del identificador de proyecto** — `SEC-AAAA-NNN` está encapsulado en
   `src/datos/ids.js` a la espera de validarlo contra la nomenclatura del POA.
5. **Migración de datos existentes e importación `.xlsx`** — la importación CSV sí está
   implementada, para proyectos y para planificación anual.
6. **Período fiscal** — falta definir si la planificación anual sigue el año calendario o el
   ejercicio presupuestario.
7. **Procesamiento real de minutas por modelo de lenguaje.**

---

## No objetivos

- No es un sistema de expedientes ni reemplaza RAFAM.
- No gestiona presupuesto ejecutado a nivel de partida; sólo montos planificados y ejecutados
  a nivel proyecto.
- No requiere integración en vivo con sistemas municipales existentes.

---

## Documentación

- **Diseño validado:** `docs/superpowers/specs/2026-08-08-coordinacion-3f-design.md`
- **Plan de implementación:** `docs/superpowers/plans/2026-08-08-coordinacion-3f.md`
