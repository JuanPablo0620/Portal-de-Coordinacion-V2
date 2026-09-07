-- ---------------------------------------------------------------------------
-- 0003_rls.sql — Permisos por rol.  07/09/2026
--
-- ###########################################################################
-- ##  NO APLICAR TODAVIA.                                                  ##
-- ##                                                                       ##
-- ##  Este archivo REEMPLAZA la lectura publica de                         ##
-- ##  05-politica-rls-lectura.sql por lectura solo para usuarios           ##
-- ##  logueados. La pantalla "Vigentes (Supabase)" que hoy esta en vivo    ##
-- ##  lee con la clave `anon` y sin login: en el momento en que se corra   ##
-- ##  esto, esa pantalla queda vacia hasta que el portal tenga pantalla    ##
-- ##  de login.                                                            ##
-- ##                                                                       ##
-- ##  Orden correcto:  0002_auth.sql  ->  crear las cuentas  ->            ##
-- ##  login en el front  ->  recien ahi este archivo.                      ##
-- ###########################################################################
--
-- Roles, segun lo definido con Tomas el 07/09/2026:
--
--   admin / coordinacion  lee todo, escribe todo, administra usuarios y
--                         catalogos. Los seis de Control de Gestion.
--   jefe_gabinete         lee todo. Escribe UNICAMENTE los campos
--                         estrategicos, y solo a traves de las funciones del
--                         bloque 4 -- nunca por UPDATE directo. El porque
--                         esta explicado ahi.
--   intendencia           lee todo. No escribe nada.
--   area                  lee y escribe solo su secretaria. Definido pero
--                         dormido: hoy no hay ningun usuario con este rol.
--
-- Las tablas que NO figuran en este archivo quedan cerradas por completo, que
-- es el comportamiento correcto: tienen RLS activo y ninguna politica, o sea
-- nadie entra. Se iran abriendo a medida que el portal las use de verdad.
-- Abrir una tabla que todavia nadie lee solo agrega superficie de riesgo.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Cerrar la lectura publica provisoria del 04/09
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'programas', 'ejes', 'estados', 'tipos_proyecto',
    'proyectos', 'mesas', 'compromisos', 'reuniones_mesa'
  ]
  loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Lectura: cualquiera logueado y activo
--
-- No se discrimina por rol en la lectura salvo para el rol `area`, que ve solo
-- lo suyo. Intendencia y jefe de gabinete necesitan la foto completa del
-- partido: es exactamente para lo que usan el portal.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'programas', 'ejes', 'estados', 'tipos_proyecto',
    'mesas', 'reuniones_mesa', 'motivos_estrategicos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lectura logueados" on public.%I', t);
    execute format(
      'create policy "lectura logueados" on public.%I '
      'for select to authenticated using (public.mi_rol() is not null)', t);
  end loop;
end $$;


-- `proyectos` y `compromisos` llevan lectura propia porque el rol `area` se
-- recorta sobre ellas.
alter table public.proyectos   enable row level security;
alter table public.compromisos enable row level security;

drop policy if exists "lectura logueados" on public.proyectos;
create policy "lectura logueados" on public.proyectos
  for select to authenticated
  using (
    public.mi_rol() is not null
    and (
      public.mi_rol() <> 'area'
      or exists (
        select 1 from public.programas g
        where g.id = proyectos.programa_id
          and g.area_id = public.mi_area()
      )
    )
  );

drop policy if exists "lectura logueados" on public.compromisos;
create policy "lectura logueados" on public.compromisos
  for select to authenticated
  using (
    public.mi_rol() is not null
    and (public.mi_rol() <> 'area' or area_id = public.mi_area())
  );


-- ---------------------------------------------------------------------------
-- 3. Escritura
--
-- Los catalogos (areas, programas, ejes, estados, tipos, motivos) los toca
-- solo admin: son el vocabulario compartido del sistema, y renombrar una
-- secretaria o un eje se propaga a todos los informes a la vez.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'programas', 'ejes', 'estados', 'tipos_proyecto',
    'mesas', 'reuniones_mesa', 'motivos_estrategicos'
  ]
  loop
    execute format('drop policy if exists "escritura admin" on public.%I', t);
    execute format(
      'create policy "escritura admin" on public.%I for all to authenticated '
      'using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;


-- Proyectos: admin escribe todo; `area` solo los de su secretaria.
drop policy if exists "escritura admin" on public.proyectos;
create policy "escritura admin" on public.proyectos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "escritura area" on public.proyectos;
create policy "escritura area" on public.proyectos
  for all to authenticated
  using (
    public.mi_rol() = 'area'
    and exists (select 1 from public.programas g
                where g.id = proyectos.programa_id and g.area_id = public.mi_area())
  )
  with check (
    public.mi_rol() = 'area'
    and exists (select 1 from public.programas g
                where g.id = proyectos.programa_id and g.area_id = public.mi_area())
  );


-- Compromisos: misma logica, con area_id directo en la fila.
drop policy if exists "escritura admin" on public.compromisos;
create policy "escritura admin" on public.compromisos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "escritura area" on public.compromisos;
create policy "escritura area" on public.compromisos
  for all to authenticated
  using (public.mi_rol() = 'area' and area_id = public.mi_area())
  with check (public.mi_rol() = 'area' and area_id = public.mi_area());


-- Notese que `intendencia` y `jefe_gabinete` no aparecen en ninguna politica
-- de escritura. No es un olvido: RLS niega por defecto, asi que para ellos
-- todo INSERT, UPDATE y DELETE directo queda rechazado. El jefe de gabinete
-- escribe exclusivamente por las funciones que siguen.


-- ---------------------------------------------------------------------------
-- 4. Proyectos estrategicos — por que van funciones y no una politica
--
-- "Proyectos Estrategicos" no es una tabla: son diez columnas dentro de
-- `proyectos` (es_estrategico, prioridad_estrategica, motivo_estrategico_id,
-- responsable_politico, compromiso_publico, fecha_compromiso,
-- origen_estrategico, estrategico_nota, estrategico_marcado_por/_en). Fue una
-- decision deliberada de 0001: un proyecto estrategico es EL MISMO proyecto
-- que siguen Monitoreo y Seguimiento, mirado con otra prioridad; duplicarlo en
-- una tabla aparte obligaria a mantener dos avances que se despegan en la
-- primera carga.
--
-- Pero RLS decide por FILA, no por COLUMNA. No hay forma de escribir una
-- politica que diga "este rol puede modificar estas diez columnas y ninguna
-- otra". Darle UPDATE sobre `proyectos` al jefe de gabinete lo habilitaria a
-- cambiar el nombre, el estado o la secretaria de cualquier proyecto -- mucho
-- mas de lo que se pidio.
--
-- Por eso el UPDATE directo le queda cerrado y la unica puerta son estas dos
-- funciones, que corren como duenio pero verifican el rol de quien llama y
-- tocan unicamente las columnas estrategicas.
--
-- Efecto lateral bueno: `estrategico_marcado_por` y `estrategico_marcado_en`
-- existen en el esquema desde 0001 y hoy no los llena nadie. Las funciones los
-- completan solas con el usuario de la sesion. Queda registrado quien marco
-- cada proyecto y cuando, que hoy es informacion que se pierde.
--
-- `updated_at` se pisa a mano porque el trigger generico que iba a mantenerlo
-- vivia en 0002_logica.sql, que nunca se escribio.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_estrategico(
  p_proyecto_id          uuid,
  p_prioridad            text default 'alta',
  p_motivo_id            uuid default null,
  p_nota                 text default null,
  p_responsable_politico text default null,
  p_compromiso_publico   text default null,
  p_fecha_compromiso     date default null,
  p_origen               public.origen_carga default null
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

  if p_prioridad not in ('alta', 'media') then
    raise exception 'La prioridad estrategica solo puede ser alta o media'
      using errcode = 'check_violation';
  end if;

  -- coalesce en todo lo opcional: volver a marcar un proyecto ya estrategico
  -- para cambiarle la prioridad no tiene que borrarle el motivo ni la nota.
  update public.proyectos set
    es_estrategico          = true,
    estrategico_marcado_por = auth.uid(),
    estrategico_marcado_en  = now(),
    prioridad_estrategica   = p_prioridad,
    motivo_estrategico_id   = coalesce(p_motivo_id, motivo_estrategico_id),
    estrategico_nota        = coalesce(p_nota, estrategico_nota),
    responsable_politico    = coalesce(p_responsable_politico, responsable_politico),
    compromiso_publico      = coalesce(p_compromiso_publico, compromiso_publico),
    fecha_compromiso        = coalesce(p_fecha_compromiso, fecha_compromiso),
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


-- Sacar de la cartera no borra por que estuvo ahi: los campos quedan, y asi el
-- historial sigue pudiendo explicar por que durante seis meses fue
-- prioritario. Es la misma regla que ya aplica `quitarEstrategico()` en
-- repositorio.js.
create or replace function public.quitar_estrategico(p_proyecto_id uuid)
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
    raise exception 'No tenes permiso para sacar proyectos de la cartera estrategica'
      using errcode = 'insufficient_privilege';
  end if;

  update public.proyectos
     set es_estrategico = false,
         updated_at     = now()
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
  public.marcar_estrategico(uuid, text, uuid, text, text, text, date, public.origen_carga)
  from public, anon;
revoke all on function public.quitar_estrategico(uuid) from public, anon;

grant execute on function
  public.marcar_estrategico(uuid, text, uuid, text, text, text, date, public.origen_carga)
  to authenticated;
grant execute on function public.quitar_estrategico(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Cerrar la ejecucion por defecto de las funciones de sesion
--
-- Postgres otorga EXECUTE a PUBLIC en toda funcion nueva, asi que el `grant to
-- authenticated` de 0002_auth.sql no restringio nada: quedaron ejecutables
-- tambien por `anon`. No filtran datos -- a un no logueado le devuelven null y
-- false, porque auth.uid() es null y no encuentran perfil -- pero no hay
-- ninguna razon para dejarlas expuestas.
-- ---------------------------------------------------------------------------
revoke all on function public.mi_rol()   from public, anon;
revoke all on function public.mi_area()  from public, anon;
revoke all on function public.es_admin() from public, anon;

grant execute on function public.mi_rol()   to authenticated;
grant execute on function public.mi_area()  to authenticated;
grant execute on function public.es_admin() to authenticated;
