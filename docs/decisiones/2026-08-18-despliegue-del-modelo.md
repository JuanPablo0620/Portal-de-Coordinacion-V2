# Decisiones del 18/08/2026 — reunión con Salva

Reunión entre los dos integrantes que construyen el portal. Tres temas:
interfaz/carga de datos, despliegue del modelo de IA, y qué resuelve un script
en vez del modelo.

---

## 1. Interfaz y módulos de carga (para cerrar la base de datos)

**Decisión:** avanzar con el diseño de la interfaz usando **los datos actuales de
los sheets** como insumo. La interfaz es lo que termina de definir la base: hasta
no saber qué formulario carga cada cosa, el esquema queda a medio confirmar.

Esto reordena la prioridad: el esquema fusionado ya está escrito
(`supabase/migrations/0001_esquema.sql`, 44 tablas), pero **no se aplica a
Supabase hasta que los formularios de carga estén definidos**, para no migrar dos
veces.

Módulos que hoy existen en el front (`src/modulos/`) y necesitan su formulario
definido contra el esquema:

| Módulo | Tablas que toca |
|---|---|
| `proyectos` | `proyectos`, `programas`, `areas`, `actualizaciones` |
| `seguimiento` | `seguimientos`, `seguimientos_proyectos`, `compromisos` |
| `monitoreo` | `monitoreos`, `temas_monitoreo` |
| `planificacion` | `planificacion_anual`, `planificacion_trimestres`, `hitos_planificacion` |
| `mesas` | `mesas`, `reuniones_mesa`, `mesas_proyectos` |
| `eventos` | `eventos`, `requerimientos_evento` |
| `estrategicos` | `proyectos` (marca), `motivos_estrategicos` |
| `posicionamiento` | `acciones_internacionales` y sus tablas puente |
| `obras` | `proyectos` + `actividades` (con lat/lng para el mapa) |
| `reportes` | solo lectura + `reportes_guardados` |

Criterio de trabajo: por cada módulo, listar los campos del formulario, cruzarlos
contra las columnas del esquema, y anotar los tres casos posibles — campo que
sobra, campo que falta, campo que existe con otro nombre.

---

## 2. Despliegue del modelo — cómo se paga la API

**Decisión de arranque:** Salva pone su tarjeta personal para el consumo de la
API, con un **límite diario de uso**. El chatbot muestra explícitamente que la
disponibilidad es acotada por presupuesto.

**Si al intendente le resulta útil y quiere usarlo más seguido**, se abren dos
caminos:

- **Opción A** — el municipio se hace cargo del consumo de la API.
- **Opción B** — se compra una placa de video y queda una computadora prendida
  24/7 en la oficina corriendo un modelo propio.

### El límite diario no es solo una restricción: es el instrumento de medición

El contador que corta el uso es el mismo que después justifica el pedido de
presupuesto. Si el medidor se llena todos los días, eso *es* el argumento para la
opción A. Por eso conviene registrar consumo por usuario y por tipo de consulta
desde el primer día, no solo el total.

Implementación en tres capas:

1. **Consola de Anthropic** — workspace propio del proyecto con su API key, para
   aislar el consumo y poder mirarlo separado del resto. Verificar ahí qué tope
   de gasto se puede fijar a nivel organización/workspace.
2. **Base de datos** — tabla de consumo: fecha, usuario, modelo, tokens de
   entrada, tokens de salida, tokens leídos de caché, costo estimado. Cada
   respuesta de la API devuelve un objeto `usage`; se guarda tal cual. Antes de
   cada llamada se suma el costo del día y, si supera el tope, se corta.
3. **Interfaz** — medidor visible en el chatbot ("consultas disponibles hoy: X de
   Y") con el motivo escrito en texto llano.

### Números para decidir entre A y B

Consulta típica estimada del asistente: ~10.000 tokens de entrada (instrucciones
+ contexto recuperado de la base) y ~800 de salida.

| Modelo | Costo por consulta | 30 consultas/día | 100 consultas/día |
|---|---|---|---|
| Haiku 4.5 | ~USD 0,014 | ~USD 13/mes | ~USD 42/mes |
| Sonnet 5 | ~USD 0,042 | ~USD 38/mes | ~USD 126/mes |
| Opus 5 | ~USD 0,070 | ~USD 63/mes | ~USD 210/mes |

Con caché de prompt (las instrucciones fijas y el esquema de la base no cambian
entre consultas) la parte estable de la entrada se cobra a una décima parte. Hay
un mínimo de tokens para que la caché se active y **varía por modelo**: 4096 en
Haiku 4.5, 1024 en Sonnet 5, 512 en Opus 5. Con instrucciones cortas, en Haiku la
caché directamente no se activa.

Contra eso, la opción B: una placa de 24 GB del orden de USD 2.500–3.500 en el
país, más el equipo, más el consumo eléctrico de tenerla prendida 24/7. A un
consumo de API de USD 40/mes, la placa tarda más de cinco años en amortizarse. Y
el modelo abierto que entra en 24 GB rinde bastante por debajo de Sonnet para
razonar sobre tablas y redactar en español institucional.

**Conclusión económica: la opción A es la correcta.** La opción B se justifica
por otros motivos, que son legítimos pero hay que nombrarlos como lo que son:

- **Datos sensibles que no pueden salir del municipio.** Atendible, pero se
  resuelve antes: los datos personales de reclamos y casos sociales no deberían
  entrar al índice del asistente (Ley 25.326); se agrega a nivel barrio.
- **Vía administrativa.** En el municipio suele ser más simple aprobar la compra
  de un equipo (bien de capital) que una erogación recurrente en dólares con
  tarjeta. Si ése es el bloqueo real, la placa no es un disparate: es convertir
  presupuesto corriente en inversión de capital. El costo es un resultado técnico
  peor.

### Riesgo a nombrar

Que el servicio dependa de la tarjeta personal de una persona es exactamente el
problema de continuidad que la propuesta de memoria institucional dice resolver.
Sirve como puente para la demostración; no sirve como esquema definitivo. Conviene
que quede escrito desde ahora, para que cuando se pida presupuesto no parezca un
pedido nuevo sino el cierre de algo previsto.

---

## 3. Todo lo que pueda resolver un script, lo resuelve un script

**Decisión:** minimizar el consumo de tokens moviendo a código todo lo que no
requiera criterio.

| Va por script (sin modelo) | Necesita modelo |
|---|---|
| Generación de PDF / DOCX / PPTX a partir de datos | Redacción de textos narrativos (conclusiones de informe) |
| Envío de mails y recordatorios (tarea programada) | Interpretar apuntes de reunión y proponer actualizaciones |
| Cálculo de % de avance y bandas de cumplimiento | Preguntas en lenguaje natural que no matchean un patrón |
| Exportaciones CSV / XLSX | Normalizar o clasificar texto libre cargado a mano |
| Alertas por umbral (crítico <65%, mínimo <80%) | |
| Gráficos y tableros | |
| Consultas frecuentes resueltas con SQL predefinido | |

**El patrón correcto para los documentos**: el modelo genera el **texto** o un
**JSON estructurado**; el código arma el archivo. Nunca el modelo "arma el PDF" —
sale más caro, más lento y menos predecible.

**Consultas con respuesta conocida**: si la pregunta encaja con un patrón
frecuente ("cuántos reclamos de bacheo se resolvieron este mes"), la responde una
consulta a la base, no el modelo. Vale mantener una lista de intenciones
predefinidas y mandar al modelo solo lo que no encaje. Es el ahorro más grande
disponible.

---

## Pendientes que salen de esta reunión

- [ ] Definir formularios de carga módulo por módulo contra el esquema fusionado.
- [ ] Recién después, aplicar las migraciones a Supabase.
- [ ] Tabla de consumo de IA + corte por tope diario + medidor en la interfaz.
- [ ] Workspace propio en la consola de Anthropic con su API key.
- [ ] Lista de intenciones predefinidas que se resuelven con SQL.
- [ ] Confirmar qué datos quedan fuera del índice del asistente por Ley 25.326.
