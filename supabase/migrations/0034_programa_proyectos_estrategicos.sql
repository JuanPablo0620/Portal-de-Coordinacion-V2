-- ---------------------------------------------------------------------------
-- 0034_programa_proyectos_estrategicos.sql — un programa para la cartera
-- estrategica, en Coordinacion.  14/09/2026
--
-- Los proyectos que se declaran estrategicos no cuelgan de ningun programa: el
-- desplegable de Programa, filtrado por area, no ofrece ninguno que les
-- corresponda, asi que quedan sueltos o colgados de un programa ajeno.
--
-- «Proyectos estrategicos» en Coordinacion es ese lugar. Va como programa y no
-- como una marca aparte porque ya existe el campo `es_estrategico`: el programa
-- dice de donde cuelga administrativamente el proyecto, el campo dice si la
-- gestion lo mira de cerca. Son dos preguntas distintas y conviene que sigan
-- siendolo.
--
-- Va por migracion y no cargandolo a mano desde Configuracion —que desde 0025
-- tambien se puede— para que este igual en cualquier base donde se corra el
-- esquema, incluidas las de prueba.
--
-- Es re-ejecutable: `on conflict` sobre el unique (area_id, nombre) de 0001.
-- ---------------------------------------------------------------------------
insert into public.programas (area_id, nombre, descripcion)
select a.id,
       'Proyectos estratégicos',
       'Proyectos de la cartera estratégica que no dependen de un programa sectorial.'
  from public.areas a
 where a.slug = 'coordinacion'
on conflict (area_id, nombre) do nothing;

notify pgrst, 'reload schema';
