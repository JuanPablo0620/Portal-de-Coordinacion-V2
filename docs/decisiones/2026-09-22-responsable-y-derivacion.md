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
5. Los históricos sin responsable se conservan. Una vez habilitada al menos una
   persona, todo compromiso nuevo requiere asignación.
6. Una cuenta de sólo lectura puede actualizar o derivar un compromiso propio;
   una vez transferido, pierde ese permiso individual. El servidor valida que
   el destinatario esté activo y habilitado.

## Por qué la regla 5 se decide en la base y no en el formulario

El trigger `validar_responsable_compromiso` corre en Postgres porque el portal
escribe por PostgREST: cualquiera con la `anon key` —que va en el front y es
pública por diseño— puede mandar un PATCH a mano. `validarResponsable()` en
`src/datos/equipo.js` es el espejo en el front, para no ofrecer un botón que la
base va a rechazar, pero no es la autorización.

Por eso tampoco se repitió la validación en cada formulario de alta. Hacerlo la
habría congelado en «siempre obligatorio», y durante la transición —padrón
vacío, histórico sin repartir— eso no deja cargar nada.

## Antes de activar el circuito

1. Aplicar la migración en un entorno de prueba, no en producción.
2. **Repartir el histórico primero.** Apenas se habilita a la primera persona,
   el alta empieza a exigir responsable. No inferir responsabilidad individual
   a partir del área.
3. Habilitar las cuentas acordadas desde Configuración → Equipo y verificar con
   dos sesiones.
4. Revisar Mi trabajo y la reunión de Dirección en escritorio y móvil.

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
