-- ---------------------------------------------------------------------------
-- 0011_eventos_rango_y_secretaria_general.sql — eventos de varios días y
-- nueva área organizadora. 08/09/2026
--
-- `fecha` sigue siendo el primer día para no romper los registros existentes.
-- `fecha_hasta` es opcional: en null, el evento dura un solo día.
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.eventos
  add column if not exists fecha_hasta date;

-- Las marcas son el puente usado por el front cuando la migración todavía no
-- podía ejecutarse desde la red municipal. Se pasan a su columna definitiva.
update public.eventos
set
  fecha_hasta = ((regexp_match(descripcion, '\[\[portal_fecha_hasta:([0-9]{4}-[0-9]{2}-[0-9]{2})\]\]\s*$'))[1])::date,
  descripcion = nullif(trim(regexp_replace(
    descripcion,
    '(\r?\n){0,2}\[\[portal_fecha_hasta:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\]\s*$',
    ''
  )), '')
where descripcion ~ '\[\[portal_fecha_hasta:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\]\s*$';

alter table public.eventos
  drop constraint if exists eventos_fecha_hasta_valida;

alter table public.eventos
  add constraint eventos_fecha_hasta_valida
  check (fecha_hasta is null or fecha_hasta >= fecha);

comment on column public.eventos.fecha_hasta is
  'Ultimo dia inclusive de un evento de varios dias. Null significa que ocurre solo en fecha.';

insert into public.areas (slug, nombre, nombre_formal, orden, activa)
values ('secretaria_general', 'Secretaría General', 'Secretaría General', 8, true)
on conflict (slug) do update set
  nombre = excluded.nombre,
  nombre_formal = excluded.nombre_formal,
  activa = true;
