-- ---------------------------------------------------------------------------
-- 0023_auditoria_autor.sql — que se pueda saber QUIEN hizo cada cambio.  10/09/2026
--
-- `auditoria.usuario_id` guarda el `auth.uid()` de quien hizo el cambio desde
-- que 0017 puso el trigger. Lo que nunca tuvo es la clave foranea hacia
-- `perfiles`: la columna se declaro en 0001 como un uuid suelto.
--
-- Para Postgres eso alcanza —el dato esta ahi— pero PostgREST arma los embeds
-- (`autor:perfiles(nombre)`) leyendo las claves foraneas del esquema. Sin la
-- restriccion no hay relacion que encontrar, y toda consulta que pida el autor
-- falla entera con PGRST200. Por eso el portal mostraba
-- «Could not find a relationship between 'auditoria' and 'perfiles'»: no era
-- un problema de cache, era una relacion que no existia.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Huerfanos
--
-- Una FK no se puede agregar si alguna fila apunta a un perfil inexistente.
-- Puede haberlos: el trigger guarda `auth.uid()` sin verificar nada, y un
-- usuario borrado de `perfiles` deja su uuid colgado en la auditoria.
--
-- Se pasan a null en vez de borrar la fila: el uuid de alguien que ya no esta
-- no identifica a nadie, pero QUE se cambio y CUANDO sigue siendo el registro
-- que esta tabla existe para guardar. Perder el autor es aceptable; perder el
-- asiento, no.
-- ---------------------------------------------------------------------------
update public.auditoria a
   set usuario_id = null
 where a.usuario_id is not null
   and not exists (select 1 from public.perfiles p where p.id = a.usuario_id);


-- ---------------------------------------------------------------------------
-- 2. La clave foranea
--
-- `on delete set null` y no `cascade`: si se da de baja un perfil, sus asientos
-- de auditoria tienen que sobrevivir. Borrar el usuario no puede ser una forma
-- de borrar el rastro de lo que hizo.
-- ---------------------------------------------------------------------------
alter table public.auditoria
  drop constraint if exists auditoria_usuario_id_fkey;

alter table public.auditoria
  add constraint auditoria_usuario_id_fkey
  foreign key (usuario_id) references public.perfiles(id) on delete set null;


-- ---------------------------------------------------------------------------
-- 3. Que el autor se pueda leer
--
-- La politica de `perfiles` decide si el embed devuelve el nombre o null. Si
-- alguien que puede leer la auditoria no puede leer los perfiles, el autor
-- sale vacio y la bitacora queda anonima. Solo `admin` lee la auditoria (0017),
-- asi que alcanza con que admin lea los perfiles.
--
-- No se crea la politica acá: 0003 ya la definio. Esto solo verifica, y avisa
-- en el log si falta, en vez de fallar silenciosamente en produccion.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'perfiles' and cmd = 'SELECT'
  ) then
    raise warning 'perfiles no tiene politica de lectura: la bitacora va a mostrar los autores vacios';
  end if;
end $$;

notify pgrst, 'reload schema';
