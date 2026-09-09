-- ---------------------------------------------------------------------------
-- 0019_cortes_geometria.sql — lo que el mapa necesita para dibujar el corte.
-- 09/09/2026
--
-- Los cortes se guardaban bien y aparecian en la lista, pero no se dibujaban en
-- el mapa. Falta lo unico que el mapa mira para trazarlos.
--
-- Al armar `0016` mire los campos que usa el FORMULARIO y di por hecho que
-- `tramos` + `cuadras` alcanzaban para reconstruir el dibujo. No alcanzan:
-- `datosDeSeleccion()` devuelve ademas un objeto `geometria` con las
-- coordenadas ya resueltas, y `Mapa.jsx` traza desde `corte.geometria.lineas`,
-- no desde las cuadras. Sin esa columna el traductor lo descartaba y el corte
-- llegaba a la base sin con que dibujarse.
--
-- La leccion, por si sirve para las que vengan: mirar los campos del formulario
-- no alcanza. Hay que mirar tambien que campos LEE la pantalla que muestra el
-- dato, que no son los mismos.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.cortes
  -- Las coordenadas del trazado, ya resueltas contra el callejero: `{ lineas }`
  -- para un tramo de calle, `{ punto }` para un corte puntual. Es lo que el
  -- mapa dibuja, y por eso no se puede derivar de `cuadras` en el momento: las
  -- cuadras son referencias al callejero, no geometria.
  add column if not exists geometria jsonb,

  -- `tramo` o `punto`. Decide si el corte se dibuja como linea o como marcador,
  -- y de que campo sale su titulo.
  add column if not exists forma text not null default 'tramo',

  -- Un corte cargado antes de la seleccion por cuadras tiene el trazado dibujado
  -- a mano y no calcado del callejero. Se marca para no dar por exacta una linea
  -- que es orientativa.
  add column if not exists trazado_aproximado boolean not null default false;

comment on column public.cortes.geometria is
  'Coordenadas del trazado: { lineas } para un tramo, { punto } para un corte '
  'puntual. Es lo que dibuja el mapa. No se deriva de `cuadras`: esas son '
  'referencias al callejero, no geometria.';

notify pgrst, 'reload schema';
