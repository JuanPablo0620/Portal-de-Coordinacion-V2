-- ---------------------------------------------------------------------------
-- 0033_notas_proyecto.sql — notas y recordatorios de un proyecto.  14/09/2026
--
-- Lo que resuelve: en Proyectos estrategicos hace falta anotar cosas que no
-- cuelgan de ningun compromiso. «El contacto de Compras cambio», «las fotos
-- estan en tal carpeta», «preguntar en el seguimiento del 24 si Vialidad
-- respondio». Hoy eso no tiene donde vivir: o se escribe en `observaciones`
-- del proyecto —que es un solo campo y se pisa— o queda en un papel.
--
-- Una nota con fecha es un RECORDATORIO. No hay una marca aparte que decidir:
-- `fecha_recordatorio` nula significa nota suelta, y con fecha sube al panel
-- del tablero con el color que le corresponda segun cuanto falte. Una decision
-- menos al cargar, y un estado imposible menos (marcado como recordatorio pero
-- sin fecha).
--
-- Por que una sola tabla y no dos, a diferencia de los compromisos: ahi
-- `actualizaciones_compromisos` existe porque la novedad es un hecho NUEVO que
-- se suma sin tocar lo anterior, y lo que importa es la serie. Una nota es al
-- reves: se corrige y la corregida reemplaza a la vieja. No hay serie que
-- mostrar. El rastro de quien la edito ya lo da el trigger de auditoria de
-- 0017, al que esta tabla se engancha mas abajo.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. La tabla
--
-- `on delete cascade` en el proyecto: una nota sin el proyecto del que habla no
-- significa nada. Es la excepcion razonable a la baja logica del resto del
-- sistema, y en la practica no se ejecuta nunca porque el portal tampoco borra
-- proyectos de verdad.
--
-- `creado_por` se guarda aunque hoy la pantalla la use una sola persona: el dia
-- que la use otra, el dato ya va a estar. Mostrarlo o no es cosa del front.
-- ---------------------------------------------------------------------------
create table if not exists public.notas_proyecto (
  id                 uuid primary key default gen_random_uuid(),
  proyecto_id        uuid not null references public.proyectos(id) on delete cascade,
  texto              text not null,
  fecha_recordatorio date,            -- null = nota suelta, con fecha = recordatorio
  activo             boolean not null default true,
  creado_por         uuid references public.perfiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.notas_proyecto is
  'Notas de un proyecto, sin relacion con sus compromisos. Con fecha_recordatorio es un recordatorio y entra al panel del tablero estrategico.';
comment on column public.notas_proyecto.fecha_recordatorio is
  'Null = nota suelta. Con fecha = recordatorio; el color sale de cuantos dias falten, con la misma escala que el resto del portal.';

-- El panel del tablero pide los recordatorios vigentes de todos los proyectos
-- ordenados por fecha. Sin este indice eso recorre la tabla entera cada vez que
-- se entra a la pantalla.
create index if not exists notas_proyecto_recordatorio_idx
  on public.notas_proyecto (fecha_recordatorio)
  where fecha_recordatorio is not null and activo;

create index if not exists notas_proyecto_proyecto_idx
  on public.notas_proyecto (proyecto_id);


-- ---------------------------------------------------------------------------
-- 2. `updated_at` al dia
--
-- La tabla se edita en lugar de acumular filas, asi que sin esto no habria
-- forma de saber cuando se toco una nota por ultima vez.
-- ---------------------------------------------------------------------------
create or replace function public.tocar_nota_proyecto()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists tocar_notas_proyecto on public.notas_proyecto;
create trigger tocar_notas_proyecto
  before update on public.notas_proyecto
  for each row execute function public.tocar_nota_proyecto();


-- ---------------------------------------------------------------------------
-- 3. Quien la lee y quien la escribe
--
-- Lectura: cualquiera logueado, como el resto de las tablas de gestion.
--
-- Escritura: los mismos tres roles que pueden tocar la cartera estrategica en
-- `marcar_estrategico` (0013) — admin, coordinacion y jefe de gabinete. No es
-- una lista nueva: es la misma pantalla, y seria raro que alguien pudiera
-- declarar un proyecto estrategico pero no anotarle un recordatorio.
--
-- El rol `area` queda afuera a proposito: estas notas son de Coordinacion sobre
-- el proyecto, no del area que lo ejecuta.
-- ---------------------------------------------------------------------------
alter table public.notas_proyecto enable row level security;

drop policy if exists "lectura logueados" on public.notas_proyecto;
create policy "lectura logueados" on public.notas_proyecto
  for select to authenticated
  using (public.mi_rol() is not null);

drop policy if exists "escritura cartera" on public.notas_proyecto;
create policy "escritura cartera" on public.notas_proyecto
  for all to authenticated
  using (public.mi_rol() in ('admin', 'coordinacion', 'jefe_gabinete'))
  with check (public.mi_rol() in ('admin', 'coordinacion', 'jefe_gabinete'));


-- ---------------------------------------------------------------------------
-- 4. Que quede rastro de las ediciones
--
-- Esto es lo que reemplaza a una tabla de actualizaciones: el trigger generico
-- de 0017 guarda la fila entera antes y despues de cada cambio, asi que
-- corregir una nota deja asiento sin que haya que mantener una segunda tabla.
--
-- La funcion ya existe; aca solo se le engancha la tabla nueva.
-- ---------------------------------------------------------------------------
drop trigger if exists auditar_notas_proyecto on public.notas_proyecto;
create trigger auditar_notas_proyecto
  after insert or update or delete on public.notas_proyecto
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
