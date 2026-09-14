-- ---------------------------------------------------------------------------
-- 0029_proyectos_drive.sql — la carpeta de Drive de cada proyecto.  14/09/2026
--
-- La ficha de un programa de posicionamiento tiene que poder llevar a la
-- carpeta donde estan los archivos de ese programa —notas, convenios,
-- documentacion de la postulacion—. Hoy esa direccion no vive en ningun lado:
-- se la pasan por chat cada vez que alguien la necesita.
--
-- Va en `proyectos` y no en una tabla aparte porque los programas de
-- posicionamiento SON proyectos de la base maestra (programa =
-- 'Posicionamiento'). De paso queda disponible para cualquier otro proyecto:
-- una obra tambien tiene su carpeta.
--
-- Opcional a proposito: la carpeta casi nunca existe el dia que se carga el
-- proyecto, y exigirla obligaria a inventar una.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.proyectos
  add column if not exists url_drive text;

comment on column public.proyectos.url_drive is
  'Carpeta de Drive con los archivos del proyecto. Opcional.';

notify pgrst, 'reload schema';
