/**
 * Proyectos de las seis secretarías VALIDADOS UNO POR UNO, relevados de la
 * pestaña "1. Cualitativo" de cada `_db` el 26/08/2026 y clasificados con JP
 * entre el 26 y el 28/08.
 *
 * Es dato real institucional, como `proyectos-reales-secretarias.js`, pero de
 * OTRA fuente y con otro nivel de certeza:
 *
 *  - `proyectos-reales-secretarias.js` sale de la pestaña maestra "Estado de
 *    proyectos", que está poco poblada (68 de 143 filas tienen programa y
 *    proyecto, `Ubicación` está vacía en todas) y NO trae la columna `Eje`,
 *    así que su loader le pone "Puntual" a todo como aproximación.
 *  - este archivo sale del cualitativo, donde cada fila es una actualización y
 *    no un proyecto. Las 3.806 filas se colapsaron en 425 nombres distintos,
 *    JP revisó cuáles son proyectos de verdad y cuáles son compromisos,
 *    puntuales o actualizaciones de otra cosa, y acá quedan SOLO los que
 *    quedaron como proyecto con confianza alta: cuelgan de un programa oficial
 *    de la hoja `Intereses` y tienen eje POA.
 *
 * Por eso estos traen `eje` real y programa oficial, y los otros no.
 *
 * `estado` va crudo, tal como está en el sheet ("Programado", "Alerta",
 * "Pendiente"): lo traduce `mapearEstado()` en el loader, que además deja el
 * valor original en las observaciones. Nunca se pisa en silencio.
 *
 * `cargas` es cuántas veces se actualizó ese proyecto en el cualitativo entre
 * febrero y agosto de 2026. No se usa para nada todavía — queda como rastro de
 * cuánta historia tiene cada uno cuando se cargue la tabla de actualizaciones.
 *
 * El detalle de cómo se clasificó está en
 * `analisis/auditoria-cualitativo-secretarias/README.md` (secciones 7 y 8) y el
 * diagnóstico de por qué el cualitativo no entra tal cual, en
 * `docs/carga-cualitativo-al-portal.md`.
 */

export const VALIDADOS_AMBIENTE = [
  { programa: "Plan de poda", proyecto: "Plan de Poda", eje: "POA", estado: "Finalizado", comentarios: "Plaza Sargento Cabral || Comienzo 22/06 y finalizacion 13/07 Plazoletas de Ciudad Jardín || Comienzo 06/07 y finalizacion 13/07 Plaza Mariano Moreno || Comienzo 13/07 finalizacion 20/07 Plaza San Cayetano || Comienzo 13/07 finalizacion 20/07 Traza Fiscehtti || Comienzo 06/07 finalizacion 13/07 Traza Estada || Comienzo 06/07 finalizacion 13/07 Traza Julio Perdiguero || Comienzo 06/07 finalizacion 1", fechaActualizacion: "2026-08-17", cargas: 79 },
  { programa: "Mantenimiento de Espacios Verdes", proyecto: "Plan de forestación", eje: "POA", estado: "Finalizado", comentarios: "Trabajos ejecutados semana anterior Paseo de los granaderos | Finaliza el 05/06 Alvear | Finaliza el 05/06 Ingreso del CEA | Finaliza el 05/06 Manzanares | Finaliza el 05/06 Olavarria y Parodi: Pendiente intervencion de Roco", fechaActualizacion: "2026-08-17", cargas: 60 },
  { programa: "Plan de mantenimiento y mejoramiento de Pluviales", proyecto: "Intervenciones en sumideros", eje: "POA", estado: "Alerta", comentarios: "Frenado", fechaActualizacion: "2026-03-30", cargas: 5 },
  { programa: "Sin programa", proyecto: "Entrega de composteras", eje: "POA", estado: "Finalizado", comentarios: "Realizado el sabado. Próxima entrega e 18 de abril y con presencia de Roco", fechaActualizacion: "2026-04-06", cargas: 3 },
  { programa: "Plan de Alumbrado", proyecto: "Plan de Alumbrado", eje: "POA", estado: "En ejecución", comentarios: "En ejecución: Colocación columnas - Columnas en puntos extraídos por Telecom || inicia el 27/03 TAGS - Mantenimiento de pintura en columnas || 16 cuadras ||2da semana, inicia el 13/03 Mantenimiento de pintura en Senador Ferro - Columna 9m. cableado", fechaActualizacion: "2026-03-16", cargas: 3 },
  { programa: "Plan de mantenimiento y mejoramiento de Pluviales", proyecto: "Plan de mantenimiento y mejoramiento de Pluviales", eje: "POA", estado: "Pendiente", comentarios: "Sin novedades", fechaActualizacion: "2026-03-16", cargas: 3 },
  { programa: "Plan de poda", proyecto: "Plaza Esteban Echeverría", eje: "POA", estado: "Finalizado", comentarios: "Poda general || 02-03 al 09-03", fechaActualizacion: "2026-03-09", cargas: 3 },
  { programa: "Plan de poda", proyecto: "Plaza Padre Elizalde - Poda General", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 10/04", fechaActualizacion: "2026-03-06", cargas: 2 },
  { programa: "Plan de Alumbrado", proyecto: "2da etapa plafones", eje: "POA", estado: "Finalizado", comentarios: "Colocación de plafones || 48 unidades ||", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Buzones en plaza", eje: "POA", estado: "Finalizado", comentarios: "Buzones de bajada para feriantes || 6 unidades", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Cementerio", eje: "POA", estado: "Pendiente", comentarios: "Remoción de farolas antiguas || 1era y 2da semana, inicia el 13/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Colocación columnas", eje: "POA", estado: "Pendiente", comentarios: "Columnas en puntos extraídos por Telecom || inicia el 27/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Columnas de Senador Ferro", eje: "POA", estado: "Pendiente", comentarios: "Mantenimiento de pintura en columnas || 16 cuadras ||2da semana, inicia el 13/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Diag. Stephenson - Pres. Kennedy", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 24/04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Estacion Fernandez Moreno", eje: "POA", estado: "Finalizado", comentarios: "Estacion Fernandez Moreno, colocación de farolas y recambio de led", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Guemes", eje: "POA", estado: "Pendiente", comentarios: "Poda de sendero || 03-04 al 17-04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Intendente Ramón Landín", eje: "POA", estado: "En ejecución", comentarios: "Poda de sendero || 02-03 al 23-03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Miguel Angel", eje: "POA", estado: "En ejecución", comentarios: "Poda de sendero || 02-03 al 23-03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza Alianza", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 24/04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza Las Palmeras", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 17/04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza Longo", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 17/04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza Pineral", eje: "POA", estado: "Pendiente", comentarios: "Poda general || inicia el 23/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza San Leonardo Murialdo", eje: "POA", estado: "Finalizado", comentarios: "Poda general ||", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plaza artilleros", eje: "POA", estado: "Finalizado", comentarios: "Poda general ||", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Plaza el gaucho", eje: "POA", estado: "Pendiente", comentarios: "Aéreo y soterrado || 2da, 3era y 4ta semana, inicia el 27/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Plazoleta Lola Mora", eje: "POA", estado: "Pendiente", comentarios: "Inicia el 16/03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Poda Caseros   Poligono 1", eje: "POA", estado: "En ejecución", comentarios: "Poda general || 02-03 al 16-03", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Poda Caseros   Poligono 2", eje: "POA", estado: "Pendiente", comentarios: "Poda general || 23-03 al 10-04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de poda", proyecto: "Poda Caseros   Poligono 3", eje: "POA", estado: "Pendiente", comentarios: "Poda general || 17-04 al 24-04", fechaActualizacion: "2026-03-06", cargas: 1 },
  { programa: "Plan de Alumbrado", proyecto: "Renovación bradley", eje: "POA", estado: "Finalizado", comentarios: "Repotenciación y colocacion nuevas columnas || 66 unidades", fechaActualizacion: "2026-03-06", cargas: 1 },
];

export const VALIDADOS_CAPITAL_HUMANO = [
  { programa: "Descentralización", proyecto: "Descentralización", eje: "POA", estado: "En ejecución", comentarios: "Libertador - Modulo Wifi ok Luz estamos esperando que de la empresa vayan a terminar el cercado de la sede para que ya edenor pueda instalar el tablero EDLA esta en obra el módulo", fechaActualizacion: "2026-08-17", cargas: 25 },
  { programa: "Descentralización", proyecto: "Descentralización Sede Villa Bosch", eje: "POA", estado: "En ejecución", comentarios: "Comenzó la mudanza el 15/4 al Derqui. Se están llevando a cabo una reunión semanal por cuestiones operativas El COM está bien para el uso de depósito", fechaActualizacion: "2026-04-13", cargas: 9 },
  { programa: "Obras de infraestructura escolar en Barrios Populares", proyecto: "Obras de infraestructura escolar en Barrios Populares", eje: "POA", estado: "En ejecución", comentarios: "- Técnica 3 | El Libertador | 16/03 pliegos | ejecución 16/06 hasta agosto. - EP 41 | Pablo Pódesta | 23/03 pliegos | ejecución 16/06 hasta octubre. - EP | Evita | 30/03 pliegos | ejecución 30/06 hasta septiembre. - Entornos municipales | 06/04 pliegos | ejecución 06/07 hasta octubre. - EES 09 | 11 de septiembre | 13/04 pliegos | ejecución 13/04 hasta enero 2027. Se atrasaron los pliegos, 27 pasar", fechaActualizacion: "2026-03-30", cargas: 4 },
  { programa: "Empleo, inclusión y economía popular", proyecto: "Capacitaciones cipec", eje: "POA", estado: "En ejecución", comentarios: "La prueba piloto comenzará el 27/03 y se realizará únicamente con egresados.", fechaActualizacion: "2026-03-02", cargas: 3 },
  { programa: "Obras de infraestructura BBPP", proyecto: "Obras de infraestructura en BBPP", eje: "POA", estado: "Alerta", comentarios: "Isla bajó suministro el 09/04", fechaActualizacion: "2026-04-20", cargas: 3 },
];

export const VALIDADOS_OBRAS = [
  { programa: "Demarcación de Calles", proyecto: "Demarcación de Calles", eje: "POA", estado: "En ejecución", comentarios: "La demarcación comienza la semana del 27/07 Puntos de del SUM anterior Isabel fernandez y nuestra señora del carmen Lisandro de la torre Benito Ferro", fechaActualizacion: "2026-08-10", cargas: 56 },
  { programa: "Túnel América", proyecto: "Túnel America", eje: "POA", estado: "En ejecución", comentarios: "El 2/7 se pagó a las empresas, esta pendiente de la empresa.", fechaActualizacion: "2026-08-10", cargas: 25 },
  { programa: "Obras pluviales", proyecto: "14 puntos de Obras pluviales", eje: "POA", estado: "En ejecución", comentarios: "En cotización de sumidero en Merlo e Iribarren", fechaActualizacion: "2026-08-10", cargas: 24 },
  { programa: "Túnel Hornos", proyecto: "Túnel Hornos", eje: "POA", estado: "En ejecución", comentarios: "INTERFERENCIAS: ver esquema de licitación Plan de trabajo: a entregarse una vez se finalice las cotizaciones de las interferencias", fechaActualizacion: "2026-08-10", cargas: 23 },
  { programa: "Intervención Miramar", proyecto: "Intervención Miramar", eje: "POA", estado: "Alerta", comentarios: "Intervenciones previas a la obra desestimadas", fechaActualizacion: "2026-04-20", cargas: 9 },
  { programa: "Plan de Acupuntura Urbana", proyecto: "Plan de Acupuntura Urbana", eje: "POA", estado: "Alerta", comentarios: "Presupuesto en revisión", fechaActualizacion: "2026-04-13", cargas: 7 },
  { programa: "Cuenca 2", proyecto: "Cuenca 2", eje: "POA", estado: "Pendiente", comentarios: "Pendiente presentación del plan reducido", fechaActualizacion: "2026-03-30", cargas: 6 },
  { programa: "Plan de Bacheo", proyecto: "Plan de Bacheo", eje: "POA", fechaActualizacion: "2026-08-17", cargas: 4 },
  { programa: "Plan de Bacheo", proyecto: "Programación Semana Actual", eje: "POA", estado: "En ejecución", comentarios: "Caseros Norte: 2 cuadrantes Caseros Sur: 2 cuadrantes Villa Bosch: 3 cuadrantes Ciudadela: 4 cuadrantes", cargas: 1 },
  { programa: "Plan de Bacheo", proyecto: "Programación Semana Anterior", eje: "POA", estado: "En ejecución", comentarios: "Caseros Norte: 2 cuadrante y 2 puntos Villa Bosch: 3 cuadrantes Ciudadela: 5 cuadrantes y 1 punto Loma Hermosa: 1 punto Ciudad Jardín: 1 punto Martín Coronado: 1 punto", fechaActualizacion: "2026-03-17", cargas: 1 },
];

export const VALIDADOS_SALUD = [
  { programa: "Cobertura de vacunación", proyecto: "Cobertura de vacunación", eje: "POA", estado: "En ejecución", comentarios: "Informe listo con el desglose por vacunas por años", cargas: 26 },
  { programa: "Telemedicina", proyecto: "Telemedicina", eje: "POA", estado: "En ejecución", comentarios: "Casos de telemedicina en aumento después de las campañas, evaluar sostenibilidad de la promoción con una estrategia conjunta: comunicación, modernización, atv y bajadas territoriales", cargas: 20 },
  { programa: "Recupero financiero del sistema de salud", proyecto: "Recupero financiero del sistema de salud", eje: "POA", estado: "En ejecución", comentarios: "50M OSDEPIM 60M PAMI", cargas: 11 },
];

export const VALIDADOS_SEGURIDAD = [
  { programa: "Informe de Estadísticas Generales", proyecto: "Informe de Estadísticas Generales", eje: "POA", estado: "En ejecución", comentarios: "Actualización 6 a 12 de Abril: Incidencia Delictiva: Descenso de 189 a 188 delitos totales (-0,05%). ---------------------------------------------------------------------- Localidades Críticas (Mayor suba porcentual): Pablo Podestá: +150% (de 2 a 5 hechos) Martín Coronado: +55,6% (de 9 a 14 hechos) Ciudadela: +43,3% (de 30 a 43 hechos) Caseros: +23,4% (de 47 a 58 hechos) --------------------------", fechaActualizacion: "2026-04-13", cargas: 6 },
  { programa: "COM + IA", proyecto: "COM + IA", eje: "POA", estado: "Pendiente", comentarios: "Pendiente definir cantidad, ejecutar SUM y avanzar.", fechaActualizacion: "2026-04-06", cargas: 5 },
  { programa: "Informe de Estadísticas Generales", proyecto: "Informe de Estadísticas Generales Mensual", eje: "POA", estado: "En ejecución", comentarios: "Actualización 30 a 5 de marzo: Incidencia Delictiva: Descenso de 198 a 188 delitos totales (-5,1%). ---------------------------------------------------------------------- Localidades Críticas (Mayor suba porcentual): Villa Raffo: +200% (de 2 a 6 hechos) El Libertador: +55,6% (de 9 a 14 hechos) Ciudad Jardín: +55,6% (de 9 a 14 hechos) Ciudadela: +30,4% (de 23 a 30 hechos) Comisaría 9°: +28,6% (de 1", fechaActualizacion: "2026-05-11", cargas: 4 },
];

export const VALIDADOS_TRABAJO_Y_PRODUCCION = [
];

/**
 * Mismo formato que `SECRETARIAS_REALES` para que el loader pueda recorrer las
 * dos listas igual. `tipoDefault` se mantiene idéntico al de aquel archivo: el
 * tipo no está cargado en ningún `_db`, así que sigue siendo una asignación por
 * secretaría y no un dato relevado — revisarlo proyecto por proyecto es una
 * tarea pendiente.
 */
export const SECRETARIAS_VALIDADAS = [
  {
    area: { id: 'ar_r_ambiente', nombre: 'Secretaría de Ambiente y Servicios Públicos', prefijo: 'AMB' },
    tipoDefault: 'Servicio',
    datos: VALIDADOS_AMBIENTE,
  },
  {
    area: { id: 'ar_r_capital', nombre: 'Secretaría de Capital Humano', prefijo: 'CAH' },
    tipoDefault: 'Programa social',
    datos: VALIDADOS_CAPITAL_HUMANO,
  },
  {
    area: { id: 'ar_r_obras', nombre: 'Secretaría de Obras', prefijo: 'OBR' },
    tipoDefault: 'Obra',
    datos: VALIDADOS_OBRAS,
  },
  {
    area: { id: 'ar_salud', nombre: 'Secretaría de Salud', prefijo: 'SAL' },
    tipoDefault: 'Servicio',
    datos: VALIDADOS_SALUD,
  },
  {
    area: { id: 'ar_r_seguridad', nombre: 'Secretaría de Seguridad', prefijo: 'SEG' },
    tipoDefault: 'Servicio',
    datos: VALIDADOS_SEGURIDAD,
  },
  {
    area: { id: 'ar_r_trabajo', nombre: 'Secretaría de Trabajo y Producción', prefijo: 'TYP' },
    tipoDefault: 'Gestión interna',
    datos: VALIDADOS_TRABAJO_Y_PRODUCCION,
  },
];
