-- ---------------------------------------------------------------------------
-- 0005_areas_nombre_formal.sql — las áreas tienen dos nombres, y hacen falta
-- los dos.  08/09/2026
--
-- Apareció al migrar Eventos: el desplegable del portal ofrece «Secretaría de
-- Obras» y la base guarda «Obras». No coincide NINGUNO de los siete, así que
-- elegir una secretaría al cargar un evento cortaba con error y la única forma
-- de guardar era dejar el campo vacío.
--
-- El problema de fondo no es que uno de los dos esté mal: los dos nombres son
-- correctos y se usan para cosas distintas, tal como está documentado en el
-- glosario de la Dirección:
--
--   - El nombre CORTO («Obras») es el que se usa en los sheets de carga, en los
--     `_db` de cada área y en las consultas del día a día.
--   - El nombre FORMAL («Secretaría de Obras») es el que va en informes,
--     presentaciones y todo deliverable institucional.
--
-- Hasta ahora cada sistema tenía uno solo y por eso no se hablaban. La tabla
-- pasa a tener los dos, que además la vuelve la única fuente de verdad: hoy la
-- denominación formal vive hardcodeada en `src/datos/catalogos.js`, donde nadie
-- del área la puede corregir.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Tildes que faltaban en la semilla de 0001
--
-- «Coordinacion» y «Trabajo y Produccion» se cargaron sin tilde. Son nombres de
-- secretarías del municipio: mal escritos terminan en un informe para el
-- intendente. Se corrigen por `slug`, que es la clave estable -- ningún dato
-- apunta a estas filas por su nombre, todos por `id`, así que renombrarlas no
-- rompe nada.
-- ---------------------------------------------------------------------------
update public.areas set nombre = 'Coordinación'         where slug = 'coordinacion';
update public.areas set nombre = 'Trabajo y Producción' where slug = 'trabajo_y_produccion';


-- ---------------------------------------------------------------------------
-- 2. La denominación formal
--
-- Los valores salen del catálogo que el portal viene usando
-- (`CATALOGOS_SEMILLA.areas`). «Coordinación» es la excepción: no lleva
-- «Secretaría de» adelante porque en el portal figura así, y porque la
-- Dirección de Control de Gestión depende de la Secretaría de Coordinación --
-- no son la misma cosa. Se deja tal cual está y se confirma con el área antes
-- de usarlo en un informe.
-- ---------------------------------------------------------------------------
alter table public.areas
  add column if not exists nombre_formal text;

comment on column public.areas.nombre_formal is
  'Denominacion institucional completa, para informes y presentaciones. '
  '`nombre` es la forma corta que se usa en los sheets y en las consultas. '
  'Los dos son correctos: ver el glosario de la Direccion de Control de Gestion.';

update public.areas set nombre_formal = v.formal
from (values
  ('ambiente',             'Secretaría de Ambiente y Servicios Públicos'),
  ('capital_humano',       'Secretaría de Capital Humano'),
  ('obras',                'Secretaría de Obras'),
  ('salud',                'Secretaría de Salud'),
  ('seguridad',            'Secretaría de Seguridad'),
  ('trabajo_y_produccion', 'Secretaría de Trabajo y Producción'),
  ('coordinacion',         'Coordinación')
) as v(slug, formal)
where public.areas.slug = v.slug;
