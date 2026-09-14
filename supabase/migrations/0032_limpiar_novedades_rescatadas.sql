-- ---------------------------------------------------------------------------
-- 0032_limpiar_novedades_rescatadas.sql — sacarles los saltos de linea que
-- 0031 les dejo pegados.  14/09/2026
--
-- 0031 rescato las novedades que habian quedado dentro de `descripcion` y las
-- separo con `trim()`. El detalle es que en Postgres `trim(texto)` saca
-- ESPACIOS y nada mas: los saltos de linea sobreviven. Como el formato que
-- dejaba el portal era `\n\n[DD/MM/AAAA] texto`, cada novedad que no era la
-- ultima se llevo los dos saltos de la siguiente.
--
-- Se ve en la base: «Posiblemente el 14/10. hay que ver necesidades\n\n».
-- En pantalla eso es un par de renglones vacios colgando de un comentario.
--
-- No afecta a lo que se cargue de ahora en adelante: el front ya hace `.trim()`
-- de JavaScript sobre la novedad, y ese si saca todo el espacio en blanco. Esto
-- es solo para las filas que ya estan.
--
-- Se corrige acá y NO editando 0031, que ya esta corrida: una migracion
-- aplicada es historia.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Los comentarios
--
-- `E'[ \t\r\n]+'` en vez de `trim()` justamente porque `trim()` es el que no
-- alcanza. Se limpia de los dos lados y se colapsa lo que quede vacio a null:
-- un comentario que era solo saltos de linea no es un comentario.
-- ---------------------------------------------------------------------------
update public.actualizaciones_compromisos
   set comentarios = nullif(regexp_replace(comentarios, E'^[ \t\r\n]+|[ \t\r\n]+$', '', 'g'), '')
 where comentarios is not null
   and comentarios <> regexp_replace(comentarios, E'^[ \t\r\n]+|[ \t\r\n]+$', '', 'g');


-- ---------------------------------------------------------------------------
-- 2. Las descripciones
--
-- Mismo problema en el otro extremo de 0031: al recortarle a la descripcion
-- todo lo que venia despues del primer `[DD/MM/AAAA]`, el nombre quedo con los
-- saltos de linea que separaban el nombre de la primera novedad.
-- ---------------------------------------------------------------------------
update public.compromisos
   set descripcion = regexp_replace(descripcion, E'^[ \t\r\n]+|[ \t\r\n]+$', '', 'g')
 where descripcion is not null
   and descripcion <> regexp_replace(descripcion, E'^[ \t\r\n]+|[ \t\r\n]+$', '', 'g');
