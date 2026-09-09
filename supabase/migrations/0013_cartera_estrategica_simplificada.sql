-- ---------------------------------------------------------------------------
-- 0013_cartera_estrategica_simplificada.sql — poner la base al día con el
-- front.  09/09/2026
--
-- POR QUÉ EXISTE ESTE ARCHIVO
--
-- El commit 7ba2bd9 («simplifica cartera estratégica y agenda») cambió los
-- campos estratégicos de `proyectos` editando `0001_esquema.sql` y
-- `0003_rls.sql` EN EL LUGAR, en vez de escribir una migración nueva.
--
-- Los dos archivos ya estaban aplicados hace meses. Postgres no vuelve a correr
-- una migración ejecutada, así que esos cambios no llegaron nunca a la base: lo
-- único que pasó es que los archivos dejaron de describir el esquema real.
--
-- El resultado fue que el portal se rompió entero para cualquier operación
-- sobre un proyecto:
--
--   * El front pedía `proyectos.descripcion_estrategica` y la base seguía
--     teniendo `prioridad_estrategica`  ->  «column does not exist» en cada
--     lectura y cada guardado de proyecto.
--   * Como la hidratación cortaba ahí, tampoco cargaban los compromisos, y
--     guardar uno fallaba con «No existe el compromiso».
--   * El front llamaba a `marcar_estrategico()` con cinco parámetros y la base
--     seguía teniendo la versión de ocho.
--
-- Esta migración hace de verdad lo que aquellos archivos daban por hecho.
--
-- LA REGLA, para que no vuelva a pasar: una migración aplicada es historia y no
-- se edita. Todo cambio de esquema va en un archivo nuevo, aunque sea para
-- corregir el anterior.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. La columna que el front pide
--
-- Se AGREGA, no se renombra `prioridad_estrategica`.
--
-- Renombrar habría sido más corto, pero los dos campos no significan lo mismo:
-- `prioridad_estrategica` guardaba 'alta' o 'media', y `descripcion_estrategica`
-- es texto libre. Renombrar dejaría proyectos cuya "descripción estratégica"
-- dice literalmente «alta», que es un dato falso servido con cara de bueno.
-- ---------------------------------------------------------------------------
alter table public.proyectos
  add column if not exists descripcion_estrategica text;

comment on column public.proyectos.descripcion_estrategica is
  'Texto libre: por que este proyecto es estrategico. Reemplaza en la interfaz '
  'a prioridad_estrategica (alta|media), que sigue existiendo con sus datos.';


-- ---------------------------------------------------------------------------
-- 2. Las tres columnas que el commit sacaba NO se borran
--
-- `0001_esquema.sql` quedó sin `motivo_estrategico_id`, `responsable_politico`
-- ni `fecha_compromiso`. Acá se dejan, y es deliberado:
--
--   * Lo que rompía el portal era el RENOMBRE y la firma de la función, no que
--     sobraran columnas. PostgREST solo falla por una columna que le PIDEN y no
--     existe; una que existe y nadie pide no molesta a nadie.
--   * Borrarlas es irreversible y puede haber datos cargados. Nadie verificó
--     que estén vacías, y perder el motivo estratégico o el responsable
--     político de un proyecto no se deshace.
--
-- Quedan invisibles para el portal, que ya no las lee ni las escribe. Cuando
-- alguien confirme que están vacías —o que sus datos no importan— se borran en
-- otra migración, con esta consulta como chequeo previo:
--
--   select count(*) filter (where motivo_estrategico_id is not null) as motivos,
--          count(*) filter (where responsable_politico   is not null) as responsables,
--          count(*) filter (where fecha_compromiso       is not null) as fechas
--   from public.proyectos;
-- ---------------------------------------------------------------------------
comment on column public.proyectos.motivo_estrategico_id is
  'Ya no se usa en el portal desde 7ba2bd9. Se conserva por si tiene datos: '
  'borrarla es irreversible. Ver 0013_cartera_estrategica_simplificada.sql.';

comment on column public.proyectos.responsable_politico is
  'Ya no se usa en el portal desde 7ba2bd9. Se conserva por si tiene datos.';

comment on column public.proyectos.fecha_compromiso is
  'Ya no se usa en el portal desde 7ba2bd9. Se conserva por si tiene datos.';


-- ---------------------------------------------------------------------------
-- 3. `marcar_estrategico()` con la firma que el front llama
--
-- Hay que BORRAR la versión vieja antes de crear la nueva. `create or replace`
-- no alcanza: cambia la lista de parámetros, así que Postgres la trata como
-- otra función y quedarían las dos. Con dos sobrecargas, una llamada por
-- nombre desde PostgREST puede resolver a la que no es, o fallar por ambigua.
-- ---------------------------------------------------------------------------
drop function if exists public.marcar_estrategico(
  uuid, text, uuid, text, text, text, date, public.origen_carga
);

create or replace function public.marcar_estrategico(
  p_proyecto_id             uuid,
  p_descripcion_estrategica text default null,
  p_nota                    text default null,
  p_compromiso_publico      text default null,
  p_origen                  public.origen_carga default null
)
returns public.proyectos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  fila public.proyectos;
begin
  -- Sigue valiendo lo de 0003: los campos estratégicos son columnas dentro de
  -- `proyectos` y RLS decide por fila, no por columna. Por eso el jefe de
  -- gabinete no tiene UPDATE sobre la tabla y esta es su única puerta.
  if public.mi_rol() is null
     or public.mi_rol() not in ('admin', 'coordinacion', 'jefe_gabinete') then
    raise exception 'No tenes permiso para marcar proyectos como estrategicos'
      using errcode = 'insufficient_privilege';
  end if;

  -- coalesce en lo opcional: volver a marcar un proyecto ya estratégico para
  -- corregirle un campo no tiene que borrarle los otros.
  update public.proyectos set
    es_estrategico          = true,
    estrategico_marcado_por = auth.uid(),
    estrategico_marcado_en  = now(),
    descripcion_estrategica = coalesce(p_descripcion_estrategica, descripcion_estrategica),
    estrategico_nota        = coalesce(p_nota, estrategico_nota),
    compromiso_publico      = coalesce(p_compromiso_publico, compromiso_publico),
    origen_estrategico      = coalesce(p_origen, origen_estrategico),
    updated_at              = now()
  where id = p_proyecto_id
  returning * into fila;

  if fila.id is null then
    raise exception 'No existe el proyecto solicitado'
      using errcode = 'no_data_found';
  end if;

  return fila;
end;
$fn$;

revoke all on function
  public.marcar_estrategico(uuid, text, text, text, public.origen_carga)
  from public, anon;

grant execute on function
  public.marcar_estrategico(uuid, text, text, text, public.origen_carga)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Que PostgREST se entere
--
-- Supabase suele recargar solo el esquema al detectar DDL, pero no siempre lo
-- hace en el momento. Sin esto, la columna nueva puede tardar en aparecer y el
-- error parece seguir vivo después de haber corrido la migración.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
