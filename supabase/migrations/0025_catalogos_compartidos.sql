-- ---------------------------------------------------------------------------
-- 0025_catalogos_compartidos.sql — que los catalogos sean de todos.  10/09/2026
--
-- Configuracion deja agregar, renombrar y dar de baja items en doce catalogos
-- —areas, ejes, tipos, unidades, organismos, motivos estrategicos...— y hasta
-- ahora todo eso se guardaba SOLO en el navegador de quien lo hacia. Agregabas
-- una secretaria y no la veia nadie mas; al recargar, la lista de programas
-- volvia a la de la base.
--
-- Nueve de los doce ya tienen tabla desde 0001. Esta migracion resuelve lo que
-- faltaba para que el portal pueda escribir en todas:
--
--   1. `unidades` no tenia como dar de baja un item.
--   2. `tipos_proyecto` no sabia cual de sus tipos ES una obra.
--   3. Tres catalogos no tienen tabla en ningun lado.
--   4. Tres tablas de catalogo quedaron sin RLS.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Baja logica en unidades
--
-- Es el unico catalogo de 0001 sin `activo`. Sin la columna, sacar «horas» de
-- la lista obliga a borrar la fila, y las mediciones historicas que la usaban
-- se quedan apuntando a nada. Con baja logica dejan de ofrecerse y lo ya
-- cargado sigue siendo legible.
-- ---------------------------------------------------------------------------
alter table public.unidades
  add column if not exists activo boolean not null default true;


-- ---------------------------------------------------------------------------
-- 2. Que tipo de proyecto es una obra
--
-- El portal marca cada tipo con `es_obra`, y de ahi sale que un proyecto
-- aparezca en la pantalla de Obras. La tabla no tenia donde guardarlo, asi que
-- el dato se perdia al crear o renombrar un tipo desde Configuracion.
-- ---------------------------------------------------------------------------
alter table public.tipos_proyecto
  add column if not exists es_obra boolean not null default false;

-- El unico tipo semilla que es obra. `where` y no un update masivo: si alguien
-- ya lo corrigio a mano, esto no lo pisa al volver a correr la migracion.
update public.tipos_proyecto set es_obra = true
 where slug = 'obra' and es_obra = false;


-- ---------------------------------------------------------------------------
-- 3. Los tres catalogos sin tabla
--
-- `tipos_evento`, `tipos_proyecto_posicionamiento` y `periodicidades` respaldan
-- columnas de TEXTO libre, no claves foraneas —fue una decision explicita, ver
-- 0015—. No son entidades del modelo: son el vocabulario que el area ofrece en
-- un desplegable.
--
-- Por eso van a una sola tabla con una columna `clave` que dice de que lista es
-- cada fila, y no a tres tablas casi identicas: tres tablas serian tres juegos
-- de politicas y tres traductores para guardar, en total, veinte nombres.
-- ---------------------------------------------------------------------------
create table if not exists public.catalogos_libres (
  id     uuid primary key default gen_random_uuid(),
  clave  text not null,     -- 'tipos_evento' | 'tipos_proyecto_posicionamiento' | 'periodicidades'
  nombre text not null,
  orden  int  not null default 0,
  activo boolean not null default true,
  unique (clave, nombre)
);

comment on table public.catalogos_libres is
  'Vocabulario de los desplegables que respaldan columnas de texto libre. La columna `clave` dice a que lista pertenece cada fila.';

-- Semillas: las mismas que traia la maqueta, para que al conectar el portal
-- las listas no aparezcan vacias. `on conflict do nothing` las hace
-- re-ejecutables y no pisa lo que el area haya agregado despues.
insert into public.catalogos_libres (clave, nombre, orden) values
  ('tipos_evento', 'Inauguración', 1),
  ('tipos_evento', 'Feria', 2),
  ('tipos_evento', 'Jornada', 3),
  ('tipos_evento', 'Operativo territorial', 4),
  ('tipos_evento', 'Actividad cultural', 5),
  ('tipos_evento', 'Actividad deportiva', 6),
  ('tipos_evento', 'Acto institucional', 7),
  ('tipos_proyecto_posicionamiento', 'Hermanamiento', 1),
  ('tipos_proyecto_posicionamiento', 'Red de ciudades', 2),
  ('tipos_proyecto_posicionamiento', 'Postulación a fondo', 3),
  ('tipos_proyecto_posicionamiento', 'Premio o distinción', 4),
  ('tipos_proyecto_posicionamiento', 'Misión o visita', 5),
  ('tipos_proyecto_posicionamiento', 'Convenio de cooperación', 6),
  ('tipos_proyecto_posicionamiento', 'Evento internacional', 7),
  ('tipos_proyecto_posicionamiento', 'Membresía en organismo', 8),
  ('periodicidades', 'semanal', 1),
  ('periodicidades', 'quincenal', 2),
  ('periodicidades', 'mensual', 3),
  ('periodicidades', 'bimestral', 4),
  ('periodicidades', 'trimestral', 5)
on conflict (clave, nombre) do nothing;


-- ---------------------------------------------------------------------------
-- 4. Permisos, para todos los catalogos por igual
--
-- `unidades`, `items_requerimiento` y `organismos` quedaron sin RLS en 0001.
-- Una tabla sin RLS en Supabase queda abierta a la clave anonima, que viaja en
-- el JavaScript del portal y por lo tanto la tiene cualquiera que abra la
-- pagina. No es que expongan algo sensible —son nombres de unidades de
-- medida— pero tampoco hay motivo para que sean la excepcion.
--
-- La regla es la misma que 0003 fijo para el resto: lee cualquiera logueado,
-- escribe solo admin. Renombrar una secretaria o un eje se propaga a todos los
-- informes a la vez, asi que no es una edicion que corresponda a cualquiera.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'unidades', 'items_requerimiento', 'organismos',
    'categorias_tema', 'catalogos_libres'
  ]
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

-- 0010 le habia puesto a `categorias_tema` una politica de lectura con otro
-- nombre. Se saca la vieja para no dejar dos diciendo lo mismo.
drop policy if exists "categorias tema lectura" on public.categorias_tema;

notify pgrst, 'reload schema';
