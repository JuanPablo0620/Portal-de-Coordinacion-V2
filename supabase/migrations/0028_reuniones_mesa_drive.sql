-- ---------------------------------------------------------------------------
-- 0028_reuniones_mesa_drive.sql — link a la carpeta de Drive de cada
-- reunión de mesa.  11/09/2026
--
-- La ficha de una mesa va a mostrar el historial de reuniones con su fecha y
-- un acceso directo a la carpeta de Drive de esa reunión en particular (actas,
-- fotos, lo que se haya subido). No hay dónde guardar ese link hoy.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------
alter table public.reuniones_mesa
  add column if not exists url_drive text;

comment on column public.reuniones_mesa.url_drive is
  'Link a la carpeta de Drive de esta reunión en particular. Opcional, texto libre.';

notify pgrst, 'reload schema';
