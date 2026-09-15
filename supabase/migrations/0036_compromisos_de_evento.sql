-- ---------------------------------------------------------------------------
-- 0036_compromisos_de_evento.sql — la reunion de agenda de eventos como cuarto
-- origen de compromisos.  14/09/2026
--
-- Que resuelve: hoy un compromiso puede nacer de un seguimiento, de un tema de
-- monitoreo o de una reunion de mesa, pero no de la reunion de agenda de
-- eventos, que es un circuito real de Coordinacion y del mismo rango que los
-- otros tres. El diseño completo y el porque de cada decision estan en
-- docs/decisiones/2026-09-14-compromisos-de-eventos.md.
--
-- POR QUE ESTE ARCHIVO EXISTE: este contenido se habia escrito editando
-- directamente `0001_esquema.sql`, que esta corrida en la base desde hace
-- meses. Editar una migracion ya aplicada no cambia nada en Supabase —solo
-- desincroniza el repo de la base—, asi que el 0001 volvio a su version
-- original y lo nuevo vive aca. Es la misma regla que fijo 0032: «va en un
-- archivo nuevo y no editando 0031, que ya esta corrida».
--
-- Verificado por REST el 14/09/2026 antes de escribirla: en la base no existen
-- `reuniones_evento`, `reuniones_evento_eventos`, `eventos.id_legible`,
-- `requerimientos_evento.area_solicitante_id`, y el enum `origen_compromiso`
-- sigue con sus tres valores. O sea, nada de esto esta aplicado todavia.
--
-- Es re-ejecutable.
--
-- SI FALLA EL PRIMER BLOQUE: `alter type ... add value` no puede convivir con
-- el USO de ese valor en la misma transaccion. Aca no se usa el literal
-- 'evento' en ningun lado, asi que corre entero; si el editor igual se queja,
-- ejecutar la seccion 1 sola y despues el resto.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. El cuarto valor del enum
-- ---------------------------------------------------------------------------
alter type public.origen_compromiso add value if not exists 'evento';


-- ---------------------------------------------------------------------------
-- 2. eventos.id_legible
--
-- Coherencia con `proyectos.id_legible`: un codigo corto para nombrar un
-- evento en una conversacion o en un informe. Es cosmetico — la PK sigue
-- siendo el uuid— y por eso admite nulos: los eventos ya cargados no tienen.
-- ---------------------------------------------------------------------------
alter table public.eventos
  add column if not exists id_legible text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_id_legible_key'
  ) then
    alter table public.eventos add constraint eventos_id_legible_key unique (id_legible);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. requerimientos_evento: quien pide, observaciones y auditoria
--
-- Era la unica tabla del esquema sin columnas de auditoria, y sin
-- created_at/updated_at el trigger generico de 0017 no tiene con que fechar
-- los cambios del checklist de un evento.
--
-- `area_solicitante_id` es distinta de `area_responsable_id`, que ya existia:
-- una es quien necesita el item y la otra quien lo tiene que proveer. Sin la
-- primera no se puede saber a quien avisarle que lo suyo esta confirmado.
--
-- El UNIQUE (id, evento_id) es redundante como restriccion —`id` ya es unico
-- solo— y esta a proposito: es lo que habilita la FK compuesta de la seccion
-- 5, que impide que un compromiso cuelgue del requerimiento de OTRO evento.
-- ---------------------------------------------------------------------------
alter table public.requerimientos_evento
  add column if not exists area_solicitante_id uuid references public.areas(id),
  add column if not exists observaciones       text,
  add column if not exists activo              boolean not null default true,
  add column if not exists creado_por          uuid references public.perfiles(id),
  add column if not exists created_at          timestamptz not null default now(),
  add column if not exists updated_at          timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'requerimientos_evento_id_evento_uk'
  ) then
    alter table public.requerimientos_evento
      add constraint requerimientos_evento_id_evento_uk unique (id, evento_id);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 4. La reunion de agenda de eventos
--
-- Reunion periodica (sin cadencia fija, a diferencia del Monitoreo semanal o
-- del Seguimiento cada 6 semanas) coordinada por Coordinacion, con
-- representantes de varias areas, donde se revisan los proximos eventos, su
-- planificacion y las necesidades que cada uno genera.
--
-- Tabla propia y NO una fila de `mesas`: en el vocabulario institucional
-- «mesa» son las mesas de barrio popular (Esperanza, EDLA, Favelita). Reusar
-- esa tabla obligaria a excluir la reunion de eventos de cada filtro por mesa,
-- para siempre.
-- ---------------------------------------------------------------------------
create table if not exists public.reuniones_evento (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  asistentes text,
  temas      text,
  activo     boolean not null default true,
  creado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agenda de la reunion: que eventos se trataron. M:N — una reunion repasa
-- varios eventos y un mismo evento se trata en varias reuniones sucesivas (la
-- de dos semanas antes, la de la semana anterior, etc.).
create table if not exists public.reuniones_evento_eventos (
  reunion_evento_id uuid not null references public.reuniones_evento(id) on delete cascade,
  evento_id         uuid not null references public.eventos(id) on delete cascade,
  primary key (reunion_evento_id, evento_id)
);


-- ---------------------------------------------------------------------------
-- 5. compromisos: el origen nuevo, el evento y el requerimiento
--
-- Tres columnas con roles distintos, y la diferencia importa:
--
--  · `id_reunion_evento_origen` es el ORIGEN — de donde salio el compromiso.
--    Entra al mismo CHECK de origen unico que los otros tres.
--  · `evento_id` es el OBJETO — sobre que evento es. Queda FUERA del CHECK,
--    igual que `proyecto_id`, para que sean validos los tres casos: acordado
--    en reunion sobre un evento (las dos cargadas), cargado a mano sobre un
--    evento sin pasar por reunion (solo evento_id) y acuerdo general de la
--    reunion que no es de ningun evento puntual (solo el origen).
--  · `requerimiento_id` es el item de checklist que se escalo a compromiso
--    con fecha (ej. «20 vallas» pasa a compromiso porque Seguridad todavia no
--    confirmo). Opcional: la mayoria se resuelve sin generar compromiso.
-- ---------------------------------------------------------------------------
alter table public.compromisos
  add column if not exists id_reunion_evento_origen uuid references public.reuniones_evento(id) on delete set null,
  add column if not exists evento_id                uuid references public.eventos(id) on delete set null,
  add column if not exists requerimiento_id         uuid;

-- El CHECK de origen unico pasa a contar cuatro columnas. Se reemplaza en vez
-- de agregarse otro: dos CHECK sobre lo mismo se contradicen apenas alguien
-- toque uno solo.
alter table public.compromisos
  drop constraint if exists compromisos_origen_unico;

alter table public.compromisos
  add constraint compromisos_origen_unico check (
    num_nonnulls(id_seguimiento_origen, id_tema_origen, id_reunion_origen, id_reunion_evento_origen) <= 1
  );

-- Si hay `requerimiento_id`, tiene que ser un requerimiento del MISMO
-- `evento_id` — nunca de otro. Con `evento_id` nulo la FK no se evalua (MATCH
-- SIMPLE), asi que un compromiso sin evento sigue siendo valido.
--
-- OJO con el `on delete set null`: una FK compuesta no puede anular una sola
-- de sus columnas, asi que borrar un requerimiento tambien deja en null el
-- `evento_id` del compromiso, y se pierde sobre que evento era. En la practica
-- casi no muerde porque `requerimientos_evento` ahora tiene `activo` y se da
-- de baja logica, no se borra. Si algun dia se borran de verdad, conviene
-- revisar esto.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compromisos_requerimiento_fk'
  ) then
    alter table public.compromisos
      add constraint compromisos_requerimiento_fk
      foreign key (requerimiento_id, evento_id)
      references public.requerimientos_evento(id, evento_id) on delete set null;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. RLS de las dos tablas nuevas
--
-- Misma regla que `mesas` y `reuniones_mesa`, que son el circuito analogo: lee
-- cualquiera logueado, escribe admin. Sin esto las tablas quedarian legibles y
-- escribibles con la clave anonima, que viaja dentro del JavaScript del portal
-- — el agujero que cerro 0026.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['reuniones_evento', 'reuniones_evento_eventos']
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
-- 7. Auditoria de la reunion
--
-- `reuniones_evento` se suma a la lista de 0017 por el mismo motivo que
-- `reuniones_mesa`: es un registro de gestion y hay que poder saber quien
-- cambio que. La tabla puente no se audita — no tiene contenido propio, solo
-- ata dos ids, y su alta y baja ya se leen en la reunion.
-- ---------------------------------------------------------------------------
drop trigger if exists auditar_reuniones_evento on public.reuniones_evento;
create trigger auditar_reuniones_evento
  after insert or update or delete on public.reuniones_evento
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
