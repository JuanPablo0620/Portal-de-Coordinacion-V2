-- ---------------------------------------------------------------------------
-- 0007_id_legible.sql — los 87 proyectos necesitan su identificador visible.
-- 08/09/2026
--
-- El portal identifica cada proyecto con un código tipo `OBR-2026-014`, y no es
-- decorativo: se muestra como chip en la tabla y **el color sale del prefijo**,
-- así que de un vistazo se ve de qué secretaría es cada fila.
--
-- La tabla ya tenía la columna (`id_legible`, marcada en 0001 como «cosmetico:
-- NO es la PK»), pero el cargador del 04/09 no la completaba: los 87 proyectos
-- reales están con el campo vacío. Sin esto, al conectar el portal a Supabase
-- la columna de ID sale en blanco y se pierde el color por secretaría.
--
-- La clave primaria sigue siendo el `uuid`. Esto es la etiqueta que ve la
-- gente, y por eso puede regenerarse sin romper ninguna referencia.
--
-- Es re-ejecutable: solo toca las filas que todavía no tienen código, y numera
-- a partir del último usado de cada prefijo y año, así nunca repite uno.
-- ---------------------------------------------------------------------------

-- El prefijo sale del área, que en el modelo se alcanza por el programa:
-- proyecto → programa → área. Es la misma cadena que resolvió a mano el
-- cargador de Python, porque Postgres directo estaba bloqueado por el firewall.
with contexto as (
  select p.id,
         a.prefijo,
         extract(year from coalesce(p.fecha_inicio, p.created_at))::int as anio
  from public.proyectos p
  join public.programas g on g.id = p.programa_id
  join public.areas a     on a.id = g.area_id
  where p.id_legible is null
),
-- Desde dónde seguir numerando. Si ya hay `OBR-2026-014`, el próximo es el 15:
-- reiniciar en 1 crearía duplicados en la segunda corrida.
ultimo as (
  select c.prefijo,
         c.anio,
         coalesce(max(substring(p.id_legible from '[0-9]+$')::int), 0) as tope
  from contexto c
  left join public.proyectos p
    on p.id_legible like c.prefijo || '-' || c.anio || '-%'
  group by c.prefijo, c.anio
),
numerados as (
  select c.id,
         c.prefijo,
         c.anio,
         u.tope + row_number() over (partition by c.prefijo, c.anio order by c.id) as n
  from contexto c
  join ultimo u on u.prefijo = c.prefijo and u.anio = c.anio
)
update public.proyectos p
   set id_legible = n.prefijo || '-' || n.anio || '-' || lpad(n.n::text, 3, '0')
  from numerados n
 where p.id = n.id;


-- Chequeo: después de correr esto no debería quedar ningún proyecto sin código.
-- Si devuelve algo, es que su programa no tiene área asignada.
select count(*) as proyectos_sin_id_legible
from public.proyectos
where id_legible is null;
