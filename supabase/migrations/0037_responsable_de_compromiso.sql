-- Responsabilidad individual sobre los compromisos.
--
-- Hasta acá un compromiso tenía área y plazo, pero no dueño: el `_db` de
-- origen nunca registró quién se hacía cargo. Eso es lo que permitió el caso
-- «Portón» (Ambiente), 25 cargas entre febrero y agosto de 2026 siempre en
-- `Pendiente` con el mismo comentario copiado — nadie lo tenía asignado, así
-- que no era de nadie.
--
-- **No borra ni modifica ninguna fila.** Los 137 compromisos que hay en
-- producción al 22/09/2026 siguen igual, sin responsable, y el circuito nuevo
-- empieza a regir cuando se habilita el padrón. Ver la regla (c).
--
-- Aplicar después de 0031, que es hasta donde llega la base real. **No depende
-- de 0032–0036**, que están escritas pero sin aplicar: a propósito no toca
-- `compromisos_origen_unico`, que es donde 0036 agrega su propia columna. Una
-- versión anterior de este archivo sí la tocaba y fallaba con
-- `42703: column "id_reunion_evento_origen" does not exist`.
--
-- No contiene identidades: el padrón se configura contra las cuentas reales
-- desde Configuración → Equipo, y este repositorio es público.

/* ── 1. El padrón ───────────────────────────────────────────────────── */

-- Tener cuenta no implica recibir compromisos. Hay integrantes que entran a
-- consultar y no se hacen cargo de nada, así que la habilitación es explícita
-- y arranca apagada para todos.
alter table public.perfiles
  add column if not exists recibe_compromisos boolean not null default false;

comment on column public.perfiles.recibe_compromisos is
  'Habilita a la cuenta para figurar como responsable de un compromiso.';

/* ── 2. El responsable ──────────────────────────────────────────────── */

-- Nullable, y no es una concesión: el 22/09/2026 se contó lo que hay en
-- producción y son 137 compromisos, ninguno con responsable. Ochenta y cuatro
-- vienen de la carga histórica del 04/09, pero los otros 53 los cargó el
-- equipo desde el portal en las tres semanas siguientes —46 siguen activos, 11
-- son del mismo 22/09— y tienen 82 actualizaciones colgando.
--
-- A esas filas no se les puede inventar un dueño. Deducirlo del área es
-- exactamente lo que no hay que hacer: el área dice quién ejecuta, no quién se
-- comprometió a impulsarlo. Así que la columna entra nullable y quien decide
-- si es obligatoria es el trigger de más abajo, según haya o no padrón.
alter table public.compromisos
  add column if not exists id_responsable uuid references public.perfiles(id);

create index if not exists compromisos_responsable_idx
  on public.compromisos(id_responsable);

comment on column public.compromisos.id_responsable is
  'Quién lo impulsa y lo actualiza. Derivar cambia esta columna y nada más.';

/* ── 3. Permisos ────────────────────────────────────────────────────── */

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

/* ── 4. Las tres reglas del responsable ─────────────────────────────── */

-- Corre en la base y no sólo en el selector de la pantalla, porque el portal
-- escribe por PostgREST y cualquiera con la anon key —que va en el front y es
-- pública por diseño— podría mandar un PATCH a mano.
create or replace function public.validar_responsable_compromiso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (a) El destinatario tiene que estar activo y habilitado. Tener cuenta no
  -- alcanza: hay integrantes que entran sólo a consultar.
  if new.id_responsable is not null
     and (tg_op = 'INSERT' or new.id_responsable is distinct from old.id_responsable) then
    if not exists (
      select 1 from public.perfiles
      where id = new.id_responsable and activo and recibe_compromisos
    ) then
      raise exception 'La persona no está habilitada para recibir compromisos';
    end if;
  end if;

  -- (b) Derivar transfiere; no deja huérfano. Sacar el responsable sin poner
  -- otro devolvería el compromiso al estado que esta migración vino a corregir.
  if tg_op = 'UPDATE' and old.id_responsable is not null and new.id_responsable is null then
    raise exception 'Elegí otro responsable para derivar el compromiso';
  end if;

  -- (c) La regla que hace convivir lo viejo con lo nuevo. Los 137 que ya están
  -- cargados se quedan sin dueño: no se les puede inventar uno. Pero en cuanto
  -- haya al menos una persona habilitada, ya no hay excusa para cargar un
  -- compromiso nuevo sin responsable.
  --
  -- Consecuencia buscada: habilitar el padrón es lo que activa el circuito.
  -- Mientras Configuración → Equipo esté vacío, el portal se comporta como
  -- hasta hoy y nada se rompe.
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

notify pgrst, 'reload schema';
