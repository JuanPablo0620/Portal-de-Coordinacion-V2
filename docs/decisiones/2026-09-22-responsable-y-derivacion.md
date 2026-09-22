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

**Sobrevive la reunión de Dirección**, que nunca tuvo temario propio: repasa
todos los compromisos activos, incluidos los cumplidos y los que no tienen
responsable. `revisado` es una marca del encuentro y no dice nada sobre el
estado del compromiso.

La migración quedó como `0037_responsables_y_reunion_direccion.sql`. Se escribió
de cero sobre main en vez de portar la `0037_equipo_y_reuniones.sql` de la rama
vieja, por dos motivos: nunca se aplicó en ninguna base, así que no hacía falta
una migración que deshiciera nada; y la `0036` de main ya había sacado
`id_monitoreo_origen` de `compromisos_origen_unico`, que la versión vieja volvía
a meter.

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
5. **Todo compromiso tiene responsable, sin excepción.** `id_responsable` es
   `not null`.
6. Una cuenta de sólo lectura puede actualizar o derivar un compromiso propio;
   una vez transferido, pierde ese permiso individual. El servidor valida que
   el destinatario esté activo y habilitado.

## Los 130 históricos no se cargan, y eso simplifica el esquema

Decisión de JP del 22/09/2026: `supabase/datos/carga-inicial/05-compromisos.csv`
no se sube, y los que ya estaban cargados en Supabase desde el 04/09 tampoco
quedan.

Es lo que permite que `id_responsable` sea `not null`. Esas 130 filas son el
único caso de compromiso sin dueño que existía —el `_db` de origen nunca
registró quién se hacía cargo—, así que sin ellas no hay nada que sostener:

- **Se cae la regla de transición.** Una versión anterior de este trabajo dejaba
  crear compromisos sin responsable mientras el padrón estuviera vacío. Era una
  puerta abierta con un solo propósito, y ese propósito ya no existe.
- **El trigger queda con una sola regla**: que el destinatario esté activo y
  habilitado. Que *haya* responsable lo garantiza el `not null`, y que no se
  pueda derivar a nadie, también.

**La migración falla si quedan filas en `compromisos`**, y está escrito así a
propósito: vaciar esa tabla tiene que ser un acto deliberado y con backup, no
algo que una migración haga sola mientras nadie mira.

`fecha_limite` sigue siendo **nullable**, por decisión aparte del mismo día.
Vale la pena anotar que el único motivo por el que no podía ser `not null` eran
justamente estos históricos —ver `ciclo-de-vida-del-compromiso.md`, sección 7—,
así que el bloqueo técnico ya no existe: queda como deuda elegida, no heredada.

## Por qué la regla se decide en la base y no en el formulario

El trigger `validar_responsable_compromiso` corre en Postgres porque el portal
escribe por PostgREST: cualquiera con la `anon key` —que va en el front y es
pública por diseño— puede mandar un PATCH a mano. `validarResponsable()` en
`src/datos/equipo.js` es el espejo en el front, para no ofrecer un botón que la
base va a rechazar, pero no es la autorización.

Por eso tampoco se repitió la validación en cada formulario de alta: vive en el
repositorio, en un solo lugar, y los formularios sólo aportan el campo.

## Antes de activar el circuito

1. **Vaciar `compromisos` con backup previo.** Si no, la migración no aplica.
2. Aplicar la migración en un entorno de prueba, no en producción.
3. **Habilitar al menos una cuenta en Configuración → Equipo.** No es opcional
   ni un paso posterior: con el padrón vacío no se puede crear ningún
   compromiso en todo el portal, porque no hay a quién asignárselo.
4. Verificar con dos sesiones, y revisar Mi trabajo y la reunión de Dirección en
   escritorio y móvil.

## Lo que todavía no se hizo

- **Nunca se abrió en el navegador con sesión real.** Lo que está verificado es
  `npm run test` (402), `npm run build` y el render SSR de la prueba de humo.
- La migración no se aplicó en ninguna base. No se pudo confirmar contra
  Supabase que la `0037` no exista ya: el MCP responde `Unauthorized`.
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
