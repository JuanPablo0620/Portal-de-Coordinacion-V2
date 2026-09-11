-- ---------------------------------------------------------------------------
-- 0026_rls_faltante.sql — las trece tablas que quedaron abiertas.  10/09/2026
--
-- Barriendo las 47 tablas del esquema contra las politicas de 0003, 0009, 0010,
-- 0017 y 0025 aparecieron trece sin RLS.
--
-- Una tabla sin RLS en Supabase es legible y escribible con la clave anonima,
-- que viaja dentro del JavaScript del portal: la tiene cualquiera que abra la
-- pagina. Lo comprobe contra la base — `reportes_guardados` respondia sin
-- sesion.
--
-- Las trece se dividen en dos grupos que necesitan tratos distintos.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Las cuatro que el portal usa
--
-- Planificacion anual y reportes guardados. Se les da la regla de las tablas de
-- gestion: lee cualquiera logueado, escribe admin.
--
-- Las tres de planificacion van juntas porque son una sola cosa partida en tres
-- tablas —el plan, sus metas trimestrales y sus hitos— y el portal las escribe
-- en la misma operacion. Una politica distinta en cualquiera de las tres
-- dejaria planes guardados a medias.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'planificacion_anual', 'planificacion_trimestres', 'hitos_planificacion',
    'reportes_guardados'
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


-- ---------------------------------------------------------------------------
-- 2. Las nueve que todavia no usa nadie
--
-- `pedidos_roco`, `serie_historica`, `adjuntos`, `alertas`, `actividades`,
-- `act_comparativas`, `renglon_overrides`, `migracion_cuarentena` y
-- `auditoria_consultas` estan creadas desde 0001 y ninguna pantalla las toca.
--
-- Se les habilita RLS SIN politicas, que es negar todo. No es un olvido: es lo
-- correcto para una tabla cuyo modelo de acceso todavia no se decidio. Quien la
-- conecte va a tener que escribir su politica, y esa es exactamente la
-- conversacion que hay que tener antes de exponerla —sobre todo en
-- `pedidos_roco`, que guarda pedidos de vecinos al intendente y por lo tanto
-- puede tener datos personales.
--
-- Mientras tanto quedan invisibles para la API en lugar de abiertas.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'pedidos_roco', 'serie_historica', 'adjuntos', 'alertas', 'actividades',
    'act_comparativas', 'renglon_overrides', 'migracion_cuarentena',
    'auditoria_consultas'
  ]
  loop
    -- Alguna puede no existir todavia segun hasta donde se corrio el esquema.
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
