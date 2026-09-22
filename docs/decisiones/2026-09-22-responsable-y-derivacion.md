# Responsable individual del compromiso, y qué pasó con la reunión de Secretaría

Reemplaza en alcance a [`2026-09-18-equipo-y-reuniones.md`](2026-09-18-equipo-y-reuniones.md),
que se escribió cuando la reunión de Secretaría de los lunes todavía iba a
estar en el portal. Las reglas sobre responsabilidad individual siguen
valiendo tal cual; las de Secretaría quedaron sin efecto.

## Qué cambió respecto del 18/09

La reunión de Secretaría de los lunes **no va en el portal**: se pidió no
tenerla en cuenta. Con ella se caen el temario seleccionado y ordenado por un
organizador, la capacidad `organiza_secretaria` y la función
`organiza_reunion_secretaria()`.

**La de Dirección también quedó afuera**, más tarde el mismo día. Se había
portado su migración, su adaptador de Supabase y sus funciones del repositorio,
pero nunca se construyó la pantalla: `crearReunionDireccion` y compañía no las
llamaba nadie. Antes que dejar dos tablas vacías sin forma de usarlas, se sacó
entera. Si alguna vez se retoma, está en
`feat/compromisos-equipo-reunion-lunes`.

Del trabajo original sobrevive entonces **una sola cosa: el responsable del
compromiso y su derivación**, que es lo que tiene interfaz completa.

La migración quedó como `0037_responsable_de_compromiso.sql`.

## Las reglas que quedan

1. Un compromiso tiene un responsable de Coordinación identificado por su
   cuenta. **Derivarlo transfiere quién lo impulsa y nada más**: no toca el
   área, el estado, la fecha límite ni las novedades anteriores.
2. No hay historial de derivaciones ni se pide motivo. La auditoría general de
   la base ya registra el cambio de columna.
3. Tener cuenta no implica recibir compromisos. El padrón se configura con
   `recibe_compromisos`, desde Configuración → Equipo. Las identidades reales
   no se versionan: este repositorio es público.
4. **Mi trabajo** une los compromisos asignados a la cuenta y los de las áreas
   elegidas, sin duplicados. La parte personal funciona sin áreas elegidas.
5. **Los 137 compromisos ya cargados se quedan sin responsable.** En cuanto
   haya al menos una persona habilitada, todo compromiso nuevo lo exige.
6. Una cuenta de sólo lectura puede actualizar o derivar un compromiso propio;
   una vez transferido, pierde ese permiso individual. El servidor valida que
   el destinatario esté activo y habilitado.

## Por qué `id_responsable` es nullable: lo que había en producción

Durante el 22/09 esta decisión se tomó dos veces, y la segunda corrigió a la
primera. Queda escrito porque el error es fácil de repetir.

**Primera versión.** Se decidió no cargar los 130 compromisos históricos de
`05-compromisos.csv`. Como esas filas eran el único caso conocido de compromiso
sin dueño, se puso `id_responsable not null` y se simplificó el trigger a una
sola regla.

**Lo que apareció al contar.** Antes de vaciar nada se hizo backup de la tabla
real. No había 130 filas: había **137**, y la distribución importaba.

| Grupo | Total | Activos | Actualizaciones |
|---|---|---|---|
| Carga histórica del 04/09 | 84 | 15 | 153 |
| Cargados por el equipo desde el 08/09 | 53 | 46 | 82 |

Los 53 no son histórico: son trabajo real, cargado desde el portal en tres
semanas, once de ellos el mismo 22/09, con contenido inequívoco («Canil de
Plaza Echeverría», «Avanzar con la compactación de autos en la comisaría N°6»).
Vaciar `compromisos` se los habría llevado junto con sus 82 actualizaciones.

**Decisión final.** La columna es **nullable** y vuelve la regla (c) del
trigger. A los 137 no se les puede inventar un responsable, y deducirlo del
área es justamente lo que la regla 3 prohíbe: el área dice quién ejecuta, no
quién se comprometió a impulsarlo.

**La lección operativa:** el backup no fue un trámite previo a borrar, fue el
que mostró que no había que borrar. Ante cualquier `delete` masivo en
producción, contar y mirar *antes*, aunque la decisión ya esté tomada.

Backups en el repo de trabajo de JP:
`archivos_varios/backup_compromisos_produccion_2026-09-22.json` y el de
`actualizaciones_compromisos`.

`fecha_limite` sigue siendo **nullable** por decisión aparte del mismo día —ver
`ciclo-de-vida-del-compromiso.md`, sección 7.

## Por qué la regla se decide en la base y no en el formulario

El trigger `validar_responsable_compromiso` corre en Postgres porque el portal
escribe por PostgREST: cualquiera con la `anon key` —que va en el front y es
pública por diseño— puede mandar un PATCH a mano. `validarResponsable()` en
`src/datos/equipo.js` es el espejo en el front, para no ofrecer un botón que la
base va a rechazar, pero no es la autorización.

Por eso tampoco se repitió la validación en cada formulario de alta: vive en el
repositorio, en un solo lugar, y los formularios sólo aportan el campo.

## Antes de activar el circuito

**No hay que vaciar nada.** La migración no toca las filas existentes.

1. **Aplicar la migración ANTES de publicar el frontend.** No es una
   preferencia de orden: `supabaseCompromisos.js` pide `id_responsable` dentro
   del `select` que trae todos los compromisos del portal, y PostgREST rechaza
   la consulta entera si una columna no existe. Publicar primero deja al equipo
   sin compromisos en ninguna pantalla, no con un aviso de error.
2. Correrla desde el editor SQL de Supabase, en el navegador: desde la red del
   municipio los puertos de Postgres están bloqueados y PostgREST no ejecuta
   DDL. El editor corre todo en una transacción, así que si falla no deja nada
   a medias — se comprobó.
3. Publicar el frontend.
4. **Recién entonces, habilitar cuentas en Configuración → Equipo.** Ese es el
   interruptor: hasta ahí todo sigue funcionando como antes.
5. Verificar con dos sesiones y revisar Mi trabajo en escritorio y móvil.

## Lo que todavía no se hizo

- **Nunca se abrió en el navegador con sesión real.** Lo que está verificado es
  `npm run test` (402), `npm run build` y el render SSR de la prueba de humo.
- **La migración no está aplicada**, confirmado el 22/09 contra la base real
  por REST: `compromisos.id_responsable` y `perfiles.recibe_compromisos` no
  existen. (El MCP de Supabase responde `Unauthorized`; la comprobación se hizo
  pidiendo cada columna y leyendo el `42703`.)
- `scripts/humo.mjs` no cubre la lista de compromisos de Mi trabajo con datos:
  en la demo no hay áreas asignadas ni perfil, así que la ruta cae en el estado
  vacío. Para cubrirla haría falta un escenario con perfil.

## Bugs previos corregidos de paso

Los cuatro estaban en main y caían encima de lo que se estaba tocando:

| Dónde | Qué pasaba |
|---|---|
| `MiTrabajo.jsx` (ex `MisAreas`) | Filtraba por `estado_efectivo === 'vencido'`, que `estadoCompromiso()` no emite nunca (devuelve `'alerta'`). La tabla de vencidos no se mostraba jamás y los vencidos se colaban entre los pendientes. |
| `CargarMonitoreo.jsx` | Misma comparación: la etiqueta «vencido · N d» nunca aparecía. |
| `FormularioNovedad.jsx` | La fecha límite guardaba el evento del DOM en vez de la fecha — faltaba `.target.value`. |
| `repositorio.js` | `actualizarEstadoCompromiso` guardaba `estado: undefined` cuando la llamada sólo cambiaba el plazo, y borraba el estado anterior en la base local. |

Y en `tienda.js`, `sincronizarUsuario` borraba las áreas propias al cambiar de
nombre: contra Supabase las dos escrituras operan sobre `auth.uid()` y no sobre
el nombre que se les pasa, así que la segunda pisaba lo que había escrito la
primera.

## La 0037 no depende de 0032–0036

Primer intento de aplicarla, 22/09: falló con
`42703: column "id_reunion_evento_origen" does not exist`.

Esa columna la crea `0036_compromisos_de_evento.sql`, que está escrita en el
repo pero **no aplicada en la base**. La 0037 la mencionaba porque reescribía
`compromisos_origen_unico` copiando la lista de 0036, asumiendo que estaba
corrida.

Estado real del esquema, medido por REST el 22/09:

| Migración | En el repo | En la base |
|---|---|---|
| 0001–0031 | sí | aplicadas |
| 0033 (notas de proyecto) | sí | aplicada |
| 0036 (compromisos de evento) | sí | **no aplicada** |

Corregido sacando esa reescritura: la 0037 ya no toca
`compromisos_origen_unico` y sólo agrega columnas, policies y un trigger. Se
puede aplicar sobre la base tal como está.

**Para la próxima:** que una migración esté en el repo no quiere decir que esté
corrida. Antes de escribir una que dependa de otra, medir contra la base, no
contra el directorio. El traspaso lo decía y no se leyó a tiempo.
