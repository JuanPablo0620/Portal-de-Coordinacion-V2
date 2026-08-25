/**
 * Catálogos cerrados.
 *
 * Dos familias, con reglas distintas:
 *
 *  · ADMINISTRABLES — viven en `bd.catalogos`, se editan desde Configuración y
 *    se dan de baja lógicamente. Son datos institucionales: la semilla de acá
 *    es provisoria y se reemplaza cuando el área entregue las listas vigentes.
 *
 *  · CONGELADOS — tienen semántica atada al código (el motor de alertas, los
 *    semáforos, las validaciones). Cambiarlos es cambiar comportamiento, no
 *    configuración, así que no se editan desde la interfaz.
 */

/* ── Congelados ─────────────────────────────────────────────────────── */

export const ESTADOS_PROYECTO = Object.freeze([
  'planificado',
  'en ejecución',
  'demorado',
  'finalizado',
  'suspendido',
]);

/** Estados que cuentan como proyecto activo (para contadores y alertas). */
export const ESTADOS_ACTIVOS = Object.freeze(['planificado', 'en ejecución', 'demorado']);

export const PRIORIDADES = Object.freeze(['alta', 'media', 'baja']);

export const CRITICIDADES = Object.freeze(['alta', 'media', 'baja']);

/**
 * Sin `vencido`: es un estado DERIVADO, no persistido. No hay proceso que lo
 * marque al cambiar el día, así que guardarlo garantizaría datos desactualizados.
 * Ver `estadoCompromiso()` en selectores.js.
 */
export const ESTADOS_COMPROMISO = Object.freeze(['pendiente', 'en curso', 'cumplido']);

export const ESTADOS_REQUERIMIENTO = Object.freeze(['solicitado', 'confirmado', 'entregado']);

export const TIPOS_MESA = Object.freeze(['temática', 'barrial', 'otros proyectos']);

export const ESTADOS_MESA = Object.freeze(['activa', 'latente', 'cerrada']);

export const ESTADOS_EVENTO = Object.freeze(['previsto', 'confirmado', 'realizado', 'suspendido']);

/**
 * Ciclo de vida de una acción de posicionamiento internacional.
 *
 * Es un embudo, no una lista de etiquetas: se identifica una oportunidad, se
 * prepara la presentación, se presenta, y de ahí sale vigente o no prosperó.
 * El orden importa —lo consumen el tablero y el semáforo—, así que va congelado.
 */
export const ESTADOS_INTERNACIONAL = Object.freeze([
  'identificada',
  'en preparación',
  'presentada',
  'vigente',
  'cerrada',
  'no prosperó',
]);

/** Estados en los que la acción todavía está en juego y hay algo que hacer. */
export const ESTADOS_INTERNACIONAL_ABIERTOS = Object.freeze([
  'identificada',
  'en preparación',
  'presentada',
  'vigente',
]);

/** Estados con fecha límite que hay que vigilar: presentar tarde es perderla. */
export const ESTADOS_INTERNACIONAL_CON_PLAZO = Object.freeze(['identificada', 'en preparación']);

export const ALCANCES_INTERNACIONAL = Object.freeze(['bilateral', 'regional', 'multilateral']);

/**
 * Objetivos de Desarrollo Sostenible.
 *
 * Congelados: los define la Agenda 2030 de Naciones Unidas, no el municipio.
 * Son el idioma común con el que se presenta cualquier postulación
 * internacional, y por eso cada acción declara a cuáles contribuye.
 */
export const ODS = Object.freeze([
  { numero: 1, nombre: 'Fin de la pobreza' },
  { numero: 2, nombre: 'Hambre cero' },
  { numero: 3, nombre: 'Salud y bienestar' },
  { numero: 4, nombre: 'Educación de calidad' },
  { numero: 5, nombre: 'Igualdad de género' },
  { numero: 6, nombre: 'Agua limpia y saneamiento' },
  { numero: 7, nombre: 'Energía asequible y no contaminante' },
  { numero: 8, nombre: 'Trabajo decente y crecimiento económico' },
  { numero: 9, nombre: 'Industria, innovación e infraestructura' },
  { numero: 10, nombre: 'Reducción de las desigualdades' },
  { numero: 11, nombre: 'Ciudades y comunidades sostenibles' },
  { numero: 12, nombre: 'Producción y consumo responsables' },
  { numero: 13, nombre: 'Acción por el clima' },
  { numero: 14, nombre: 'Vida submarina' },
  { numero: 15, nombre: 'Vida de ecosistemas terrestres' },
  { numero: 16, nombre: 'Paz, justicia e instituciones sólidas' },
  { numero: 17, nombre: 'Alianzas para lograr los objetivos' },
]);

/** De dónde salió que un proyecto sea estratégico. Es trazabilidad, no clasificación. */
export const ORIGENES_ESTRATEGICO = Object.freeze(['base', 'monitoreo', 'seguimiento']);

/**
 * Umbrales de vencimiento y cobertura, en un solo lugar.
 *
 * Viven acá —y no en el motor de alertas— porque los consumen los dos lados:
 * `alertas.js` para emitir la alerta y `selectores.js` para pintar el semáforo
 * de cada secretaría. Este módulo no importa a nadie, así que ambos pueden
 * leerlo sin abrir un ciclo de importación.
 */
export const UMBRALES = Object.freeze({
  DIAS_POR_VENCER: 7,
  DIAS_SIN_ACTUALIZAR: 30,
  DIAS_EVENTO: 5,
  DIAS_VENCIMIENTOS_DASHBOARD: 15,
  /** Días sin monitorear a partir de los cuales una secretaría queda en amarillo. */
  DIAS_SIN_MONITOREO: 30,
  /**
   * Un proyecto estratégico se mira más seguido que el resto: quince días sin
   * novedades ya es una señal, contra los treinta de la cartera general. Si
   * fuera el mismo umbral, declararlo estratégico no cambiaría nada.
   */
  DIAS_ESTRATEGICO_SIN_NOVEDAD: 15,
  /**
   * Aviso previo al cierre de una convocatoria internacional. Es más largo que
   * el de un compromiso porque una postulación no se arma en una semana:
   * requiere avales, traducciones y firma de autoridad.
   */
  DIAS_CIERRE_INTERNACIONAL: 30,
});

/** Días que representa cada periodicidad de mesa, para el indicador de vencimiento. */
export const DIAS_PERIODICIDAD = Object.freeze({
  semanal: 7,
  quincenal: 15,
  mensual: 30,
  bimestral: 60,
  trimestral: 90,
});

/* ── Administrables ─────────────────────────────────────────────────── */

/**
 * Semilla del sistema — las siete secretarías reales de Tres de Febrero.
 *
 * Hasta el 19/08/2026 esta lista tenía ocho áreas GENÉRICAS e inventadas
 * ("Secretaría de Obras Públicas", "Dirección de Ambiente", etc.), separadas
 * de las reales, para que `demo.js`/`base-completa.js` tuvieran sobre qué
 * generar datos de prueba. Se sacaron de acá porque confundían la pantalla
 * de Configuración → Catálogos, que mostraba nombres inventados mezclados
 * con los reales como si fueran errores de carga. `demo.js` ahora genera sus
 * proyectos ficticios sobre estas mismas siete áreas reales (evidentemente
 * ficticios por el contenido, no por el nombre de la secretaría);
 * `base-completa.js` sigue con su propio catálogo de catorce áreas
 * enteramente inventadas, pero autocontenido — lo reemplaza entero al
 * cargarse (`armarCatalogos()` en base-completa-vocabulario.js) y nunca
 * convive con esta lista, así que no genera la misma confusión.
 */
export const CATALOGOS_SEMILLA = Object.freeze({
  areas: [
    { id: 'ar_coord', nombre: 'Coordinación', prefijo: 'COR', activo: true },
    { id: 'ar_r_ambiente', nombre: 'Secretaría de Ambiente y Servicios Públicos', prefijo: 'AMB', activo: true },
    { id: 'ar_r_capital', nombre: 'Secretaría de Capital Humano', prefijo: 'CAH', activo: true },
    { id: 'ar_r_obras', nombre: 'Secretaría de Obras', prefijo: 'OBR', activo: true },
    { id: 'ar_salud', nombre: 'Secretaría de Salud', prefijo: 'SAL', activo: true },
    { id: 'ar_r_seguridad', nombre: 'Secretaría de Seguridad', prefijo: 'SEG', activo: true },
    { id: 'ar_r_trabajo', nombre: 'Secretaría de Trabajo y Producción', prefijo: 'TYP', activo: true },
  ],
  programas: [
    { id: 'pr_infra', nombre: 'Infraestructura urbana', activo: true },
    { id: 'pr_habitat', nombre: 'Hábitat y vivienda', activo: true },
    { id: 'pr_inclusion', nombre: 'Inclusión social', activo: true },
    { id: 'pr_primera', nombre: 'Primera infancia', activo: true },
    { id: 'pr_higiene', nombre: 'Higiene urbana', activo: true },
    { id: 'pr_aps', nombre: 'Atención primaria de la salud', activo: true },
    { id: 'pr_trayect', nombre: 'Trayectorias educativas', activo: true },
    { id: 'pr_cultura', nombre: 'Cultura de cercanía', activo: true },
    { id: 'pr_empleo', nombre: 'Empleo joven', activo: true },
    { id: 'pr_verde', nombre: 'Espacios verdes', activo: true },
    { id: 'pr_posic', nombre: 'Posicionamiento', activo: true },
    { id: 'pr_seguridad', nombre: 'Seguridad ciudadana', activo: true },
    { id: 'pr_gestion', nombre: 'Modernización de la gestión', activo: true },
  ],
  /**
   * Valores reales del campo `Eje` de los `_db` (ver glosario). Hasta el
   * 25/08/2026 esta lista mezclaba estos con ocho ejes genéricos inventados
   * ("Desarrollo urbano", "Inclusión y equidad"...) que no existen en ningún
   * sheet — se sacaron: confundían la pantalla de Configuración → Catálogos
   * igual que pasaba con las áreas ficticias antes del 20/08.
   *
   * `Mesa Esperanza` / `Mesa EDLA` / `Mesa Favelita / El Libertador` son las
   * tres mesas de barrios populares releveadas — no un genérico "Mesa": el
   * campo `Eje` real nombra la mesa puntual, no la categoría.
   *
   * `Puntual` sigue acá como valor de `eje` de PROYECTOS a propósito, aunque
   * el esquema de Supabase que se está armando en paralelo (PR de Tomás,
   * 25/08) modela los puntuales como tabla PROPIA — nunca `eje='Puntual'` en
   * `proyectos`. Separar esa colección en el prototipo es un cambio más
   * grande que JP pidió dejar para después: por ahora los proyectos reales
   * de las 6 secretarías (no Posicionamiento) siguen cayendo acá como
   * aproximación, documentada en `proyectos-reales-secretarias.js`.
   *
   * `Compromisos` es un valor real observado en los `_db` pero de sentido sin
   * confirmar del todo (ver glosario, "(confirmar qué son exactamente)") y
   * ninguna carga real lo usa todavía — queda listado para no perder
   * vocabulario institucional, no como recomendación de uso.
   */
  ejes: [
    { id: 'ej_poa', nombre: 'POA', activo: true },
    { id: 'ej_puntual', nombre: 'Puntual', activo: true },
    { id: 'ej_mesa_esperanza', nombre: 'Mesa Esperanza', activo: true },
    { id: 'ej_mesa_edla', nombre: 'Mesa EDLA', activo: true },
    { id: 'ej_mesa_favelita', nombre: 'Mesa Favelita / El Libertador', activo: true },
    { id: 'ej_posic', nombre: 'Posicionamiento', activo: true },
    { id: 'ej_compromisos', nombre: 'Compromisos', activo: true },
  ],
  tipos: [
    { id: 'ti_obra', nombre: 'Obra', es_obra: true, activo: true },
    { id: 'ti_servicio', nombre: 'Servicio', es_obra: false, activo: true },
    { id: 'ti_social', nombre: 'Programa social', es_obra: false, activo: true },
    { id: 'ti_gestion', nombre: 'Gestión interna', es_obra: false, activo: true },
    { id: 'ti_adq', nombre: 'Adquisición', es_obra: false, activo: true },
  ],
  unidades: [
    { id: 'un_m2', nombre: 'm²', activo: true },
    { id: 'un_benef', nombre: 'beneficiarios', activo: true },
    { id: 'un_cuadras', nombre: 'cuadras', activo: true },
    { id: 'un_unidades', nombre: 'unidades', activo: true },
    { id: 'un_pct', nombre: '%', activo: true },
    { id: 'un_ml', nombre: 'metros lineales', activo: true },
    { id: 'un_hs', nombre: 'horas', activo: true },
  ],
  categorias_tema: [
    { id: 'ca_operativo', nombre: 'Operativo', activo: true },
    { id: 'ca_presup', nombre: 'Presupuestario', activo: true },
    { id: 'ca_admin', nombre: 'Administrativo / expediente', activo: true },
    { id: 'ca_rrhh', nombre: 'Recursos humanos', activo: true },
    { id: 'ca_vecinal', nombre: 'Reclamo vecinal', activo: true },
    { id: 'ca_inter', nombre: 'Articulación entre áreas', activo: true },
    { id: 'ca_prov', nombre: 'Proveedores y contrataciones', activo: true },
    { id: 'ca_tecnico', nombre: 'Técnico / proyecto', activo: true },
  ],
  items_requerimiento: [
    { id: 'rq_sonido', nombre: 'Sonido', activo: true },
    { id: 'rq_escenario', nombre: 'Escenario', activo: true },
    { id: 'rq_sillas', nombre: 'Sillas', activo: true },
    { id: 'rq_vallado', nombre: 'Vallado', activo: true },
    { id: 'rq_banios', nombre: 'Baños químicos', activo: true },
    { id: 'rq_seguridad', nombre: 'Seguridad', activo: true },
    { id: 'rq_limpieza', nombre: 'Limpieza', activo: true },
    { id: 'rq_gacebos', nombre: 'Gacebos', activo: true },
    { id: 'rq_energia', nombre: 'Energía', activo: true },
    { id: 'rq_difusion', nombre: 'Difusión', activo: true },
  ],
  tipos_evento: [
    { id: 'te_inaug', nombre: 'Inauguración', activo: true },
    { id: 'te_feria', nombre: 'Feria', activo: true },
    { id: 'te_jornada', nombre: 'Jornada', activo: true },
    { id: 'te_operativo', nombre: 'Operativo territorial', activo: true },
    { id: 'te_cultural', nombre: 'Actividad cultural', activo: true },
    { id: 'te_deportivo', nombre: 'Actividad deportiva', activo: true },
    { id: 'te_institucional', nombre: 'Acto institucional', activo: true },
  ],
  tipos_accion_internacional: [
    { id: 'ai_hermanamiento', nombre: 'Hermanamiento', activo: true },
    { id: 'ai_red', nombre: 'Red de ciudades', activo: true },
    { id: 'ai_fondo', nombre: 'Postulación a fondo', activo: true },
    { id: 'ai_premio', nombre: 'Premio o distinción', activo: true },
    { id: 'ai_mision', nombre: 'Misión o visita', activo: true },
    { id: 'ai_convenio', nombre: 'Convenio de cooperación', activo: true },
    { id: 'ai_evento', nombre: 'Evento internacional', activo: true },
    { id: 'ai_membresia', nombre: 'Membresía en organismo', activo: true },
  ],
  organismos_internacionales: [
    { id: 'or_merco', nombre: 'Mercociudades', activo: true },
    { id: 'or_cglu', nombre: 'CGLU — Ciudades y Gobiernos Locales Unidos', activo: true },
    { id: 'or_ucci', nombre: 'UCCI — Unión de Ciudades Capitales Iberoamericanas', activo: true },
    { id: 'or_onuhab', nombre: 'ONU-Hábitat', activo: true },
    { id: 'or_pnud', nombre: 'PNUD', activo: true },
    { id: 'or_bid', nombre: 'BID', activo: true },
    { id: 'or_caf', nombre: 'CAF — Banco de Desarrollo de América Latina', activo: true },
    { id: 'or_ue', nombre: 'Unión Europea', activo: true },
    { id: 'or_oei', nombre: 'OEI — Organización de Estados Iberoamericanos', activo: true },
    { id: 'or_aecid', nombre: 'AECID — Cooperación Española', activo: true },
    { id: 'or_giz', nombre: 'GIZ — Cooperación Alemana', activo: true },
    { id: 'or_c40', nombre: 'C40 Cities', activo: true },
    { id: 'or_embajada', nombre: 'Embajada o consulado', activo: true },
    { id: 'or_universidad', nombre: 'Universidad extranjera', activo: true },
  ],
  paises_contraparte: [
    { id: 'pa_brasil', nombre: 'Brasil', activo: true },
    { id: 'pa_uruguay', nombre: 'Uruguay', activo: true },
    { id: 'pa_chile', nombre: 'Chile', activo: true },
    { id: 'pa_paraguay', nombre: 'Paraguay', activo: true },
    { id: 'pa_bolivia', nombre: 'Bolivia', activo: true },
    { id: 'pa_peru', nombre: 'Perú', activo: true },
    { id: 'pa_colombia', nombre: 'Colombia', activo: true },
    { id: 'pa_mexico', nombre: 'México', activo: true },
    { id: 'pa_espania', nombre: 'España', activo: true },
    { id: 'pa_italia', nombre: 'Italia', activo: true },
    { id: 'pa_francia', nombre: 'Francia', activo: true },
    { id: 'pa_alemania', nombre: 'Alemania', activo: true },
    { id: 'pa_portugal', nombre: 'Portugal', activo: true },
    { id: 'pa_eeuu', nombre: 'Estados Unidos', activo: true },
    { id: 'pa_canada', nombre: 'Canadá', activo: true },
    { id: 'pa_japon', nombre: 'Japón', activo: true },
    { id: 'pa_corea', nombre: 'Corea del Sur', activo: true },
    { id: 'pa_china', nombre: 'China', activo: true },
    { id: 'pa_israel', nombre: 'Israel', activo: true },
    { id: 'pa_multi', nombre: 'Multilateral / varios países', activo: true },
  ],
  motivos_estrategicos: [
    { id: 'me_gestion', nombre: 'Compromiso público de gestión', activo: true },
    { id: 'me_impacto', nombre: 'Alto impacto vecinal', activo: true },
    { id: 'me_monto', nombre: 'Monto o escala excepcional', activo: true },
    { id: 'me_financ', nombre: 'Financiamiento externo comprometido', activo: true },
    { id: 'me_articul', nombre: 'Articulación con provincia o nación', activo: true },
    { id: 'me_innov', nombre: 'Innovación institucional', activo: true },
    { id: 'me_riesgo', nombre: 'Riesgo alto si se atrasa', activo: true },
    { id: 'me_interna', nombre: 'Posicionamiento internacional', activo: true },
  ],
  periodicidades: [
    { id: 'pe_semanal', nombre: 'semanal', activo: true },
    { id: 'pe_quincenal', nombre: 'quincenal', activo: true },
    { id: 'pe_mensual', nombre: 'mensual', activo: true },
    { id: 'pe_bimestral', nombre: 'bimestral', activo: true },
    { id: 'pe_trimestral', nombre: 'trimestral', activo: true },
  ],
});

/** Metadatos de presentación de cada catálogo administrable, para Configuración. */
export const CATALOGOS_ADMINISTRABLES = Object.freeze([
  { clave: 'areas', titulo: 'Áreas', descripcion: 'Secretarías, subsecretarías y direcciones', conPrefijo: true },
  { clave: 'programas', titulo: 'Programas', descripcion: 'Programas a los que pertenecen los proyectos' },
  { clave: 'ejes', titulo: 'Ejes estratégicos', descripcion: 'Ejes de gestión' },
  { clave: 'tipos', titulo: 'Tipos de proyecto', descripcion: 'Obra, servicio, programa social, gestión interna, adquisición', conEsObra: true },
  { clave: 'unidades', titulo: 'Unidades de medida', descripcion: 'Unidad en que se mide el objetivo' },
  { clave: 'categorias_tema', titulo: 'Categorías de tema', descripcion: 'Clasificación de los temas de monitoreo' },
  { clave: 'items_requerimiento', titulo: 'Requerimientos de evento', descripcion: 'Ítems solicitables para un evento' },
  { clave: 'tipos_evento', titulo: 'Tipos de evento', descripcion: 'Clasificación de eventos' },
  { clave: 'tipos_accion_internacional', titulo: 'Tipos de acción internacional', descripcion: 'Hermanamientos, redes, postulaciones, premios, misiones' },
  { clave: 'organismos_internacionales', titulo: 'Organismos y redes', descripcion: 'Contrapartes del posicionamiento internacional' },
  { clave: 'paises_contraparte', titulo: 'Países contraparte', descripcion: 'Origen de la contraparte de cada acción' },
  { clave: 'motivos_estrategicos', titulo: 'Motivos estratégicos', descripcion: 'Por qué un proyecto se declara estratégico' },
  { clave: 'periodicidades', titulo: 'Periodicidades de mesa', descripcion: 'Frecuencia de reunión declarada' },
]);
