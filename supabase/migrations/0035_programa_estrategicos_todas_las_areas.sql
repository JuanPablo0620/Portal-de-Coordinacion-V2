-- ---------------------------------------------------------------------------
-- 0035_programa_estrategicos_todas_las_areas.sql — «Proyectos estrategicos»
-- en todas las secretarias, no solo en Coordinacion.  14/09/2026
--
-- 0034 lo creo unicamente en Coordinacion, partiendo de que la cartera
-- estrategica la administra esa secretaria. Pero el proyecto estrategico NO es
-- de Coordinacion: es de Obras, de Salud o de quien lo ejecuta, y Coordinacion
-- solo lo sigue de cerca. Con el programa en una sola area, dar de alta un
-- proyecto estrategico de Obras obligaba a elegir entre colgarlo de un programa
-- sectorial que no le corresponde o cambiarle el area, que es peor: lo saca de
-- los tableros de su propia secretaria.
--
-- Asi que cada area tiene el suyo. Son homonimos a proposito y la base los
-- distingue sin ambiguedad: el unique de `programas` es (area_id, nombre), no
-- el nombre solo, y el portal ya filtra el desplegable por area — nunca se ven
-- dos «Proyectos estrategicos» juntos en la misma lista.
--
-- Se corre sobre TODAS las areas activas, incluida Coordinacion: el
-- `on conflict` deja pasar la que 0034 ya creo, asi que no hay que acordarse de
-- cual falta ni mantener una lista aparte que se desactualice cuando se agregue
-- una secretaria.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------
insert into public.programas (area_id, nombre, descripcion)
select a.id,
       'Proyectos estratégicos',
       'Proyectos de la cartera estratégica que no dependen de un programa sectorial.'
  from public.areas a
 where a.activa
on conflict (area_id, nombre) do nothing;

notify pgrst, 'reload schema';
