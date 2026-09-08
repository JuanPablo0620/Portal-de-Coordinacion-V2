-- ---------------------------------------------------------------------------
-- 0004_eventos.sql — lo que le falta al esquema para que Eventos escriba
-- de verdad en Supabase.  08/09/2026
--
-- Primera tanda de la migración de la escritura: hasta hoy el portal guarda
-- todo en el navegador de cada uno, así que un evento que carga uno no lo ve
-- nadie más. Eventos va primero por ser el módulo más chico y autocontenido:
-- sirve de prueba piloto del circuito completo (leer, escribir, traducir entre
-- las dos formas) sobre algo de bajo riesgo.
--
-- Al comparar la colección local contra la tabla de 0001 aparecieron tres
-- huecos. Los tres se cierran acá.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. `requerimientos_evento` no tiene con qué dar de baja una fila
--
-- El portal no borra nunca: da de baja lógica, poniendo `activo = false`. Es la
-- regla del sistema entero -- «el borrado físico no existe», dice
-- `repositorio.js`. Pero esta tabla salió de 0001 sin la columna, así que
-- quitar un requerimiento no tendría cómo registrarse: o se borraba de verdad,
-- perdiendo el rastro de que alguna vez se pidió, o no se podía quitar.
-- ---------------------------------------------------------------------------
alter table public.requerimientos_evento
  add column if not exists activo boolean not null default true;

comment on column public.requerimientos_evento.activo is
  'Baja logica. El portal nunca borra filas: las marca inactivas y dejan de '
  'contar en el checklist, pero queda el rastro de que se pidieron.';


-- ---------------------------------------------------------------------------
-- 2. El catálogo de ítems está vacío
--
-- `requerimientos_evento.item_id` apunta a `items_requerimiento`, que 0001
-- creó pero nunca sembró: hoy no hay un solo ítem al que apuntar, así que no
-- se podría cargar ningún requerimiento. Se siembra con los once que el portal
-- ya usa (`CATALOGOS_SEMILLA` en `src/datos/catalogos.js`).
--
-- «Corte de calle» no es un requerimiento como los otros: pedirlo no dibuja
-- nada, es la bandera de que el evento necesita un corte, que después se carga
-- en el módulo de Mapa. El front lo trata distinto (ver `ITEM_CORTE` en
-- FormularioEvento.jsx), pero en el catálogo es una fila más.
-- ---------------------------------------------------------------------------
-- El `unique` de la tabla esta en `slug`, no en `nombre`, y `slug` es
-- obligatorio: por eso van los dos y el `on conflict` es por slug. El slug es
-- la clave estable -- si alguien renombra «Gacebos» a «Gazebos», el slug no
-- cambia y los requerimientos ya cargados siguen apuntando bien.
insert into public.items_requerimiento (slug, nombre) values
  ('sonido',       'Sonido'),
  ('escenario',    'Escenario'),
  ('sillas',       'Sillas'),
  ('vallado',      'Vallado'),
  ('banios',       'Baños químicos'),
  ('seguridad',    'Seguridad'),
  ('limpieza',     'Limpieza'),
  ('gacebos',      'Gacebos'),
  ('energia',      'Energía'),
  ('difusion',     'Difusión'),
  ('corte_calle',  'Corte de calle')
on conflict (slug) do update set nombre = excluded.nombre;


-- ---------------------------------------------------------------------------
-- 3. El vínculo con un proyecto no se puede guardar todavía
--
-- `eventos.proyecto_id` es una clave foránea a `proyectos(id)`, que son uuid.
-- Pero los proyectos del portal viven en el navegador y tienen ids de otra
-- forma («OBR-2026-003»), sin ninguna correspondencia con los 87 que se
-- cargaron en Supabase el 04/09. Guardar el vínculo hoy es imposible: la clave
-- foránea rechazaría el valor.
--
-- Esta columna es el puente mientras dure la transición. Guarda el id local tal
-- como lo eligió la persona, para que el dato no se pierda entre que se migra
-- Eventos y se migra Proyectos. Cuando Proyectos entre a Supabase, se resuelve
-- cada uno contra su uuid, se llena `proyecto_id` y esta columna se elimina.
--
-- Va con nombre feo y comentario largo a propósito: es deuda, y tiene que
-- gritar que lo es para que nadie la tome por parte del modelo.
-- ---------------------------------------------------------------------------
alter table public.eventos
  add column if not exists proyecto_ref_local text;

comment on column public.eventos.proyecto_ref_local is
  'TEMPORAL - id de proyecto del almacenamiento del navegador (ej. OBR-2026-003), '
  'mientras proyectos no este migrado a Supabase. Al migrar proyectos hay que '
  'resolverlo contra proyectos.id, llenar proyecto_id y BORRAR esta columna. '
  'No construir nada nuevo sobre este campo.';


-- ---------------------------------------------------------------------------
-- 4. Políticas para las dos tablas
--
-- Mismo criterio que 0003_rls.sql: lee cualquiera con sesión activa, escribe
-- `admin`/`coordinacion`. `intendencia` y `jefe_gabinete` no aparecen, así que
-- RLS les niega la escritura por defecto.
--
-- `items_requerimiento` es catálogo: lo toca solo admin, como el resto.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['eventos', 'requerimientos_evento', 'items_requerimiento']
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
