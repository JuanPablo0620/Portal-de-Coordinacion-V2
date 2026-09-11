-- ---------------------------------------------------------------------------
-- 0027_subsecretarias_direcciones.sql — a qué unidad de la secretaría
-- pertenece cada compromiso.  11/09/2026
--
-- Hasta ahora un compromiso solo sabía su secretaría (`area_id`). Se agregan
-- dos niveles más, opcionales y en cascada: subsecretaría y, dentro de ella,
-- dirección. Se puede cargar uno de los dos, los dos, o ninguno.
--
-- Datos: ORGANIGRAMA MUNICIPAL.pdf (Drive de la Municipalidad), pasado por JP
-- el 11/09/2026. Sólo se cargan las 7 secretarías que tienen `_db` en el
-- circuito de monitoreo (ambiente, capital_humano, obras, salud, seguridad,
-- trabajo_y_produccion, coordinacion) — Secretaría General y Finanzas y
-- Eficiencia del Estado quedan afuera a pedido explícito.
--
-- Dos achatamientos del organigrama real, a propósito:
--
--  1. Capital Humano y la rama de Movilidad de Obras tienen TRES niveles
--     (Subsecretaría → Dirección General → Dirección puntual). Acá se
--     guardan los dos últimos como direcciones hermanas de la misma
--     subsecretaría — no se pierde ningún nombre, se pierde el paso
--     intermedio como filtro propio.
--  2. Salud es al revés de lo esperable: sus dos subsecretarías no tienen
--     ninguna dirección debajo en el organigrama, y las cuatro direcciones
--     de Salud cuelgan directo de la secretaría. Quedan cargadas con
--     `subsecretaria_id` nulo.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

create table if not exists public.subsecretarias (
  id      uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id),
  nombre  text not null,
  orden   int  not null default 0,
  activo  boolean not null default true,
  unique (area_id, nombre)
);

comment on table public.subsecretarias is
  'Subsecretarías de cada secretaría, para clasificar de dónde sale un compromiso. Ver 0027 para la fuente y los achatamientos del organigrama real.';

create table if not exists public.direcciones (
  id               uuid primary key default gen_random_uuid(),
  area_id          uuid not null references public.areas(id),
  -- Nula: hay direcciones que dependen directo de la secretaría, sin
  -- subsecretaría en el medio (ver Salud en el comentario de arriba).
  subsecretaria_id uuid references public.subsecretarias(id),
  nombre           text not null,
  orden            int  not null default 0,
  activo           boolean not null default true,
  unique (area_id, nombre)
);

comment on table public.direcciones is
  'Direcciones de cada secretaría, opcionalmente bajo una subsecretaría. Ver 0027 para la fuente y los achatamientos del organigrama real.';

alter table public.compromisos
  add column if not exists subsecretaria_id uuid references public.subsecretarias(id),
  add column if not exists direccion_id     uuid references public.direcciones(id);

comment on column public.compromisos.subsecretaria_id is 'Opcional. En cascada con direccion_id: ver 0027.';
comment on column public.compromisos.direccion_id is 'Opcional. Si tiene subsecretaria_id, tiene que pertenecer a esa subsecretaría.';


-- ---------------------------------------------------------------------------
-- Semillas: subsecretarías primero (las necesita direcciones), después
-- direcciones resueltas contra el id real de su área y su subsecretaría.
-- `on conflict do nothing` para que correr esto dos veces no duplique.
-- ---------------------------------------------------------------------------
insert into public.subsecretarias (area_id, nombre, orden)
select a.id, s.nombre, s.orden
from (values
  ('coordinacion',          'Subsecretaría de Atención al Vecino',              1),
  ('salud',                 'Subsecretaría de Determinantes Sociales de la Salud', 1),
  ('salud',                 'Subsecretaría de Gestión y Administración Sanitaria', 2),
  ('seguridad',             'Subsecretaría de Seguridad',                        1),
  ('ambiente',              'Subsecretaría de Ambiente e Higiene Urbana',        1),
  ('ambiente',              'Subsecretaría de Mantenimiento del Espacio Público', 2),
  ('trabajo_y_produccion',  'Subsecretaría de Fiscalización y Control',          1),
  ('obras',                 'Subsecretaría de Obras Públicas y Movilidad',       1),
  ('obras',                 'Subsecretaría de Infraestructura',                  2),
  ('obras',                 'Subsecretaría de Desarrollo Urbano',                3),
  ('capital_humano',        'Subsecretaría de Capital Humano (Unidad Ejecutora)', 1)
) as s(area_slug, nombre, orden)
join public.areas a on a.slug = s.area_slug
on conflict (area_id, nombre) do nothing;

insert into public.direcciones (area_id, subsecretaria_id, nombre, orden)
select a.id, ss.id, d.nombre, d.orden
from (values
  -- Coordinación: dos direcciones directas de la secretaría, dos bajo
  -- Atención al Vecino.
  ('coordinacion', null,                                        'Dirección de Control de Gestión',                       1),
  ('coordinacion', null,                                        'Dirección Ceremonial',                                  2),
  ('coordinacion', 'Subsecretaría de Atención al Vecino',        'Dirección de Gestión Vecinal',                          1),
  ('coordinacion', 'Subsecretaría de Atención al Vecino',        'Dirección de Cercanía y Participación Vecinal',         2),

  -- Salud: las cuatro direcciones cuelgan directo de la secretaría — sus dos
  -- subsecretarías no tienen ninguna dirección debajo en el organigrama.
  ('salud', null, 'Dirección de Emergencias Médicas',            1),
  ('salud', null, 'Dirección CEMAR',                             2),
  ('salud', null, 'Dirección de Atención Primaria de la Salud',  3),
  ('salud', null, 'Dirección de Salud Mental',                   4),

  -- Seguridad: una sola subsecretaría, con las seis direcciones debajo.
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Operaciones',                        1),
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Videovigilancia Urbana',              2),
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Atención a la Víctima',                3),
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Planificación de Seguridad',          4),
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Servicios de Seguridad y Emergencias', 5),
  ('seguridad', 'Subsecretaría de Seguridad', 'Dirección de Seguridad Vial',                       6),

  -- Ambiente: coincide con lo ya transcripto en contexto/organigrama.md.
  ('ambiente', 'Subsecretaría de Ambiente e Higiene Urbana',         'Dirección de Ambiente',              1),
  ('ambiente', 'Subsecretaría de Mantenimiento del Espacio Público', 'Dirección de Cementerio',            1),
  ('ambiente', 'Subsecretaría de Mantenimiento del Espacio Público', 'Dirección de Luminaria y Arbolado',  2),
  ('ambiente', 'Subsecretaría de Mantenimiento del Espacio Público', 'Dirección de Servicios Urbanos',     3),

  -- Trabajo y Producción: cuatro direcciones directas, tres bajo
  -- Fiscalización y Control.
  ('trabajo_y_produccion', null, 'Dirección de Inversiones y Emprendedores',              1),
  ('trabajo_y_produccion', null, 'Dirección de Comercio',                                 2),
  ('trabajo_y_produccion', null, 'Dirección de Empleo y Formación para el Trabajo',       3),
  ('trabajo_y_produccion', null, 'Dirección de Producción',                               4),
  ('trabajo_y_produccion', 'Subsecretaría de Fiscalización y Control', 'Dirección de Coordinación Administrativa',       1),
  ('trabajo_y_produccion', 'Subsecretaría de Fiscalización y Control', 'Dirección de Fiscalización y Control',           2),
  ('trabajo_y_produccion', 'Subsecretaría de Fiscalización y Control', 'Dirección de Fiscalización del Espacio Público', 3),

  -- Obras: una dirección directa; el resto repartido en sus tres
  -- subsecretarías. Movilidad trae achatada la Dirección General de
  -- Movilidad y Transporte junto con sus dos direcciones puntuales — ver la
  -- nota del encabezado.
  ('obras', null, 'Dirección Administrativa', 1),
  ('obras', 'Subsecretaría de Obras Públicas y Movilidad', 'Dirección General de Movilidad y Transporte', 1),
  ('obras', 'Subsecretaría de Obras Públicas y Movilidad', 'Dirección de Licencias de Conducir',           2),
  ('obras', 'Subsecretaría de Obras Públicas y Movilidad', 'Dirección de Obras Viales',                    3),
  ('obras', 'Subsecretaría de Infraestructura',            'Dirección de Servicios Generales',             1),
  ('obras', 'Subsecretaría de Desarrollo Urbano',          'Dirección General de Planeamiento Urbano',     1),

  -- Capital Humano: una sola subsecretaría (Unidad Ejecutora); las cuatro
  -- "Dirección General de X" y sus direcciones puntuales quedan todas
  -- hermanas debajo — ver la nota del encabezado.
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección General de Desarrollo Humano y Hábitat',       1),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Niñez, Adolescencia y Familia',             2),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Protección Social',                        3),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Hábitat, Vivienda y Regularización Dominial', 4),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección General de Educación',                        5),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Primera Infancia',                         6),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Desarrollo Educativo',                     7),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Infraestructura y Servicios Escolares',    8),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección General de Deportes',                         9),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Desarrollo Deportivo',                     10),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección de Deporte en el Espacio Público',            11),
  ('capital_humano', 'Subsecretaría de Capital Humano (Unidad Ejecutora)', 'Dirección General de Cultura',                          12)
) as d(area_slug, subsecretaria_nombre, nombre, orden)
join public.areas a on a.slug = d.area_slug
left join public.subsecretarias ss on ss.area_id = a.id and ss.nombre = d.subsecretaria_nombre
on conflict (area_id, nombre) do nothing;


-- ---------------------------------------------------------------------------
-- Permisos: mismo criterio que el resto de los catálogos (0025) — lee
-- cualquiera logueado, escribe solo admin.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['subsecretarias', 'direcciones']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "lectura logueados" on public.%I', t);
    execute format(
      'create policy "lectura logueados" on public.%I '
      'for select to authenticated using (public.mi_rol() is not null)', t);

    execute format('drop policy if exists "escritura admin" on public.%I', t);
    execute format(
      'create policy "escritura admin" on public.%I for all to authenticated '
      'using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
