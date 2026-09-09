-- ---------------------------------------------------------------------------
-- 0014_actualizaciones_compromisos.sql — historial de los compromisos.
-- 09/09/2026
--
-- Hasta hoy un compromiso guardaba solo su estado ACTUAL: cada `UPDATE` pisaba
-- el anterior. Si paso de `pendiente` a `en_curso` y despues a `cumplido`, lo
-- unico que quedaba era «cumplido» -- ni cuando cambio, ni quien lo movio.
--
-- Es justo donde mas importa. El compromiso es lo que se repasa en el
-- Seguimiento cada seis semanas, y la pregunta «¿esto ya estaba pendiente la
-- vez pasada?» no tenia respuesta en la base.
--
-- La tabla sigue la forma de `actualizaciones_posicionamiento` (0001): una fila
-- fechada por observacion, con quien la cargo. Lo que cambia es COMO se llena.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. La tabla
--
-- `estado_anterior` es redundante -- se podria deducir mirando la fila previa --
-- y esta a proposito: hace que cada renglon se lea solo, sin tener que ordenar
-- toda la serie para entender uno. «Paso de en_curso a cumplido» en una fila.
--
-- `fecha_limite` se guarda en cada observacion porque tambien cambia: correr un
-- vencimiento es una decision de gestion, y sin registrarla un compromiso que
-- se pateo tres veces se ve igual que uno que se cumplio en fecha.
-- ---------------------------------------------------------------------------
create table if not exists public.actualizaciones_compromisos (
  id                  uuid primary key default gen_random_uuid(),
  compromiso_id       uuid not null
                      references public.compromisos(id) on delete cascade,
  fecha_actualizacion date not null default current_date,
  estado              public.estado_compromiso not null,
  estado_anterior     public.estado_compromiso,
  fecha_limite        date,
  fecha_cumplimiento  date,
  comentarios         text,
  cargado_por         uuid references public.perfiles(id),
  created_at          timestamptz not null default now()
);

comment on table public.actualizaciones_compromisos is
  'Historial de un compromiso: una fila por cambio de estado o de fecha limite. '
  'La llena un trigger, no la aplicacion -- ver el bloque 2.';

create index if not exists actualizaciones_compromisos_compromiso_idx
  on public.actualizaciones_compromisos (compromiso_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 2. La llena un trigger, no el portal
--
-- Se pidio persistir los estados «si o si», y esa palabra es la que decide el
-- diseño. Si el registro dependiera de que el front se acuerde de escribirlo,
-- se perderia todo lo que no pase por el front: un script de Python, una
-- correccion desde el SQL Editor, una pantalla nueva que alguien escriba el
-- año que viene y olvide el paso.
--
-- Con un trigger no hay forma de cambiar un compromiso sin dejar rastro.
--
-- `security definer` para que la insercion no dependa de los permisos de quien
-- dispara el cambio: si alguien puede modificar el compromiso, su cambio TIENE
-- que quedar registrado, no es opcional.
--
-- `auth.uid()` es null cuando el cambio viene de un script con `service_role`.
-- Se guarda null y esta bien: dice la verdad, que fue un proceso y no una
-- persona.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_cambio_compromiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- En el alta se asienta el punto de partida, para que la serie empiece cuando
  -- el compromiso nace y no en su primera edicion.
  if tg_op = 'INSERT' then
    insert into public.actualizaciones_compromisos (
      compromiso_id, estado, estado_anterior, fecha_limite, fecha_cumplimiento,
      comentarios, cargado_por
    ) values (
      new.id, new.estado, null, new.fecha_limite, new.fecha_cumplimiento,
      'Alta del compromiso', auth.uid()
    );
    return new;
  end if;

  -- En la edicion, solo si cambio algo que valga la pena registrar. Corregir
  -- una falta de ortografia en la descripcion no es un hito del compromiso, y
  -- llenar la serie de filas iguales la vuelve ilegible.
  if new.estado is distinct from old.estado
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
      case
        when new.activo = false then 'Compromiso dado de baja'
        when new.fecha_limite is distinct from old.fecha_limite
             and new.estado is not distinct from old.estado
          then 'Cambio de fecha limite'
        else null
      end,
      auth.uid()
    );
  end if;

  return new;
end;
$fn$;

drop trigger if exists compromisos_registrar_cambio on public.compromisos;
create trigger compromisos_registrar_cambio
  after insert or update on public.compromisos
  for each row execute function public.registrar_cambio_compromiso();


-- ---------------------------------------------------------------------------
-- 3. Punto de partida de los compromisos que ya existen
--
-- Los 130 que ya estan cargados no tienen historial, y sin esto su serie
-- arrancaria recien en el proximo cambio: un compromiso cumplido hace dos meses
-- se veria sin ningun registro.
--
-- Se asienta su estado actual con la fecha en que se cargo, y el comentario
-- dice que es un punto de partida y no un cambio observado. No se inventa una
-- historia que nadie registro: solo se deja constancia de donde estaban el dia
-- que empezo a registrarse.
-- ---------------------------------------------------------------------------
insert into public.actualizaciones_compromisos (
  compromiso_id, fecha_actualizacion, estado, estado_anterior,
  fecha_limite, fecha_cumplimiento, comentarios, cargado_por
)
select c.id,
       coalesce(c.updated_at::date, c.created_at::date, current_date),
       c.estado,
       null,
       c.fecha_limite,
       c.fecha_cumplimiento,
       'Estado al empezar a registrarse el historial (09/09/2026)',
       null
from public.compromisos c
where not exists (
  select 1 from public.actualizaciones_compromisos a where a.compromiso_id = c.id
);


-- ---------------------------------------------------------------------------
-- 4. Permisos: se lee, no se escribe
--
-- Cualquiera con sesion puede leer el historial. NADIE puede insertarlo,
-- editarlo ni borrarlo desde la API -- ni siquiera un admin.
--
-- No es exceso de celo: un historial que se puede editar no sirve como
-- historial. El unico que escribe es el trigger, que corre como duenio y se
-- saltea estas politicas. Asi el registro refleja lo que paso y no lo que
-- alguien preferiria que hubiera pasado.
-- ---------------------------------------------------------------------------
alter table public.actualizaciones_compromisos enable row level security;

drop policy if exists "lectura logueados" on public.actualizaciones_compromisos;
create policy "lectura logueados" on public.actualizaciones_compromisos
  for select to authenticated using (public.mi_rol() is not null);

notify pgrst, 'reload schema';
