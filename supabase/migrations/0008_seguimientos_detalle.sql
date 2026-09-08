-- 0008_seguimientos_detalle.sql — conservar los bloques de una minuta
--
-- El front ya separa una minuta en avances y problemas. El esquema original
-- guardaba el texto crudo y el resumen, pero no esos dos bloques; sin estas
-- columnas la migración perdería información que después usa el historial.

alter table public.seguimientos
  add column if not exists temas text,
  add column if not exists avances jsonb not null default '[]'::jsonb,
  add column if not exists problemas jsonb not null default '[]'::jsonb;
