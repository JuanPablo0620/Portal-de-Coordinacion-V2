# Traspaso: datos reales de gestión en el portal

**Para:** quien siga la carga de datos reales (Tomás / su Claude).
**De:** JP + Claude, sesión del 25 al 28/08/2026.
**Estado al 28/08/2026:** 51 proyectos validados ya cargados (commit `3c9e157`).

Este documento es autocontenido: no hace falta haber estado en esa sesión. Dice
qué se hizo, por qué, dónde quedó cada cosa y qué falta.

---

## 1. El hallazgo que ordena todo lo demás

**Una fila del `1. Cualitativo` no es un proyecto. Es una actualización.**

Las 3.806 filas de las seis secretarías corresponden a **425 nombres distintos**
— un promedio de 6,7 cargas por proyecto. Caso extremo verificado: *Demarcación
de Calles* (Obras) aparece **52 veces**, con 22 fechas de actualización y 24
comentarios distintos. No son 52 proyectos: es un proyecto monitoreado 52 veces.

Se corrió el validador real del portal (`validarFilasProyecto()`) sobre las
3.806 filas: **0 aceptadas**. El diagnóstico completo, con los siete
impedimentos y sus números, está en
[`carga-cualitativo-al-portal.md`](carga-cualitativo-al-portal.md). Leerlo antes
de tocar la carga ahorra rehacer el análisis.

Los dos puntos que más impactan en el modelo:

1. **El prototipo React no tiene colección de actualizaciones.** El esquema de
   Supabase sí (`actualizaciones`, con `tipo = 'cualitativa'`, `proyecto_id`,
   `fecha_actualizacion`, `estado_id`, `derivacion`, `comentarios`) — es
   exactamente una fila del `_db`. `COLECCIONES` en `src/datos/esquema.js` no
   tiene el equivalente.
2. **El `Eje` describe la fila, no el proyecto.** En ambos modelos el eje es
   columna de `proyectos`, pero en el `_db` cambia carga a carga porque dice de
   dónde salió la observación (POA / mesa / compromiso). 18 proyectos tienen más
   de un eje entre sus filas. Falta `mesa_id` / `reunion_id` en
   `actualizaciones`. **Esto toca el esquema de Supabase y quedó explícitamente
   pendiente de conversar** — no se avanzó por decisión de JP.

Y la causa de fondo, confirmada por JP: **la columna "Proyecto" no contiene solo
proyectos.** Solo el 18% de las filas cuelga de un programa oficial del POA. El
resto son compromisos, pedidos puntuales y temas de mesa cargados en las mismas
diez columnas, porque el `_db` no tiene otro lugar donde ponerlos.

Ejemplo canónico: **"Portón"** (Ambiente), 25 filas del 23/02 al 17/08, eje
`Mesa Esperanza`, estado `Pendiente` las 25 veces, el mismo comentario copiado
semana a semana. No es un proyecto con seis meses de avance: es un compromiso de
mesa que lleva seis meses sin cumplirse.

---

## 2. La cadena de artefactos

Cuatro pasos, cada uno con su archivo. Si algo hay que rehacer, este es el orden.

```
1. Cualitativo de los 6 _db  (3.806 filas)
        │  corrección mecánica de errores de carga
        ▼
analisis/auditoria-cualitativo-secretarias/completo/*.csv
        │  colapso a 425 nombres + propuesta de destino
        ▼
sheet "limpieza de datos"  ← revisado por JP, es la FUENTE DE VERDAD
        │  filtro: destino PROYECTO + confianza alta
        ▼
src/datos/proyectos-validados-cualitativo.js   (51 proyectos, cargado)
```

### Paso 1 — CSV corregidos

`analisis/auditoria-cualitativo-secretarias/completo/*.csv` (6 archivos, uno por
secretaría). Son el cualitativo completo con los errores de carga ya corregidos:
comentarios que estaban metidos en la celda de Proyecto separados con `|`,
`Derivación` con dos valores, `"."` sueltos. Traen dos columnas agregadas,
`Revisar (criterio propio)` y `Motivo`, que marcan las 381 filas donde hubo que
decidir con criterio propio.

El detalle de qué se corrigió y con qué regla está en el README de esa carpeta.

### Paso 2 — La clasificación

Las 3.806 filas se colapsaron en **425 nombres** (por secretaría, normalizando
mayúsculas y acentos: `Plan de poda` y `Plan de Poda` son uno solo). Para cada
uno se propuso un destino con una heurística, y **JP revisó y corrigió**.

### Paso 3 — El sheet, que es la fuente de verdad

Ver sección 3, abajo.

### Paso 4 — Lo que ya está en el portal

`src/datos/proyectos-validados-cualitativo.js`, cargado por
`cargarProyectosValidadosCualitativo()` en `repositorio.js`. Ver sección 4.

---

## 3. El sheet «limpieza de datos»

```
https://docs.google.com/spreadsheets/d/1sccSIcC0kVGdWrWUmBEyc-8omWk-bglZKHCcfvrTywU
```

Una pestaña, `Hoja 1`, 425 filas de datos + encabezado. **Es la fuente de verdad
de qué es cada cosa.** Cualquier carga futura debería salir de acá, no de una
lectura nueva del `_db`.

### Columnas

| Col | Nombre | Qué es |
|---|---|---|
| A | `Correcion mia` | Lo que escribió JP a mano al revisar. Texto libre, 28 filas |
| B | `Secretaría` | |
| C | `Nombre` | El nombre tal como está en la columna Proyecto del `_db` |
| D | `Otras escrituras del mismo nombre` | Variantes que se fusionaron (`AySA` = `AYSA`) |
| E | `Filas` | Cuántas filas del `_db` representa este nombre |
| F | `DESTINO PROPUESTO` | La propuesta automática |
| G | `Destino corregido (completar)` | Quedó sin usar: JP corrigió en A |
| H | `Confianza` | `alta` / `media` / `baja` de la propuesta automática |
| I | `Por qué se propone eso` | La regla que disparó |
| J-N | Ejes, programas, estados, fechas | Evidencia para decidir |
| O | `Último comentario` | |
| **P** | **`DESTINO FINAL`** | **La que hay que leer.** Resuelve A contra F |
| **Q** | **`Es actualización de`** | El proyecto padre, cuando P dice `ACTUALIZACION` |

**Leer siempre P, no F.** `DESTINO FINAL` ya combina la corrección de JP con la
propuesta automática.

### Los destinos

| Destino | Nombres | Qué significa | Tabla de Supabase |
|---|---:|---|---|
| `COMPROMISO` | 208 | Algo que alguien se comprometió a hacer | `compromisos` |
| `PROYECTO` | 128 | Proyecto del POA, con programa y avance | `proyectos` |
| `ACTUALIZACION` | 29 | **No es una entidad**: es una observación sobre otro registro | `actualizaciones` |
| `DESCARTAR` | 27 | Etiqueta de sección del sheet o dato de prueba | — |
| `PUNTUAL` | 24 | Pedido o intervención suelta, sin programa | `puntuales` |
| `REVISAR` | 9 | Sin señal suficiente | — |

Dos cosas que conviene entender de esta tabla:

**Más de la mitad son compromisos** (208 de 425, que representan 1.676 de las
3.806 filas). El `compromisos` de Supabase ya soporta el caso difícil: su
constraint es `num_nonnulls(proyecto_id, puntual_id) <= 1`, o sea *de un
proyecto, de un puntual, o de ninguno* — lo único obligatorio es el área. Eso es
exactamente lo que hace falta para "Portón".

**`ACTUALIZACION` no es un cuarto tipo de entidad.** Es una fila que va a
`actualizaciones` colgada de otro registro. Salió de la revisión de JP: 15 de
sus 28 correcciones dicen alguna variante de *"es una actualización de un
proyecto"*.

Un sub-patrón que vale conocer porque se repite: **el nombre lleva el estado
adentro**. `Alumbrado: Finalizados`, `Poda: Programados`, `Finalizados (OOPP)`,
`Bacheo / Programación Semana Actual`. El proyecto real es `Alumbrado`, `Poda`,
`Bacheo`; lo de después del `:` o `/` es el estado — una tercera columna metida
dentro del nombre. Son 18 nombres, 143 filas. Explica de paso por qué varios
figuraban con 20 cargas y siempre el mismo estado: el estado nunca cambia porque
ya está escrito en el nombre.

### Lo que está pendiente en el sheet

**9 filas de la columna Q dicen `COMPLETAR`.** JP las marcó como actualización
pero no nombró de qué proyecto. Sin ese dato el vínculo queda huérfano.

| Secretaría | Nombre | Filas |
|---|---|---:|
| Ambiente | Plaza Echeverría | 8 |
| Obras | Suministros | 8 |
| Obras | Cancha de Handball | 4 |
| Obras | Paradas colectivos | 3 |
| Trabajo y Producción | Plaza Churruca | 13 |
| Trabajo y Producción | Operativos migración | 9 |
| Trabajo y Producción | Desarrollo Pyme | 7 |
| Trabajo y Producción | Control sobre colectora general Paz | 7 |
| Trabajo y Producción | Curso manipuladores | 6 |

**Y un problema sin resolver:** dos de los padres que hacen falta —
`Servicios Generales` y `OOPP` — **no existen como proyecto en ningún lado**.
Aparecen solo como *Programa*. Hay que darlos de alta como proyecto, o cambiar
el modelo para que una actualización pueda colgar de un programa. La primera
opción es la barata y es la que se recomendó; **está sin decidir**.

**JP puso todo esto en standby** el 28/08 para priorizar cargar datos que ya
estuvieran seguros. No es que se olvidó.

---

## 4. Lo que ya está cargado en el portal

Commit `3c9e157`. 313 tests en verde, build OK.

`src/datos/proyectos-validados-cualitativo.js` — **51 proyectos**, los que
quedaron con `DESTINO FINAL = PROYECTO` **y** `Confianza = alta`. Ese doble
filtro es deliberado: son los que cuelgan de un programa oficial de la hoja
`Intereses` y tienen eje POA, o sea los que no dependen de ningún juicio
discutible.

Ambiente 30 · Obras 10 · Capital Humano 5 · Salud 3 · Seguridad 3 · Trabajo y
Producción 0. La última queda en cero porque esa secretaría no tiene programas
cargados en `Intereses`, así que ninguno llega a confianza alta.

### Cómo entra

`Configuración → Datos del sistema → cargar datos reales`, que llama a
`cargarTodosLosProyectosReales()`. Total en pantalla: **128 proyectos** — estos
51 con eje `POA` real, 69 del maestro con `Puntual` aproximado, 8 de
Posicionamiento.

### Por qué NO se usó el importador CSV

Dos razones, y las dos siguen vigentes:

1. `CAMPOS_PROYECTO` en `importacion.js` marca `unidad` y `objetivo` como
   `requerido: true`, y el cualitativo no los tiene **por definición** — es la
   pestaña de los proyectos sin métrica. La simulación daba 3 filas cargables de
   3.806. (Nota: para Supabase ya se decidió que `objetivo` es nullable; el
   importador del prototipo quedó atrás.)
2. El botón de "Importar CSV" se sacó de `CargarProyectos.jsx` el 28/08.

El camino que sí sirve ya existía: `crearProyecto()` no pide esos campos. **No
se aflojó ninguna validación** — vale la pena no hacerlo sin necesidad.

### El refactor que se hizo en `repositorio.js`

Se extrajo `cargarListaDeSecretarias(secretarias, ejePorDefecto)`, que ahora
comparten las dos fuentes de datos reales. Dos detalles con intención:

- **El eje del dato manda**; el por defecto es solo para las fuentes que no
  traen la columna. El loader del maestro le pone `Puntual` a todo porque la
  pestaña `Estado de proyectos` no tiene columna Eje; estos 51 traen `POA`
  porque el cualitativo sí la tiene.
- **`cargarTodosLosProyectosReales()` corre los validados PRIMERO**, para que si
  un proyecto está en las dos fuentes gane el que tiene eje real. El loader es
  idempotente por `área + programa + proyecto`.

**Bug corregido de paso:** el loader armaba `yaCargados` una sola vez antes del
bucle, así que dos filas iguales dentro de la misma lista entraban las dos. No
se notaba porque el maestro no tiene repetidos; el cualitativo sí.

Tests en `pruebas/proyectos-validados.test.mjs` (6 casos). El que más importa es
el que fija que el eje real no se pierda: si eso se rompe, los 51 revisados uno
por uno quedan indistinguibles de los que nunca se revisaron.

---

## 5. Qué falta, y dónde está el dato

Lo que se ve incompleto en el portal con estos 51 cargados, en orden de
facilidad:

| # | Qué falta | Dónde está el dato | Dificultad |
|---|---|---|---|
| 1 | `unidad` y `objetivo` → sin barras de avance ni % | Pestaña `Objetivos` de cada `_db` | Fácil, pero ver la advertencia |
| 2 | `fecha_inicio` / `fecha_fin_prevista` → alertas de vencimiento vacías | Pestaña `Estado de proyectos` | Fácil, pero incompleto en origen |
| 3 | `avance` / `cantidad` | Pestaña `2. Cuantitativo` | Media |
| 4 | Historial de cada proyecto vacío | Las 3.806 filas del cualitativo | **Requiere modelo nuevo** |
| 5 | Mapa de obras vacío (zona, lat, lng) | No existe en ningún `_db` | Sin dato |
| 6 | `responsable` | No existe en el cualitativo | Sin dato |

**Advertencia sobre 1 y 2: los sheets están mucho más vacíos de lo que parece.**
Medido el 28/08 sobre las seis secretarías:

- `Objetivos`: 74 filas en total, 57 con objetivo, 47 con unidad. Solo **20**
  hacen match con el maestro.
- `Estado de proyectos`: 143 filas, de las cuales **68** tienen programa y
  proyecto. `Fecha de Inicio Proyectado` está cargada en 22, `Fecha de Fin` en
  15, y `Ubicación` en **0 de 143**.
- Cruzando los 128 proyectos clasificados contra `Objetivos`: **10** tienen
  alguna métrica. Con confianza alta, **3**.

O sea: el punto 1 no es "cargar los objetivos que faltan", es "los objetivos no
están cargados en el sheet". Es un problema de gestión, no de código.

El punto 4 es el que vale la pena atacar aunque cueste: es el que convierte al
portal en algo que muestra la evolución de la gestión y no una foto.

---

## 6. Cómo leer y escribir los sheets

Hay un toolkit en `Informes/slides_api/` del repo de trabajo de JP (no de este
repo). Usa una **cuenta de servicio** de Google Cloud, no OAuth de usuario — sin
navegador, sin `access_denied`, sin token que venza a los 7 días.

| Archivo | Qué hace |
|---|---|
| `service_auth.py` | Autenticación. Devuelve `(slides, sheets, drive)` |
| `sheets_toolkit.py` | `leer`, `escribir`, `reemplazar`, `listar_pestanas`, `crear_pestana`, `contenido_de` |
| `probar_conexion.py` | Diagnóstico: qué APIs están habilitadas y qué hay compartido |

La cuenta es `claude-code@bot-coordinacion.iam.gserviceaccount.com` y **solo ve
lo que le comparten**. Ya tiene acceso de Editor a la carpeta de trabajo del
equipo. Para usarla desde otra máquina hace falta la clave JSON, que está en
`.secrets/` y no se versiona — pedírsela a JP.

### Dos trampas que costaron tiempo

**El conector de Google Drive de Claude trunca las pestañas a ~250 filas, sin
avisar.** No tira error ni marca nada. Eso invalidó una corrección entera el
25/08 — se descubrió recién cuando JP notó filas sin corregir. `sheets_toolkit.leer()`
no trunca; usar ese. Y `download_file_content` con `text/csv` trae la primera
pestaña completa, pero **solo la primera**.

**Los nombres de las pestañas importadas son inconsistentes.** En Obras y
Trabajo y Producción la pestaña se llama `cuantitativo_copia` pero el contenido
es el **cualitativo**. Salud usa `copia_cualitativo`. Cualquier script que
recorra las seis necesita esta tabla:

| Secretaría | `_db` | Pestaña con el cualitativo corregido |
|---|---|---|
| Ambiente | `1A3VdCSM5M2rzOf2kcWeNgET2trfKcsCxTr-YVHc9vZI` | `cualitativo_copia` |
| Capital Humano | `1IwbJSCdpo8y3WKN6rKqCYPpDLqsIb9j5LpDCFfKRjtQ` | `cualitativo_copia` |
| Obras | `1g7yeNVr01QxJhnsrF9kdGMdnxjAom4VoNjQtzXoKjOI` | `cuantitativo_copia` ⚠️ |
| Salud | `1izAozVURxZdI90fHVFeauGisRBtuPLiBi1VYSyRLK8k` | `copia_cualitativo` ⚠️ |
| Seguridad | `1QYEa8h9vcMA6naQ31xfoc0p2kaJ9lQ3MLjkEGMmYSnQ` | `cualitativo_copia` |
| Trabajo y Producción | `1d5yFOKxNhn_sUoF8PM8FgHfTEVl4OQP7Ux584_6yczE` | `cuantitativo_copia` ⚠️ |

Esas pestañas están **en los `_db` de producción**, no en copias. La pestaña
`1. Cualitativo` original está intacta al lado.

### Otros sheets del sistema

`Coordinacion_db` `1MqLANtoQPduz6RID9ZvGiiArZmDh7_ZscxoklD2-MaM` ·
`Ejes_Estratégicos` `1KSjweEfcE-1hqYrhdor3iW6xArrMNCjKgxDmMmZ1vFk` ·
`Informe` (hoja `Intereses`, la lista oficial de programas)
`1JYwZEAzSu_NRDRgHjxKOFMRL06hi3md9eXm5a6SEDSQ` ·
`Informe Dirección` `19Bq-B_Ql1UcCsLiyWfmFp0RGHc0dMGcYyLu5XiXSq50` ·
`Mesas Transversales` `1WwkZeNepEBHmYUeNSjvMOEgcrGa3gnzmzJ5jLUwAF6g` ·
`Pendientes` `1U_wAdjcG7lCeleyp1bpWGeQb77Pxo5WFQmzQnB7CzV0`

**Y uno que no estaba en el radar: `Puntuales`**
(`19BhLinNqxyr7CNPLJfBznM6_GdNrh2N8mJFoLIFX1Ho`), en la carpeta
`01. Puntuales`. Los puntuales **ya existen como planilla propia**, separada de
los `_db`. Es directamente relevante para la tabla `puntuales` del esquema —
conviene mirarlo antes de decidir cómo los modela el portal. No se abrió en esta
sesión.

También apareció una carpeta `11. Finanzas y Transformación del Estado`, un área
que no figura en `contexto/organigrama.md` ni en `programas-municipales.md`.
Todavía sin sheets adentro.

---

## 7. Decisiones abiertas

Ninguna de estas se tomó, y todas necesitan a JP o una conversación entre
ustedes dos. Listadas por lo que desbloquean:

1. **Agregar la colección de actualizaciones al prototipo React**, espejando
   `actualizaciones` de Supabase. Sin eso, las 3.806 filas no tienen dónde ir y
   se pierden cuatro columnas del `_db` (`Fecha de actualización`,
   `Estado General`, `Comentarios`, `Derivación`).
2. **Mover el eje de `proyectos` a la actualización**, o agregar
   `mesa_id` / `reunion_id` a `actualizaciones`. Toca el esquema de Supabase.
   Es lo que permite representar que una misma cosa se habló en el POA y en una
   mesa.
3. **Completar las 9 filas de la columna Q** y decidir qué hacer con
   `Servicios Generales` y `OOPP`, que no existen como proyecto.
4. **Cargar compromisos y puntuales.** El prototipo no tiene esas colecciones;
   Supabase sí. Son 208 + 24 nombres ya clasificados, esperando.
5. **Los 51 cargados tienen `tipo` asignado por secretaría, no relevado.**
   `tipo` no está en ningún `_db`. Hoy Ambiente y Salud son `Servicio`, Obras
   `Obra`, Capital Humano `Programa social`, Trabajo y Producción `Gestión
   interna`. De ahí sale `es_obra`, que decide si el proyecto aparece en el mapa
   — revisarlo proyecto por proyecto son 51 filas.

---

## 8. Para leer en orden

1. Este documento.
2. [`carga-cualitativo-al-portal.md`](carga-cualitativo-al-portal.md) — el
   diagnóstico completo con los siete impedimentos y sus números.
3. `analisis/auditoria-cualitativo-secretarias/README.md` (repo de trabajo de
   JP) — secciones 7 y 8: cómo se clasificó y qué corrigió JP.
4. El sheet «limpieza de datos», columnas P y Q.
5. `docs/registro-de-cambios.md`, entrada del 28/08/2026.
