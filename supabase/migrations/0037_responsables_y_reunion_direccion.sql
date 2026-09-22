-- Responsabilidad individual sobre los compromisos, y la revisión de Dirección.
--
-- Hasta acá un compromiso tenía área y plazo, pero no dueño: el `_db` de
-- origen nunca registró quién se hacía cargo. Eso es lo que permitió el caso
-- «Portón» (Ambiente), 25 cargas entre febrero y agosto de 2026 siempre en
-- `Pendiente` con el mismo comentario copiado — nadie lo tenía asignado, así
-- que no era de nadie. Acá se agrega el responsable y la derivación.
--
-- PRECONDICIÓN: `public.compromisos` tiene que estar vacía. El responsable es
-- `not null` y no hay valor por defecto razonable que inventarle a una fila
-- vieja; asignarle una persona al azar seria peor que no tener la columna.
--
-- Aplicar después de 0036. No contiene identidades: el padrón se configura
-- contra las cuentas reales desde Configuración → Equipo, y este repositorio
-- es público.
--
-- Nota sobre el alcance: una versión anterior de este trabajo incluía también
-- la reunión de Secretaría de los lunes, con temario seleccionado y ordenado
-- por un organizador. Esa reunión quedó fuera del portal por decisión de
-- gestión, así que acá sobrevive únicamente la de Dirección, que no tiene
-- temario propio: revisa todo lo que esté vigente.

/* ── 1. El padrón ───────────────────────────────────────────────────── */

-- Tener cuenta no implica recibir compromisos. Hay integrantes que entran a
-- consultar y no se hacen cargo de nada, así que la habilitación es explícita
-- y arranca apagada para todos.
alter table public.perfiles
  add column if not exists recibe_compromisos boolean not null default false;

comment on column public.perfiles.recibe_compromisos is
  'Habilita a la cuenta para figurar como responsable de un compromiso.';

/* ── 2. El responsable ──────────────────────────────────────────────── */

-- `not null` a proposito, y por decision de JP del 22/09/2026: los 130
-- compromisos historicos de `05-compromisos.csv` NO se cargan. Sin filas sin
-- dueno que sostener, la columna puede exigir responsable desde el principio
-- y no hace falta ninguna regla de transicion.
--
-- SI ESTA LINEA FALLA es porque todavia quedan compromisos en la tabla. No es
-- un error de la migracion: es que vaciarlos tiene que ser un acto deliberado
-- y con backup, no algo que una migracion haga por su cuenta mientras nadie
-- mira. Contalos primero:
--
--   select count(*) from public.compromisos;
alter table public.compromisos
  add column if not exists id_responsable uuid not null references public.perfiles(id);

create index if not exists compromisos_responsable_idx
  on public.compromisos(id_responsable);

comment on column public.compromisos.id_responsable is
  'Quién lo impulsa y lo actualiza. Derivar cambia esta columna y nada más.';

/* ── 3. La reunión de Dirección ─────────────────────────────────────── */

create table if not exists public.reuniones_direccion (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cerrada boolean not null default false,
  creado_por uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now()
);

-- Separado del origen a propósito: el origen dice de qué reunión NACIÓ un
-- compromiso y no cambia nunca, mientras que un mismo compromiso se revisa en
-- muchos encuentros sucesivos. Si esto fuera el origen, cada revisión le
-- pisaría la procedencia.
create table if not exists public.temas_reunion_direccion (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.reuniones_direccion(id) on delete cascade,
  compromiso_id uuid references public.compromisos(id),
  titulo text not null check (length(trim(titulo)) > 0),
  nota text not null default '',
  acuerdo text not null default '',
  orden integer not null default 0,
  revisado boolean not null default false,
  unique (reunion_id, compromiso_id)
);

comment on column public.temas_reunion_direccion.revisado is
  'Marca del encuentro, independiente del estado del compromiso: que se haya '
  'mirado no quiere decir que esté cumplido.';

alter type public.origen_compromiso add value if not exists 'direccion';

alter table public.compromisos
  add column if not exists id_reunion_direccion_origen uuid references public.reuniones_direccion(id);

-- Se reescribe entera sobre la lista que dejó 0036 (que ya había sacado
-- `id_monitoreo_origen`), sumando la columna nueva.
alter table public.compromisos drop constraint if exists compromisos_origen_unico;
alter table public.compromisos add constraint compromisos_origen_unico check (
  num_nonnulls(
    id_seguimiento_origen,
    id_tema_origen,
    id_reunion_origen,
    id_reunion_evento_origen,
    id_reunion_direccion_origen
  ) <= 1
);

/* ── 4. Permisos ────────────────────────────────────────────────────── */

-- Los permisos generales no cambian. Lo que se agrega es individual: recibir
-- un compromiso habilita a leer y actualizar ESE registro, no otros. Una vez
-- derivado, esa cuenta pierde el permiso sobre él.
drop policy if exists "responsable lee su compromiso" on public.compromisos;
create policy "responsable lee su compromiso" on public.compromisos
  for select to authenticated
  using (public.mi_rol() is not null and id_responsable = auth.uid());

drop policy if exists "responsable actualiza su compromiso" on public.compromisos;
create policy "responsable actualiza su compromiso" on public.compromisos
  for update to authenticated
  using (public.mi_rol() is not null and id_responsable = auth.uid())
  with check (public.mi_rol() is not null);

/* ── 5. La regla del responsable ────────────────────────────────────── */

-- Que la columna exista y sea `not null` garantiza que HAYA alguien, pero no
-- que ese alguien corresponda: sin esto se podria asignar un compromiso a una
-- cuenta dada de baja, o a una que entra solo a consultar.
--
-- Corre en la base y no solo en el selector de la pantalla, porque el portal
-- escribe por PostgREST y cualquiera con la anon key —que va en el front y es
-- publica por diseno— podria mandar un PATCH a mano.
--
-- Las otras dos reglas que tenia este trigger (no dejar el compromiso
-- huerfano al derivar, y exigir responsable en el alta) las cubre ahora el
-- `not null` de la columna, que las rechaza antes de llegar aca.
create or replace function public.validar_responsable_compromiso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.id_responsable is distinct from old.id_responsable then
    if not exists (
      select 1 from public.perfiles
      where id = new.id_responsable and activo and recibe_compromisos
    ) then
      raise exception 'La persona no está habilitada para recibir compromisos';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_responsable on public.compromisos;
create trigger validar_responsable before insert or update on public.compromisos
  for each row execute function public.validar_responsable_compromiso();

/* ── 6. RLS de la reunión de Dirección ──────────────────────────────── */

alter table public.reuniones_direccion enable row level security;
alter table public.temas_reunion_direccion enable row level security;

drop policy if exists "equipo lee reuniones de direccion" on public.reuniones_direccion;
create policy "equipo lee reuniones de direccion" on public.reuniones_direccion
  for select to authenticated
  using (public.mi_rol()::text in ('admin', 'coordinacion', 'jefe_gabinete', 'intendencia'));

drop policy if exists "admin gestiona reuniones de direccion" on public.reuniones_direccion;
create policy "admin gestiona reuniones de direccion" on public.reuniones_direccion
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "equipo lee temas de direccion" on public.temas_reunion_direccion;
create policy "equipo lee temas de direccion" on public.temas_reunion_direccion
  for select to authenticated
  using (exists (select 1 from public.reuniones_direccion r where r.id = reunion_id));

drop policy if exists "equipo escribe temas de direccion" on public.temas_reunion_direccion;
create policy "equipo escribe temas de direccion" on public.temas_reunion_direccion
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Cerrar congela el temario del encuentro, no los compromisos: el acta dice
-- qué se miró ese día, y los compromisos siguen vivos y cambiando después.
create or replace function public.validar_tema_reunion_direccion()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  r public.reuniones_direccion;
  cambia_agenda boolean;
begin
  if tg_op = 'UPDATE' and new.reunion_id <> old.reunion_id then
    raise exception 'Un tema no se puede mover a otra reunión';
  end if;
  select * into r from public.reuniones_direccion
    where id = case when tg_op = 'DELETE' then old.reunion_id else new.reunion_id end;
  if not found then raise exception 'La reunión no está disponible'; end if;

  cambia_agenda := tg_op <> 'UPDATE';
  if tg_op = 'UPDATE' then
    cambia_agenda := (new.compromiso_id, new.titulo, new.nota, new.orden)
      is distinct from (old.compromiso_id, old.titulo, old.nota, old.orden);
  end if;
  if cambia_agenda and r.cerrada then
    raise exception 'El temario de la reunión está cerrado';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists validar_tema_direccion on public.temas_reunion_direccion;
create trigger validar_tema_direccion before insert or update or delete on public.temas_reunion_direccion
  for each row execute function public.validar_tema_reunion_direccion();

-- El cierre guarda la lista completa en una transacción. Un encuentro cerrado
-- no incorpora los compromisos creados después: es la foto de ese día.
create or replace function public.cerrar_reunion_direccion(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare r public.reuniones_direccion;
begin
  select * into r from public.reuniones_direccion where id = p_id for update;
  if not found or not public.es_admin() then
    raise exception 'No podés cerrar esta reunión';
  end if;
  if r.cerrada then return; end if;
  insert into public.temas_reunion_direccion(reunion_id, compromiso_id, titulo)
    select p_id, c.id, c.descripcion from public.compromisos c
    where c.activo
      and not exists (
        select 1 from public.temas_reunion_direccion t
        where t.reunion_id = p_id and t.compromiso_id = c.id
      );
  update public.reuniones_direccion set cerrada = true where id = p_id;
end;
$$;

revoke all on function public.cerrar_reunion_direccion(uuid) from public;
grant execute on function public.cerrar_reunion_direccion(uuid) to authenticated;
grant select, insert, update on public.reuniones_direccion to authenticated;
grant select, insert, update, delete on public.temas_reunion_direccion to authenticated;

notify pgrst, 'reload schema';
