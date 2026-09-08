# Traspaso lunes 07/09/2026 — el portal tiene login real

**Para:** JP.
**De:** Tomás + Claude, sesión del lunes 07/09.
**Continúa:** `traspaso-04-09-supabase-en-vivo.md` (tu sesión del viernes).

**Titular:** el portal pasó de no tener autenticación a tener login real con
nueve usuarios, roles y perfiles. Está desplegado en producción. Falta un solo
paso para cerrar el circuito: aplicar `0003_rls.sql`.

**Cuidado con esto:** desde hoy el portal **pide login**. Cualquiera que tuviera
el link y lo estuviera mirando sin cuenta, ya no entra. Las nueve personas de la
lista sí, con la contraseña inicial que reparte Tomás.

---

## 1. Estado verificado, no supuesto

Todo lo que sigue se comprobó contra la base y contra producción, no es "debería
andar":

| Qué | Estado |
|---|---|
| `main` local = `origin/main` | `5de3565` |
| Bundle en producción | `index-DpljS26Z.js`, MD5 idéntico al build local |
| `0002_auth.sql` en Supabase | Aplicado |
| Cuentas creadas | 9 |
| Perfiles creados por el trigger | 9 (6 `admin`, 1 `jefe_gabinete`, 2 `intendencia`) |
| Registro público | Desactivado (`signup_disabled`) |
| `npm test` | 323 de 323 |
| `npm run verificar` | Completa (incluye humo y accesibilidad) |
| `0003_rls.sql` | **Escrito, NO aplicado** |

---

## 2. Lo primero que hubo que arreglar: el repo estaba desincronizado

Antes de tocar nada, tres cosas de tu traspaso no coincidían con la realidad, y
conviene que las sepas porque explican media hora perdida:

1. **Decías que el push fue a `fork`.** Fue a `origin`/`oficial`
   (JuanPablo0620). El `fork` de Tomás (TRLaise) había quedado 34 commits atrás.
2. **La copia local de Tomás estaba en `a50e208`**, sin tus 10 commits del
   viernes. Por eso al principio parecía que `supabaseClient.js` y la carpeta
   `carga-inicial/` no existían. Se resolvió con un `git pull` limpio.
3. **Las claves no estaban en `.secrets/`** de este workspace — esa carpeta no
   existe acá. Eran de tu máquina. Tomás sacó la `anon` del dashboard.

Nada de esto invalidó tu trabajo: los datos que cargaste están todos y los
números dieron exactos (87 proyectos, 130 compromisos, 61 programas, 3 mesas).

**El bloqueo de Postgres se confirma también desde la máquina de Tomás:** puertos
5432 y 6543 cerrados, 443 abierto. Sigue valiendo tu regla: todo por API REST.

---

## 3. Se corrigió algo que faltaba de tu sesión: las variables en Vercel

Quedaba sin confirmar. **No estaban puestas.** Se verificó objetivamente: el
bundle de producción no contenía la URL de Supabase, o sea que se compiló sin
las variables. Se cargaron `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en
Vercel y se redeployó.

Detalle que puede hacerte perder tiempo: **agregar variables en Vercel no
reconstruye nada**. Estas se incrustan en el JavaScript al compilar, así que hay
que forzar un Redeploy destildando "Use existing Build Cache". Si no, el sitio
sigue sirviendo el build viejo.

---

## 4. El hallazgo grande: `0002`–`0009` nunca existieron

`0001_esquema.sql` referencia en un comentario un `0003_rls.sql`, y la memoria
del proyecto daba por escritos nueve archivos de migración. **Se verificó contra
todas las ramas y todo el historial de git: solo existe `0001`.** Los otros ocho
se diseñaron en alguna sesión y nunca se escribieron a disco.

Por eso RLS estaba activado sin políticas, como habías detectado: no era un
descuido de Tomás en el dashboard, era que el archivo que debía crearlas no se
escribió nunca.

Se escribieron dos de ellos.

---

## 5. `0002_auth.sql` — identidad (APLICADO)

Cierra el hueco entre `auth.users` (que administra Supabase) y `public.perfiles`
(que `0001` declaraba pero nadie llenaba).

- **Lista blanca** (`usuarios_autorizados`) con las nueve personas.
- **Trigger sobre `auth.users`**: al crearse una cuenta, busca el mail en la
  lista y arma el perfil con su rol. Si el mail no figura, **aborta la creación
  de la cuenta**.
- **Funciones de sesión**: `mi_rol()`, `mi_area()`, `es_admin()`.
- **RLS sobre `perfiles` y la lista blanca.**
- **`debe_cambiar_password`** y `marcar_password_cambiada()`.

**Por qué las funciones van `SECURITY DEFINER`:** no es un atajo. Una política
sobre `perfiles` que consultara `perfiles` para averiguar el rol se llama a sí
misma y Postgres la aborta por recursión. Corriendo como dueño, leen salteando
RLS y cortan el ciclo. Es el patrón estándar de Supabase.

**El archivo es re-ejecutable** (`create table if not exists`, `insert on
conflict`, `create or replace`, `add column if not exists`). Correrlo de nuevo no
rompe nada.

---

## 6. `0003_rls.sql` — permisos (ESCRITO, SIN APLICAR)

**Es el único paso que falta.** Ver la sección 10.

Contiene las políticas de escritura por rol y dos funciones para los proyectos
estratégicos.

**Por qué los estratégicos van por función y no por política:** "Proyectos
Estratégicos" no es una tabla, son diez columnas dentro de `proyectos`. RLS
decide **por fila, no por columna**: no hay forma de escribir una política que
diga "este rol puede tocar estas diez columnas y ninguna otra". Darle `UPDATE`
sobre `proyectos` al jefe de gabinete lo habilitaría a cambiar el nombre, el
estado o la secretaría de cualquier proyecto. Por eso el `UPDATE` directo le
queda cerrado y la única puerta son `marcar_estrategico()` y
`quitar_estrategico()`, que verifican el rol de quien llama.

**Beneficio lateral:** esas funciones completan solas `estrategico_marcado_por` y
`estrategico_marcado_en`, dos campos que existen desde `0001` y que hoy no llena
nadie. Vas a saber quién marcó cada proyecto y cuándo.

---

## 7. Los nueve usuarios y sus roles

Decisiones tomadas con Tomás:

| Rol | Quiénes | Puede |
|---|---|---|
| `admin` | Los 6 de Control de Gestión | Todo, más administrar usuarios y catálogos |
| `jefe_gabinete` | Valentino | Leer todo. Escribir **solo** los campos estratégicos, vía función |
| `intendencia` | Marcos y Rodrigo | Solo lectura |
| `coordinacion` | nadie | Sinónimo exacto de `admin` en las políticas, sin usar |
| `area` | nadie | Definido pero **dormido** — hoy carga solo Control de Gestión |

**Se colapsaron `coordinacion` y `admin`** por decisión de Tomás: en la práctica
hacían lo mismo. No se borró `coordinacion` del enum porque Postgres no permite
quitar valores de un tipo enumerado sin recrearlo y reescribir cada columna que
lo usa. Dejarlo sin usar es gratis.

**El rol `area` queda escrito y listo.** El día que una secretaría entre a cargar
sus propios datos, es agregar una fila a la lista blanca — no tocar SQL.

### Login con mail y contraseña, no con Google

Se evaluó Google OAuth y se descartó: **el equipo no tiene dominio institucional
propio**, son cuentas `@gmail.com` sueltas. Google no puede filtrar por dominio,
así que cualquiera con una cuenta de Google podría autenticarse y lo único que lo
frenaría sería la lista blanca.

Con mail y contraseña y el registro público desactivado, **no existe ningún
camino por el cual un desconocido pueda crearse una cuenta**. Menos piezas, menos
formas de equivocarse. Si algún día el municipio saca dominio propio, migrar a
Google no obliga a rehacer nada: cambia la pantalla de login y nada más.

---

## 8. El front

- `src/estado/sesion.js` — la sesión y el perfil.
- `src/modulos/acceso/Login.jsx` — pantalla de ingreso.
- `src/modulos/acceso/CambiarPassword.jsx` — cambio forzado en el primer ingreso.
- Guarda de acceso en `App.jsx`.
- `config.usuario` reemplazado por el usuario real de la sesión.

**Tres decisiones que conviene revisar:**

1. **Falla cerrada.** Sin configuración de Supabase, el portal no deja entrar a
   nadie, en vez de volver al comportamiento viejo sin login. Si no fuera así,
   bastaría con que se borre una variable de entorno en Vercel para que
   producción quedara abierta sin que nadie se entere.

2. **La guarda está en `App.jsx`, no por ruta.** Una guarda por ruta es una lista
   que hay que acordarse de actualizar, y la que se olvide queda abierta.

3. **Alcance real: esto da identidad, no seguridad.** Los datos que hoy muestra
   el portal viven en `localStorage`, en el navegador de cada uno, y se ven desde
   la consola sin pasar por el login. Lo que se gana es saber **quién** carga
   cada cosa, que es lo que `config.usuario` no podía. La seguridad es la de la
   base, y es `0003_rls.sql`.

**Se migraron las áreas de «Mis áreas».** Estaban guardadas contra el nombre
viejo de texto libre; al entrar por primera vez se mudan solas al nombre de la
sesión. Sin eso, quien tenía tres secretarías elegidas abría el portal y las veía
vacías.

---

## 9. El listado del equipo NO está en el repo

**El repositorio del portal es público en GitHub.** Se verificó contra la API, no
se supuso. Commitear los nueve mails —personales, de agentes municipales,
incluido el del intendente— los publicaría de forma permanente: el historial de
git no se borra aunque después se saque el archivo.

El listado vive en `supabase/datos/usuarios-autorizados.local.sql`, excluido por
`.gitignore` (`*.local.sql`).

**Consecuencia para vos:** si clonás o pulleás, no vas a tener ese archivo. No lo
necesitás para nada del día a día — la lista ya está cargada en Supabase. Solo
hace falta para dar de alta gente nueva, y en ese caso pedíselo a Tomás.

**Vale la pena discutir si el repo debería seguir siendo público.** Es un sistema
de gestión municipal; no hay nada que ganar con que sea abierto, y sí bastante
que perder.

---

## 10. Lo único que falta: aplicar `0003_rls.sql`

**El orden importa y ya se cumplió la condición previa:** el login está
desplegado en producción. Ahora sí se puede cerrar la lectura pública sin dejar a
nadie sin datos.

**Antes de aplicarlo:**

1. Entrar a `portal-de-coordinacion-v2.vercel.app`, loguearse, cambiar la
   contraseña inicial.
2. Ir a "Vigentes (Supabase)" y confirmar que se ven los 87 proyectos y los 130
   compromisos.

**Aplicarlo:** pegar `supabase/migrations/0003_rls.sql` en el SQL Editor y correr.

**Después de aplicarlo:** volver a "Vigentes (Supabase)". Si sigue mostrando los
datos **estando logueado**, las políticas funcionan. Si querés confirmarlo sin
depender de la pantalla, probá abrir el portal en una ventana de incógnito: no
debería mostrar nada.

---

## 11. Lo demás que sigue pendiente

En orden de lo que más desbloquea:

1. **Aplicar `0003_rls.sql`** (arriba).
2. **Escritura desde el portal.** Con `0003` aplicado, la base ya acepta que un
   `admin` escriba. Pero el portal todavía guarda en `localStorage`: falta
   conectar la escritura real. Es el trabajo grande, el de migrar
   `repositorio.js` de síncrono a async y revisar sus ~40 consumidores.
3. **Decidir el `tipo_id` de las 8 filas corregidas** (Cartelería, Cuadrilla
   Municipal, Intervenciones Contratadas, Obras Particulares, Restauración casona
   Bosch, OC, Licencias de conducir, Obras de mantenimiento). Siguen con
   `tipo_id = 'Obra'` y `es_obra = false`.
4. **Los 15 proyectos sin cargar** (`02b`/`02c` en `carga-inicial/`). Los tres de
   Salud —Presentismo, Turnos efectivos, Uso de Agenda— parecen colgar de un
   programa real, no de "Agenda".
5. **Contenedores sin lugar en el modelo** (`Reportes MI3F`, `Agenda Roco`,
   `Informe de Estadísticas Generales`).

---

## 12. Cosas chicas encontradas de paso

Ninguna urgente, todas anotadas para no perderlas:

1. **124 de los 130 compromisos no tienen fecha límite.** Fue decisión tuya y
   está bien, pero tiene una consecuencia: la alerta por vencimiento se *deduce*
   de esa fecha, así que **hoy la función de alertas no opera sobre el 95% de los
   datos**. Solo los 6 del PDF de Obras la tienen.
2. **Los 130 compromisos están sin responsable.** El `_db` no lo registra.
3. **Un proyecto tiene comillas dobles espurias en el nombre**, arrastradas del
   CSV: `"Plan Estratégico de los Espacios de Primera Infancia (EPIs)"`.
4. **`marcarEstrategico()` del front escribe dos campos que no existen** en el
   esquema: `id_origen_estrategico` y `fecha_marcado_estrategico`. El segundo es
   un problema de nombre — en la base se llama `estrategico_marcado_en`.
5. **El front manda `origen_estrategico: 'base'`**, pero el enum `origen_carga`
   solo acepta `monitoreo` o `seguimiento`. La base lo va a rechazar cuando ese
   módulo se migre.
6. **Python está como `py`, no como `python`**, en la máquina de Tomás. Los
   scripts del viernes se corren con `py scripts/cargar_supabase.py`.
7. **La rama `feat/autenticacion`** quedó en GitHub, ya fusionada en `main`. Es
   redundante, se puede borrar.

---

## 13. Para probarlo, lo más rápido

No hace falta tocar nada técnico: entrar a
`portal-de-coordinacion-v2.vercel.app` con tu mail y la contraseña inicial que
te pasa Tomás. Te va a pedir elegir una nueva antes de dejarte entrar.

Si además querés el código local:

```
git checkout main
git pull
npm install
```

Y necesitás tu propio `.env.local` con `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` (hay un `.env.example` con los nombres). Sin eso el
portal local no deja entrar a nadie — es el "falla cerrada" del punto 8.

### Para dar de alta a alguien nuevo

1. Agregar la fila en `supabase/datos/usuarios-autorizados.local.sql`.
2. Correr ese archivo en el SQL Editor.
3. Recién ahí crear la cuenta en Authentication → Users, con "Auto Confirm User"
   tildado.

Si el mail no está en la lista, el paso 3 falla — es el trigger funcionando.

### Para dar de baja

No alcanza con sacarlo de la lista blanca: hay que poner `perfiles.activo =
false`. Eso corta el acceso de inmediato sin borrarle la cuenta.

### Si alguien pierde la contraseña

No hay recuperación por mail: no se configuró servicio de correo. Se la resetea
un admin desde Authentication → Users.

---

*Recibido de Tomás el 08/09/2026 y guardado acá por JP, junto al traspaso del
04/09 al que continúa.*
