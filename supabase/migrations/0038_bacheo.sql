-- ---------------------------------------------------------------------------
-- 0038_bacheo.sql — programación semanal de Bacheo en el mapa.  17/11/2026
--
-- Todas las semanas el área de Bacheo manda dos PDF: la programación de
-- asfalto (por cuadrilla) y la de hormigón (con m²). Hasta ahora se miraban
-- como PDF y, a pedido, se pasaban a mano a un mapa armado afuera del portal.
-- El módulo /bacheo los lee en el navegador, ubica cada trabajo contra el
-- callejero oficial y publica la semana para que la vea todo el portal.
--
-- Tres tablas:
--
--   bacheo_semanas   una fila por semana (la identifica su lunes)
--   bacheo_trabajos  los trabajos de esa semana, con su geometría
--   bacheo_lugares   la memoria de ubicaciones revisadas: un cuadrante que se
--                    marcó o confirmó una vez se reusa las semanas siguientes.
--                    Los lugares se repiten mucho (10 de 22 trabajos de la
--                    semana del 16/11 estaban en lugares de la anterior).
--
-- Las geometrías van como GeoJSON en jsonb, no en PostGIS: el portal no hace
-- consultas espaciales en la base (el cruce con reclamos, cuando llegue, se
-- calcula en el navegador como el resto de la lógica), y no hace falta sumar
-- una extensión para guardar algo que solo se lee y se dibuja.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

create table if not exists public.bacheo_semanas (
  id             uuid primary key default gen_random_uuid(),
  -- La semana se identifica por su lunes aunque arranque un martes por
  -- feriado: así volver a subir los PDF de la misma semana la reemplaza en
  -- vez de duplicarla.
  lunes          date not null unique,
  desde          date not null,
  hasta          date not null,
  -- Qué PDF se cargaron: `[{ tipo, nombre }]`. Sirve para saber, ante una
  -- reprogramación a mitad de semana, qué versión está publicada.
  archivos       jsonb not null default '[]'::jsonb,
  -- Feriados y otros avisos de la grilla que valen para el día entero:
  -- `[{ fecha, texto }]`.
  novedades      jsonb not null default '[]'::jsonb,
  publicada_por  uuid references public.perfiles(id),
  publicada_en   timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  constraint bacheo_semanas_rango check (desde <= hasta)
);

comment on table public.bacheo_semanas is
  'Programación semanal de Bacheo publicada desde el módulo /bacheo. Una por semana, identificada por su lunes.';


create table if not exists public.bacheo_trabajos (
  id                  uuid primary key default gen_random_uuid(),
  semana_id           uuid not null references public.bacheo_semanas(id) on delete cascade,
  orden               integer not null default 0,
  cuadrilla           text not null default '',
  tipo                text not null
    check (tipo in ('caliente', 'frio', 'sellado', 'reconstruccion', 'pintura',
                    'viales', 'limpieza', 'mantenimiento', 'hormigon')),
  -- Tal como la escribe la planilla: es lo que el área reconoce.
  descripcion         text not null,
  -- La oficial (para agrupar) y la de la planilla (para no perder el dato).
  localidad           text not null default '',
  localidad_planilla  text not null default '',
  fechas              date[] not null default '{}',
  -- Solo hormigón: `[{ fecha, tarea, hora }]` (desmonte, hormigón).
  tareas              jsonb not null default '[]'::jsonb,
  -- Solo hormigón. El total se calcula: el de la planilla no es confiable.
  m2                  numeric,
  -- Lluvia u otros avisos de esa fila: `[{ fecha, texto }]`.
  novedades           jsonb not null default '[]'::jsonb,

  -- Geometría GeoJSON (Point, LineString, MultiLineString o Polygon), o null
  -- si quedó sin ubicar.
  geometria           jsonb,
  forma               text not null default 'area'
    check (forma in ('area', 'tramo', 'esquina')),
  /*
   * De dónde salió la ubicación, que es lo que decide cuánto creerle:
   *   revisada    de la memoria de lugares (alguien la marcó o confirmó)
   *   manual      marcada a mano en esta carga
   *   automatica  resuelta contra el callejero, sin revisar
   *   aproximada  resuelta a medias (una calle que no cruza, un cuadrante
   *               que no cierra): se dibuja punteada
   *   sin_ubicar  no se pudo; el trabajo figura en la lista pero no en el mapa
   */
  ubicacion           text not null default 'sin_ubicar'
    check (ubicacion in ('revisada', 'manual', 'automatica', 'aproximada', 'sin_ubicar')),
  nota                text not null default '',
  created_at          timestamptz not null default now()
);

create index if not exists bacheo_trabajos_semana_idx on public.bacheo_trabajos (semana_id, orden);

comment on table public.bacheo_trabajos is
  'Trabajos de una semana de Bacheo. Un trabajo por fila y tipo: una cuadra con reconstrucción el miércoles y pintura el viernes son dos.';


create table if not exists public.bacheo_lugares (
  -- Descripción y localidad normalizadas (ver `claveLugar()` en
  -- src/datos/bacheo/nombresCalle.js). Si se cambia la normalización, las
  -- claves viejas dejan de encontrarse: hay que recalcularlas.
  clave           text primary key,
  descripcion     text not null,
  localidad       text not null default '',
  geometria       jsonb not null,
  forma           text not null default 'area'
    check (forma in ('area', 'tramo', 'esquina')),
  nota            text not null default '',
  -- 'manual' | 'confirmada' | 'carga-inicial'
  origen          text not null default 'manual',
  actualizado_por uuid references public.perfiles(id),
  updated_at      timestamptz not null default now()
);

comment on table public.bacheo_lugares is
  'Ubicaciones de Bacheo revisadas por una persona. Se reusan cada vez que un trabajo vuelve a un lugar con la misma descripción y localidad.';


-- ---------------------------------------------------------------------------
-- Publicar una semana, entera o nada.
--
-- Son tres escrituras (semana, trabajos, lugares). Hechas por separado desde
-- el navegador, un corte a mitad de camino deja una semana publicada con la
-- mitad de los trabajos y nadie se entera. En una función, Postgres las hace
-- en una sola transacción.
--
-- Volver a publicar la misma semana (una reprogramación a mitad de semana)
-- reemplaza sus trabajos: la semana conserva su id.
-- ---------------------------------------------------------------------------
create or replace function public.publicar_semana_bacheo(
  p_semana   jsonb,
  p_trabajos jsonb,
  p_lugares  jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if not public.es_admin() then
    raise exception 'No tenés permiso para publicar la programación de Bacheo'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.bacheo_semanas (lunes, desde, hasta, archivos, novedades, publicada_por, publicada_en)
  values (
    (p_semana->>'lunes')::date,
    (p_semana->>'desde')::date,
    (p_semana->>'hasta')::date,
    coalesce(p_semana->'archivos', '[]'::jsonb),
    coalesce(p_semana->'novedades', '[]'::jsonb),
    auth.uid(),
    now()
  )
  on conflict (lunes) do update set
    desde         = excluded.desde,
    hasta         = excluded.hasta,
    archivos      = excluded.archivos,
    novedades     = excluded.novedades,
    publicada_por = excluded.publicada_por,
    publicada_en  = excluded.publicada_en
  returning id into v_id;

  delete from public.bacheo_trabajos where semana_id = v_id;

  insert into public.bacheo_trabajos (
    semana_id, orden, cuadrilla, tipo, descripcion, localidad, localidad_planilla,
    fechas, tareas, m2, novedades, geometria, forma, ubicacion, nota
  )
  select
    v_id,
    coalesce((t->>'orden')::integer, 0),
    coalesce(t->>'cuadrilla', ''),
    t->>'tipo',
    t->>'descripcion',
    coalesce(t->>'localidad', ''),
    coalesce(t->>'localidad_planilla', ''),
    coalesce(array(select jsonb_array_elements_text(t->'fechas'))::date[], '{}'),
    coalesce(t->'tareas', '[]'::jsonb),
    nullif(t->>'m2', '')::numeric,
    coalesce(t->'novedades', '[]'::jsonb),
    case when jsonb_typeof(t->'geometria') = 'object' then t->'geometria' end,
    coalesce(t->>'forma', 'area'),
    coalesce(t->>'ubicacion', 'sin_ubicar'),
    coalesce(t->>'nota', '')
  from jsonb_array_elements(p_trabajos) as t;

  insert into public.bacheo_lugares (clave, descripcion, localidad, geometria, forma, nota, origen, actualizado_por, updated_at)
  select
    l->>'clave', l->>'descripcion', coalesce(l->>'localidad', ''), l->'geometria',
    coalesce(l->>'forma', 'area'), coalesce(l->>'nota', ''), coalesce(l->>'origen', 'manual'),
    auth.uid(), now()
  from jsonb_array_elements(p_lugares) as l
  where jsonb_typeof(l->'geometria') = 'object'
  on conflict (clave) do update set
    geometria       = excluded.geometria,
    forma           = excluded.forma,
    nota            = excluded.nota,
    origen          = excluded.origen,
    actualizado_por = excluded.actualizado_por,
    updated_at      = excluded.updated_at;

  return v_id;
end;
$fn$;

revoke all on function public.publicar_semana_bacheo(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.publicar_semana_bacheo(jsonb, jsonb, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- Permisos: mismo criterio que los cortes de calle. Ve cualquiera con perfil;
-- escribe Coordinación (y admin). La publicación pasa por la función, pero se
-- deja la escritura directa a es_admin() para poder corregir una fila suelta.
-- ---------------------------------------------------------------------------
alter table public.bacheo_semanas  enable row level security;
alter table public.bacheo_trabajos enable row level security;
alter table public.bacheo_lugares  enable row level security;

drop policy if exists "lectura logueados" on public.bacheo_semanas;
create policy "lectura logueados" on public.bacheo_semanas
  for select to authenticated using (public.mi_rol() is not null);
drop policy if exists "escritura admin" on public.bacheo_semanas;
create policy "escritura admin" on public.bacheo_semanas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura logueados" on public.bacheo_trabajos;
create policy "lectura logueados" on public.bacheo_trabajos
  for select to authenticated using (public.mi_rol() is not null);
drop policy if exists "escritura admin" on public.bacheo_trabajos;
create policy "escritura admin" on public.bacheo_trabajos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura logueados" on public.bacheo_lugares;
create policy "lectura logueados" on public.bacheo_lugares
  for select to authenticated using (public.mi_rol() is not null);
drop policy if exists "escritura admin" on public.bacheo_lugares;
create policy "escritura admin" on public.bacheo_lugares
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

notify pgrst, 'reload schema';
