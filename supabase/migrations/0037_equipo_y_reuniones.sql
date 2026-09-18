-- Responsabilidad individual y reuniones de Secretaría / Dirección.
-- Aplicar después de 0036. No contiene identidades: las capacidades se
-- configuran contra las cuentas reales en Configuración > Equipo.
alter table public.perfiles
  add column if not exists recibe_compromisos boolean not null default false,
  add column if not exists organiza_secretaria boolean not null default false;

alter type public.origen_compromiso add value if not exists 'equipo';

create table if not exists public.reuniones_equipo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('secretaria', 'direccion')),
  fecha date not null,
  cerrada boolean not null default false,
  creado_por uuid default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now()
);

alter table public.compromisos
  add column if not exists id_responsable uuid references public.perfiles(id),
  add column if not exists id_reunion_equipo_origen uuid references public.reuniones_equipo(id);
create index if not exists compromisos_responsable_idx on public.compromisos(id_responsable);
alter table public.compromisos drop constraint if exists compromisos_origen_unico;
alter table public.compromisos add constraint compromisos_origen_unico check (
  num_nonnulls(id_seguimiento_origen, id_tema_origen, id_reunion_origen,
    id_monitoreo_origen, id_reunion_evento_origen, id_reunion_equipo_origen) <= 1
);

-- Separado del origen: un mismo compromiso se revisa en muchos encuentros.
create table if not exists public.temas_reunion_equipo (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.reuniones_equipo(id) on delete cascade,
  compromiso_id uuid references public.compromisos(id),
  titulo text not null check (length(trim(titulo)) > 0),
  nota text not null default '',
  acuerdo text not null default '',
  orden integer not null default 0,
  revisado boolean not null default false,
  unique (reunion_id, compromiso_id)
);

create or replace function public.organiza_reunion_secretaria()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select activo and organiza_secretaria from public.perfiles where id = auth.uid()), false);
$$;

-- Los permisos generales existentes no cambian. Para una cuenta de lectura,
-- recibir un compromiso habilita actualizar o derivar ESE registro; no otros.
drop policy if exists "responsable lee su compromiso" on public.compromisos;
create policy "responsable lee su compromiso" on public.compromisos for select to authenticated
  using (public.mi_rol() is not null and id_responsable = auth.uid());
drop policy if exists "responsable actualiza su compromiso" on public.compromisos;
create policy "responsable actualiza su compromiso" on public.compromisos for update to authenticated
  using (public.mi_rol() is not null and id_responsable = auth.uid())
  with check (public.mi_rol() is not null);

-- Un usuario con acceso no necesariamente recibe compromisos. La validación
-- también corre para escrituras directas por API, no sólo en el selector.
create or replace function public.validar_responsable_compromiso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id_responsable is not null and (tg_op = 'INSERT' or new.id_responsable is distinct from old.id_responsable) then
    if not exists (select 1 from public.perfiles where id = new.id_responsable and activo and recibe_compromisos) then
      raise exception 'La persona no está habilitada para recibir compromisos';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.id_responsable is not null and new.id_responsable is null then
    raise exception 'Elegí otro responsable para derivar el compromiso';
  end if;
  -- La transición permite conservar el histórico sin dueño. Una vez
  -- configurado el equipo, todo compromiso nuevo requiere responsable.
  if tg_op = 'INSERT' and new.id_responsable is null
    and exists (select 1 from public.perfiles where activo and recibe_compromisos) then
    raise exception 'Elegí quién se hará cargo del compromiso';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_responsable on public.compromisos;
create trigger validar_responsable before insert or update on public.compromisos
  for each row execute function public.validar_responsable_compromiso();

alter table public.reuniones_equipo enable row level security;
alter table public.temas_reunion_equipo enable row level security;
drop policy if exists "equipo lee reuniones" on public.reuniones_equipo;
create policy "equipo lee reuniones" on public.reuniones_equipo for select to authenticated
  using (public.mi_rol()::text in ('admin', 'coordinacion', 'jefe_gabinete', 'intendencia'));
drop policy if exists "organizador crea reuniones" on public.reuniones_equipo;
create policy "organizador crea reuniones" on public.reuniones_equipo for insert to authenticated
  with check (public.es_admin() and (tipo = 'direccion' or public.organiza_reunion_secretaria()));
drop policy if exists "organizador edita reuniones" on public.reuniones_equipo;
create policy "organizador edita reuniones" on public.reuniones_equipo for update to authenticated
  using (public.es_admin() and (tipo = 'direccion' or public.organiza_reunion_secretaria()))
  with check (public.es_admin() and (tipo = 'direccion' or public.organiza_reunion_secretaria()));
drop policy if exists "equipo lee temas" on public.temas_reunion_equipo;
create policy "equipo lee temas" on public.temas_reunion_equipo for select to authenticated
  using (exists (select 1 from public.reuniones_equipo r where r.id = reunion_id));
drop policy if exists "equipo escribe temas" on public.temas_reunion_equipo;
create policy "equipo escribe temas" on public.temas_reunion_equipo for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- El equipo puede asentar acuerdos. Sólo el organizador modifica la selección
-- y el orden de Secretaría. Cerrar congela el temario, no los compromisos.
create or replace function public.validar_tema_reunion_equipo()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  r public.reuniones_equipo;
  cambia_agenda boolean;
begin
  if tg_op = 'UPDATE' and new.reunion_id <> old.reunion_id then
    raise exception 'Un tema no se puede mover a otra reunión';
  end if;
  select * into r from public.reuniones_equipo where id = case when tg_op = 'DELETE' then old.reunion_id else new.reunion_id end;
  if not found then raise exception 'La reunión no está disponible'; end if;
  cambia_agenda := tg_op <> 'UPDATE';
  if tg_op = 'UPDATE' then
    cambia_agenda := (new.compromiso_id, new.titulo, new.nota, new.orden)
      is distinct from (old.compromiso_id, old.titulo, old.nota, old.orden);
  end if;
  if cambia_agenda and r.cerrada then raise exception 'El temario de la reunión está cerrado'; end if;
  if cambia_agenda and r.tipo = 'secretaria' and not public.organiza_reunion_secretaria() then
    raise exception 'Sólo el organizador puede preparar el temario de Secretaría';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists validar_tema_equipo on public.temas_reunion_equipo;
create trigger validar_tema_equipo before insert or update or delete on public.temas_reunion_equipo
  for each row execute function public.validar_tema_reunion_equipo();

-- El cierre guarda la lista completa de Dirección en una transacción. Los
-- encuentros anteriores no incorporan los compromisos creados después.
create or replace function public.cerrar_reunion_equipo(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare r public.reuniones_equipo;
begin
  select * into r from public.reuniones_equipo where id = p_id for update;
  if not found or not public.es_admin() then raise exception 'No podés cerrar esta reunión'; end if;
  if r.tipo = 'secretaria' and not public.organiza_reunion_secretaria() then
    raise exception 'Sólo el organizador puede cerrar el temario de Secretaría';
  end if;
  if r.cerrada then return; end if;
  if r.tipo = 'direccion' then
    insert into public.temas_reunion_equipo(reunion_id, compromiso_id, titulo)
      select p_id, c.id, c.descripcion from public.compromisos c
      where c.activo and not exists (select 1 from public.temas_reunion_equipo t where t.reunion_id = p_id and t.compromiso_id = c.id);
  end if;
  update public.reuniones_equipo set cerrada = true where id = p_id;
end;
$$;
revoke all on function public.cerrar_reunion_equipo(uuid) from public;
grant execute on function public.cerrar_reunion_equipo(uuid) to authenticated;
grant execute on function public.organiza_reunion_secretaria() to authenticated;
grant select, insert, update on public.reuniones_equipo to authenticated;
grant select, insert, update, delete on public.temas_reunion_equipo to authenticated;
notify pgrst, 'reload schema';
