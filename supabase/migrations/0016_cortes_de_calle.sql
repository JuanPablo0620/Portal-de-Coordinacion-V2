-- ---------------------------------------------------------------------------
-- 0016_cortes_de_calle.sql — los cortes salen del navegador.  09/09/2026
--
-- El modulo de Mapa es posterior a `0001_esquema.sql` y nunca se le hizo lugar
-- en la base: los cortes viven en el navegador de cada persona. Es el unico de
-- los cuatro modulos sin migrar que ni siquiera tenia tabla.
--
-- El costo hoy: si alguien marca el corte de una avenida para un evento del
-- sabado, nadie mas lo ve. La informacion que existe para coordinarse entre
-- areas esta encerrada en una computadora.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

create table if not exists public.cortes (
  id                 uuid primary key default gen_random_uuid(),

  -- Un corte puede existir sin evento —una obra, un aviso de un tercero— y un
  -- evento puede tener varios. De ahi que sea opcional y no al reves.
  evento_id          uuid references public.eventos(id) on delete set null,
  area_solicitante_id uuid references public.areas(id),

  motivo             text,
  detalle_motivo     text,
  estado             text not null default 'previsto',
  alcance            text not null default 'total',

  vigencia_desde     date,
  vigencia_hasta     date,
  hora_desde         time,
  hora_hasta         time,

  -- Dias de la semana en que rige, 0 a 6. Un corte de feria puede ser todos los
  -- domingos de tres meses, no un rango continuo.
  dias_semana        integer[] not null default '{}',
  -- Excepciones dentro de la vigencia: feriados, suspensiones por lluvia.
  fechas_excluidas   date[] not null default '{}',

  /*
   * Los tramos van como jsonb y es una decision, no una comodidad.
   *
   * Cada tramo trae calle, esquina de inicio y fin, localidad, sentido, forma y
   * la lista de cuadras que resolvio el callejero oficial. Es un resultado de
   * geometria: se guarda entero, se muestra entero y no se consulta por partes
   * --nadie va a preguntar «que cortes tienen sentido unico»--. Normalizarlo
   * serian dos tablas mas para representar algo que siempre viaja junto.
   *
   * Si algun dia hace falta cruzar cortes contra calles, ahi si conviene
   * normalizar. Hoy seria complejidad sin uso.
   */
  tramos             jsonb not null default '[]'::jsonb,

  /*
   * Las cuadras concretas que el corte abarca, tal como se seleccionaron sobre
   * el callejero oficial. Van aparte de `tramos` porque son la unidad real: los
   * tramos agrupan cuadras por calle para poder mostrarlas, pero lo que se
   * dibuja en el mapa es esta lista.
   */
  cuadras            jsonb not null default '[]'::jsonb,

  observaciones      text,
  activo             boolean not null default true,
  creado_por         uuid references public.perfiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Una vigencia al reves no es un corte, es un error de carga.
  constraint cortes_vigencia_ordenada
    check (vigencia_desde is null or vigencia_hasta is null
           or vigencia_desde <= vigencia_hasta)
);

comment on table public.cortes is
  'Cortes de calle del modulo de Mapa. Un corte puede no tener evento (obra, '
  'aviso externo) y un evento puede tener varios.';

create index if not exists cortes_evento_idx
  on public.cortes (evento_id) where evento_id is not null;

create index if not exists cortes_vigencia_idx
  on public.cortes (vigencia_desde, vigencia_hasta);


-- ---------------------------------------------------------------------------
-- Permisos: mismo criterio que el resto.
-- ---------------------------------------------------------------------------
alter table public.cortes enable row level security;

drop policy if exists "lectura logueados" on public.cortes;
create policy "lectura logueados" on public.cortes
  for select to authenticated using (public.mi_rol() is not null);

drop policy if exists "escritura admin" on public.cortes;
create policy "escritura admin" on public.cortes
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

notify pgrst, 'reload schema';
