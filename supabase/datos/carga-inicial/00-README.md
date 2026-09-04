> **Actualizado el 04/09/2026.** El 01/09 Tomás revirtió `puntuales` como tabla
> propia (commit `63226a4`, PR #4): el prototipo nunca la adoptó, así que vuelve
> a ser una fila de `proyectos` con `eje_id='Puntual'`. Los 8 puntuales de este
> paquete se movieron de `03-puntuales.csv` a `02-proyectos.csv` con esa forma.
> `03-puntuales.csv` queda vacío, con la nota, para que no se cargue por error
> contra una tabla que ya no existe.
# Carga inicial a Supabase — datos reales auditados

**Generado el 01/09/2026.** Datos del `1. Cualitativo` de los seis `_db`,
clasificados y **auditados fila por fila por JP**.

Objetivo: que las áreas puedan **cargar compromisos nuevos y consultar los
vigentes** desde el portal. La carga del histórico completo (3.806
actualizaciones) queda en standby por decisión de JP.

| Archivo | Filas | Tabla destino |
|---|---:|---|
| `01-programas.csv` | 61 | `programas` |
| `02-proyectos.csv` | 95 | `proyectos` (87 del POA + 8 puntuales con `eje='Puntual'`) |
| `02b-proyectos-SIN-PROGRAMA.csv` | 10 | **no cargar todavía** — ver abajo |
| `02c-proyectos-PROGRAMA-DUDOSO.csv` | 5 | **no cargar todavía** — ver abajo |
| `03-puntuales.csv` | 0 | **vacío** — la tabla ya no existe, ver nota arriba |
| `04-mesas.csv` | 3 | `mesas` |
| `05-compromisos.csv` | 130 | `compromisos` (124 del `_db` + 6 del PDF de Obras 20/08) |

**Los catálogos no están acá a propósito**: `areas`, `ejes`, `estados` y
`tipos_proyecto` ya vienen en los seeds de `0001_esquema.sql`, y los nombres de
estos CSV coinciden con ellos. Si cambiás un seed, revisá que siga cerrando.

Todos los archivos tienen **BOM** (para que Excel y Sheets respeten los
acentos). Si el importador deja la primera columna con un carácter raro
adelante, saltealo.

---

## Orden de carga

Las dependencias mandan: `programas` necesita `areas`, `proyectos` necesita
`programas`, `compromisos` necesita `areas` y —los de mesa— `reuniones_mesa`.

```
migración 0001 (crea tablas + catálogos)
   └─ 01-programas      (necesita areas)
        └─ 02-proyectos (necesita programas, ejes, tipos_proyecto)
   └─ 03-puntuales      (necesita areas)
   └─ 04-mesas
        └─ 05-compromisos (necesita areas; los de mesa, una reunión)
```

### 1. Programas

```sql
create table stg_programas (area text, nombre text);
-- \copy stg_programas from '01-programas.csv' with (format csv, header true);

insert into public.programas (area_id, nombre)
select a.id, s.nombre
from stg_programas s join public.areas a on a.nombre = s.area
on conflict (area_id, nombre) do nothing;
```

### 2. Proyectos

```sql
create table stg_proyectos (
  area text, programa text, nombre text, eje text, tipo text, es_obra boolean,
  estado_general text, fecha_ultima_actualizacion date, observaciones text
);
-- \copy stg_proyectos from '02-proyectos.csv' with (format csv, header true);

insert into public.proyectos (
  programa_id, nombre, eje_id, tipo_id, estado_general, es_obra, observaciones
)
select p.id, s.nombre, e.id, t.id,
       s.estado_general::public.estado_general, s.es_obra, s.observaciones
from stg_proyectos s
join public.areas a     on a.nombre = s.area
join public.programas p on p.nombre = s.programa and p.area_id = a.id
join public.ejes e      on e.nombre = s.eje
left join public.tipos_proyecto t on t.nombre = s.tipo;

select count(*) from public.proyectos;  -- 95 (87 del POA + 8 puntuales)
```

Si salen menos de 87, algún `join` no encontró su catálogo.

### 3. (sacado — los puntuales van con proyectos, ver arriba)

### 4. Mesas

```sql
insert into public.mesas (nombre, tipo, estado)
select nombre, tipo::public.tipo_mesa, estado::public.estado_mesa
from stg_mesas;
```

### 5. Compromisos

```sql
insert into public.compromisos (area_id, descripcion, estado, origen_tipo)
select a.id, s.descripcion,
       s.estado::public.estado_compromiso,
       s.origen_tipo::public.origen_compromiso
from stg_compromisos s join public.areas a on a.nombre = s.area;
```

---

## Decisiones ya tomadas, para que no haya que re-decidirlas

### Los estados de compromiso

El enum es `pendiente | en_curso | cumplido`. Los del `_db` son otros, así que
se mapearon:

| En el `_db` | Compromisos | → enum |
|---|---:|---|
| Pendiente | 77 | `pendiente` |
| En ejecución | 42 | `en_curso` |
| Alerta | 2 | `en_curso` |
| Programado | 1 | `pendiente` |
| (vacío) | 2 | `pendiente` |

**`alerta` no se guarda: se deduce.** Un compromiso no "pasa a alerta" — está en
alerta porque venció su fecha límite y sigue abierto. Es la regla que confirmó
JP el 01/09 y que el portal ya implementa en `estadoCompromiso()`. Por eso el
enum tiene tres valores y no cuatro. El ciclo de vida completo está en
`contexto/glosario.md` del repo de trabajo de JP.

### `fecha_limite` va vacía en los 124

El `_db` no la registra. Decisión de JP: **dejarlos sin alerta** en vez de
inventarles una fecha.

Consecuencia a tener presente: estos 124 **nunca van a aparecer en alerta**, por
más meses que lleven abiertos. Los compromisos nuevos que se carguen desde el
portal sí la van a tener — desde el 01/09 es obligatoria y por defecto es la
fecha del próximo seguimiento (+42 días).

### Los compromisos entran sin colgar de un proyecto

`proyecto_id` y `puntual_id` van en NULL en los 124. El esquema lo permite
(`num_nonnulls(proyecto_id, puntual_id) <= 1`) y lo único obligatorio es el
área.

El vínculo histórico compromiso→proyecto **no existe en el dato** y
reconstruirlo quedó en standby. Para el objetivo inmediato no hace falta: lo que
importa es que existan los proyectos y puntuales en el selector, para que las
áreas enganchen los compromisos **nuevos**.

### El origen de los de mesa

68 salen de reuniones de seguimiento y 56 de mesas. La columna `mesa` de
`05-compromisos.csv` dice de cuál. Para llenar `id_reunion_origen` hace falta
crear antes una `reuniones_mesa` por cada una — si no, quedan con `origen_tipo`
pero sin el id.

---

## Lo que NO entra, y por qué

**`02b-proyectos-SIN-PROGRAMA.csv` — 10 filas.** `programas.area_id` es
`not null` y `proyectos.programa_id` también, así que sin programa no hay forma
de insertarlos. Hay que decidir de qué programa cuelgan, o crear uno. Son todas
de Obras y casi todas obras de plaza reales (`Obra Plaza Artilleros`,
`Obra Plaza El Campito`…): probablemente cuelguen de `Obras en Espacios Verdes`,
pero eso lo confirma JP.

**`02c-proyectos-PROGRAMA-DUDOSO.csv` — 5 filas.** Su `programa` no es un
programa: es un lote de reunión (`Compromisos seguimiento 22/07`,
`Compromisos`) o un contenedor (`Agenda`). Cargarlos así metería esos tres
nombres en el catálogo de programas, que es justo lo que se viene limpiando.

Los tres de Salud con programa `Agenda` —`Presentismo`, `Turnos efectivos`,
`Uso de Agenda`— son además el caso que quedó sin decidir: tienen unidad y
objetivo cargados en la pestaña `Objetivos`, así que son **indicadores
cuantitativos**, no proyectos del POA.

**18 entidades marcadas fuera** en la pestaña `entidades_vigentes` del sheet,
con el motivo en la columna `NOTA / DESTINO REVISADO`. Son de tres clases, y
todas comparten el mismo problema de fondo — **son contenedores de datos
periódicos, no proyectos**:

- `Reportes MI3F` (7): los creó JP para volcar lo que extrae el script de mi3f.
- `Agenda Roco` (7): aparecen en las seis secretarías con el mismo nombre. Es
  una entidad transversal, no un programa de área.
- `Informe de Estadísticas Generales` (3) y `Mesa de barrios` (1).

**Esos datos sí tienen que aparecer en los reportes** — JP fue explícito. Pero
hoy no tienen lugar propio en el modelo. Si el objetivo incluye los informes del
lunes, este vacío va a aparecer ahí.

**Se descartó también** lo finalizado, lo clasificado como `ACTUALIZACION` (29,
que son observaciones sobre otro registro) y lo `DESCARTAR` (27, etiquetas de
sección del sheet que se colaron como filas).

---

## Advertencias

**Cuatro filas quedaron sin decidir** y están en el sheet, no acá: en Salud, el
programa `Agenda` (`Presentismo`, `Turnos efectivos`, `Uso de Agenda`) son
indicadores con unidad y objetivo, no proyectos; y en Seguridad la fila
`Informe` parece un compromiso de mesa mal clasificado.

**18 de los 124 compromisos son arrastres**: 3+ meses entre la primera y la
última carga, y 5+ cargas, sin cambiar de estado. El caso extremo es "Portón"
(Ambiente): 25 cargas, seis meses, siempre `Pendiente`. Van a entrar como
vigentes porque nadie los cerró. Vale revisarlos en la reunión de secretaría
antes de que aparezcan en pantalla.

**Una fila tiene `Derivación = ". , Dirección"`**, con un punto suelto. La
derivación no se carga (no existe en `compromisos`), así que no rompe nada, pero
está ahí.

---

## De dónde salió cada cosa

- Sheet **«limpieza de datos»**, pestañas `entidades_vigentes` y
  `compromisos_vigentes` — es la fuente de verdad y lo auditó JP.
- El camino completo, de las 3.806 filas hasta acá:
  [`../../docs/traspaso-datos-reales.md`](../../docs/traspaso-datos-reales.md).
- Por qué el cualitativo no entra tal cual:
  [`../../docs/carga-cualitativo-al-portal.md`](../../docs/carga-cualitativo-al-portal.md).


---

## Agregado el 04/09/2026 — 6 compromisos del PDF de Obras (20/08)

El jefe de JP pidió cargar compromisos recientes que están en PDF porque no se
cargaron en el sheet — se esperaba a que el portal estuviera disponible. Se
recibieron 3 PDF: Capital Humano 15/07, Seguridad 08/07, Obras 20/08.

**Capital Humano y Seguridad: se verificaron y NO aportan nada nuevo.** Los 14
ítems de esos dos PDF ya están en el `_db`, con el mismo texto exacto, repetido
semana a semana hasta el 17/08/2026 — es el patrón de arrastre que ya
documentamos (mismo comentario copiado sin cambios). Ya están en este paquete.
Se verificó por nombre exacto + fecha, no por texto aproximado.

**Obras sí tenía novedades reales.** De los 8 ítems del PDF, 6 se agregaron:

| Título | Motivo |
|---|---|
| `PBN Hornos` | El `_db` lo tenía marcado `Finalizado` desde el 06/07 — el PDF del 20/08 lo reabre con trabajo pendiente nuevo. **Avisar en la reunión**: o se reabrió de verdad, o el `_db` nunca reflejó que seguía abierto |
| `Difusión demolición parrilla` | El `_db` ya tenía un compromiso "Comunicación" pero de otro tema (evento con Quilmes). Se le puso nombre distinto para no confundirlos — JP confirmó: nuevo, sin vincular a ningún proyecto |
| `Cartelería escolar` | Mismo caso: el `_db` ya tenía "Cartelería" de otro tema (Centros Comerciales) |
| `Estudio Observacional` | Nuevo, sin nombre previo en el `_db` |
| `Obras en ejecución` | Nuevo |
| `Viviendas Firpo` | Nuevo |

**Un ítem del PDF se descartó a pedido de JP**: el punto 4 (sin nombre propio en
el original — "Articular con Ceremonial para que Roco vaya a comunicar el plan
de colocación de refugios") no se cargó.

**`fecha_limite` de los 6 nuevos: `2026-10-01`, sin confirmar.** Es el default
de la regla (fecha de la reunión + 42 días = próximo seguimiento), no la fecha
real agendada de Obras. Si tienen la fecha real, corregirla antes de subir a
Supabase.

**Se agregó la columna `fuente`** a las 130 filas: `_db cualitativo` para las
124 históricas, `PDF Seguimiento Obras 20/08/2026` para las 6 nuevas — para que
el archivo quede autodescriptivo sobre de dónde salió cada compromiso.
