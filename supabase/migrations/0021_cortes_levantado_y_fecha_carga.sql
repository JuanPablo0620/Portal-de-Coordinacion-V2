-- ---------------------------------------------------------------------------
-- 0021_cortes_levantado_y_fecha_carga.sql — dos campos que el portal escribe y
-- la base no tenia donde guardar.  10/09/2026
--
-- Salieron de auditar coleccion por coleccion que campos LEE y ESCRIBE el
-- portal contra los que el traductor lleva a la base. Los dos se perdian en
-- silencio: no rompian nada visible, simplemente no llegaban.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Cuando se levanto un corte
--
-- `levantarCorte()` guarda el dia en que se levanto, y con razon: un corte
-- levantado el miercoles con vigencia hasta el domingo, sin esa fecha, figura
-- en el historico como que corto toda la semana.
--
-- La columna nunca existio. El campo viajaba en el payload y se descartaba.
-- ---------------------------------------------------------------------------
alter table public.cortes
  add column if not exists levantado_en date;

comment on column public.cortes.levantado_en is
  'Dia en que se levanto el corte, si se levanto antes de su fecha de fin. Sin '
  'esto el historico cuenta como cortada toda la vigencia planificada.';


-- ---------------------------------------------------------------------------
-- 2. Cuando se cargo un proyecto
--
-- `fecha_carga` no es decorativa: `FichaProyecto` la muestra y, sobre todo,
-- `selectores.js` FILTRA los proyectos por rango de fechas usando este campo.
-- Sin el, el filtro por periodo de la base maestra no puede funcionar --
-- compara contra `undefined` en cada fila.
--
-- Podria haberse derivado de `created_at`, que es cuando entro la fila. No se
-- hizo porque no siempre coinciden: la importacion de planillas la fija en la
-- fecha de inicio del proyecto, a proposito, para que un CSV historico no
-- aparezca todo cargado el dia que se importo.
--
-- Los 87 que ya estan se completan con su `created_at`, que para ellos SI es
-- el dia en que se cargaron.
-- ---------------------------------------------------------------------------
alter table public.proyectos
  add column if not exists fecha_carga date;

update public.proyectos
   set fecha_carga = created_at::date
 where fecha_carga is null;

alter table public.proyectos
  alter column fecha_carga set default current_date;

comment on column public.proyectos.fecha_carga is
  'Dia en que el proyecto entro al sistema. Distinto de created_at: la '
  'importacion de planillas la fija en la fecha de inicio, para que un CSV '
  'historico no figure todo cargado el dia de la importacion. La usa el filtro '
  'por periodo de la base maestra.';

create index if not exists proyectos_fecha_carga_idx
  on public.proyectos (fecha_carga);

notify pgrst, 'reload schema';
