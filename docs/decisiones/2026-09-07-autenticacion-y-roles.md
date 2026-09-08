# 07/09/2026 — Autenticación, roles y por qué el acceso falla cerrado

> Extraído de `docs/traspaso-07-09-autenticacion.md` el 08/09/2026 para que las
> decisiones no vivan solamente dentro de un traspaso. Si algo quedó mal
> resumido, manda el traspaso.

---

## Contexto

Hasta el 07/09 el portal no tenía autenticación: `config.usuario` era un campo de
texto libre y cualquiera escribía el nombre que quisiera, así que la bitácora no
registraba nada verificable. Además, la escritura contra Supabase estaba cerrada
justamente por eso (ver `2026-09-04-supabase-como-backend.md`).

## Decisión 1 — Login con mail y contraseña, no con Google

Se evaluó Google OAuth y **se descartó**: el equipo no tiene dominio institucional
propio, son cuentas `@gmail.com` sueltas. Google no puede filtrar por dominio, así
que cualquiera con una cuenta de Google podría autenticarse y lo único que lo
frenaría sería la lista blanca.

Con mail y contraseña, y el registro público desactivado, **no existe ningún camino
por el cual un desconocido pueda crearse una cuenta**. Menos piezas, menos formas
de equivocarse.

Si algún día el municipio saca dominio propio, migrar a Google no obliga a rehacer
nada: cambia la pantalla de login y nada más.

**Consecuencia operativa:** no hay recuperación de contraseña por mail, porque no
se configuró servicio de correo. La resetea un admin desde Authentication → Users.

## Decisión 2 — El acceso falla cerrado

Sin variables de Supabase configuradas, el portal **no deja entrar a nadie**
(`src/estado/sesion.js`).

La alternativa tentadora era que, sin configuración, cayera al comportamiento
viejo sin login. Sería un error grave: bastaría con que se borre una variable de
entorno en Vercel para que producción quedara abierta sin que nadie se entere. Es
preferible que el portal no arranque.

**No revertir esto** para hacer más cómodo el desarrollo local. Para trabajar en
local hace falta un `.env.local` propio; los nombres están en `.env.example`.

## Decisión 3 — La guarda de acceso va en `App.jsx`, no por ruta

Una guarda por ruta es una lista que hay que acordarse de actualizar, y la ruta
que alguien se olvide de agregar queda abierta sin que se note.

## Decisión 4 — Cinco roles, dos de ellos dormidos

| Rol | Quiénes | Puede |
|---|---|---|
| `admin` | Los 6 de Control de Gestión | Todo, más administrar usuarios y catálogos |
| `jefe_gabinete` | 1 persona | Leer todo. Escribir **solo** los campos estratégicos, vía función |
| `intendencia` | 2 personas | Solo lectura |
| `coordinacion` | nadie | Sinónimo exacto de `admin`, sin usar |
| `area` | nadie | Definido pero dormido |

**Se colapsaron `coordinacion` y `admin`** porque en la práctica hacían lo mismo.
No se borró `coordinacion` del enum: Postgres no permite quitar valores de un tipo
enumerado sin recrearlo y reescribir cada columna que lo usa. Dejarlo sin usar es
gratis.

**El rol `area` queda escrito y listo.** El día que una secretaría entre a cargar
sus propios datos, es agregar una fila a la lista blanca — no tocar SQL.

## Decisión 5 — Los proyectos estratégicos se tocan por función, no por política RLS

"Proyectos Estratégicos" no es una tabla: son diez columnas dentro de `proyectos`.
RLS decide **por fila, no por columna**, así que no hay forma de escribir una
política que diga "este rol puede tocar estas diez columnas y ninguna otra". Darle
`UPDATE` sobre `proyectos` al jefe de gabinete lo habilitaría a cambiar el nombre,
el estado o la secretaría de cualquier proyecto.

Por eso el `UPDATE` directo le queda cerrado y la única puerta son
`marcar_estrategico()` y `quitar_estrategico()`, que verifican el rol de quien
llama.

**Beneficio lateral:** esas funciones completan solas `estrategico_marcado_por` y
`estrategico_marcado_en`, dos campos que existían desde `0001` y que no llenaba
nadie.

## Decisión 6 — Las funciones de sesión van `SECURITY DEFINER`

`mi_rol()`, `mi_area()`, `es_admin()`. No es un atajo: una política sobre
`perfiles` que consultara `perfiles` para averiguar el rol se llama a sí misma y
Postgres la aborta por recursión. Corriendo como dueño, leen salteando RLS y
cortan el ciclo. Es el patrón estándar de Supabase.

## Decisión 7 — El listado del equipo no se commitea

El repositorio es público en GitHub (verificado contra la API). Commitear los
nueve mails —personales, de agentes municipales, incluido el del intendente— los
publicaría de forma permanente: el historial de git no se borra aunque después se
saque el archivo.

El listado vive en `supabase/datos/usuarios-autorizados.local.sql`, excluido por
el patrón `*.local.sql`.

**Quedó abierta la pregunta de si el repo debería seguir siendo público.** Es un
sistema de gestión municipal; no hay nada que ganar con que sea abierto.

## Hallazgo: las migraciones `0002`–`0009` nunca habían existido

`0001_esquema.sql` referenciaba en un comentario un `0003_rls.sql`, y varias
sesiones daban por escritos nueve archivos de migración. Se verificó contra todas
las ramas y todo el historial: **solo existía `0001`.** Los otros ocho se
diseñaron en alguna sesión y nunca se escribieron a disco.

Por eso RLS estaba activado sin políticas: no era un descuido en el dashboard, era
que el archivo que debía crearlas no se escribió nunca.

Se escribieron `0002_auth.sql` (aplicado) y `0003_rls.sql` (pendiente de aplicar).

**La lección, que vale más que el hallazgo:** una decisión conversada con la IA y
no escrita a disco no existe. Es exactamente el problema que `docs/traspaso-actual.md`
y esta carpeta vienen a resolver.
