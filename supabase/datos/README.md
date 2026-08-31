# Datos de carga inicial

## `proyectos-validados-51.csv`

Los 51 proyectos reales que hoy carga
`cargarProyectosValidadosCualitativo()` en el prototipo. Salen de la pestaña
`1. Cualitativo` de los seis `_db`, y son los únicos que pasaron el doble
filtro de la clasificación: destino `PROYECTO` **y** confianza alta — es decir,
cuelgan de un programa oficial de la hoja `Intereses` y tienen eje POA.

Contexto completo de cómo se llegó a estos 51: [`../../docs/traspaso-datos-reales.md`](../../docs/traspaso-datos-reales.md).

**Se genera, no se edita a mano:**

```
node scripts/exportar-validados.mjs supabase/datos/proyectos-validados-51.csv
```

El script corre el loader real sobre una base vacía y exporta lo que quedó, así
el CSV no puede desviarse de lo que el portal muestra.

### Columnas

| Columna | Notas |
|---|---|
| `id_legible` | `SEC-2026-NNN`, el que genera el prototipo. Cosmético: en Supabase la PK es el uuid |
| `area`, `programa` | Por nombre. En Supabase el área llega vía `programas.area_id` — `proyectos` no tiene `area_id` propio |
| `nombre` | El proyecto |
| `eje` | `POA` en los 51 |
| `tipo`, `es_obra` | `es_obra` se deriva del tipo. 10 obras, 5 programas sociales, 36 servicios |
| `estado_portal` | Ya traducido al catálogo del sistema |
| `estado_general` | `vigente` / `finalizado`, que es el enum de Supabase |
| `estado_en_el_sheet` | El valor **original**, sin traducir. Para poder auditar la traducción |
| `fecha_ultima_carga` | Última vez que se actualizó en el cualitativo |
| `observaciones` | Último comentario + la nota del estado original |
| `cargas_en_el_cualitativo` | Cuántas veces se actualizó entre febrero y agosto de 2026 |

**Seis columnas están vacías en las 51 filas**: `prioridad`, `fecha_inicio`,
`fecha_fin_proyectada`, `unidad`, `objetivo`, `avance`. No es un error de
exportación — esos datos no están en el cualitativo. Las métricas viven en la
pestaña `Objetivos` (74 filas en total entre las seis secretarías, de las cuales
solo 20 matchean con el maestro) y las fechas en `Estado de proyectos` (cargadas
en 22 y 15 filas de 143). El detalle está en el documento de traspaso.

---

## Cómo cargarlo en Supabase

**No se puede hacer un `COPY` directo.** `proyectos.programa_id`, `eje_id` y
`tipo_id` son uuid con foreign key, y el CSV trae nombres. Hay que poblar los
catálogos primero y resolver las FK por nombre.

Orden obligatorio, por las dependencias:

```
areas  →  programas (necesita area_id)  →  proyectos
ejes, tipos_proyecto (independientes, en cualquier momento antes de proyectos)
```

### 1. Catálogos base

```sql
insert into public.areas (nombre, prefijo) values
  ('Secretaría de Ambiente y Servicios Públicos', 'AMB'),
  ('Secretaría de Capital Humano',                'CAH'),
  ('Secretaría de Obras',                         'OBR'),
  ('Secretaría de Salud',                         'SAL'),
  ('Secretaría de Seguridad',                     'SEG')
on conflict do nothing;

insert into public.ejes (slug, nombre) values ('poa', 'POA')
on conflict (slug) do nothing;

insert into public.tipos_proyecto (slug, nombre) values
  ('obra', 'Obra'), ('servicio', 'Servicio'), ('programa-social', 'Programa social')
on conflict (slug) do nothing;
```

Trabajo y Producción no está: ninguno de sus proyectos llegó a confianza alta,
así que no aporta filas a este CSV.

### 2. Subir el CSV a una tabla de staging

```sql
create table stg_proyectos (
  id_legible text, area text, programa text, nombre text, eje text, tipo text,
  es_obra boolean, estado_portal text, estado_general text, estado_en_el_sheet text,
  prioridad text, fecha_ultima_carga date, fecha_inicio date, fecha_fin_proyectada date,
  unidad text, objetivo text, avance text, observaciones text,
  cargas_en_el_cualitativo int
);
```

Importar con `\copy` desde psql, o con el importador de la consola de Supabase.
**El archivo tiene BOM** (para que Excel y Sheets respeten los acentos): si el
importador deja `﻿id_legible` con un carácter raro adelante, sacarle el BOM
antes o renombrar la columna.

### 3. Programas — de acá sale el vínculo con el área

```sql
insert into public.programas (area_id, nombre)
select distinct a.id, s.programa
from stg_proyectos s
join public.areas a on a.nombre = s.area
on conflict (area_id, nombre) do nothing;
```

### 4. Proyectos

```sql
insert into public.proyectos (
  id_legible, programa_id, nombre, eje_id, tipo_id,
  estado_general, es_obra, observaciones
)
select
  s.id_legible,
  p.id,
  s.nombre,
  e.id,
  t.id,
  s.estado_general::public.estado_general,
  s.es_obra,
  s.observaciones
from stg_proyectos s
join public.areas a           on a.nombre = s.area
join public.programas p       on p.nombre = s.programa and p.area_id = a.id
join public.ejes e            on e.nombre = s.eje
left join public.tipos_proyecto t on t.nombre = s.tipo;
```

Verificar antes de dar por buena la carga:

```sql
select count(*) from public.proyectos;  -- tienen que ser 51
```

Si salen menos, es que algún `join` no encontró su catálogo — revisar áreas y
programas.

### 5. Después

Borrar `stg_proyectos`. Y tener presente que `estado_portal` y
`fecha_ultima_carga` **no entran** en `proyectos`: son propiedades de una
actualización, no del proyecto. Su lugar es la tabla `actualizaciones`, con
`tipo = 'cualitativa'` — que es justamente la carga que quedó pendiente.
