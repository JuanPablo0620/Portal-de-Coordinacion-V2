# Traspaso viernes 04/09/2026 — Supabase pasó a estar en vivo

**Para:** el Claude de Tomás, lunes 07/09/2026 a primera hora.
**De:** JP + Claude, sesión del viernes 04/09.
**Por qué existe este documento aparte:** el viernes pasó más en una sesión de
lo habitual — el jefe de JP pidió compromisos vigentes en el portal *ya*,
Tomás no estaba, y terminó desplegándose Supabase de verdad. Es autocontenido;
no hace falta haber leído la sesión completa, pero si algo no cierra, el
detalle está en `docs/traspaso-datos-reales.md` (28/08, contexto previo) y en
la conversación misma.

**Estado verificado al escribir esto (lunes, antes de arrancar):** repo
sincronizado (`main` local = `fork/main` = `ea9474b`), Supabase con RLS de
solo lectura activo y 87 proyectos / 130 compromisos visibles con la clave
`anon`. Lo único sin confirmar es si las variables de entorno ya están
puestas en Vercel — ver sección 5.

---

## 1. Qué pasó, en orden

1. **Análisis del repo**: Tomás había hecho 20 commits desde el 01/09 sin que
   JP los tuviera — entre ellos, **revirtió `puntuales` como tabla propia**
   (PR #4, commit `63226a4`) y avanzó bastante en Monitoreo (carga de
   compromisos de la ventana entre seguimientos, actualizar sin salir de la
   pantalla, fixes de scroll).
2. El jefe de JP pidió cargar a mano, desde PDF, compromisos de reuniones que
   nunca se habían cargado al sheet (se esperaba al portal). Se cruzaron
   contra el `_db` real antes de cargar nada — dos de los tres PDF no
   aportaban nada nuevo (ya estaban, con el mismo texto repetido semana a
   semana), el de Obras sí tenía 6 compromisos genuinamente nuevos.
3. JP pidió pasar de "datos en archivos" a "datos en Supabase, ya". Se
   desplegó la base real por primera vez.
4. Se conectó el portal a Supabase — acotado, solo lectura, una pantalla
   nueva — porque migrar el sistema entero a Supabase es un trabajo de días
   que no correspondía hacer sin que Tomás lo revise.
5. Se mergeó todo (los commits de JP + los 20 de Tomás) y se pusheó a `fork`.
   Vercel debería haber redesplegado solo.

---

## 2. El hallazgo grande: Postgres está bloqueado desde la red del municipio

Esto es importante porque **va a afectar a cualquiera que trabaje desde esa
misma red** (probablemente vos también, si estás en la oficina).

Se probaron los tres connection strings que ofrece Supabase — conexión
directa (5432), transaction pooler (6543), session pooler (5432) — **los tres
con timeout**. Diagnóstico: el firewall del municipio bloquea saliente
cualquier puerto de Postgres. El 443 (HTTPS) sale libre sin problema.

**Consecuencia práctica:** no se puede usar `psql`, ni un ORM con conexión
directa, ni ninguna herramienta que hable el protocolo Postgres nativo, desde
esa red. Lo que sí funciona es la **API REST de Supabase** (PostgREST, corre
sobre HTTPS) — es lo que se usó para toda la carga.

Si tu red es distinta (otra oficina, tu casa), probablemente no tengas este
problema y puedas conectar directo. Pero si trabajás desde la municipalidad,
arrancá asumiendo que Postgres directo no va a andar.

---

## 3. Supabase — estado real de la base

Proyecto: `bqwrnzjvkwtzlcnguwnz` (`PortalCoordinacion`, cuenta
`datoscoordinacion3f@gmail.com`, mail compartido del equipo).

### Lo que hay cargado

| Tabla | Filas |
|---|---:|
| `areas`, `ejes`, `estados`, `tipos_proyecto` | los seeds de `0001_esquema.sql`, sin tocar |
| `programas` | 61 |
| `proyectos` | 87 |
| `mesas` | 3 (Esperanza, EDLA, Favelita/El Libertador) |
| `compromisos` | 130 (124 del `_db` auditado + 6 del PDF de Obras del 20/08) |

**No existe la tabla `puntuales`** — la revirtió Tomás el 01/09. Los 8
puntuales del paquete de carga se cargaron como filas de `proyectos` con
`eje_id = 'Puntual'`, siguiendo ese mismo revert.

**18 proyectos quedaron sin cargar**, a propósito — están en
`supabase/datos/carga-inicial/02b-proyectos-SIN-PROGRAMA.csv` (10, sin
programa asignable) y `02c-proyectos-PROGRAMA-DUDOSO.csv` (5, su "programa"
era en realidad un lote de reunión, no un programa real) — más los 8
puntuales que si hubiera tocado excluir por falta de programa. Hay que
decidir con JP de qué programa cuelgan antes de cargarlos.

**Bug encontrado y corregido en caliente**: el generador del paquete asignaba
`es_obra` por *secretaría entera* (todo lo que carga Obras quedaba "obra"),
no por si el proyecto es una obra física. Se corrigieron 8 filas
(`es_obra: true → false` para Cartelería, Cuadrilla Municipal, Intervenciones
Contratadas, Obras Particulares, Restauración casona Bosch, OC, Licencias de
conducir, Obras de mantenimiento) directo en la base, vía API REST. **Quedó
pendiente**: esas mismas 8 siguen con `tipo_id = 'Obra'` en el catálogo, y
como el formulario del front autocompleta `es_obra` a partir del tipo, quedan
en un estado inconsistente hasta que alguien les asigne el tipo correcto
(¿Servicio? ¿Gestión interna?). Es una decisión por proyecto, no mecánica.

### RLS (seguridad de acceso)

**Antes del viernes, RLS estaba activado en producción sin ninguna
política** — ni una línea de `create policy` en `0001_esquema.sql`. Eso no es
"todo abierto": es lo contrario, **todo bloqueado**, incluida la lectura con
la clave `anon` (que es la que usa el frontend). Probablemente lo activó
Tomás manualmente en el dashboard, sin escribir políticas, y nunca quedó
reflejado en la migración — la base real y el archivo commiteado ya habían
divergido en esto.

**Se agregó una política de solo lectura** para las 9 tablas del núcleo
(`areas`, `programas`, `ejes`, `estados`, `tipos_proyecto`, `proyectos`,
`mesas`, `compromisos`, `reuniones_mesa`): cualquiera puede `SELECT`, nadie
puede escribir. El SQL vive en
`supabase/datos/carga-inicial/05-politica-rls-lectura.sql` y ya está aplicado
(verificado hoy lunes: la clave `anon` ve las 87+130 filas, y un intento de
`INSERT` sigue devolviendo `42501 row-level security policy`).

**Por qué solo lectura y no escritura también**: el portal no tiene login
real — `config.usuario` es un campo de texto libre, cualquiera puede poner el
nombre que quiera. La clave `anon` viaja en el bundle del frontend, es
pública de hecho. Abrir escritura sin verificar identidad dejaría cualquier
compromiso o proyecto municipal editable por cualquiera con el link del
portal. **Esto lo decidió JP explícitamente** cuando se le preguntó — eligió
"solo lectura" sobre "lectura y escritura abiertas". Si el plan es agregar
autenticación real (Supabase Auth, roles por secretaría), ahí es donde entra:
las políticas de escritura se agregan atadas a `auth.uid()` o a un rol, no
abiertas a `anon`.

### Cómo se cargó, ya que Postgres directo no anda

Con la clave `service_role` (salta RLS) contra la API REST, resolviendo las
relaciones (área→programa→proyecto) en Python en vez de con `JOIN` de SQL.
Las herramientas quedaron en el repo:

- `scripts/supabase_toolkit.py` — cliente mínimo (`tabla()`, `insertar()`,
  `upsert()`) contra PostgREST.
- `scripts/cargar_supabase.py` — el cargador del paquete completo, con una
  pasada de **validación obligatoria** antes de escribir (resuelve todos los
  nombres contra los catálogos reales; si algo no matchea, no escribe nada).

Las claves (`service_role`, `anon`, y el connection string de Postgres que
resultó inútil) están en `.secrets/` de este mismo workspace, no en el repo
del portal — mismo patrón que las credenciales de Google. Pedirle a JP el
acceso si hace falta usarlas desde otra sesión.

---

## 4. El portal — nueva pantalla "Vigentes (Supabase)"

**No es la migración completa del sistema.** JP quería conectar todo el
portal a Supabase; se le explicó que eso es reescribir ~40 funciones de
`repositorio.js` de síncronas a async y revisar cada componente que las
consume — trabajo de días, para que **vos lo revises**, no para hacerlo a las
apuradas un viernes. JP estuvo de acuerdo con ese límite.

Lo que sí se hizo: una pantalla nueva, **aislada**, que lee directo de
Supabase sin tocar ni depender de nada más del sistema. El resto del portal
sigue exactamente igual que lo dejaste — `localStorage`, `repositorio.js`,
todo tal cual.

### Archivos nuevos

- `src/datos/supabaseClient.js` — el cliente (`@supabase/supabase-js`, recién
  agregado a `package.json`). Tiene el razonamiento del punto de RLS en un
  comentario largo, por si hace falta revisarlo.
- `src/datos/vigentesSupabase.js` — lee `proyectos` y `compromisos`, arma la
  forma que ya esperan los selectores existentes. **Importante**: reusa
  `estadoCompromiso()` y `nivelPorDias()` de `selectores.js` tal cual, sin
  reimplementarlos — son funciones puras que solo necesitan
  `{ estado, fecha_limite }` y no les importa si el dato vino de
  `localStorage` o de Supabase. Es la prueba de que la lógica de negocio no
  hay que reescribirla si el día de mañana se migra todo de verdad.
- `src/modulos/vigentes-supabase/VigentesSupabase.jsx` — la pantalla. Dos
  tablas (compromisos, proyectos), botón de refrescar, sin ninguna acción de
  carga ni edición.
- Ruta agregada en `App.jsx`, entrada de menú en `Layout.jsx` ("Vigentes
  (Supabase)", ícono de nube).

### Otro cambio de configuración necesario, por dev

`.env.local` (no versionado — hay un `.env.example` con las variables que
hacen falta) con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. **Cada quien
necesita el suyo** — pedirle la clave `anon` a JP si hace falta correr el
portal local con datos reales. La `service_role` NUNCA va en el frontend, ni
en `.env.local`, ni en ningún archivo que Vite empaquete — esa es
exclusivamente de los scripts de Python.

---

## 5. Lo único sin confirmar: si Vercel ya tiene las variables de entorno

El push a `fork/main` se hizo el viernes y Vercel debería haber redesplegado
solo. Pero el sitio en producción **no comparte el `.env.local`** de la
máquina de JP — sin que alguien cargue `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` en el dashboard de Vercel (Project Settings →
Environment Variables) y redeploye, la pantalla "Vigentes (Supabase)" en
`portal-de-coordinacion-v2.vercel.app` va a mostrar el aviso de error ("no
está configurado"), no un crash, pero tampoco datos.

Quedó sin verificar si JP ya lo hizo durante el fin de semana. **Primer paso
de hoy: abrir `portal-de-coordinacion-v2.vercel.app/vigentes-supabase` y
mirar.** Si sigue en rojo, cargar esas dos variables en Vercel con los
valores de `.secrets/supabase_anon.txt` y redeployar.

---

## 6. Lo que queda pendiente, para priorizar con JP

En orden de lo que más desbloquea:

1. **Confirmar las variables de entorno en Vercel** (arriba).
2. **Decidir el `tipo_id` de las 8 filas corregidas** (Cartelería, Cuadrilla
   Municipal, etc.) — hoy inconsistentes entre tipo y `es_obra`.
3. **Los 18 proyectos sin cargar** (`02b`/`02c` en `carga-inicial/`) — de qué
   programa cuelgan, o si hace falta crear alguno.
4. **Política de escritura real**, atada a autenticación — hoy nadie puede
   cargar un compromiso nuevo desde el portal, todo compromiso nuevo tiene
   que pasar por el script de Python con `service_role`.
5. **La migración completa del sistema a Supabase** — sigue siendo la
   decisión grande de fondo, sin tocar.
6. **Contenedores de datos sin lugar en el modelo** (`Reportes MI3F`,
   `Agenda Roco`, `Informe de Estadísticas Generales` — ver
   `docs/traspaso-datos-reales.md` §7) — siguen sin resolver.

---

## 7. Para leer en orden si hace falta más contexto

1. Este documento.
2. `supabase/datos/carga-inicial/00-README.md` — el detalle completo del
   paquete de carga: qué se cargó, qué se excluyó y por qué, el mapeo de
   estados, los 6 compromisos del PDF de Obras con su justificación uno por
   uno.
3. `docs/ciclo-de-vida-del-compromiso.md` — la especificación completa de
   cuándo un compromiso pasa a `alerta` (no se guarda, se deduce) y por qué
   la fecha límite es obligatoria.
4. `docs/traspaso-datos-reales.md` (28/08) — el contexto de fondo: por qué el
   cualitativo de los `_db` no entra tal cual al portal, cómo se clasificaron
   los 425 nombres, qué es el sheet «limpieza de datos».
5. `docs/registro-de-cambios.md` — entradas del 28/08 y del 04/09 con el
   detalle técnico de cada cambio de interfaz.
