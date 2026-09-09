-- ---------------------------------------------------------------------------
-- 0017_auditoria.sql — quien cambio que, en todo el sistema.  09/09/2026
--
-- La tabla `auditoria` existe desde 0001 y esta vacia. No es que nadie la use:
-- el trigger generico que la llenaba vivia en `0002_logica.sql`, uno de los
-- ocho archivos que se diseñaron y nunca se escribieron.
--
-- Mientras tanto, el unico registro de cambios del portal es la bitacora local
-- (`historial`), que vive en el navegador de cada uno: lo que registra tu
-- maquina no lo ve nadie mas. Para un sistema de gestion municipal donde nueve
-- personas cargan sobre los mismos datos, eso es un agujero.
--
-- Un solo trigger resuelve el problema para TODAS las tablas a la vez, y por
-- eso conviene mas que ir agregando una tabla de historial por entidad. Las
-- tablas de observaciones fechadas —`actualizaciones`,
-- `actualizaciones_compromisos`— siguen teniendo sentido, pero para otra cosa:
-- son las que ademas hay que MOSTRAR en pantalla. Esta es para auditar.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. El trigger generico
--
-- `datos_antes` y `datos_despues` van como jsonb de la fila entera. Guardar el
-- diff campo por campo seria mas prolijo de leer, pero obliga a decidir de
-- antemano que campos importan; con la fila completa, cualquier pregunta futura
-- —«¿quien le cambio el area a este proyecto en marzo?»— se puede responder sin
-- haberla anticipado.
--
-- En un DELETE se guarda la fila que se va. El portal no borra fisicamente
-- (usa baja logica), pero un script o el SQL Editor si pueden, y es
-- justamente el caso donde mas importa que quede rastro.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  clave text;
begin
  -- La PK de casi todas las tablas es `id`, pero las tablas puente tienen clave
  -- compuesta y no lo tienen. Por eso `registro_id` es text en 0001: se guarda
  -- lo que haya, y si no hay id se cae a la fila entera en texto.
  clave := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
    case when tg_op = 'DELETE' then old::text else new::text end
  );

  insert into public.auditoria (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values (
    tg_table_name,
    clave,
    lower(tg_op),
    auth.uid(),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 2. Engancharlo a las tablas de gestion
--
-- Se listan explicitamente y no se toman todas las del esquema: las de catalogo
-- casi no cambian y las de auditoria no se auditan a si mismas —eso seria una
-- recursion infinita que llena la tabla hasta reventar--.
--
-- `actualizaciones_compromisos` tampoco entra: ya es un historial, auditarlo
-- seria guardar dos veces lo mismo.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'proyectos', 'compromisos', 'eventos', 'requerimientos_evento',
    'monitoreos', 'temas_monitoreo', 'seguimientos', 'actualizaciones',
    'act_cuantitativas', 'mesas', 'reuniones_mesa',
    'proyectos_posicionamiento', 'cortes', 'perfiles', 'usuarios_autorizados'
  ]
  loop
    -- `to_regclass` devuelve null si la tabla no existe todavia. Asi este
    -- archivo no se rompe si se corre antes que la migracion que la crea.
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', 'auditar_' || t, t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I '
        'for each row execute function public.registrar_auditoria()',
        'auditar_' || t, t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Permisos: la audita quien administra, y nadie la escribe
--
-- Lectura solo para admin: la auditoria dice quien hizo cada cosa, y no
-- corresponde que cualquiera revise el historial de actividad de sus
-- companieros. Es una herramienta de control de gestion, no un tablero.
--
-- Escritura para nadie desde la API. Solo el trigger, que corre como duenio.
-- Una auditoria que se puede editar no es una auditoria.
-- ---------------------------------------------------------------------------
alter table public.auditoria enable row level security;

drop policy if exists "lectura admin" on public.auditoria;
create policy "lectura admin" on public.auditoria
  for select to authenticated using (public.es_admin());

notify pgrst, 'reload schema';
