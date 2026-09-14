-- ---------------------------------------------------------------------------
-- 0031_novedad_compromiso_al_historial.sql — la novedad va al historial, no
-- al nombre del compromiso.
-- 14/09/2026
--
-- El problema que arregla: al actualizar un compromiso, el texto de la novedad
-- se CONCATENABA a `descripcion` (`actualizarEstadoCompromiso` en
-- repositorio.js armaba `descripcion + E'\n\n[14/09/2026] ...'`). El resultado
-- es que el nombre del compromiso crece sin parar y mezcla dos cosas distintas:
-- QUE se comprometio el area, y COMO viene. En pantalla se leia
-- «Definir fecha del evento Premio Pala [13/09/2026] Posiblemente el 14/10.
-- hay que ver necesidades [14/09/2026] dddd», que ya no es el nombre de nada.
--
-- `actualizaciones_compromisos` (0014) es el lugar que corresponde, y ya
-- existe. Lo que le faltaba es el texto: el trigger llena `comentarios` con
-- etiquetas fijas ('Alta del compromiso', 'Cambio de fecha limite'), y no habia
-- forma de que la novedad que escribe una persona llegara ahi.
--
-- Como se resuelve, y por que asi: 0014 decidio que la tabla la escribe SOLO el
-- trigger, y que nadie pueda insertar desde la API — un historial editable no
-- sirve como historial. Esa decision se mantiene. La novedad viaja hasta el
-- trigger por una variable LOCAL a la transaccion (`app.comentario_compromiso`)
-- que setea `actualizar_compromiso_con_novedad`. Asi sigue habiendo un unico
-- escritor y no hace falta abrir la tabla a INSERT.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. El trigger aprende a recibir la novedad
--
-- Dos cambios sobre la version de 0014:
--
--  a) Si la transaccion trae `app.comentario_compromiso`, ese texto gana sobre
--     la etiqueta automatica. La etiqueta describe el cambio de estado; el
--     comentario de la persona dice lo que realmente paso, y es mas util.
--  b) Un comentario, por si solo, ya es motivo para registrar. Antes se exigia
--     que cambiara estado, fecha limite o activo — con eso, dejar una novedad
--     sin mover el estado (el caso mas comun en un monitoreo: «sigue igual,
--     esperando a Legales») no dejaba rastro en ningun lado.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_cambio_compromiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_comentario text := nullif(trim(coalesce(current_setting('app.comentario_compromiso', true), '')), '');
begin
  if tg_op = 'INSERT' then
    insert into public.actualizaciones_compromisos (
      compromiso_id, estado, estado_anterior, fecha_limite, fecha_cumplimiento,
      comentarios, cargado_por
    ) values (
      new.id, new.estado, null, new.fecha_limite, new.fecha_cumplimiento,
      coalesce(v_comentario, 'Alta del compromiso'), auth.uid()
    );
    return new;
  end if;

  if v_comentario is not null
     or new.estado is distinct from old.estado
     or new.fecha_limite is distinct from old.fecha_limite
     or new.activo is distinct from old.activo then
    insert into public.actualizaciones_compromisos (
      compromiso_id, estado, estado_anterior, fecha_limite, fecha_cumplimiento,
      comentarios, cargado_por
    ) values (
      new.id,
      new.estado,
      old.estado,
      new.fecha_limite,
      new.fecha_cumplimiento,
      coalesce(
        v_comentario,
        case
          when new.activo = false then 'Compromiso dado de baja'
          when new.fecha_limite is distinct from old.fecha_limite
               and new.estado is not distinct from old.estado
            then 'Cambio de fecha limite'
          else null
        end
      ),
      auth.uid()
    );
  end if;

  return new;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 2. La funcion que usa el portal para actualizar un compromiso
--
-- `security invoker` A PROPOSITO (es el default; se deja explicito para que no
-- se lo cambie sin pensarlo): el UPDATE tiene que pasar por las politicas RLS
-- de `compromisos` como cualquier otra escritura del portal. Si fuera
-- `security definer`, cualquiera con sesion podria editar el compromiso de
-- cualquier area llamando a esta funcion. El unico que necesita saltear RLS es
-- el trigger, que ya es `definer` desde 0014.
--
-- `set_config(..., true)` hace la variable local a la transaccion: la funcion y
-- el trigger que dispara corren en la misma, y al terminar no queda nada
-- seteado para la siguiente consulta de esa conexion (el pooler las reusa).
--
-- Los parametros nulos significan «no tocar»: asi una novedad sin cambio de
-- estado no pisa la fecha limite, y correr una fecha no exige remandar todo.
-- `p_descripcion` esta para CORREGIR el texto original, que sigue siendo un
-- caso valido; lo que ya no existe es el agregado automatico al final.
-- ---------------------------------------------------------------------------
create or replace function public.actualizar_compromiso_con_novedad(
  p_id               uuid,
  p_comentario       text default null,
  p_estado           public.estado_compromiso default null,
  p_fecha_limite     date default null,
  p_limpiar_fecha    boolean default false,
  p_descripcion      text default null,
  p_subsecretaria_id uuid default null,
  p_direccion_id     uuid default null,
  p_tocar_unidad     boolean default false
)
returns public.compromisos
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_previo public.compromisos;
  v_fila   public.compromisos;
begin
  select * into v_previo from public.compromisos where id = p_id;
  if not found then
    raise exception 'No existe el compromiso %', p_id;
  end if;

  perform set_config('app.comentario_compromiso', coalesce(p_comentario, ''), true);

  update public.compromisos set
    descripcion   = coalesce(p_descripcion, descripcion),
    estado        = coalesce(p_estado, estado),
    fecha_limite  = case when p_limpiar_fecha then null
                         else coalesce(p_fecha_limite, fecha_limite) end,
    -- Misma regla que ya traia el portal: al entrar a cumplido se estampa la
    -- fecha si no habia una, y al salir de cumplido se limpia, para que no
    -- quede una fecha de cumplimiento colgada de algo que dejo de estarlo.
    fecha_cumplimiento = case
      when p_estado is null or p_estado = v_previo.estado then fecha_cumplimiento
      when p_estado = 'cumplido' then coalesce(fecha_cumplimiento, current_date)
      else null
    end,
    subsecretaria_id = case when p_tocar_unidad then p_subsecretaria_id else subsecretaria_id end,
    direccion_id     = case when p_tocar_unidad then p_direccion_id else direccion_id end,
    updated_at    = now()
  where id = p_id
  returning * into v_fila;

  -- Dejarla seteada contaminaria el proximo UPDATE que viaje por la misma
  -- conexion del pooler: ese compromiso se llevaria este comentario.
  perform set_config('app.comentario_compromiso', '', true);

  return v_fila;
end;
$fn$;

grant execute on function public.actualizar_compromiso_con_novedad(
  uuid, text, public.estado_compromiso, date, boolean, text, uuid, uuid, boolean
) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Rescatar las novedades que ya quedaron pegadas a la descripcion
--
-- Al 14/09/2026 son 3 novedades en 2 compromisos. El formato que dejaba el
-- portal es regular (`\n\n[DD/MM/AAAA] texto`), asi que se pueden separar sin
-- adivinar nada. Cada una entra al historial con SU fecha, no con la de hoy, y
-- la descripcion vuelve a ser solo el nombre del compromiso.
--
-- Se insertan directo y no via trigger: son hechos pasados, no cambios de
-- estado. `estado` refleja el actual del compromiso porque el que tenia ese dia
-- no quedo registrado en ningun lado — inventarlo seria peor.
--
-- El `where not exists` sobre el mismo texto y fecha es lo que la hace
-- re-ejecutable: correrla dos veces no duplica el historial.
-- ---------------------------------------------------------------------------
do $migracion$
declare
  c        record;
  v_trozo  text;
  v_fecha  date;
  v_texto  text;
  v_nombre text;
begin
  for c in
    select id, descripcion, estado, fecha_limite, fecha_cumplimiento
    from public.compromisos
    where descripcion ~ '\[[0-9]{2}/[0-9]{2}/[0-9]{4}\]'
  loop
    -- Lo que va antes del primer [DD/MM/AAAA] es el nombre real.
    v_nombre := trim(regexp_replace(c.descripcion, '\[[0-9]{2}/[0-9]{2}/[0-9]{4}\].*$', '', 'g'));

    for v_trozo in
      select unnest(
        regexp_split_to_array(c.descripcion, '(?=\[[0-9]{2}/[0-9]{2}/[0-9]{4}\])')
      )
    loop
      continue when v_trozo !~ '^\[[0-9]{2}/[0-9]{2}/[0-9]{4}\]';

      v_fecha := to_date(substring(v_trozo from 2 for 10), 'DD/MM/YYYY');
      v_texto := trim(substring(v_trozo from 13));
      continue when v_texto = '';

      insert into public.actualizaciones_compromisos (
        compromiso_id, fecha_actualizacion, estado, estado_anterior,
        fecha_limite, fecha_cumplimiento, comentarios, cargado_por
      )
      select c.id, v_fecha, c.estado, null, c.fecha_limite, c.fecha_cumplimiento,
             v_texto, null
      where not exists (
        select 1 from public.actualizaciones_compromisos a
        where a.compromiso_id = c.id
          and a.comentarios = v_texto
          and a.fecha_actualizacion = v_fecha
      );
    end loop;

    if v_nombre <> '' then
      update public.compromisos set descripcion = v_nombre where id = c.id;
    end if;
  end loop;
end;
$migracion$;

notify pgrst, 'reload schema';
