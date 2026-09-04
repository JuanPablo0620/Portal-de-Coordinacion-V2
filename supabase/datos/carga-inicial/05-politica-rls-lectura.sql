-- Politica de RLS: SOLO LECTURA para todos, sin login (04/09/2026).
--
-- Contexto: al cargar los datos reales el 04/09 se encontro que RLS estaba
-- activado en produccion sin ninguna politica (ni una sola `create policy` en
-- 0001_esquema.sql) -- eso bloquea TODO, incluida la lectura con la clave
-- `anon`, que es la que va a usar el frontend. El portal no tiene login real
-- todavia (config.usuario es texto libre), asi que no se puede distinguir
-- quien pide que dato: la unica politica posible hoy es "todos pueden leer,
-- nadie escribe sin loguearse". Ver docs/traspaso-datos-reales.md.
--
-- Se puede correr mas de una vez sin error (drop + create).
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'programas', 'ejes', 'estados', 'tipos_proyecto',
    'proyectos', 'mesas', 'compromisos', 'reuniones_mesa'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select using (true)', t);
  end loop;
end $$;
