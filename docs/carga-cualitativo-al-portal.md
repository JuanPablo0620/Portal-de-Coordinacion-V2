# Cargar el "1. Cualitativo" de los `_db` al portal — simulación y hallazgos

**Fecha:** 26/08/2026
**Qué se hizo:** se simuló la importación al portal de las 3.806 filas del
"1. Cualitativo" de las seis secretarías (las mismas que JP importó a la hoja
`cualitativo_copia` de cada `_db`), corriendo el validador real del portal
(`validarFilasProyecto()` de `src/datos/importacion.js`) contra
`CATALOGOS_SEMILLA`.

**Resultado de la simulación: 0 filas aceptadas de 3.806.**

No es un problema de calidad del dato — los CSV ya venían corregidos. Es un
desajuste de modelo: **el `_db` cualitativo y la tabla `proyectos` del portal no
describen la misma cosa.**

---

## Resumen del veredicto

| # | Impedimento | Gravedad |
|---|---|---|
| 1 | Una fila del cualitativo **no es un proyecto**, es una actualización | Bloqueante — estructural |
| 2 | El portal exige `tipo`, `unidad` y `objetivo`; el cualitativo no los tiene por definición | Bloqueante |
| 3 | El `Eje` describe la fila, no el proyecto: no hay dónde guardarlo | Bloqueante — es el problema de los compromisos |
| 4 | `Programa` se usa como lote de reunión, no como programa | Alto |
| 5 | Los catálogos de `Estado` no coinciden | Medio |
| 6 | `Estado General`, `Derivación` y `Finaliza en` no tienen destino en el prototipo | Medio |
| 7 | Los nombres de proyecto no están normalizados | Bajo, pero contamina |

---

## 1. Una fila no es un proyecto — es una actualización

Este es el hallazgo principal y explica casi todos los demás.

Las 3.806 filas corresponden a **564 pares (programa + proyecto) distintos**, o
**425 proyectos** una vez normalizados los nombres. Cada proyecto aparece en
promedio **6,7 veces**, y en casos extremos muchas más:

| Secretaría | Filas | Pares prog+proy únicos | Máx. repeticiones de un mismo proyecto |
|---|---:|---:|---:|
| Ambiente | 1.032 | 180 | 43 |
| Capital Humano | 628 | 95 | 25 |
| Obras | 834 | 128 | 52 |
| Salud | 466 | 46 | 28 |
| Seguridad | 443 | 66 | 20 |
| Trabajo y Producción | 403 | 49 | 21 |
| **Total** | **3.806** | **564** | |

Ejemplo verificado — Obras, "Demarcación de Calles": 52 filas, **22 fechas de
actualización distintas, 24 comentarios distintos** y tres estados a lo largo
del tiempo (`En ejecución` → `Programado` → `Finalizado`). No son 52 proyectos:
es un proyecto monitoreado 52 veces. El 91% de las filas (3.459 de 3.806) trae
`Fecha de actualización` cargada, que es lo que las distingue entre sí.

**Consecuencia:** importar el cualitativo contra `proyectos` crea 3.806
proyectos duplicados en vez de 425 proyectos con su historial. El portal
mostraría "Demarcación de Calles" 52 veces en la tabla maestra.

**Dónde va realmente:** el esquema de Supabase ya tiene la tabla correcta —
`actualizaciones`, con `tipo = 'cualitativa'`, `proyecto_id`,
`fecha_actualizacion`, `estado_id`, `derivacion` y `comentarios`. Es
exactamente una fila del "1. Cualitativo". **El prototipo React no la tiene:**
`COLECCIONES` en `src/datos/esquema.js` no incluye ninguna colección de
actualizaciones por proyecto.

---

## 2. Campos obligatorios que el cualitativo no puede tener

`CAMPOS_PROYECTO` marca como requeridos `proyecto`, `area`, `tipo`, `unidad` y
`objetivo`. La pestaña cualitativa, por definición, es la de los proyectos **sin
métrica numérica** (ver glosario) — no tiene unidad ni objetivo, y nunca los va
a tener. Esos viven en "2. Cuantitativo".

Motivos de rechazo agregados de la simulación:

| Filas rechazadas | Motivo |
|---:|---|
| 3.806 | falta tipo |
| 3.806 | falta unidad |
| 3.806 | falta objetivo |
| 3.246 | el programa no está en el catálogo |
| 1.517 | el estado no es un valor válido |
| 175 | falta nombre del proyecto |
| 42 | fin previsto no es una fecha válida |
| 37 | el eje no está en el catálogo |

Además, **el mapeo automático no reconoce el área**: el CSV del `_db` no tiene
columna de área — está implícita en de qué sheet salió. En la simulación se
inyectó a mano (mejor caso posible) y aun así el rechazo fue total.

Encabezados del `_db` que el portal **sí** reconoce solo: `Proyecto`,
`Programa`, `Eje`, `Estado`, `Fecha de fin`. Los otros cinco quedan sin mapear.

---

## 3. El `Eje` describe la fila, no el proyecto — el problema de los compromisos

Este es el punto que JP planteó, y la simulación confirma que **el modelo actual
no lo puede representar**.

En `proyectos` (tanto en el prototipo como en Supabase) el eje es una columna
del proyecto: `eje_id uuid not null`. Un proyecto, un eje. Pero en el `_db` el
eje cambia fila por fila, porque describe **de dónde salió esa observación**:

- `POA` — la observación viene del monitoreo del plan operativo
- `Mesa Esperanza` / `Mesa EDLA` / `Mesa Favelita / El Libertador` — viene de una mesa
- `Compromisos` — viene de una reunión de seguimiento
- `Puntual` — pedido suelto

**18 proyectos (4%) tienen más de un eje entre sus filas.** Ejemplos reales:

- Ambiente, "Becarios" (13 filas): `Mesa EDLA` y `Compromisos`
- Ambiente, "Plantaciones" (7 filas): `POA` y `Compromisos`
- Ambiente, "Luminaria" (9 filas): `Mesa Favelita / El Libertador` y `Mesa Esperanza`
- Capital Humano, "SAE" (7 filas): `POA` y `Compromisos`

Al colapsar las filas en un proyecto hay que elegir **un** eje y se pierde el
resto. Y si en cambio se crea un proyecto por eje, se duplica el proyecto.

### Lo que pasó al vaciar `Programa = "Compromisos"`

Antes del cambio había **658 filas** con `Programa` exactamente `"Compromisos"`.
Su distribución por eje:

| Eje de esas filas | Cantidad |
|---|---:|
| `Mesa Esperanza` / `Mesa EDLA` / `Mesa Favelita / El Libertador` | 350 |
| `Compromisos` | 297 |
| (vacío) | 11 |
| `POA` | **0** |

Dos observaciones sobre esto:

1. **No había compromisos marcados sobre eje POA.** Los compromisos sobre
   proyectos del POA aparecen con `Eje = Compromisos`, no con `Eje = POA`. Ese
   caso sigue siendo identificable por el eje.

2. **Las 350 filas de mesa sí quedaron sin marca**, tal como JP anticipó. Y no
   se puede deducir por el eje, porque **no todas las filas de una mesa son
   compromisos**: Ambiente tiene 146 filas de `Mesa Esperanza`, de las cuales
   solo 78 tenían `Programa = "Compromisos"`. Las otras 68 son observaciones de
   monitoreo comunes sobre los mismos proyectos ("Contenedores", "Portón"). La
   información de qué era compromiso y qué no **se perdió y no es recuperable
   desde el dato**.

### Aviso: quedaron 16 variantes sin borrar

Si se borró el literal `"Compromisos"`, siguen cargadas estas variantes en la
columna `Programa`, que son el mismo concepto escrito distinto:

```
COMPROMISOS              Compromisos 01/04        Compromisos 27/05
COMPROMISOS BARRIOS      Compromisos 08/04        Compromisos 29/05
COMPROMISOS PUNTUALES    Compromisos 08/07        Compromisos EDLA
COMPROMISOS SEGUIMIENTO  Compromisos 15/07        Compromisos Esperanza
Compromisos  17/06       Compromisos seguimiento  Compromisos seguimiento 10/06
Compromisos  24/06       Compromisos seguimiento 22/07
```

Conviene decidir qué hacer con ellas antes de dar el dato por limpio: o se
borran también, o se usan como pista para reconstruir la marca de compromiso.

---

## 4. `Programa` se usa como identificador de reunión

Las variantes de arriba muestran el patrón: `Compromisos seguimiento 10/06`,
`Compromisos 22/07`, `OBRAS+AMB+COORDINACION`. **Eso no es un programa** — es la
reunión en la que se cargó la fila, o las áreas que participaron.

**77 proyectos (17%) aparecen bajo más de un `Programa` distinto**, justamente
porque el mismo proyecto se tocó en varias reuniones.

En el modelo del portal `programa_id` es `not null` en `proyectos` y apunta a un
catálogo cerrado. Con el dato como está, o se rechaza la fila (3.246 rechazos en
la simulación) o se puebla el catálogo de programas con nombres de reunión.

Lo que el dato está pidiendo es la tabla `monitoreos` de Supabase (fecha + área)
con las filas colgando de ahí — que existe, pero el prototipo no la conecta con
esta carga.

---

## 5. Los estados no coinciden

| Estado en el `_db` | Filas | ¿Existe en `ESTADOS_PROYECTO`? |
|---|---:|---|
| `En ejecución` | 1.402 | Sí |
| `Pendiente` | 1.238 | No |
| `Finalizado` | 465 | Sí |
| (vacío) | 422 | — |
| `Alerta` | 131 | No |
| `Programado` | 126 | No |
| `Crítico` | 22 | No |

Solo 1.867 de 3.806 filas (49%) traen un estado que el portal acepta. El
catálogo del portal es `planificado / en ejecución / demorado / finalizado /
suspendido`; el del `_db` es otro vocabulario.

Ya existe `mapearEstado()` en `src/datos/repositorio.js` (línea 300) que traduce
estos valores y conserva el original en observaciones — pero **el importador CSV
no lo usa**: valida contra `ESTADOS_PROYECTO` directo y rechaza.

Nota: `Pendiente` y `Programado` son estados reales y frecuentes, no errores de
carga. `Pendiente` es el segundo estado más usado de todo el dataset.

---

## 6. Columnas sin destino en el prototipo

| Columna del `_db` | Destino en el prototipo | Destino en Supabase |
|---|---|---|
| `Fecha de actualización` | — (el proyecto solo tiene `fecha_carga`) | `actualizaciones.fecha_actualizacion` ✓ |
| `Estado General` (Vigente / Finalizado) | — | `proyectos.estado_general` ✓ |
| `Comentarios` | — (no hay campo de observación por actualización) | `actualizaciones.comentarios` ✓ |
| `Derivación` (Dirección / Secretaría) | — | `actualizaciones.derivacion` ✓ |
| `Finaliza en` (días restantes) | — | — (es una fórmula, se recalcula) |

El prototipo pierde cuatro de las diez columnas. El esquema de Supabase cubre
casi todas — **le falta una sola cosa: de qué mesa o reunión salió la
actualización.** `actualizaciones` no tiene `mesa_id` ni `reunion_id`, y ese es
justamente el dato del `Eje` (punto 3).

---

## 7. Nombres de proyecto no normalizados

443 nombres distintos que se reducen a **425** al bajar a minúsculas, sacar
acentos y colapsar espacios. Es decir, **18 pares son el mismo proyecto escrito
de dos formas**:

- `Plan de poda` = `Plan de Poda`
- `Plan de Bacheo` = `PLAN DE BACHEO`
- `Demarcación de Calles` = `DEMARCACION DE CALLES` = `DEMARCACIÓN DE CALLES`
- `Túnel hornos` = `Tunel hornos`
- `AySA` = `AYSA`
- `Telegestion` = `Telegestión`
- `Obras de infraestructura  escolar…` (doble espacio) = `Obras de infraestructura escolar…`

Sin normalizar, cualquier agrupación por nombre parte el historial de esos
proyectos en dos.

---

## 8. La causa de fondo: la columna "Proyecto" no contiene proyectos

*(Agregado el 26/08/2026, a partir de la hipótesis de JP: "hay muchos proyectos
que no lo son, como Portón en Ambiente, que no debería ser un proyecto sino un
compromiso de ningún proyecto".)*

La hipótesis se confirma. Cruzando la columna `Programa` contra la lista oficial
de programas de la hoja `Intereses` (ver `contexto/programas-municipales.md`):

| Secretaría | Filas | Programa oficial del POA | Sin programa | Programa = una reunión | Otro texto |
|---|---:|---:|---:|---:|---:|
| Ambiente | 1.032 | 164 | 188 | 497 | 183 |
| Capital Humano | 628 | 110 | 80 | 256 | 182 |
| Obras | 834 | 219 | 142 | 154 | 319 |
| Salud | 466 | 136 | 41 | 142 | 147 |
| Seguridad | 443 | 40 | 75 | 239 | 89 |
| Trabajo y Producción | 403 | 0 | 34 | 225 | 144 |
| **Total** | **3.806** | **669** | **560** | **1.513** | **1.064** |

**Solo el 18% de las filas cuelga de un programa oficial del POA.** El otro 82%
son compromisos, pedidos puntuales y temas de mesa cargados en las mismas
columnas que los proyectos.

Y de los 389 nombres de proyecto distintos, **213 son de una o dos palabras** —
"Portón", "Contenedores", "Cartelería", "Columnas Telecom", "AySA". Eso es la
forma gramatical de un compromiso ("resolver el tema del portón"), no la de un
proyecto.

### El caso "Portón", entero

25 filas, del 23/02/2026 al 17/08/2026, semana por semana:

- `Eje` siempre `Mesa Esperanza`
- `Estado` siempre `Pendiente` — las 25 veces
- `Comentarios` prácticamente idéntico: *"Pendiente resolver tema portón luego
  de la realización de la plaza"*, que en mayo pasa a *"Pendiente porton.
  Pendiente preguntar a leguiza por el Portón"*
- `Programa` cambia solo: vacío → `Compromisos Esperanza` → `Compromisos`

Eso no es un proyecto con seis meses de avance. Es **un compromiso de la Mesa
Esperanza que lleva seis meses sin cumplirse**, arrastrado de reunión en reunión.
El `_db` no tiene dónde ponerlo, así que lo pone en la columna "Proyecto".

### Dos hallazgos nuevos que salieron de mirar esto

**a) 227 filas son encabezados de sección, no datos.** En la columna `Proyecto`
aparecen las etiquetas estructurales del propio sheet: `Compromisos` (46 filas),
`Puntuales` (34), `Proyectos` (36), `POA` (22), `Eventos` (26), `Compromisos
barrios` (26). **106 de ellas están completamente vacías** — ni estado ni
comentario: son los separadores visuales de la planilla, que al exportar a CSV
se vuelven filas de datos. Hay que descartarlas en cualquier carga.

**b) El 57% de las actualizaciones no actualiza nada.** De las 3.563 filas que
pertenecen a un proyecto con historial, **2.025 repiten estado Y comentario
idénticos a la carga anterior**. La carga semanal copia la fila previa cuando no
hubo novedad. El `_db` no registra *cambios*, registra *el estado en cada
semana*.

Para el portal esto es una decisión de diseño a tomar, no un error a corregir:
guardar las 3.806 y poder responder "¿cómo estaba esto el 15/06?", o guardar
solo las ~1.500 con cambio real y que el historial sea más corto y más legible.
Recomendación: **guardar todas** (el dato ya existe y es barato), pero que la
ficha del proyecto muestre por defecto solo las que cambian algo.

### Esto NO es solo un problema de disciplina de carga

Vale separar las dos cosas, porque tienen arreglos distintos:

- **Lo que sí es error de carga:** los 18 nombres duplicados por mayúsculas, los
  "." sueltos, los comentarios metidos en la columna Proyecto (ya corregido en
  la auditoría del 25-26/08).
- **Lo que es diseño de la planilla:** meter proyectos, compromisos, puntuales y
  temas de mesa en **una sola tabla con las mismas diez columnas**. Nadie se
  equivocó al cargar "Portón" ahí: no había otro lugar donde ponerlo. El `_db`
  hace tres trabajos con una sola estructura.

Pedirle a las áreas que carguen mejor no arregla lo segundo. Lo que lo arregla
es que el portal ofrezca los tres destinos por separado.

### La buena noticia: el modelo nuevo ya lo contempla

El esquema de Supabase que mergeamos de Tomás **ya soporta exactamente el caso
que JP describe** — un compromiso que no pertenece a ningún proyecto:

```sql
create table public.compromisos (
  proyecto_id  uuid references public.proyectos(id),
  puntual_id   uuid references public.puntuales(id),
  area_id      uuid not null references public.areas(id),
  descripcion  text not null,
  ...
  constraint compromisos_vinculo_unico check (
    num_nonnulls(proyecto_id, puntual_id) <= 1
  )
);
```

`<= 1`, no `= 1`: de un proyecto, de un puntual, **o de ninguno**. Lo único
obligatorio es el área. El comentario del propio código de Tomás lo dice con un
ejemplo casi idéntico al del Portón.

Así que "Portón" tiene destino: `compromisos`, con `area_id` = Ambiente,
`id_reunion_origen` = la reunión de Mesa Esperanza, `proyecto_id` y `puntual_id`
en NULL, `estado = 'pendiente'`. Las 25 filas dejan de ser 25 proyectos y pasan
a ser **un compromiso** — que además queda visible como lo que es: algo pendiente
hace seis meses.

**Lo que falta para poder hacerlo:** decidir, fila por fila, si va a `proyectos`,
`puntuales` o `compromisos`. Eso no se puede inferir del dato con seguridad —
depende de saber qué es cada cosa. Es una clasificación que hay que hacer una
vez, sobre 389 nombres (no sobre 3.806 filas), y de ahí en más el portal la
sostiene solo.

---

## Qué habría que hacer

Ordenado por lo que desbloquea más:

1. **Separar la carga en dos pasos.** Primero dar de alta los ~425 proyectos
   (una vez, con área, tipo y programa reales), después importar las 3.806
   actualizaciones referenciando el proyecto. Es el único orden que no duplica.

2. **Agregar la colección de actualizaciones al prototipo**, espejando
   `actualizaciones` de Supabase. Sin eso el prototipo no tiene dónde poner
   ninguna de las 3.806 filas, y las cuatro columnas del punto 6 se pierden.

3. **Mover el eje de `proyectos` a la actualización**, o agregar
   `mesa_id` / `reunion_id` a `actualizaciones`. Es lo que resuelve el problema
   de los compromisos de mesa de raíz, y hace falta también en Supabase.

4. **Decidir cómo se marca un compromiso.** Las 350 filas de mesa ya perdieron
   la marca. Las 16 variantes de `Programa` del punto 3 son la única pista que
   queda; si se van a usar, hay que hacerlo antes de borrarlas.

5. **Aflojar el importador para la carga cualitativa:** que `unidad` y
   `objetivo` no sean obligatorios cuando la fila es cualitativa, y que use
   `mapearEstado()` en vez de rechazar los estados del `_db`.

6. **Normalizar nombres de proyecto** antes de agrupar (minúsculas, sin
   acentos, espacios colapsados) — 18 fusiones.

---

## Cómo reproducir la simulación

Los scripts quedaron en el scratchpad de la sesión, no en el repo (son de un
solo uso). Lo que hacen, para rehacerlo:

1. Leer los CSV de `analisis/auditoria-cualitativo-secretarias/completo/` con un
   parser CSV real (las celdas de `Comentarios` tienen saltos de línea internos).
2. Mapear cada fila a un objeto con las claves de `CAMPOS_PROYECTO`, inyectando
   `area` a mano (el CSV no la trae).
3. Llamar a `validarFilasProyecto(objetos, CATALOGOS_SEMILLA, hoy)` y contar
   `aceptadas` / `rechazadas` agrupando por motivo.
