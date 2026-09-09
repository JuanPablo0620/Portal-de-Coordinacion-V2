-- ---------------------------------------------------------------------------
-- 0015_posicionamiento_completo.sql — lo que le falta a Posicionamiento para
-- poder vivir en Supabase.  09/09/2026
--
-- Posicionamiento es uno de los cuatro modulos que todavia guardan en el
-- navegador de cada persona: lo que carga uno no lo ve nadie mas y se pierde si
-- limpia el navegador. La tabla existe en la base desde 0001, vacia y sin usar.
--
-- Al comparar el formulario contra la tabla aparecio por que nunca se migro:
-- el front usa catorce campos y la tabla tiene ocho. Faltan nueve.
--
-- No es que el esquema estuviera mal: se escribio antes de que el modulo
-- creciera, y el modulo creció donde era barato hacerlo -- en el navegador,
-- donde agregar un campo no cuesta nada porque no hay esquema que respetar.
-- Es la deuda tipica de un modulo que nunca salio de localStorage.
--
-- Mesas de trabajo, en cambio, NO necesita migracion: sus campos ya coinciden.
-- Solo le falta el traductor.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Los campos que faltaban
--
-- `tipo` va como texto y no como catalogo con tabla propia, igual que
-- `eventos.tipo`: es una lista corta que administra el area desde Configuracion
-- y no tiene relaciones colgando. Normalizarlo seria mas prolijo y hoy no
-- compra nada.
--
-- `ods` son los Objetivos de Desarrollo Sostenible, del 1 al 17. Van como
-- arreglo de enteros porque eso es: una seleccion de numeros de una lista fija
-- y universal, que no cambia y no tiene atributos propios.
-- ---------------------------------------------------------------------------
alter table public.proyectos_posicionamiento
  add column if not exists tipo             text,
  add column if not exists referente        text,
  add column if not exists descripcion      text,
  add column if not exists fecha_inicio     date,
  add column if not exists fecha_limite     date,
  add column if not exists fecha_resolucion date,
  add column if not exists resultado        text,
  add column if not exists ods              integer[] not null default '{}';

comment on column public.proyectos_posicionamiento.ods is
  'Objetivos de Desarrollo Sostenible asociados, del 1 al 17.';

comment on column public.proyectos_posicionamiento.resultado is
  'Que se consiguio. Se completa cuando la accion llega a un estado resuelto '
  '(vigente, cerrada, no prospero).';

-- El objetivo ya existia desde 0001 con otro nombre en la cabeza de quien lo
-- escribio: la tabla lo llama `objetivo` y el formulario `descripcion`. Se deja
-- constancia para que el traductor no invente una tercera version.
comment on column public.proyectos_posicionamiento.objetivo is
  'Lo que se espera conseguir. En el formulario del portal es un campo aparte '
  'de `descripcion`: objetivo es la meta, descripcion es de que se trata.';


-- ---------------------------------------------------------------------------
-- 2. Los proyectos vinculados
--
-- Una accion de posicionamiento puede empujar varios proyectos de la cartera, y
-- un proyecto puede aparecer en varias acciones. Es una relacion de muchos a
-- muchos, y va como tabla puente igual que `mesas_proyectos` (0001), no como
-- arreglo de ids adentro de la fila.
--
-- La diferencia importa: con tabla puente, borrar un proyecto limpia solo el
-- vinculo y la base garantiza que no queden referencias a proyectos que ya no
-- existen. Con un arreglo de uuid, esa consistencia hay que sostenerla a mano y
-- tarde o temprano queda algun id colgado apuntando a la nada.
-- ---------------------------------------------------------------------------
create table if not exists public.posicionamiento_proyectos (
  posicionamiento_id uuid not null
                     references public.proyectos_posicionamiento(id) on delete cascade,
  proyecto_id        uuid not null
                     references public.proyectos(id) on delete cascade,
  primary key (posicionamiento_id, proyecto_id)
);


-- ---------------------------------------------------------------------------
-- 3. Permisos
--
-- Mismo criterio que el resto: lee cualquiera con sesion, escribe admin. Se
-- incluyen tambien las tablas de mesas, que estaban sin politicas porque el
-- modulo nunca habia salido del navegador y nadie las habia necesitado.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'proyectos_posicionamiento', 'actualizaciones_posicionamiento',
    'posicionamiento_proyectos', 'organismos',
    'mesas', 'reuniones_mesa', 'mesas_proyectos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "lectura logueados" on public.%I', t);
    execute format(
      'create policy "lectura logueados" on public.%I '
      'for select to authenticated using (public.mi_rol() is not null)', t);

    execute format('drop policy if exists "escritura admin" on public.%I', t);
    execute format(
      'create policy "escritura admin" on public.%I for all to authenticated '
      'using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
