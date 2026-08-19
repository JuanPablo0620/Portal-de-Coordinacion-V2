# Registro de cambios de interfaz

Bitácora acumulativa de ajustes a la interfaz, para tener trazabilidad de qué
se pidió, qué se cambió y por qué — a diferencia de `docs/decisiones/`, que
registra decisiones de una reunión puntual, este archivo se actualiza cada
vez que se hace un cambio de interfaz, sin importar si vino de una reunión o
de un pedido suelto.

Formato por entrada: fecha, quién lo pidió, qué se cambió, archivos tocados,
y el resultado de `npm run verificar`.

---

## 19/08/2026 — Datos reales de las siete secretarías, no solo Posicionamiento

**Pedido de JP:** "Los datos que aparecen en el portal son datos que Salva le
pidió que cree Claude para ver el portal con datos de prueba... me gustaría
que usemos una buena cantidad de datos reales de los sheets de la secretaría
para poder ver el portal con datos reales." El mecanismo ya construido para
Posicionamiento (ver la entrada de corrección más abajo) se generalizó a las
otras seis secretarías.

**Relevamiento:** seis subagentes en paralelo, uno por `_db`
(`Ambiente_db`, `Capital_humano_db`, `Obras_db`, `Salud_db`, `Seguridad_db`,
`Trabajo_y_Produccion_db`), cada uno leyendo directamente de Drive la pestaña
oculta **"Estado de proyectos"** (el maestro de un proyecto por fila, no el
log semanal de "1. Cualitativo"). Resultado: **92 proyectos reales**
(29 Ambiente, 21 Capital Humano, 16 Obras, 8 Salud, 9 Seguridad, 1 Trabajo y
Producción, más los 8 de Posicionamiento ya cargados). Nada inventado: donde
un `Estado` no era interpretable (vacío, o un "0" que parece resto de una
fórmula rota) se dejó constancia en observaciones en vez de adivinar un
estado plausible. Trabajo y Producción tiene una sola fila real cargada en su
maestro — así está el sheet, no es un recorte del relevamiento.

**Cambios:**

1. `catalogos.js`: se agregaron cinco áreas reales más (Ambiente, Capital
   Humano, Obras, Seguridad, Trabajo y Producción) y tres ejes reales (POA,
   Compromisos, Puntual). **Salud NO sumó área nueva**: su nombre real
   ("Secretaría de Salud") coincide por casualidad con una de las ocho
   placeholders genéricas que ya usa `demo.js` — agregar una segunda con el
   mismo nombre reintroducía el bug de tarjetas duplicadas que se arregló
   hoy mismo (`nombresAreas()` no dedupea por nombre). Los proyectos reales
   de Salud se cuelgan de la entrada `ar_salud` existente.
2. `proyectos-reales-secretarias.js` (nuevo): los datos crudos relevados,
   documentados con las mismas notas que reportó cada subagente.
3. `repositorio.js`: `cargarProyectosRealesSecretarias()` — mismo patrón que
   `cargarProyectosPosicionamientoReales()` (aditivo, idempotente, separado
   de `demo`/`base-completa`), generalizado para iterar las siete
   secretarías. Dos piezas nuevas: `mapearEstado()` traduce el `Estado`
   crudo del sheet al vocabulario cerrado del sistema (planificado / en
   ejecución / demorado / finalizado / suspendido) sin pisar en silencio lo
   que no encaja — el valor real queda en observaciones; `idDesdeNombre()`
   genera el id de catálogo para cualquier programa real que aparezca,
   dado de alta automáticamente si no existe. También se agregó
   `cargarTodosLosProyectosReales()`, que encadena Posicionamiento + las
   seis secretarías en una sola llamada.
4. `Configuracion.jsx`: nuevo botón "Cargar datos reales de las
   secretarías" en la tarjeta "Datos del sistema", sin modal de
   confirmación (a diferencia de demo/base completa/vaciar: esta acción no
   reemplaza ni borra nada). Muestra cuántos proyectos entraron por
   secretaría al terminar.

**Probado a mano:** localStorage vacío → 0 proyectos → clic en el botón →
92 proyectos, uno por fila real, discriminados por secretaría en el mensaje
de resultado → clic de nuevo → los siete conteos dan 0 (idempotencia
confirmada) → Monitoreo muestra 14 tarjetas, una por secretaría, sin
duplicados ni siquiera con Salud compartiendo catálogo entre lo real y lo
genérico → Reportes: elegir "Secretaría de Salud" en Área deja el
desplegable de Programa con exactamente los 7 programas reales de esa
secretaría → Posicionamiento sigue andando sin cambios → sin errores de
consola en ningún paso.

**Archivos:** `src/datos/catalogos.js`,
`src/datos/proyectos-reales-secretarias.js` (nuevo), `src/datos/repositorio.js`,
`src/modulos/configuracion/Configuracion.jsx`.

`npm run verificar`: 307/307 tests, build OK, 114 chequeos de render, 28
rutas de accesibilidad.

**Pendiente para más adelante:**

- El campo `Eje` no está en la pestaña "Estado de proyectos": los 92
  proyectos reales quedaron con eje "Puntual" por defecto, que es una
  aproximación, no un dato relevado. Si hace falta el eje real, hay que
  cruzar contra "1. Cualitativo"/"2. Cuantitativo" de cada sheet.
- Fechas de "última actualización" ambiguas (formato `DD/MM/AA`) se
  asumieron todas en 2026, salvo un caso de Seguridad ("Cámaras operativas")
  que el propio sheet fecha en 2025.
- No se cargó el detalle cuantitativo (objetivo/avance/unidad) de los
  proyectos de tipo "Cuantitativo": estos 92 son solo el maestro cualitativo
  (nombre + estado + comentario). Es la misma limitación que ya tenía
  Posicionamiento.

---

## 19/08/2026 (corrección) — Posicionamiento: de lista fija a módulo dinámico

**Error de entendimiento, detectado por JP:** la entrada anterior de este
mismo día implementó "un módulo por proyecto" como un **archivo estático**
(`posicionamiento-real.js` rendereado directo) con los 8 proyectos reales
hardcodeados en el JSX. El pedido real era otro: **que la interfaz esté
programada para leer proyectos de Posicionamiento de la base y mostrarlos
como módulos** — dinámico, igual que cualquier otra pantalla del sistema, no
una lista fija escrita a mano.

**Corrección:**

1. `catalogos.js`: se agregó el área real **Coordinación** (`COR`), el
   programa **Posicionamiento** y el eje **Posicionamiento** — ninguno
   existía antes; sin esto no había dónde colgar un proyecto real de
   Posicionamiento como proyecto de verdad.
2. `posicionamiento-real.js` pasó de "datos con forma de UI" a **datos
   crudos** (nombre, estado real, comentario, fecha) — ya no se importa
   desde el componente.
3. Nueva acción `acciones.cargarProyectosPosicionamientoReales()` en
   `repositorio.js`: da de alta los 8 relevados como **proyectos reales**
   en `bd.proyectos` (vía `crearProyecto`, el mismo camino que "Nuevo
   proyecto"). Aditiva e idempotente — no reemplaza nada, no duplica si ya
   están cargados. Vive separada de `cargarDemo`/`cargarBaseCompleta` a
   propósito: esas dos siguen siendo 100% sintéticas.
4. `Posicionamiento.jsx`: `ProyectosEnCurso` ahora lee `bd.proyectos`
   filtrado por `programa === 'Posicionamiento'` — ya no importa la lista
   fija. Sin proyectos cargados muestra un estado vacío con el botón que
   dispara la carga.

**Probado a mano** (no solo con el smoke test automático, que no ejercita el
flujo de clic): base vacía → estado vacío correcto → clic en "Cargar los
relevados de Coordinacion_db" → aparecen los 8 proyectos, RIL con su marca
"a confirmar" → recargar la página los conserva → sin errores de consola.

**Archivos:** `src/datos/catalogos.js`, `src/datos/posicionamiento-real.js`,
`src/datos/repositorio.js`, `src/modulos/posicionamiento/Posicionamiento.jsx`.

`npm run verificar`: 307/307 tests, build OK, 114 chequeos de render, 28
rutas de accesibilidad.

---

## 19/08/2026 — Monitoreo, Posicionamiento y Reportes

Pedido de JP, tres cambios de interfaz independientes.

### 1. Monitoreo — una tarjeta por secretaría, tarjeta completa clickeable

**Síntoma reportado:** aparecía más de un módulo para la misma secretaría en
la grilla de Monitoreo.

**Causa real:** `nombresAreas()` (`src/datos/selectores.js`) armaba la lista
de secretarías uniendo el catálogo (`bd.catalogos.areas`) con **cualquier**
valor de `area` encontrado en `proyectos`, `monitoreos`, `seguimientos` y
`compromisos`. Un registro con el nombre de área mal tipeado, viejo o
inconsistente con el catálogo generaba una tarjeta fantasma extra — una
secretaría "fantasma" por cada variante del nombre, no una sola por
secretaría real.

**Cambio:** `nombresAreas()` ahora sale únicamente del catálogo. Es la única
fuente de verdad de qué secretarías existen; un dato mal cargado en un
registro ya no puede inventar una secretaría nueva.

**Además:** la tarjeta de cada secretaría (`TarjetaSecretaria` en
`TableroSecretarias.jsx`) antes solo respondía al clic en el botón "Abrir
hoja" del pie. Ahora toda la tarjeta es clickeable (`role="button"`,
`tabIndex`, `onKeyDown` para teclado), y el botón se reemplazó por un
indicador visual no interactivo, para no dejar un `<button>` anidado dentro
de un elemento con `role="button"` (rompía accesibilidad).

**Archivos:** `src/datos/selectores.js`, `src/modulos/monitoreo/TableroSecretarias.jsx`,
`pruebas/secretarias.test.mjs` (el test que documentaba la unión vieja se
reescribió para afirmar el comportamiento nuevo, más un test de no-duplicados).

### 2. Posicionamiento — sin financiamiento obtenido ni embudo, un módulo por proyecto real

**Pedido:** sacar la métrica "Financiamiento obtenido" y la tarjeta "Embudo
por estado"; que al entrar al módulo aparezca una tarjeta por cada proyecto
de Posicionamiento que se está llevando a cabo, no una vista agregada.

**Verificación contra el dato real:** antes de armar la grilla se relevó
`Coordinacion_db` (pestaña "Estado de proyectos", `Programa = Posicionamiento`)
en vez de usar los nombres tal como se los recordaba de memoria. Resultado:

- Confirmados con dato real y reciente (10/08/26 salvo aclaración): **CIPPEC**,
  **UBA**, **CIIAR**, **UBER**, **Bloomberg WWC** — coinciden con lo pedido.
- Encontrados además, no mencionados en el pedido: **Bloomberg City Lab**
  (proyecto propio, distinto de Bloomberg WWC) y **RECIA** — ambos con fila
  propia en la pestaña maestra.
- **RIL**: está en el pedido y es real (aparece en el registro semanal de
  "1. Cualitativo", con el detalle del convenio de $40M), pero **no tiene
  fila en la pestaña maestra "Estado de proyectos"** — su última carga real
  es del 27/04/26. Se incluyó igual, marcado como "a confirmar" en la
  interfaz.
- **"UBA - ciudades inteligentes"**: no se encontró como proyecto propio en
  ningún lado del sheet. Los comentarios de UBA mencionan una secuencia de
  evaluación (Institucional y Desarrollo Económico → Sociedad → Ambiente),
  pero no un proyecto separado con ese nombre. **No se inventó** — queda
  afuera hasta que se confirme o se cargue.

**Cambio:** nueva sección `ProyectosEnCurso` en el Tablero, con los 8
proyectos reales de `src/datos/posicionamiento-real.js` (dato relevado a
mano, no generado por `demo.js`/`base-completa.js` — están comentados como
tal en el archivo para que no se confundan con datos sintéticos). Se sacó la
tarjeta "Embudo por estado" y la métrica "Financiamiento obtenido"; se
conservó "Financiamiento en gestión" (no estaba pedido sacarlo) y "Por tipo
de acción".

**Archivos:** `src/modulos/posicionamiento/Posicionamiento.jsx`,
`src/datos/posicionamiento-real.js` (nuevo), `scripts/humo.mjs` (la
aserción del smoke test que buscaba "Embudo por estado" se actualizó al
título de la sección nueva).

### 3. Reportes — el filtro de Programa depende del Área elegida

**Pedido:** que al elegir un Área, el desplegable de Programa muestre sólo
los programas de esa área, no los de las siete.

**Cambio:** `opcionesPrograma` dejó de salir del catálogo plano
(`useOpciones('programas')`, que no tiene forma de saber a qué área
pertenece cada programa) y ahora se deriva de los proyectos reales
(`bd.proyectos`), filtrados por `filtros.area` cuando hay una elegida — el
mismo patrón que ya usaba este archivo para la lista de responsables. Al
cambiar de Área, el Programa elegido se limpia si ya no aplica.

**Por qué no se tocó el catálogo:** `catalogos.js` no tiene un `area_id` en
cada programa, y dárselo hubiese exigido reescribir los generadores de datos
de demostración (`demo.js` y `base-completa.js`, ~2.500 líneas, con
programas que hoy se reutilizan a propósito entre varias áreas fake). Derivar
desde los proyectos reales resuelve el pedido sin ese riesgo.

**Archivos:** `src/modulos/reportes/Reportes.jsx`.

### Verificación

```
npm run verificar
```

307/307 tests · build OK · 114 comprobaciones de render · 28 rutas de
accesibilidad auditadas. Sin fallas.

### Pendiente para más adelante, no resuelto hoy

- El catálogo de áreas/programas de `catalogos.js` sigue siendo genérico
  (`Secretaría de Obras Públicas`, `Secretaría de Desarrollo Social`, etc.),
  no las siete secretarías reales de Tres de Febrero. Reemplazarlo exige
  reescribir `demo.js` y `base-completa.js`, que dependen de esos nombres
  exactos — es un cambio grande, deliberadamente fuera de esta tanda.
- Confirmar el estado real de **RIL** (no está en la pestaña maestra) y si
  existe algún proyecto de UBA sobre "ciudades inteligentes" que haya que
  cargar aparte.
