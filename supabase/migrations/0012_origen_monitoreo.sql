-- ---------------------------------------------------------------------------
-- 0012_origen_monitoreo.sql — qué se hizo en cada monitoreo.  09/09/2026
--
-- La pestaña «Últimos monitoreos» describía cada reunión contando TEMAS, que ya
-- no se cargan: la sección está desactivada en `CargarMonitoreo.jsx` detrás de
-- un `{false && …}`. Por eso los monitoreos nuevos aparecían con cero en todo.
--
-- Hoy un monitoreo es dos cosas: avances de proyectos y compromisos nuevos.
-- Ninguna de las dos deja rastro de en qué monitoreo ocurrió:
--
--   * `actualizaciones` no tiene con qué apuntar al monitoreo.
--   * `compromisos` tiene columnas de origen para seguimiento, tema y reunión
--     de mesa -- pero no para monitoreo. `crearCompromisoDirecto()` ya le pasa
--     el id, y se perdía en el camino porque no había dónde guardarlo.
--
-- Sin este vínculo no se puede responder «¿qué se hizo en la reunión del 8?»,
-- que es exactamente lo que la pantalla tiene que mostrar.
--
-- Las dos columnas son nullable: los avances y compromisos cargados desde otras
-- pantallas no vienen de un monitoreo, y eso es correcto, no un dato faltante.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. De qué monitoreo salió cada avance
--
-- `on delete set null` y no `cascade`: si algún día se borra un monitoreo, el
-- avance del proyecto NO se borra con él. El avance es un hecho de gestión --
-- se bachearon 500 m² --, y sigue siendo cierto aunque se pierda el registro de
-- la reunión donde se informó.
-- ---------------------------------------------------------------------------
alter table public.actualizaciones
  add column if not exists monitoreo_id uuid
  references public.monitoreos(id) on delete set null;

comment on column public.actualizaciones.monitoreo_id is
  'Monitoreo en el que se informo este avance. Null = se cargo desde otra '
  'pantalla (ficha del proyecto, seguimiento), que es un caso legitimo.';

create index if not exists actualizaciones_monitoreo_idx
  on public.actualizaciones (monitoreo_id) where monitoreo_id is not null;


-- ---------------------------------------------------------------------------
-- 2. De qué monitoreo salió cada compromiso
--
-- Se suma como cuarta columna de origen, al lado de las tres que ya existían.
-- Hay que rehacer el check que garantiza que el origen sea uno solo: si no, un
-- compromiso podría quedar colgando de un seguimiento Y de un monitoreo a la
-- vez, y ninguno de los dos informes lo contaría bien.
-- ---------------------------------------------------------------------------
alter table public.compromisos
  add column if not exists id_monitoreo_origen uuid
  references public.monitoreos(id) on delete set null;

comment on column public.compromisos.id_monitoreo_origen is
  'Monitoreo donde nacio el compromiso. Distinto de id_tema_origen: ese es el '
  'tema que lo origino, este es la reunion. Un compromiso cargado a mano en el '
  'monitoreo no tiene tema.';

alter table public.compromisos
  drop constraint if exists compromisos_origen_unico;

alter table public.compromisos
  add constraint compromisos_origen_unico check (
    num_nonnulls(
      id_seguimiento_origen,
      id_tema_origen,
      id_reunion_origen,
      id_monitoreo_origen
    ) <= 1
  );

create index if not exists compromisos_monitoreo_idx
  on public.compromisos (id_monitoreo_origen) where id_monitoreo_origen is not null;


-- ---------------------------------------------------------------------------
-- 3. «Cargado por» NO necesita migración
--
-- La columna de la pantalla mostraba siempre un guión, y se podría haber
-- supuesto que faltaba el campo. No falta: `monitoreos.creado_por` existe desde
-- 0001. Lo que faltaba era usarla — `supabaseMonitoreos.js` no la traía en su
-- SELECT ni la escribía al crear. Se arregla en el front, no acá.
--
-- Queda anotado para que nadie vuelva a buscarle una migración.
--
-- Los monitoreos ya cargados quedan sin autor: no se puede saber quién los hizo
-- y no se va a inventar.
-- ---------------------------------------------------------------------------
