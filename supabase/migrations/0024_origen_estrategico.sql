-- ---------------------------------------------------------------------------
-- 0024_origen_estrategico.sql — de donde salio cada proyecto estrategico.  10/09/2026
--
-- La cartera estrategica muestra una columna «Origen», y la ficha del proyecto
-- otra igual. Las dos dicen «Base maestra» SIEMPRE, incluso en los proyectos
-- que se promovieron desde un monitoreo o un seguimiento.
--
-- No es un error de las pantallas: el dato nunca llego a la base.
-- `promoverAEstrategico` arma `origen_estrategico` e `id_origen_estrategico`,
-- pero el cliente llamaba a `marcar_estrategico` sin el parametro `p_origen`
-- —que existe desde 0013— y `id_origen_estrategico` no tiene columna donde
-- guardarse. El portal despues LEE `origen_estrategico`, que siempre viene
-- null, y lo muestra como «Base maestra».
--
-- Lo que se pierde es la trazabilidad: un proyecto es estrategico porque un
-- tema se repitio en el monitoreo de Obras o porque el intendente lo pidio en
-- un seguimiento, y esa diferencia es justamente lo que la cartera existe para
-- poder explicar seis meses despues.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Donde guardar el origen puntual
--
-- Va como uuid suelto y NO como clave foranea: el origen puede ser un
-- monitoreo o un seguimiento —dos tablas distintas— y `origen_estrategico` ya
-- dice cual de las dos. Una FK obligaria a elegir una sola, o a dos columnas
-- excluyentes para guardar un dato que nunca es ambiguo.
--
-- Null es un valor legitimo y es el caso normal: significa que el proyecto se
-- declaro estrategico desde la base maestra, sin un hecho puntual detras.
-- ---------------------------------------------------------------------------
alter table public.proyectos
  add column if not exists id_origen_estrategico uuid;

comment on column public.proyectos.id_origen_estrategico is
  'Monitoreo o seguimiento del que salio la promocion. Que tabla es lo dice origen_estrategico. Null = base maestra.';


-- ---------------------------------------------------------------------------
-- 2. La funcion, con el origen completo
--
-- Se REEMPLAZA la de 0013 en vez de agregar una sobrecarga. Dos funciones con
-- el mismo nombre y parametros por defecto dejan a PostgREST sin poder elegir
-- cual llamar («could not choose the best candidate function»), y una llamada
-- ambigua falla entera.
--
-- Sigue siendo la unica puerta a los campos estrategicos: RLS decide por fila
-- y estos son columnas dentro de `proyectos`, asi que el jefe de gabinete no
-- tiene UPDATE sobre la tabla (ver 0003 y 0013).
-- ---------------------------------------------------------------------------
drop function if exists public.marcar_estrategico(uuid, text, text, text, public.origen_carga);

create or replace function public.marcar_estrategico(
  p_proyecto_id             uuid,
  p_descripcion_estrategica text default null,
  p_nota                    text default null,
  p_compromiso_publico      text default null,
  p_origen                  public.origen_carga default null,
  p_id_origen               uuid default null
)
returns public.proyectos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  fila public.proyectos;
begin
  if public.mi_rol() is null
     or public.mi_rol() not in ('admin', 'coordinacion', 'jefe_gabinete') then
    raise exception 'No tenes permiso para marcar proyectos como estrategicos'
      using errcode = 'insufficient_privilege';
  end if;

  -- coalesce en lo opcional: volver a marcar un proyecto ya estrategico para
  -- corregirle un campo no tiene que borrarle los otros.
  update public.proyectos set
    es_estrategico          = true,
    estrategico_marcado_por = auth.uid(),
    estrategico_marcado_en  = now(),
    descripcion_estrategica = coalesce(p_descripcion_estrategica, descripcion_estrategica),
    estrategico_nota        = coalesce(p_nota, estrategico_nota),
    compromiso_publico      = coalesce(p_compromiso_publico, compromiso_publico),
    origen_estrategico      = coalesce(p_origen, origen_estrategico),
    id_origen_estrategico   = coalesce(p_id_origen, id_origen_estrategico),
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
  public.marcar_estrategico(uuid, text, text, text, public.origen_carga, uuid)
  from public, anon;

grant execute on function
  public.marcar_estrategico(uuid, text, text, text, public.origen_carga, uuid)
  to authenticated;

notify pgrst, 'reload schema';
