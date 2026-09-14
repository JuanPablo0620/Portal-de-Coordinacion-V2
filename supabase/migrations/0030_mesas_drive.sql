-- ---------------------------------------------------------------------------
-- 0030_mesas_drive.sql — la carpeta de Drive de cada mesa.  14/09/2026
--
-- 0028 le dio carpeta a cada REUNION de mesa: los archivos de esa reunion
-- puntual —acta, fotos, listado de asistentes—. Falta la de la mesa entera,
-- que es otra cosa: donde vive lo que no es de una reunion sino del espacio
-- (el convenio que la crea, el padron de referentes barriales, los mapas).
--
-- Mismo criterio que 0028 y 0029: texto libre y opcional. La carpeta casi
-- nunca existe el dia que se crea la mesa.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.mesas
  add column if not exists url_drive text;

comment on column public.mesas.url_drive is
  'Carpeta de Drive de la mesa. Distinta de la de cada reunion (ver 0028). Opcional.';

notify pgrst, 'reload schema';
