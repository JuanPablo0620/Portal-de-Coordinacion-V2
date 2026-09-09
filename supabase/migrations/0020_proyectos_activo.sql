-- ---------------------------------------------------------------------------
-- 0020_proyectos_activo.sql — dar de baja un proyecto vuelve a hacer algo.
-- 09/09/2026
--
-- `bajaProyecto()` escribe `activo: false`, pero `proyectos` nunca tuvo esa
-- columna: 0001 le puso `estado_general` (vigente | finalizado) y nada mas. El
-- campo se descartaba al guardar y, aunque no se descartara, la lectura lo
-- pisaba: el traductor devolvia `activo: true` fijo.
--
-- Resultado: un proyecto dado de baja seguia apareciendo en todas las listas,
-- los tableros y los selectores.
--
-- POR QUE UNA COLUMNA NUEVA Y NO REUSAR `estado_general`
--
-- Son dos cosas distintas y mezclarlas ensucia los numeros:
--
--   `estado_general = finalizado`  el proyecto TERMINO. Es un logro de gestion
--                                  y cuenta en los informes de cumplimiento.
--   `activo = false`               el proyecto NO DEBERIA ESTAR: se cargo mal,
--                                  esta duplicado, se dio de alta por error.
--
-- Mapear la baja a «finalizado» habria evitado esta migracion, pero pondria
-- proyectos mal cargados en la cuenta de proyectos cumplidos -- justamente los
-- numeros que despues se le muestran al intendente.
--
-- Es la misma convencion que ya tienen `eventos`, `compromisos`, `mesas`,
-- `cortes` y el resto: el borrado fisico no existe en el sistema, todo es baja
-- logica.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.proyectos
  add column if not exists activo boolean not null default true;

comment on column public.proyectos.activo is
  'Baja logica. false = el proyecto no deberia estar (mal cargado, duplicado). '
  'Distinto de estado_general = finalizado, que es un proyecto que TERMINO y '
  'cuenta en los informes de cumplimiento.';

-- Los 87 que ya estan cargados quedan activos, que es lo que son. El default
-- solo aplica a las filas nuevas, asi que hay que decirlo explicitamente.
update public.proyectos set activo = true where activo is null;

create index if not exists proyectos_activo_idx
  on public.proyectos (activo) where activo;

notify pgrst, 'reload schema';
