-- ---------------------------------------------------------------------------
-- 0018_cortes_cuadras.sql — la columna que 0016 no llego a agregar.
-- 09/09/2026
--
-- POR QUE HACE FALTA ESTE ARCHIVO
--
-- `0016_cortes_de_calle.sql` se entrego sin la columna `cuadras`. Se agrego
-- despues, al escribir el traductor, editando el mismo archivo -- que para
-- entonces ya se habia corrido.
--
-- Ese es el problema: `0016` crea la tabla con `create table if not exists`.
-- En una base donde la tabla ya existe, Postgres saltea el bloque ENTERO y las
-- columnas nuevas que se le hayan agregado adentro nunca se aplican. El archivo
-- queda describiendo una tabla que no es la que hay.
--
-- Es la misma clase de error que rompio el portal esta manana con
-- `descripcion_estrategica`, con la diferencia de que ahi el sintoma fue
-- inmediato. Vale la pena que quede escrito: **una migracion que alguien ya
-- corrio no se edita, se corrige con una nueva**, aunque el cambio sea de una
-- linea y aunque el archivo tenga `if not exists` por todos lados.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

alter table public.cortes
  add column if not exists cuadras jsonb not null default '[]'::jsonb;

comment on column public.cortes.cuadras is
  'Las cuadras concretas que abarca el corte, seleccionadas sobre el callejero '
  'oficial. Van aparte de `tramos` porque son la unidad real: los tramos las '
  'agrupan por calle para mostrarlas, pero lo que se dibuja en el mapa es esto.';

notify pgrst, 'reload schema';
