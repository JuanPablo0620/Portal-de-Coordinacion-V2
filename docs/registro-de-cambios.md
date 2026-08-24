# Registro de cambios de interfaz

Bitácora acumulativa de ajustes a la interfaz, para tener trazabilidad de qué
se pidió, qué se cambió y por qué — a diferencia de `docs/decisiones/`, que
registra decisiones de una reunión puntual, este archivo se actualiza cada
vez que se hace un cambio de interfaz, sin importar si vino de una reunión o
de un pedido suelto.

Formato por entrada: fecha, quién lo pidió, qué se cambió, archivos tocados,
y el resultado de `npm run verificar`.

---

## 24/08/2026 — Seguimiento: selector de proyecto en avances y problemas también

**Pedido de JP**, probando la carga real de Trabajo y Producción: en la
sección "3 · Campos transferidos", cada fila —no solo los compromisos—
necesita un selector a su izquierda para elegir a qué proyecto pertenece,
acotado a los proyectos del área elegida en la sección 1 (si el área es
Trabajo y Producción, el selector solo ofrece los proyectos de esa
secretaría).

**Cambio de forma de dato**: `avances` y `problemas` pasan de ser arrays de
string simples a arrays de `{ descripcion, id_proyecto }` — mismo patrón que
ya tenían los compromisos. Reemplaza el patrón anterior de "vínculo
colapsado" (botón "Vincular a un proyecto" que expandía el buscador
completo) por un `<select>` siempre visible a la izquierda de cada fila,
igual para compromisos, avances y problemas — más simple que el buscador
completo porque la lista ya viene acotada al área, no hace falta buscar
entre todos los proyectos del sistema.

**Derivación de `seguimientos_proyectos`** (para que el historial de un
proyecto muestre sus seguimientos) ahora considera las tres listas, no solo
compromisos: se arma de a qué proyectos quedó vinculada CUALQUIER fila de
la carga.

**Efecto colateral resuelto**: cambiar la forma de `avances`/`problemas`
rompía dos consumidores que asumían strings simples —
`VistaPrevia.jsx` (Reportes, renderizaba el string directo) y
`candidatosEstrategicos()` en `selectores.js` (usaba `problemas[0]` como
título)—, además de un test que corre el corpus completo de
`base-completa.js` contra el clasificador. Los tres se actualizaron; los dos
primeros quedaron defensivos contra la forma vieja (`typeof x === 'string'
? x : x.descripcion`), porque un seguimiento cargado con el formulario
anterior puede seguir guardado así en el navegador de quien lo cargó.
`demo.js` y `base-completa.js` también se actualizaron para generar la
forma nueva, así el sistema no mezcla dos formas distintas para el mismo
campo.

**Archivos:** `src/modulos/seguimiento/CargarSeguimiento.jsx` (reescrito),
`src/modulos/reportes/VistaPrevia.jsx`, `src/datos/selectores.js`,
`src/datos/demo.js`, `src/datos/base-completa.js`,
`pruebas/minutas.test.mjs`.

**Probado a mano** con gstack, sobre Trabajo y Producción: el selector de
cada fila mostró únicamente "Cursos y Capacitaciones" (el único proyecto
real de esa secretaría) → cargué un avance vinculado a ese proyecto y
guardé → sin errores de consola → la ficha del proyecto pasó a mostrar
"Seguimientos 1" sin que hiciera falta ningún compromiso → confirmado
también consultando el dato tal como quedó persistido: `{ descripcion:
"...", id_proyecto: "TYP-2026-001" }`.

`npm run verificar`: 307/307 tests, build OK, 118 comprobaciones de render,
29 rutas de accesibilidad.

---

## 21/08/2026 — Seguimiento: el vínculo a proyecto es del compromiso, no de la carga entera

**Pedido de JP**, surgido de una conversación sobre qué es y qué no es un
compromiso: un compromiso puede o no ser de un proyecto puntual — "hablar
con Sistemas porque un CAPS no tiene internet" no es de ningún proyecto,
"hablar con Legales por el suministro del túnel Hornos" sí es del túnel
Hornos. Esa distinción es de CADA compromiso. El pedido concreto: sacar el
selector de "Proyectos tratados" de la sección "1 · De qué seguimiento se
trata" en Seguimiento → Cargar realizado — no hace falta declarar de
entrada de qué proyectos habla toda la carga.

**Dos cosas dependían de ese selector, resueltas antes de tocar nada:**

1. **¿Cómo se vincula un compromiso a un proyecto sin la lista de arriba?**
   Cada fila de compromiso suma su propio campo opcional "Vincular a un
   proyecto" — arranca colapsado (mismo patrón que el proyecto vinculado de
   un tema en `CargarMonitoreo.jsx`), porque la mayoría de los compromisos
   no son de ningún proyecto en particular.
2. **La sección "4 · Avance de cada proyecto"** (el número de avance por
   proyecto, que dependía de esa lista) **se sacó del formulario** — el
   avance de un proyecto se actualiza desde Proyectos/Obras, no desde acá.
   Con ella se fue también el campo `estado_reportado` de este formulario.

**Cómo queda `seguimientos_proyectos`** (la tabla que hace que el historial
de un proyecto muestre sus seguimientos): ya no es una declaración aparte,
se **deriva** de a qué proyectos terminaron vinculados los compromisos de
esa carga (`[...new Set(compromisos.map(c => c.id_proyecto).filter(Boolean))]`).
Si ningún compromiso se vincula a un proyecto, el seguimiento no aparece en
el historial de ningún proyecto — que es exactamente lo esperable si de
verdad no tocó ninguno.

**Archivos:** `src/modulos/seguimiento/CargarSeguimiento.jsx` (reescrito).

**Probado a mano** con gstack: cargué un seguimiento de Obras con un
compromiso "Hablar con Legales para apurar el suministro" vinculado a Túnel
Hornos (OBR-2026-006) → guardó sin error → la ficha del proyecto muestra
"Seguimientos 1" y "Compromisos 1" → el compromiso aparece en la pestaña
Compromisos con su chip de proyecto. Sin errores de consola.

`npm run verificar`: 307/307 tests, build OK, 118 comprobaciones de render,
29 rutas de accesibilidad.

---

## 21/08/2026 — Color por secretaría en el chip de ID (Proyectos)

**Pedido de JP**: en la página de Proyectos, que el chip que muestra el ID
(`AMB-2026-018`, `CAH-2026-001`...) tenga un color distinguible por
secretaría, en vez del mismo azul genérico para todas.

**Cómo se armó el color**: cargué la skill de `dataviz` en vez de elegir
tonos a ojo. La paleta categórica que la app ya usa para gráficos
(`--color-serie-1..8`) no sirvió — corrida por el validador de la skill,
3 de los 8 tonos leen grisáceos y dos son casi indistinguibles entre sí—, así
que arme una paleta nueva y chica, acotada a este uso, y la validé con
`node scripts/validate_palette.js` contra el fondo real de la app (blanco):
lightness band, piso de croma, separación CVD (daltonismo) y piso de
distinción a ojo normal, los cuatro en verde. Deliberadamente ningún tono
coincide con los cuatro colores de estado que ya tiene el sistema
(vencido/próximo/atención/en regla), para que un chip de área nunca se lea
como un semáforo de estado. Cada color sigue el mismo patrón de tres
variantes que ya usa el resto de la app (base, `-texto` oscurecido a ≥4,5:1
para que el texto sea legible, `-suave` aclarado para el fondo del chip) —
las derivé con un script en vez de a ojo, buscando el oscurecimiento mínimo
que llega al contraste pedido.

Un aviso quedó en el amarillo (banda 6-8 de separación CVD contra el verde,
límite legal solo con "codificación secundaria" — la skill lo exige
explícitamente). Acá se cumple sin agregar nada: el propio texto del ID
(las letras del prefijo) ya identifica la secretaría independientemente del
color, así que el color es un refuerzo visual, nunca la única señal.

**Alcance**: las 7 secretarías reales tienen color fijo por prefijo
(AMB/CAH/OBR/SAL/SEG/TYP/COR). Cualquier otro prefijo — por ejemplo, las 14
áreas ficticias de la base completa — cae en el tono acento genérico de
siempre: no vale la pena mantener un color propio por área de prueba.

**Archivos:** `src/estilos/index.css` (21 tokens nuevos: 7 colores × 3
variantes), `src/componentes/Basicos.jsx` (7 tonos nuevos de `Chip` +
`tonoPorIdProyecto()`), `src/modulos/proyectos/Proyectos.jsx` (columna ID).

**Probado a mano** con gstack, datos reales cargados: Ambiente en azul,
Capital Humano en naranja, Obras en verde-teal, Salud en mostaza — los
cuatro claramente distintos entre sí y de los chips de estado
(planificado/en ejecución/demorado/finalizado). Sin errores de consola.

`npm run verificar`: 307/307 tests, build OK, 118 comprobaciones de render,
29 rutas de accesibilidad.

---

## 21/08/2026 — Módulo nuevo «Mis áreas»

**Pedido de JP** (dejado corriendo mientras se iba a una reunión, con
autorización explícita para asumir lo que faltara y avisar después qué se
asumió): cada integrante de Coordinación monitorea un subconjunto de las
siete secretarías, no las siete. Quería una pestaña nueva en el sidebar
donde cada persona elija sus áreas y vea de un vistazo las alertas y los
compromisos pendientes de esas áreas.

### Qué se construyó

Un módulo nuevo, `/mis-areas`, con dos partes:

1. **Selector de áreas** — check-list de las secretarías del catálogo, con
   un botón «Guardar» que reemplaza de una sola vez la asignación de esa
   persona (no altas/bajas incrementales).
2. **Vista filtrada** — reutiliza, sin duplicar código, las mismas piezas
   que ya usa Monitoreo: `ListaAlertas` para las alertas (mismo motor
   central, mismos días de atraso), `Tabla` + `COLUMNAS_COMPROMISO` para los
   compromisos vigentes, y **`TarjetaSecretaria`** (recién exportada desde
   `TableroSecretarias.jsx` para este fin) para la tarjeta de estado de cada
   secretaría — semáforo, mini-serie, criticidad de temas, avance agregado,
   todo idéntico a lo que ya se ve en Monitoreo, solo que acotado a las
   áreas elegidas. Cada tarjeta abre la hoja completa real de esa secretaría
   (`/monitoreo?tab=secretarias&secretaria=...`), no una versión reducida.

### Decisiones que tomé sin poder preguntar (para revisar)

1. **Identidad = `config.usuario`.** El sistema no tiene login; la
   asignación de áreas se guarda contra el nombre libre que cada quien
   carga en Configuración → «Usuario actual». Si dos personas comparten
   una computadora, tienen que cambiar ese nombre para ver su propia
   selección — es la misma convención que ya usa todo el sistema para
   «quién cargó esto», no algo nuevo que inventé para este módulo.
2. **Reemplazo atómico, no incremental.** Guardar pisa toda la lista de
   áreas de esa persona (como `guardarCatalogo`), no agrega/quita de a una.
3. **Sin bitácora.** No queda asiento en el historial: es preferencia de
   uso, no dato de gestión institucional, mismo criterio que `config.usuario`.
4. **Ubicación en el sidebar**: la puse justo debajo de «Inicio» — es la
   pantalla de uso diario más frecuente después del dashboard general, así
   que le di prioridad de posición.
5. **Sin selector de período** (a diferencia de Monitoreo): esta pantalla es
   para un vistazo rápido del estado actual, no para analizar una ventana de
   tiempo específica. Si hace falta, se puede agregar después.
6. **Ícono**: `UserCheck` de lucide-react.

Si alguna de estas seis no es lo que tenías pensado, avisame y la ajusto.

### Encontrado de paso (no pedido, corregido igual)

`scripts/humo.mjs` seguía comprobando `/monitoreo?secretaria=Secretaría de
Obras Públicas` — el nombre viejo, de antes del rediseño del catálogo del
20/08. Como `resumenSecretaria()` no valida que el área exista en el
catálogo (devuelve un resumen vacío para cualquier string), la prueba de
humo seguía "pasando" pero contra una secretaría fantasma, sin ejercer
datos reales de la demo. Corregido a `Secretaría de Obras` — ahora vuelve a
probar contra contenido real.

**Archivos:** `src/datos/esquema.js`, `src/datos/repositorio.js`,
`src/datos/selectores.js`, `src/modulos/monitoreo/TableroSecretarias.jsx`
(export de `TarjetaSecretaria`), `src/modulos/mis-areas/MisAreas.jsx`
(nuevo), `src/App.jsx`, `src/componentes/Layout.jsx`, `scripts/humo.mjs`.

**Probado a mano** con gstack: elegir Obras + Salud → Guardar → aparecen
las alertas y compromisos reales de esas dos áreas (y de ninguna otra) →
recargar la página conserva la selección → clic en «Abrir hoja» navega a
la hoja real de Monitoreo para esa secretaría → sin errores de consola.

`npm run verificar`: 307/307 tests, build OK, 118 comprobaciones de render
(+4), 29 rutas de accesibilidad (+1).

---

## 20/08/2026 — Catálogo de áreas: fuera las ocho genéricas, demo sobre las 7 reales

**Pedido de JP**, mirando Configuración → Catálogos → Áreas: "¿Por qué hay
secretarías erróneas o repetidas? Secretaría de Ambiente y Servicios
Públicos es la correcta, no Dirección de Ambiente. Secretaría de Desarrollo
Social tampoco existe, es Secretaría de Capital Humano." No era un error del
relevamiento del 19/08 — eran las ocho áreas genéricas e inventadas que
`demo.js` usaba desde antes de esa carga ("Secretaría de Obras Públicas",
"Secretaría de Desarrollo Social", "Secretaría de Servicios Públicos",
"Subsecretaría de Educación", "Subsecretaría de Cultura", "Dirección de
Producción y Empleo", "Dirección de Ambiente", más una "Secretaría de Salud"
que coincidía por casualidad con la real), conviviendo con las siete reales
en el mismo catálogo sin ninguna marca que las distinguiera.

**Decisión, entre tres opciones planteadas:** sacar las ocho del catálogo y
reescribir `demo.js` para que genere proyectos ficticios sobre las siete
secretarías reales (opción recomendada, elegida por JP), en vez de sacar los
botones de datos de prueba o solo separar la vista sin tocar nada.

**Por qué `base-completa.js` NO se tocó:** genera sus catorce áreas
enteramente inventadas (Secretaría de Gobierno, Hacienda, Deportes,
Juventud, Género y Diversidad, Modernización, más las ocho de siempre) con
su propio `armarCatalogos()`, que **reemplaza entero** `bd.catalogos` al
cargarse — nunca convive con la semilla real, así que nunca generaba la
confusión que sí generaba `demo.js`. El diseño de catorce áreas es a
propósito (probar el ordenamiento del tablero a escala), no un descuido.

**Cambios:**

1. `catalogos.js`: `CATALOGOS_SEMILLA.areas` pasó de 15 entradas (8
   genéricas + 7 reales) a **7** (las reales). Se agregaron dos programas
   ("Seguridad ciudadana", "Modernización de la gestión") y un eje
   ("Seguridad ciudadana") nuevos, que hacían falta para las dos secretarías
   que antes no tenían plantilla de demo (Seguridad, Coordinación).
2. `demo.js`: `PLANTILLAS`/`PREFIJOS` reescritos con las siete secretarías
   reales como claves — no ocho inventadas. Las plantillas que antes vivían
   en áreas separadas se fusionaron donde correspondía (Desarrollo Social +
   Educación + Cultura → Capital Humano; Servicios Públicos + Ambiente →
   Ambiente y Servicios Públicos), agregando un quinto elemento opcional de
   `programa` por ítem para no perder la variedad de programas dentro de una
   misma secretaría fusionada. Se sumaron plantillas nuevas para Seguridad y
   Coordinación, que antes no generaban proyectos de demo. El set sigue
   siendo evidentemente ficticio por el CONTENIDO (proyectos, zonas,
   personas inventados), ya no por el nombre de la secretaría.
3. `pruebas/demo.test.mjs`, `pruebas/flujos.test.mjs`,
   `pruebas/estrategicos.test.mjs`: fixtures que usaban los nombres/ids
   viejos (`'Secretaría de Obras Públicas'`, `id_area: 'ar_obras'`, etc.)
   actualizados a los reales.
4. `ImportarProyectos.jsx`: el placeholder de ejemplo del CSV usaba el
   nombre de área viejo — corregido.

**Probado a mano:** sistema vacío → Catálogos muestra exactamente 7 áreas,
todas reales (COR AMB CAH OBR SAL SEG TYP) → "Cargar datos de
demostración" sin errores, Monitoreo muestra "7 de 7 secretarías" con los
siete nombres reales y actividad en todas → "Cargar base completa" sin
errores, Catálogos pasa a mostrar sus catorce áreas ficticias propias (OBR
DSO SPU SAL EDU CUL PRO AMB GOB HAC DEP JUV GEN MOD) sin ninguna
interferencia con las reales → "Vaciar sistema" vuelve a las 7 áreas reales
limpias.

**Archivos:** `src/datos/catalogos.js`, `src/datos/demo.js`,
`src/modulos/proyectos/ImportarProyectos.jsx`,
`src/datos/proyectos-reales-secretarias.js` (comentario actualizado),
`pruebas/demo.test.mjs`, `pruebas/flujos.test.mjs`,
`pruebas/estrategicos.test.mjs`.

`npm run verificar`: 307/307 tests, build OK, 114 chequeos de render, 28
rutas de accesibilidad.

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
