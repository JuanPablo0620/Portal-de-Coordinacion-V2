-- ---------------------------------------------------------------------------
-- 0006_catalogos_proyectos.sql — los catálogos que necesita Proyectos.
-- 08/09/2026
--
-- Preparación para migrar Proyectos a Supabase. Tres cosas:
--
--   1. Los cinco estados que usa el portal. Faltaban tres.
--   2. Las tildes que faltan en las semillas de 0001, en todos los catálogos.
--   3. La tabla `unidades`, que 0001 creó y nunca sembró.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Los estados del portal
--
-- El portal ofrece cinco: planificado, en ejecución, demorado, finalizado y
-- suspendido. En la base había ocho, y solo dos coincidían («En ejecucion» y
-- «Finalizado»). Faltan tres.
--
-- Los ocho que ya estaban NO se tocan ni se borran: `Alerta`, `Crítico`,
-- `Pendiente`, `Programado`, `Objetivo cumplido` y `Supera Objetivo` son los
-- del glosario de la Dirección, salen de los `_db` reales y varios se calculan
-- solos por umbral -- nadie los elige a mano. Conviven con los cinco que sí se
-- eligen desde el formulario. Que el catálogo tenga más valores que el
-- desplegable es correcto: el desplegable ofrece lo que una persona carga, el
-- catálogo guarda todo lo que un estado puede ser.
--
-- El `slug` es la clave de traducción: el portal manda «en ejecución» y el
-- traductor lo normaliza a `en_ejecucion`. Por eso los slugs importan más que
-- los nombres, y por eso se puede corregir un nombre sin romper nada.
-- ---------------------------------------------------------------------------
insert into public.estados (slug, nombre, color, orden, aplica_a) values
  ('planificado', 'Planificado', '#B8C2C9',  9, 'ambas'),
  ('demorado',    'Demorado',    '#F6B07B', 10, 'ambas'),
  ('suspendido',  'Suspendido',  '#B8C2C9', 11, 'ambas')
on conflict (slug) do update set nombre = excluded.nombre;


-- ---------------------------------------------------------------------------
-- 2. Tildes
--
-- Las semillas de 0001 se cargaron sin tildes, en todos los catálogos. No es
-- un detalle cosmético: son las etiquetas que van a salir impresas en informes
-- para el intendente y en presentaciones institucionales. «Gestion interna» y
-- «Articulacion con provincia o nacion» no se pueden mostrar así.
--
-- Se corrige el `nombre`, nunca el `slug`: el slug es la clave estable contra
-- la que se resuelve todo, y cambiarlo sí rompería las referencias.
--
-- (`areas` ya se corrigió en 0005_areas_nombre_formal.sql.)
-- ---------------------------------------------------------------------------
update public.estados set nombre = 'En ejecución' where slug = 'en_ejecucion';
update public.estados set nombre = 'Crítico'      where slug = 'critico';

update public.tipos_proyecto set nombre = 'Gestión interna' where slug = 'gestion_interna';
update public.tipos_proyecto set nombre = 'Adquisición'     where slug = 'adquisicion';

update public.motivos_estrategicos set nombre = 'Compromiso público de gestión'
  where slug = 'compromiso_publico';
update public.motivos_estrategicos set nombre = 'Articulación con provincia o nación'
  where slug = 'articulacion_provincia';
update public.motivos_estrategicos set nombre = 'Innovación institucional'
  where slug = 'innovacion';


-- ---------------------------------------------------------------------------
-- 3. Unidades
--
-- `act_cuantitativas.unidad_id` apunta acá, y la tabla está vacía desde 0001 —
-- el mismo olvido que tenía `items_requerimiento`. Sin esto no se puede cargar
-- una sola observación cuantitativa: ni «3.500 m² de bacheo» ni «1.200
-- beneficiarios».
--
-- Los valores son los que el portal ya usa (`CATALOGOS_SEMILLA.unidades`).
-- ---------------------------------------------------------------------------
insert into public.unidades (slug, nombre) values
  ('m2',              'm²'),
  ('beneficiarios',   'beneficiarios'),
  ('cuadras',         'cuadras'),
  ('unidades',        'unidades'),
  ('porcentaje',      '%'),
  ('metros_lineales', 'metros lineales'),
  ('horas',           'horas')
on conflict (slug) do update set nombre = excluded.nombre;


-- ---------------------------------------------------------------------------
-- 4. Políticas de las tablas que todavía no las tenían
--
-- Mismo criterio que 0003 y 0004: lee cualquiera con sesión, escribe admin.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['unidades', 'motivos_estrategicos', 'actualizaciones',
                           'act_cuantitativas', 'objetivos']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "lectura logueados" on public.%I', t);
    execute format(
      'create policy "lectura logueados" on public.%I '
      'for select to authenticated using (public.mi_rol() is not null)', t);

    execute format('drop policy if exists "escritura admin" on public.%I', t);
    execute format(
      'create policy "escritura admin" on public.%I for all to authenticated '
      'using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;
