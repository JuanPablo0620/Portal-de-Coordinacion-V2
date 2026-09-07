-- ---------------------------------------------------------------------------
-- 0002_auth.sql — Autenticacion y perfiles.  07/09/2026
--
-- Cierra el hueco entre `auth.users` (que administra Supabase) y
-- `public.perfiles` (que declara 0001_esquema.sql pero nadie llena).
--
-- Decisiones que implementa, tomadas con Tomas el 07/09/2026:
--
--  * Login con mail y contrasenia, SIN registro publico. Las cuentas las crea
--    un admin desde el dashboard. No se usa Google porque el equipo no tiene
--    dominio institucional propio -- son cuentas @gmail.com sueltas, y Google
--    no puede filtrar por dominio. Migrar a Google mas adelante no obliga a
--    tocar nada de este archivo salvo la pantalla de login.
--
--  * Lista blanca obligatoria (`usuarios_autorizados`). Nadie obtiene perfil
--    si su mail no figura ahi de antemano. Es defensa en profundidad: aunque
--    alguien reactive el registro publico por error en el dashboard, un
--    desconocido que se registre NO consigue perfil y sin perfil no ve nada.
--
--  * `coordinacion` y `admin` quedan colapsados: las politicas los tratan
--    igual y al equipo se le asigna `admin`. No se borra `coordinacion` del
--    enum porque Postgres no permite quitar valores de un tipo enumerado sin
--    recrearlo y reescribir cada columna que lo usa. Dejarlo sin usar es
--    gratis, y volver a separarlos es editar una politica.
--
-- ESTE ARCHIVO ES SEGURO DE APLICAR CON EL PORTAL EN VIVO: solo agrega. No
-- toca la politica "lectura publica" de 05-politica-rls-lectura.sql, asi que
-- la pantalla "Vigentes (Supabase)" sigue funcionando igual. El cierre de esa
-- lectura publica ocurre en 0003_rls.sql, que NO hay que aplicar hasta que el
-- portal tenga pantalla de login.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Lista blanca
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios_autorizados (
  email      text primary key,
  nombre     text not null,
  rol        public.rol_usuario not null,
  area_id    uuid references public.areas(id),
  created_at timestamptz not null default now(),
  -- Misma regla que perfiles: la secretaria solo la lleva el rol 'area'.
  constraint autorizados_area_solo_rol_area
    check (area_id is null or rol = 'area'),
  -- El mail se guarda normalizado; el trigger busca con lower().
  constraint autorizados_email_normalizado
    check (email = lower(email))
);

comment on table public.usuarios_autorizados is
  'Lista blanca de acceso. Solo quien figure aca obtiene perfil al crearse su '
  'cuenta en auth.users. Dar de alta a alguien es: insertar la fila aca, y '
  'despues crear el usuario en Authentication > Users.';


-- ---------------------------------------------------------------------------
-- 2. Semilla del equipo -- NO VA EN ESTE ARCHIVO
--
-- Este repositorio es publico. El listado del equipo son mails personales de
-- agentes municipales, incluido el del intendente: commitearlos los publica en
-- internet de forma permanente, porque el historial de git no se borra aunque
-- se saque el archivo despues. Vector de spam y phishing, gratis y para
-- siempre.
--
-- El listado vive en `supabase/datos/usuarios-autorizados.local.sql`, que el
-- .gitignore excluye. Se corre a mano en el SQL Editor, despues de este
-- archivo. Si el archivo no esta en tu copia, pediselo a alguien del equipo:
-- no se pierde nada, la lista tambien esta cargada en la base.
--
-- Sin ese paso, este archivo deja el sistema funcionando pero sin nadie
-- autorizado -- y como el trigger de abajo rechaza toda cuenta que no figure
-- en la lista blanca, no se podria crear ningun usuario.


-- ---------------------------------------------------------------------------
-- 3. Alta automatica del perfil
--
-- No se puede pre-cargar `perfiles` porque su clave primaria referencia
-- auth.users(id), que no existe hasta que la cuenta se crea. De ahi que el
-- perfil nazca por trigger.
--
-- El `raise exception` aborta la transaccion que crea el usuario: si el mail
-- no esta autorizado, la cuenta directamente no llega a existir. Es lo que
-- convierte la lista blanca en una barrera real y no en un filtro cosmetico.
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  autorizado public.usuarios_autorizados%rowtype;
begin
  select * into autorizado
  from public.usuarios_autorizados
  where email = lower(new.email);

  if not found then
    raise exception
      'El mail % no esta autorizado a acceder al portal de Coordinacion', new.email
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.perfiles (id, nombre, email, rol, area_id)
  values (new.id, autorizado.nombre, lower(new.email), autorizado.rol, autorizado.area_id)
  on conflict (id) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_de_usuario();


-- Backfill: si alguna cuenta ya existia antes de esta migracion y esta
-- autorizada, se le crea el perfil ahora. Hoy deberia no afectar ninguna fila.
insert into public.perfiles (id, nombre, email, rol, area_id)
select u.id, a.nombre, lower(u.email), a.rol, a.area_id
from auth.users u
join public.usuarios_autorizados a on a.email = lower(u.email)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 4. Funciones de sesion
--
-- Van SECURITY DEFINER a proposito, y no es un atajo: una politica sobre
-- `perfiles` que consultara `perfiles` para saber el rol se llamaria a si
-- misma y Postgres aborta por recursion infinita. Al correr como duenio, estas
-- funciones leen la tabla salteando RLS y cortan el ciclo. Es el patron
-- estandar de Supabase para esto.
--
-- `activo` se chequea aca adentro: dar de baja a alguien es poner
-- perfiles.activo = false, y desde ese momento estas tres devuelven null/false
-- y todas las politicas dejan de reconocerlo, sin tocar su cuenta.
-- ---------------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $fn$
  select rol from public.perfiles where id = auth.uid() and activo;
$fn$;

create or replace function public.mi_area()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select area_id from public.perfiles where id = auth.uid() and activo;
$fn$;

-- Atajo de lectura: `admin` y `coordinacion` son el mismo permiso (ver la
-- cabecera). Toda politica de escritura general se apoya en esta funcion, asi
-- que si algun dia se separan los dos roles, se cambia aca y nada mas.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select rol in ('admin', 'coordinacion')
     from public.perfiles where id = auth.uid() and activo),
    false);
$fn$;

grant execute on function public.mi_rol()   to authenticated;
grant execute on function public.mi_area()  to authenticated;
grant execute on function public.es_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. RLS sobre las tablas de identidad
--
-- `perfiles`: cualquiera logueado ve la lista del equipo (son nueve personas y
-- el portal necesita mostrar "marcado por Fulano"). Modificarla, solo admin.
-- Nadie puede cambiarse el rol a si mismo: el `for all` esta restringido a
-- quien YA es admin, evaluado contra la fila guardada, no contra la enviada.
-- ---------------------------------------------------------------------------
alter table public.perfiles enable row level security;

drop policy if exists "perfiles lectura equipo"  on public.perfiles;
drop policy if exists "perfiles admin escribe"   on public.perfiles;

create policy "perfiles lectura equipo" on public.perfiles
  for select to authenticated using (true);

create policy "perfiles admin escribe" on public.perfiles
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());


-- La lista blanca es material sensible: define quien puede entrar. Solo admin,
-- ni siquiera lectura para el resto.
alter table public.usuarios_autorizados enable row level security;

drop policy if exists "autorizados solo admin" on public.usuarios_autorizados;

create policy "autorizados solo admin" on public.usuarios_autorizados
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());


-- ---------------------------------------------------------------------------
-- 6. Cambio de contrasenia obligatorio en el primer ingreso  (07/09/2026)
--
-- Las nueve cuentas se crearon con una contrasenia inicial repartida a mano.
-- Supabase no trae un "forzar cambio en el primer ingreso", asi que la marca
-- va en el perfil y la hace cumplir el portal: mientras este en true, el
-- usuario no llega a ninguna pantalla, solo al formulario de cambio.
--
-- Se agrega en `perfiles` y no en `auth.users` porque auth.users la administra
-- Supabase y no conviene meterle columnas propias.
--
-- Arranca en true para todos los perfiles ya creados: ninguno cambio todavia
-- la contrasenia con la que se dio de alta.
-- ---------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists debe_cambiar_password boolean not null default true;

comment on column public.perfiles.debe_cambiar_password is
  'true = todavia usa la contrasenia inicial repartida a mano. El portal '
  'bloquea todo hasta que elija una propia. Lo baja la funcion cambiar_password().';


-- La baja de la marca va por funcion y no por politica de UPDATE: si se le
-- diera al usuario permiso de update sobre su propia fila de `perfiles`,
-- podria cambiarse tambien el `rol`, que vive en la misma fila. RLS decide por
-- fila, no por columna -- el mismo motivo por el que los campos estrategicos
-- van por funcion en 0003_rls.sql.
--
-- El cambio de contrasenia en si lo hace el front con supabase.auth.updateUser();
-- esta funcion solo registra que ya ocurrio.
create or replace function public.marcar_password_cambiada()
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.perfiles
     set debe_cambiar_password = false,
         updated_at            = now()
   where id = auth.uid();
$fn$;

revoke all on function public.marcar_password_cambiada() from public, anon;
grant execute on function public.marcar_password_cambiada() to authenticated;
