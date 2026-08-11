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
 * Semilla provisoria. Los catálogos institucionales reales (áreas, programas,
 * ejes y tipos vigentes del municipio) están diferidos a la etapa siguiente.
 */
export const CATALOGOS_SEMILLA = Object.freeze({
  areas: [
    { id: 'ar_obras', nombre: 'Secretaría de Obras Públicas', prefijo: 'OBR', activo: true },
    { id: 'ar_social', nombre: 'Secretaría de Desarrollo Social', prefijo: 'DSO', activo: true },
    { id: 'ar_serv', nombre: 'Secretaría de Servicios Públicos', prefijo: 'SPU', activo: true },
    { id: 'ar_salud', nombre: 'Secretaría de Salud', prefijo: 'SAL', activo: true },
    { id: 'ar_educ', nombre: 'Subsecretaría de Educación', prefijo: 'EDU', activo: true },
    { id: 'ar_cult', nombre: 'Subsecretaría de Cultura', prefijo: 'CUL', activo: true },
    { id: 'ar_prod', nombre: 'Dirección de Producción y Empleo', prefijo: 'PRO', activo: true },
    { id: 'ar_amb', nombre: 'Dirección de Ambiente', prefijo: 'AMB', activo: true },
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
  ],
  ejes: [
    { id: 'ej_urbano', nombre: 'Desarrollo urbano', activo: true },
    { id: 'ej_social', nombre: 'Inclusión y equidad', activo: true },
    { id: 'ej_salud', nombre: 'Salud y bienestar', activo: true },
    { id: 'ej_educ', nombre: 'Educación y cultura', activo: true },
    { id: 'ej_econ', nombre: 'Desarrollo económico', activo: true },
    { id: 'ej_amb', nombre: 'Ambiente y sustentabilidad', activo: true },
    { id: 'ej_gest', nombre: 'Modernización de la gestión', activo: true },
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
  { clave: 'periodicidades', titulo: 'Periodicidades de mesa', descripcion: 'Frecuencia de reunión declarada' },
]);
