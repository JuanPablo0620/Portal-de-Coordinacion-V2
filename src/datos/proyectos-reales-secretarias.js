/**
 * Proyectos reales de las siete secretarías, relevados el 19/08/2026 desde la
 * pestaña oculta "Estado de proyectos" de cada `_db` (Ambiente_db,
 * Capital_humano_db, Obras_db, Salud_db, Seguridad_db, Trabajo_y_Produccion_db).
 * Coordinación ya tiene su propio archivo — ver `posicionamiento-real.js`.
 *
 * Es DATO REAL institucional, no sintético — igual que `posicionamiento-real.js`
 * y a diferencia de `demo.js`/`base-completa.js`. Reemplaza, para quien mira el
 * portal, la necesidad de usar datos de prueba: JP pidió "una buena cantidad de
 * datos reales de los sheets... para poder ver el portal con datos reales"
 * (19/08/2026).
 *
 * Estos son los datos CRUDOS tal como están escritos en cada sheet — el mapeo a
 * los campos reales del proyecto (area/programa/eje/tipo/estado del catálogo)
 * vive en el loader (`cargarProyectosRealesSecretarias()` en repositorio.js),
 * para que este archivo sea solo lo que se relevó, sin mezclar decisiones de
 * modelado.
 *
 * Notas de relevamiento (no se inventó nada; lo que no estaba cargado, se dejó
 * afuera o se marcó tal cual):
 *
 * - La pestaña "Estado de proyectos" NO tiene columna "Eje" (Puntual/POA/
 *   Compromisos/Mesa...) — esa información vive en las pestañas "1. Cualitativo"
 *   / "2. Cuantitativo", que no se relevaron en esta tanda. El loader asigna
 *   "Puntual" por defecto a todos estos proyectos; es una aproximación, no un
 *   dato relevado.
 * - Varios `estado` no son ninguno de los cinco estados del catálogo del
 *   sistema (planificado / en ejecución / demorado / finalizado / suspendido):
 *   aparecen "Alerta", "Crítico", "Programado", "Por debajo del objetivo",
 *   vacíos, o directamente el número "0" (probablemente resto de una fórmula
 *   rota). El loader los traduce con `mapearEstado()` y siempre conserva el
 *   valor real en las observaciones — nunca se pisa en silencio.
 * - Trabajo y Producción solo tiene UNA fila real cargada en su maestro: la
 *   pestaña está recién empezando a poblarse en ese sheet (confirmado, no es
 *   un error de relevamiento).
 * - Ambiente: "Plan de poda" tiene un comentario truncado (la lista completa de
 *   plazas/trazas en el sheet es más larga) — se dejó una nota explícita en el
 *   texto en vez de resumir sin avisar.
 * - Capital Humano: 5 filas de "Protección Social" tienen `estado: '0'` en el
 *   sheet — mismo caso que Ambiente/Seguridad, no se corrigió el dato de origen.
 * - Salud usa el id de catálogo `ar_salud`, el mismo que ya existía en la
 *   semilla desde antes de esta carga (antes del 20/08/2026 lo compartía con
 *   una de las ocho áreas genéricas que usaba `demo.js`; esas se sacaron del
 *   todo del catálogo — ver la nota en `catalogos.js`).
 * - Seguridad: "Cámaras operativas" tiene fecha de última actualización de
 *   2025 (no 2026) — así figura en el sheet.
 */

export const PROYECTOS_REALES_AMBIENTE = [
  { programa: 'Recolección de Residuos', proyecto: 'Acumulación de Basura (% de Resolución)', estado: '', comentarios: '[ 136% | Res: 1158 | Ing: 849]', fechaActualizacion: '2026-05-04' },
  { programa: 'Recolección de Residuos', proyecto: 'Acumulación de Basura (Cantidad Resueltos)', estado: '0,5837137877', comentarios: '[ 586 Reportes Resueltos]', fechaActualizacion: '2026-01-02' },
  { programa: 'Recolección de Residuos', proyecto: 'Recolección Domiciliaria (% de Resolución)', estado: '', comentarios: '[ 93% | Res: 1110 | Ing: 1198]', fechaActualizacion: '2026-05-04' },
  { programa: 'Recolección de Residuos', proyecto: 'Servicio de Barrido (% de Resolución)', estado: '', comentarios: '[ 103% | Res: 381 | Ing: 370]', fechaActualizacion: '2026-05-04' },
  { programa: 'Mantenimiento de Alumbrado Público', proyecto: 'Luminaria no funciona (% de Resolución)', estado: '', comentarios: '[ 120% | Res: 751 | Ing: 625]', fechaActualizacion: '2026-05-04' },
  { programa: 'Mantenimiento de Alumbrado Público', proyecto: 'Luminaria prendida (% de Resolución)', estado: '', comentarios: '[ 113% | Res: 70 | Ing: 62]', fechaActualizacion: '2026-05-04' },
  { programa: 'Plan de mantenimiento y mejoramiento de Pluviales', proyecto: 'Intervenciones en sumideros', estado: 'Alerta', comentarios: 'Frenado', fechaActualizacion: '2026-03-30' },
  { programa: 'Plan de mantenimiento y mejoramiento de Pluviales', proyecto: 'Intervenciones en sumideros (Cantidad)', estado: '2,55', comentarios: '[ 102 Sumideros] Verificado', fechaActualizacion: '2026-03-03' },
  { programa: 'Mantenimiento de Espacios Verdes', proyecto: 'Plan de forestación', estado: 'Finalizado', comentarios: 'Trabajos ejecutados semana anterior Paseo de los granaderos | Finaliza el 05/06 Alvear | Finaliza el 05/06 Ingreso del CEA | Finaliza el 05/06 Manzanares | Finaliza el 05/06 Olavarria y Parodi: Pendiente intervencion de Roco', fechaActualizacion: '2026-08-10' },
  { programa: 'Reciclado', proyecto: 'Reciclables secos', estado: '1,11336', comentarios: '[ 92780 KG] Verificado', fechaActualizacion: '2026-01-02' },
  { programa: 'Reciclado', proyecto: 'Aceite Vegetal Usado AVU', estado: '0,4338461538', comentarios: '[ 235 Litros] Verificado', fechaActualizacion: '2026-01-02' },
  { programa: 'Reciclado', proyecto: 'Neumáticos Fuera de Uso NFU', estado: '2,48', comentarios: '[ 3100 KG] Verificado', fechaActualizacion: '2026-03-03' },
  { programa: 'Reciclado', proyecto: 'Aparatos electrónicos en desuso', estado: '0', comentarios: '[ 0 KG]' },
  { programa: 'Reciclado', proyecto: 'Entrega de composteras', estado: 'Finalizado', comentarios: 'Realizado el sabado. Próxima entrega e 18 de abril y con presencia de Roco', fechaActualizacion: '2026-04-06' },
  { programa: 'Poda', proyecto: 'Poda (% de Resolución)', estado: '', comentarios: '[ 35% | Res: 116 | Ing: 327]', fechaActualizacion: '2026-05-04' },
  { programa: 'Intervenciones Alumbrado', proyecto: 'Intervenciones Alumbrado', estado: 'Programado', comentarios: 'Pendiente stock: Renovacion Antartida || Repotenciacion y colocacion nuevas columnas Cementerio Corredores seguros || Sin planificar MT Alvear || Colocación de columnas Plaza Eucaliptus Pluviometro Alimentacion Esperanza', fechaActualizacion: '2026-08-10' },
  { programa: 'Puntual Luminarias', proyecto: 'Renovación bradley', estado: 'Finalizado', comentarios: 'Repotenciación y colocacion nuevas columnas || 66 unidades', fechaActualizacion: '2026-03-06' },
  { programa: 'Puntual Luminarias', proyecto: 'Colocación columnas', estado: 'Pendiente', comentarios: 'Columnas en puntos extraídos por Telecom || inicia el 27/03', fechaActualizacion: '2026-03-06' },
  { programa: 'Puntual Luminarias', proyecto: '2da etapa plafones', estado: 'Finalizado', comentarios: 'Colocación de plafones || 48 unidades ||', fechaActualizacion: '2026-03-06' },
  { programa: 'Puntual Luminarias', proyecto: 'Plaza Echeverria', estado: '', comentarios: '' },
  { programa: 'Puntual Luminarias', proyecto: 'Buzones en plaza', estado: 'Finalizado', comentarios: 'Buzones de bajada para feriantes || 6 unidades', fechaActualizacion: '2026-03-06' },
  { programa: 'Puntual Luminarias', proyecto: 'Estacion Fernandez Moreno', estado: 'Finalizado', comentarios: 'Estacion Fernandez Moreno, colocación de farolas y recambio de led', fechaActualizacion: '2026-03-06' },
  { programa: 'Puntual Luminarias', proyecto: 'Plaza el gaucho', estado: 'Pendiente', comentarios: 'Aéreo y soterrado || 2da, 3era y 4ta semana, inicia el 27/03', fechaActualizacion: '2026-03-06' },
  { programa: 'Plan de Alumbrado', proyecto: 'Plan de Alumbrado', estado: 'En ejecución', comentarios: 'En ejecución: Colocación columnas - Columnas en puntos extraídos por Telecom || inicia el 27/03 TAGS - Mantenimiento de pintura en columnas || 16 cuadras || 2da semana, inicia el 13/03 Mantenimiento de pintura en Senador Ferro - Columna 9m. cableado', fechaActualizacion: '2026-03-16' },
  { programa: 'Plan de poda', proyecto: 'Plan de poda', estado: 'Finalizado', comentarios: 'Plaza Sargento Cabral || Comienzo 22/06 y finalizacion 13/07 Plazoletas de Ciudad Jardín || Comienzo 06/07 y finalizacion 13/07 Plaza Mariano Moreno || Comienzo 13/07 finalizacion 20/07 Plaza San Cayetano || Comienzo 13/07 finalizacion 20/07 [comentario truncado — sigue con ~14 trazas y plazas más hasta el 03/08 en el sheet original]', fechaActualizacion: '2026-08-10' },
  { programa: 'Intervenciones Alumbrado', proyecto: 'Retiro de obsolencias Luminicas', estado: 'Finalizado', comentarios: 'Trabajando sobre AV. Urquiza', fechaActualizacion: '2026-05-25' },
  { programa: 'Intervenciones Alumbrado', proyecto: 'Telegestion', estado: 'En ejecución', comentarios: 'Pendiente fecha Plaza Giorello', fechaActualizacion: '2026-04-06' },
  { programa: 'Intervenciones Alumbrado', proyecto: 'Telecom', estado: '', comentarios: '' },
  { programa: 'Intervenciones Alumbrado', proyecto: 'Colocacion de tags', estado: 'En ejecución', comentarios: 'Planificado colocacion en Alvear y el Norte', fechaActualizacion: '2026-04-06' },
];

export const PROYECTOS_REALES_CAPITAL_HUMANO = [
  { programa: 'Cine Ciudadela', proyecto: 'Cine Ciudadela', estado: 'En ejecución', comentarios: 'Se hizo una visita con un potencial comprador, en espera de que avance.', fechaActualizacion: '2026-03-02' },
  { programa: 'Empleo, inclusión y economía popular', proyecto: 'Capacitaciones CIPPEC', estado: 'En ejecución', comentarios: 'Nueva capacitacion de esmaltado 11/6', fechaActualizacion: '2026-06-01' },
  { programa: 'Empleo, inclusión y economía popular', proyecto: 'Deserción en Talleres', estado: 'PRUEBA PILOTO / Todavía no hay datos oficiales', comentarios: '[0% | Res: 350 | Ing: 500]', fechaActualizacion: '2026-02-12' },
  { programa: 'Descentralización', proyecto: 'Descentralización Sede Villa Bosch', estado: 'En ejecución', comentarios: 'Comenzó la mudanza el 15/4 al Derqui. Se están llevando a cabo una reunión semanal por cuestiones operativas. El COM está bien para el uso de depósito.', fechaActualizacion: '2026-04-13' },
  { programa: 'Eventos', proyecto: 'Eventos', estado: 'En ejecución', comentarios: 'Próximos eventos: Vivi Podesta (15/16 de agosto), Expo Universidades (20 agosto), Día del niño (agosto), 3f se mueve (8 agosto), Virgen de Urkupiña (sáb 15/08), Migrantes.', fechaActualizacion: '2026-08-10' },
  { programa: 'Jardines Municipales', proyecto: 'Inicio de la Jornada Completa en el nivel inicial', estado: '', comentarios: '¿Borrar proyecto?', fechaActualizacion: '2026-03-16' },
  { programa: 'Jardines Municipales', proyecto: 'Sistema de información para los Jardines Municipales', estado: 'En ejecución', comentarios: 'Cronograma: 22 al 26 junio, comité voluntario para probar la app; 26 junio a 15 julio, simulacro y encuentro con directivos; 03 agosto, lanzamiento oficial de la plataforma para uso interno; marzo 2027, lanzamiento con familias. Capacitaciones para maestras en curso.', fechaActualizacion: '2026-08-10' },
  { programa: 'Obras de infraestructura Escolar', proyecto: 'Obras de infraestructura Escolar', estado: 'En ejecución', comentarios: 'En ejecución armado de proyecto: Técnica 3, EP 47, EP 41.', fechaActualizacion: '2026-03-16' },
  { programa: 'Protección Social', proyecto: 'Personas localizadas - Personas en situación de calle', estado: '0', comentarios: '[0 Personas] Pendiente ver con Sistemas', fechaActualizacion: '2026-03-04' },
  { programa: 'Protección Social', proyecto: 'Operativo frío', estado: '0', comentarios: '[0 Medidas de abrigo] Pendiente ver con Sistemas', fechaActualizacion: '2026-03-04' },
  { programa: 'Protección Social', proyecto: 'CUDS', estado: '0', comentarios: '[0 Certificados] Pendiente ver con Sistemas', fechaActualizacion: '2026-03-04' },
  { programa: 'Protección Social', proyecto: 'Entrega de tirantes y chapas', estado: '0', comentarios: '[0 PENDIENTE] Pendiente ver con Sistemas', fechaActualizacion: '2026-03-04' },
  { programa: 'Protección Social', proyecto: 'Entrega de insumos alimenticios y de construcción', estado: '0', comentarios: '[0 PENDIENTE] Pendiente ver con Sistemas', fechaActualizacion: '2026-03-04' },
  { programa: 'Protección Social', proyecto: 'Protección Social', estado: 'En ejecución', comentarios: 'Operativo frío: inicio el 18/6, se releva a partir de la base de datos de Mi3F. Protección Social - Situación de calle al 23/07: Alertas 76, Casos activos 91, Parador 9.', fechaActualizacion: '2026-08-10' },
  { programa: 'SAE', proyecto: 'SAE', estado: 'Finalizado', comentarios: 'Continuar el seguimiento del SUM.', fechaActualizacion: '2026-06-15' },
  { programa: 'Obras de infraestructura escolar en Barrios Populares', proyecto: 'Obras de infraestructura escolar en Barrios Populares', estado: 'En ejecución', comentarios: 'Técnica 3 (El Libertador): pliegos 16/03, ejecución 16/06 a agosto. EP 41 (Pablo Pódesta): pliegos 23/03, ejecución 16/06 a octubre. EP (Evita): pliegos 30/03, ejecución 30/06 a septiembre. Entornos municipales: pliegos 06/04, ejecución 06/07 a octubre. EES 09 (11 de Septiembre): pliegos 13/04, ejecución hasta enero 2027. Se atrasaron los pliegos.', fechaActualizacion: '2026-03-30' },
  { programa: 'UDIs', proyecto: 'Plan Estratégico de las Unidades de Desarrollo Infantil (UDIs) y de la Sede Esperanza', estado: 'En ejecución', comentarios: 'Entrega de tarjetas: finalizaron la nueva etapa de inscripción con 537 inscriptos. Se entregaron los posnets pendientes (30 centros adheridos aprox.), pocos usándolo correctamente. Pendiente entrega de tarjetas (130 aprox.). Total inscriptos programa: 1460+.', fechaActualizacion: '2026-08-10' },
  { programa: 'EPIs', proyecto: 'Plan Estratégico de los Espacios de Primera Infancia (EPIs)', estado: 'En ejecución', comentarios: 'Pendiente actualizar información.', fechaActualizacion: '2026-04-27' },
  { programa: 'Casa de Tierras', proyecto: 'Regularización dominial', estado: 'En ejecución', comentarios: 'Favelita: pedimos 70 chapitas, fecha de entrega 12/8. Primera semana de agosto, firma de escrituras de 53 familias.', fechaActualizacion: '2026-08-10' },
  { programa: 'Puesta en valor CEDEMs', proyecto: 'Cedems', estado: 'En ejecución', comentarios: 'Techo microestadio: en licitación. Intervención cuadrilla municipal: en ejecución. Luces deportivas: en planificación, falta que Beto saque el suministro de luces.', fechaActualizacion: '2026-08-10' },
  { programa: 'Paramount', proyecto: 'Paramount', estado: 'Pendiente', comentarios: 'Resolver con SSGG la calefacción.', fechaActualizacion: '2026-08-10' },
];

export const PROYECTOS_REALES_OBRAS = [
  { programa: 'Proyectos urbanos', proyecto: 'Proyectos urbanos', estado: 'En ejecución', comentarios: 'Enviaron el proyecto y pendiente de OC de Cartelería', fechaActualizacion: '2026-08-10' },
  { programa: 'Licencias de conducir', proyecto: 'Licencias de conducir', estado: 'En ejecución', comentarios: 'Pendiente ver la mejora de la calidad fotográfica en Ciudadela y Caseros. No hay SUM de ploteo', fechaActualizacion: '2026-05-04' },
  { programa: 'Plan de Bacheo', proyecto: 'Obras de mantenimiento', estado: 'Pendiente', comentarios: 'Coordinar una mesa para ordenar prioridades del listado de necesidades de cada secretaría.', fechaActualizacion: '2026-05-04' },
  { programa: 'Plan de Bacheo', proyecto: 'Bacheo / Programación Semana Anterior', estado: 'Finalizado', comentarios: 'Caseros Sur: 3 cuadrantes + 1 traza. Caseros: 1 cuadrante + 2 trazas. Villa Bosch: 4 cuadrantes. Ciudadela: 4 cuadrantes + 4 trazas. Sáenz Peña: 1 traza. Villa Raffo: 2 trazas. Santos Lugares: 2 trazas + 1 punto. Ciudad Jardín: 1 cuadrante + 1 traza. Loma Hermosa: 1 cuadrante.', fechaActualizacion: '2026-08-10' },
  { programa: 'Plan de Bacheo', proyecto: 'Bacheo / Programación Semana Actual', estado: 'En ejecución', comentarios: 'Caseros: 1 cuadrante + 6 trazas. Villa Bosch: 3 cuadrantes + 1 traza. Ciudadela: 3 cuadrantes + 1 traza. Santos Lugares: 1 cuadrante + 1 traza. Loma Hermosa: 2 cuadrantes. Ciudad Jardín: 1 traza. Martín Coronado: 2 trazas. El Libertador: 1 traza.', fechaActualizacion: '2026-08-10' },
  { programa: 'Túnel Hornos', proyecto: 'Túnel Hornos', estado: 'En ejecución', comentarios: 'INTERFERENCIAS: ver esquema de licitación. Plan de trabajo: a entregarse una vez se finalicen las cotizaciones de las interferencias.', fechaActualizacion: '2026-08-10' },
  { programa: 'Demarcación de Calles', proyecto: 'Demarcación de Calles', estado: 'En ejecución', comentarios: 'La demarcación comienza la semana del 27/07. Puntos del SUM anterior: Isabel Fernández y Nuestra Señora del Carmen, Lisandro de la Torre, Benito Ferro.', fechaActualizacion: '2026-08-10' },
  { programa: 'Restauración casona Bosch', proyecto: 'Restauración casona Bosch', estado: 'Pendiente', comentarios: 'Esperando ver presupuesto, la primera cotización fue muy alta. Beto está gestionando la nueva cotización. Pendiente definir quién va a ocupar el espacio.', fechaActualizacion: '2026-04-06' },
  { programa: 'Obras Particulares', proyecto: 'Obras Particulares', estado: 'En ejecución', comentarios: 'Finalizado: Obra Plaza Artilleros y Obra Plaza Miguel Benitez (aguardando cartelería, inauguración 27/03). En ejecución: Obra Plaza Beltrán (próxima a finalizar). Pendientes: Obra Plaza El Campito y Obra Plaza Villa Parque (cotización oficial pendiente), Sendero Carrefour.', fechaActualizacion: '2026-03-30' },
  { programa: 'Plan Hidráulico Esperanza', proyecto: 'Cuenca 2', estado: 'Pendiente', comentarios: 'Pendiente presentación del plan reducido.', fechaActualizacion: '2026-03-30' },
  { programa: 'Intervención Miramar', proyecto: 'Intervención Miramar', estado: 'Alerta', comentarios: 'Intervenciones previas a la obra desestimadas.', fechaActualizacion: '2026-04-20' },
  { programa: 'Plan de Acupuntura Urbana', proyecto: 'Plan de Acupuntura Urbana', estado: 'Alerta', comentarios: 'Presupuesto en revisión.', fechaActualizacion: '2026-04-13' },
  { programa: 'Plan de Acupuntura Urbana', proyecto: 'EDLA', estado: 'Finalizado', comentarios: '' },
  { programa: 'Túnel America', proyecto: 'Túnel America', estado: 'En ejecución', comentarios: 'El 2/7 se pagó a las empresas, está pendiente de la empresa.', fechaActualizacion: '2026-08-10' },
  { programa: 'Obras pluviales', proyecto: '14 puntos de Obras pluviales', estado: 'En ejecución', comentarios: 'En cotización de sumidero en Merlo e Iribarren.', fechaActualizacion: '2026-08-10' },
  { programa: 'Servicios Generales', proyecto: 'SSGG / Actividades', estado: 'Finalizado', comentarios: 'Terminadas: Galpón SSUU (albañilería nueva y filtraciones), Oficinas Secretaría de Seguridad, Oficina de sector privado en primer piso, Oficinas Secretaría de Obras Públicas, Piso de comunicación, Zoonosis (poda y cierre de techo), HCD (oficina del presidente). Pendientes: bases para contenedor en EDLA, restauración de contenedor COM (traslado a R8 y Buen Ayre), reparación de techo CEDEM 4 (en ejecución).', fechaActualizacion: '2026-05-25' },
];

export const PROYECTOS_REALES_SALUD = [
  { programa: 'Telemedicina', proyecto: 'Telemedicina', estado: 'En ejecución', comentarios: 'Casos de telemedicina en aumento después de las campañas, evaluar sostenibilidad de la promoción con una estrategia conjunta: comunicación, modernización, atv y bajadas territoriales', fechaActualizacion: '2026-08-10' },
  { programa: 'Cobertura de vacunación', proyecto: 'Cobertura de vacunación', estado: 'En ejecución', comentarios: 'Informe listo con el desglose por vacunas por años', fechaActualizacion: '2026-08-10' },
  { programa: 'Recupero financiero del sistema de salud', proyecto: 'Recupero financiero del sistema de salud', estado: 'En ejecución', comentarios: '50M OSDEPIM 60M PAMI', fechaActualizacion: '2026-06-08' },
  { programa: 'Acceso a la Salud', proyecto: 'Indicadores Acceso a la Salud', estado: 'En ejecución', comentarios: 'Generando indicadores con el área', fechaActualizacion: '2026-05-18' },
  { programa: 'Inclusión de IA en procesos de la municipalidad', proyecto: 'Chatbot', estado: 'En ejecución', comentarios: 'Chatbot iniciado el 26/3, se desarrolla con normalidad', fechaActualizacion: '2026-08-10' },
  { programa: 'Inclusión de IA en procesos de la municipalidad', proyecto: 'Derivaciones con IA (Knidian)', estado: 'Pendiente', comentarios: 'Nuevo circuito de derivaciones de especialidades en CEMAR y OFTALMOLOGÍA || 26 de abril', fechaActualizacion: '2026-08-10' },
  { programa: 'Insumos críticos, stock y depósitos', proyecto: 'Nuevo Sistema Stock', estado: 'En ejecución', comentarios: 'Implementación orientada a optimizar la trazabilidad, el control y la eficiencia en el manejo de insumos médicos de la Secretaría', fechaActualizacion: '2026-08-10' },
  { programa: 'Same y emergencias', proyecto: 'Vehiculos Same y emergencias', estado: 'En ejecución', comentarios: 'Operativas: motos (3) y ambulancia (8) Alerta / Soicitudes: moto (1) y ambulancia (1)', fechaActualizacion: '2026-08-10' },
];

export const PROYECTOS_REALES_SEGURIDAD = [
  { programa: 'COM + IA', proyecto: 'COM + IA', estado: 'Pendiente', comentarios: 'Pendiente definir cantidad, ejecutar SUM y avanzar.', fechaActualizacion: '2026-04-06' },
  { programa: 'Cámaras', proyecto: 'Cámaras repuestas', estado: '', comentarios: '' },
  { programa: 'Cámaras', proyecto: 'Cámaras operativas', estado: 'Por debajo del objetivo', comentarios: '[ 0% | Res: 550 | Ing: 600 ]', fechaActualizacion: '2025-02-01' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Informe de Estadísticas Generales', estado: 'En ejecución', comentarios: 'Actualización 6 a 12 de Abril: Incidencia Delictiva: Descenso de 189 a 188 delitos totales (-0,05%). Localidades críticas con mayor suba: Pablo Podestá (+150%), Martín Coronado (+55,6%), Ciudadela (+43,3%), Caseros (+23,4%). Delitos con arma subieron 15,2% (de 46 a 53 eventos), concentrados en Caseros.', fechaActualizacion: '2026-04-13' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Delitos consumados y tentados', estado: '0', comentarios: '[ 134 Hechos ]', fechaActualizacion: '2026-05-04' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Delitos en finca', estado: '0', comentarios: '[ 17 Hechos ]', fechaActualizacion: '2026-05-04' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Delitos de automotor', estado: '0', comentarios: '[ Hechos ]', fechaActualizacion: '2026-04-21' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Delitos de motovehículo', estado: '0', comentarios: '[ Hechos ] No aparece este valor en esta semana', fechaActualizacion: '2026-05-04' },
  { programa: 'Informe de Estadísticas Generales', proyecto: 'Hurto de Vehículos', estado: '0', comentarios: '[ 52 Hechos ]', fechaActualizacion: '2026-05-04' },
];

export const PROYECTOS_REALES_TRABAJO_Y_PRODUCCION = [
  { programa: 'Cursos y Capacitaciones', proyecto: 'Cursos y Capacitaciones', estado: 'En ejecución', comentarios: 'Nuevas capacitaciones de empleo con ARLOG: ya salío el sum - Operador Logístico - Autoelevadores', fechaActualizacion: '2026-08-10' },
];

/**
 * Metadata de cada secretaría real: a qué área/catálogo mapea (mismos id/nombre
 * agregados en `catalogos.js`) y qué tipo de proyecto usar por defecto cuando el
 * sheet no distingue (obra/servicio/programa social/gestión interna/adquisición
 * son los cinco tipos del catálogo; ninguno describe con precisión cada fila, así
 * que se eligió el más representativo del grueso de cada secretaría).
 */
export const SECRETARIAS_REALES = [
  {
    area: { id: 'ar_r_ambiente', nombre: 'Secretaría de Ambiente y Servicios Públicos', prefijo: 'AMB' },
    tipoDefault: 'Servicio',
    datos: PROYECTOS_REALES_AMBIENTE,
  },
  {
    area: { id: 'ar_r_capital', nombre: 'Secretaría de Capital Humano', prefijo: 'CAH' },
    tipoDefault: 'Programa social',
    datos: PROYECTOS_REALES_CAPITAL_HUMANO,
  },
  {
    area: { id: 'ar_r_obras', nombre: 'Secretaría de Obras', prefijo: 'OBR' },
    tipoDefault: 'Obra',
    datos: PROYECTOS_REALES_OBRAS,
  },
  {
    // Reutiliza el id/nombre de la entrada genérica 'ar_salud' del catálogo:
    // el nombre real y el genérico coinciden ("Secretaría de Salud"), así que
    // no hay que crear una segunda área con el mismo nombre — ver la nota en
    // catalogos.js.
    area: { id: 'ar_salud', nombre: 'Secretaría de Salud', prefijo: 'SAL' },
    tipoDefault: 'Servicio',
    datos: PROYECTOS_REALES_SALUD,
  },
  {
    area: { id: 'ar_r_seguridad', nombre: 'Secretaría de Seguridad', prefijo: 'SEG' },
    tipoDefault: 'Servicio',
    datos: PROYECTOS_REALES_SEGURIDAD,
  },
  {
    area: { id: 'ar_r_trabajo', nombre: 'Secretaría de Trabajo y Producción', prefijo: 'TYP' },
    tipoDefault: 'Gestión interna',
    datos: PROYECTOS_REALES_TRABAJO_Y_PRODUCCION,
  },
];
