/**
 * ─────────────────────────────────────────────────────────────────────
 * GENERADOR DE DATOS DE DEMOSTRACIÓN
 *
 * Set sintético y EVIDENTEMENTE FICTICIO: las áreas, los proyectos, los
 * barrios y las personas son inventados. Nunca datos reales del municipio.
 *
 * Todo se genera RELATIVO a `hoy`, no con fechas fijas: así el set sigue
 * mostrando los mismos casos de borde dentro de seis meses.
 * ─────────────────────────────────────────────────────────────────────
 */
import { bdVacia } from './esquema.js';
import { nuevoId } from './ids.js';
import {
  PLANTILLAS_POSICIONAMIENTO,
  BARRIOS,
  CIUDADES_EXTRANJERAS,
  COMPROMISOS_PUBLICOS,
  PERSONAS,
  crearAzar,
  desplazar,
  marcaTiempo,
  puntoEnBarrio,
} from './sintetico.js';

/**
 * Plantillas por área: [prefijoNombre, tipo, unidad, esObra, programa?].
 *
 * Las claves son las SIETE secretarías reales (mismos nombres que
 * `CATALOGOS_SEMILLA.areas`) — hasta el 19/08/2026 este generador usaba ocho
 * nombres de área inventados ("Secretaría de Obras Públicas", "Dirección de
 * Ambiente", etc.), separados de los reales. Se sacaron porque confundían la
 * pantalla de Configuración → Catálogos: un usuario que mira la lista de
 * áreas no tiene forma de distinguir "esto es una secretaría real" de "esto
 * es un nombre que inventó el generador de pruebas". El set sigue siendo
 * EVIDENTEMENTE FICTICIO por el contenido (proyectos, zonas, personas
 * inventados), no por el nombre de la secretaría.
 *
 * El quinto elemento de cada proyecto es un `programa` opcional: si no se
 * indica, se usa `plantilla.programa`. Sirve para las áreas que agrupan más
 * de un programa real (Ambiente y Servicios Públicos, Capital Humano).
 */
const PLANTILLAS = {
  'Secretaría de Obras': {
    proyectos: [
      ['Repavimentación', 'Obra', 'cuadras', true],
      ['Bacheo integral', 'Obra', 'cuadras', true],
      ['Red de desagües pluviales', 'Obra', 'metros lineales', true],
      ['Puesta en valor de plaza', 'Obra', 'm²', true],
      ['Alumbrado LED', 'Obra', 'unidades', true],
      ['Refacción de edificio municipal', 'Obra', 'm²', true],
    ],
    programa: 'Infraestructura urbana',
    eje: 'POA',
  },
  'Secretaría de Ambiente y Servicios Públicos': {
    proyectos: [
      ['Recolección diferenciada', 'Servicio', 'beneficiarios', false, 'Higiene urbana'],
      ['Poda y mantenimiento de arbolado', 'Servicio', 'unidades', false, 'Higiene urbana'],
      ['Limpieza de sumideros', 'Servicio', 'unidades', false, 'Higiene urbana'],
      ['Renovación de contenedores', 'Adquisición', 'unidades', false, 'Higiene urbana'],
      ['Forestación urbana', 'Servicio', 'unidades', false, 'Espacios verdes'],
      ['Punto verde de reciclado', 'Obra', 'unidades', true, 'Espacios verdes'],
      ['Educación ambiental en escuelas', 'Programa social', 'beneficiarios', false, 'Espacios verdes'],
    ],
    programa: 'Higiene urbana',
    eje: 'POA',
  },
  'Secretaría de Capital Humano': {
    proyectos: [
      ['Programa de acompañamiento familiar', 'Programa social', 'beneficiarios', false, 'Inclusión social'],
      ['Entrega de módulos alimentarios', 'Programa social', 'beneficiarios', false, 'Inclusión social'],
      ['Centro de primera infancia', 'Programa social', 'beneficiarios', false, 'Primera infancia'],
      ['Mejoramiento habitacional', 'Obra', 'unidades', true, 'Inclusión social'],
      ['Apoyo escolar en barrios', 'Programa social', 'beneficiarios', false, 'Trayectorias educativas'],
      ['Refacción de jardín municipal', 'Obra', 'm²', true, 'Trayectorias educativas'],
      ['Provisión de material didáctico', 'Adquisición', 'unidades', false, 'Trayectorias educativas'],
      ['Ciclo de cultura en los barrios', 'Programa social', 'beneficiarios', false, 'Cultura de cercanía'],
      ['Puesta en valor del centro cultural', 'Obra', 'm²', true, 'Cultura de cercanía'],
      ['Escuela municipal de arte', 'Servicio', 'beneficiarios', false, 'Cultura de cercanía'],
    ],
    programa: 'Inclusión social',
    eje: 'POA',
  },
  'Secretaría de Salud': {
    proyectos: [
      ['Refuerzo de atención primaria', 'Servicio', 'beneficiarios', false],
      ['Campaña de vacunación', 'Servicio', 'beneficiarios', false],
      ['Equipamiento de centro de salud', 'Adquisición', 'unidades', false],
      ['Ampliación de sala de atención', 'Obra', 'm²', true],
    ],
    programa: 'Atención primaria de la salud',
    eje: 'POA',
  },
  'Secretaría de Seguridad': {
    proyectos: [
      ['Refuerzo de cámaras de seguridad', 'Adquisición', 'unidades', false],
      ['Modernización del centro de monitoreo', 'Obra', 'm²', true],
      ['Patrullaje barrial', 'Servicio', 'beneficiarios', false],
      ['Capacitación en prevención comunitaria', 'Programa social', 'beneficiarios', false],
    ],
    programa: 'Seguridad ciudadana',
    eje: 'POA',
  },
  'Secretaría de Trabajo y Producción': {
    proyectos: [
      ['Formación en oficios', 'Programa social', 'beneficiarios', false],
      ['Registro de emprendedores', 'Gestión interna', '%', false],
      ['Feria de productores locales', 'Servicio', 'beneficiarios', false],
    ],
    programa: 'Empleo joven',
    eje: 'POA',
  },
  'Coordinación': {
    proyectos: [
      ['Sistema de seguimiento de gestión municipal', 'Gestión interna', '%', false],
      ['Digitalización de expedientes internos', 'Gestión interna', '%', false],
      ['Convenio de cooperación institucional', 'Gestión interna', 'unidades', false],
    ],
    programa: 'Modernización de la gestión',
    eje: 'POA',
  },
};

const PREFIJOS = {
  'Secretaría de Obras': 'OBR',
  'Secretaría de Ambiente y Servicios Públicos': 'AMB',
  'Secretaría de Capital Humano': 'CAH',
  'Secretaría de Salud': 'SAL',
  'Secretaría de Seguridad': 'SEG',
  'Secretaría de Trabajo y Producción': 'TYP',
  'Coordinación': 'COR',
};

/* ── Generador principal ────────────────────────────────────────────── */

export function generarDemo(hoy) {
  const bd = bdVacia();
  const azar = crearAzar(20260808);
  // El set chico se queda con una parte del vocabulario: con treinta proyectos,
  // cuarenta nombres distintos hacen que nada se repita y no se vea que el
  // responsable es un dato que se repite entre proyectos de la misma área.
  const personas = PERSONAS.slice(0, 15);
  const barrios = BARRIOS.slice(0, 10);
  const elegir = (arr) => arr[Math.floor(azar() * arr.length)];
  const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
  const anio = Number(hoy.slice(0, 4));
  const usuario = 'Coordinación';

  bd.config.usuario = usuario;

  /** Asiento de bitácora con fecha explícita, para poder fabricar antigüedad. */
  let secuencia = 0;
  const asentar = (entidad, id_entidad, accion, cambios, cuando, id_proyecto = null) => {
    secuencia += 1;
    bd.historial.push({
      id: nuevoId('h'),
      entidad,
      id_entidad,
      accion,
      cambios,
      id_proyecto,
      creado_por: usuario,
      creado_en: cuando,
      secuencia,
    });
  };

  /* ── Proyectos ──────────────────────────────────────────────────── */

  const areas = Object.keys(PLANTILLAS);
  const correlativos = {};

  for (const area of areas) {
    const plantilla = PLANTILLAS[area];
    for (const [nombreBase, tipo, unidad, esObra, programaItem] of plantilla.proyectos) {
      correlativos[area] = (correlativos[area] ?? 0) + 1;
      const id = `${PREFIJOS[area]}-${anio}-${String(correlativos[area]).padStart(3, '0')}`;
      const objetivo = esObra ? entre(20, 400) : entre(150, 4000);
      const porcentaje = entre(0, 105) / 100;
      const avance = Math.round(objetivo * Math.min(porcentaje, 1));

      const estado =
        avance >= objetivo ? 'finalizado' : avance === 0 ? 'planificado' : azar() < 0.18 ? 'demorado' : 'en ejecución';

      const inicio = desplazar(hoy, -entre(30, 260));
      const finPrevisto = desplazar(inicio, entre(120, 420));
      const planificado = entre(8, 320) * 1_000_000;

      // La zona es un campo, no una parte del nombre: el mapa y el desagregado
      // de obras la leen de acá y no de la cadena del título.
      const zona = elegir(barrios);

      bd.proyectos.push({
        id_proyecto: id,
        area,
        programa: programaItem ?? plantilla.programa,
        proyecto: `${nombreBase} — ${zona}`,
        zona,
        ...puntoEnBarrio(zona, azar),
        eje: plantilla.eje,
        tipo,
        cantidad: entre(1, 12),
        objetivo,
        avance,
        unidad,
        estado,
        responsable: elegir(personas),
        prioridad: azar() < 0.22 ? 'alta' : azar() < 0.6 ? 'media' : 'baja',
        fecha_carga: inicio,
        fecha_inicio: inicio,
        fecha_fin_prevista: finPrevisto,
        es_obra: esObra,
        monto_planificado: planificado,
        monto_ejecutado: Math.round(planificado * Math.min(porcentaje + (azar() - 0.5) * 0.25, 1.15)),
        activo: true,
        creado_por: usuario,
        creado_en: marcaTiempo(inicio, 9),
      });

      asentar('proyectos', id, 'alta', [], marcaTiempo(inicio, 9), id);
      // Una actualización de avance reciente, para que la serie temporal exista.
      if (avance > 0) {
        const cuando = desplazar(hoy, -entre(2, 25));
        asentar(
          'proyectos',
          id,
          'edicion',
          [{ campo: 'avance', antes: Math.round(avance * 0.6), despues: avance }],
          marcaTiempo(cuando, 11),
          id,
        );
      }
    }
  }

  const proyectos = bd.proyectos;
  const porArea = (area) => proyectos.filter((p) => p.area === area);

  /* ── CASO DE BORDE · proyectos sin actualizar hace más de 30 días ── */
  // Acá sólo se ELIGEN. Correrles los asientos hacia atrás es lo último que hace
  // el generador: cualquier sección posterior que los toque —un seguimiento, un
  // compromiso, un proyecto de posicionamiento vinculado— les levantaría la última
  // actualización y el caso se perdería sin que nada fallara.
  const sinActualizar = proyectos.filter((p) => p.estado === 'en ejecución').slice(0, 3);

  /* ── CASO DE BORDE · proyectos vencidos y no finalizados ────────── */
  const vencidos = proyectos.filter(
    (p) => p.estado === 'en ejecución' && !sinActualizar.includes(p),
  ).slice(0, 2);
  for (const p of vencidos) {
    p.fecha_fin_prevista = desplazar(hoy, -entre(12, 60));
    p.estado = 'demorado';
  }

  /* ── Seguimientos ───────────────────────────────────────────────── */

  const seguimientos = [];

  // Realizados, en los últimos tres meses
  for (const area of areas) {
    const proyectosArea = porArea(area);
    for (let i = 0; i < entre(2, 4); i += 1) {
      const fecha = desplazar(hoy, -entre(3, 90));
      const elegidos = proyectosArea.slice(0, entre(1, 2)).map((p) => p.id_proyecto);
      const s = {
        id: nuevoId('seg'),
        ids_proyecto: elegidos,
        area,
        fecha,
        hora: `${entre(9, 17)}:00`,
        tipo: 'realizado',
        participantes: [elegir(personas), elegir(personas)].join(', '),
        temas: 'Avance de obra, requerimientos pendientes',
        texto_crudo:
          'Se revisó el estado general de los proyectos del área. Se ejecutaron los trabajos previstos ' +
          'para el período. Falta la conformidad del área técnica para avanzar con la etapa siguiente. ' +
          `${elegir(personas)} va a presentar el informe actualizado antes de fin de mes.`,
        resumen: 'Revisión de avance y definición de próximos pasos.',
        // { descripcion, id_proyecto } desde el 24/08/2026 — cada avance o
        // problema puede vincularse a un proyecto puntual del área.
        avances: [{ descripcion: 'Se ejecutaron los trabajos previstos para el período.', id_proyecto: elegidos[0] ?? null }],
        problemas: [{ descripcion: 'Falta la conformidad del área técnica para avanzar con la etapa siguiente.', id_proyecto: null }],
        estado_reportado: 'en ejecución',
        activo: true,
        creado_por: usuario,
        creado_en: marcaTiempo(fecha, 15),
      };
      seguimientos.push(s);
      bd.seguimientos.push(s);
      asentar('seguimientos', s.id, 'alta', [], s.creado_en, elegidos[0] ?? null);
    }
  }

  // Programados, próximos
  for (const area of areas.slice(0, 5)) {
    const fecha = desplazar(hoy, entre(1, 20));
    const s = {
      id: nuevoId('seg'),
      ids_proyecto: porArea(area).slice(0, 2).map((p) => p.id_proyecto),
      area,
      fecha,
      hora: `${entre(9, 16)}:30`,
      tipo: 'programado',
      participantes: [elegir(personas), elegir(personas)].join(', '),
      temas: 'Revisión de avance trimestral y cronograma',
      texto_crudo: '',
      resumen: '',
      avances: [],
      problemas: [],
      estado_reportado: '',
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(hoy, 12),
    };
    bd.seguimientos.push(s);
    asentar('seguimientos', s.id, 'alta', [], s.creado_en, s.ids_proyecto[0] ?? null);
  }

  /* ── Compromisos ────────────────────────────────────────────────── */

  const DESCRIPCIONES = [
    'Enviar el informe de avance actualizado',
    'Presentar el pliego técnico para licitación',
    'Coordinar la reunión con el área de Legales',
    'Relevar el estado de los frentistas del sector',
    'Definir el cronograma de la etapa siguiente',
    'Remitir el detalle de gastos ejecutados',
    'Convocar a los referentes barriales',
    'Elevar el expediente para su aprobación',
    'Contratar el servicio de mantenimiento',
    'Entregar el listado de beneficiarios actualizado',
  ];

  const crearCompromiso = ({ origen_tipo, id_origen, area, id_proyecto, fecha_limite, estado }) => {
    const c = {
      id: nuevoId('com'),
      origen_tipo,
      id_origen,
      id_proyecto,
      area,
      descripcion: elegir(DESCRIPCIONES),
      responsable: elegir(personas),
      fecha_limite,
      estado,
      fecha_cumplimiento: estado === 'cumplido' ? desplazar(fecha_limite, -entre(0, 5)) : null,
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(desplazar(fecha_limite, -20), 14),
    };
    bd.compromisos.push(c);
    asentar('compromisos', c.id, 'alta', [], c.creado_en, id_proyecto);
    return c;
  };

  for (const s of seguimientos) {
    for (let i = 0; i < entre(1, 3); i += 1) {
      const cumplido = azar() < 0.45;
      crearCompromiso({
        origen_tipo: 'seguimiento',
        id_origen: s.id,
        area: s.area,
        id_proyecto: s.ids_proyecto[0] ?? null,
        fecha_limite: desplazar(s.fecha, entre(10, 45)),
        estado: cumplido ? 'cumplido' : azar() < 0.4 ? 'en curso' : 'pendiente',
      });
    }
  }

  /* ── CASO DE BORDE · compromisos vencidos ───────────────────────── */
  for (let i = 0; i < 4; i += 1) {
    const p = proyectos[entre(0, proyectos.length - 1)];
    const s = seguimientos[entre(0, seguimientos.length - 1)];
    crearCompromiso({
      origen_tipo: 'seguimiento',
      id_origen: s.id,
      area: p.area,
      id_proyecto: p.id_proyecto,
      fecha_limite: desplazar(hoy, -entre(2, 30)),
      estado: 'pendiente',
    });
  }

  /* ── CASO DE BORDE · compromisos que vencen en ≤ 7 días ─────────── */
  for (let i = 0; i < 3; i += 1) {
    const p = proyectos[entre(0, proyectos.length - 1)];
    const s = seguimientos[entre(0, seguimientos.length - 1)];
    crearCompromiso({
      origen_tipo: 'seguimiento',
      id_origen: s.id,
      area: p.area,
      id_proyecto: p.id_proyecto,
      fecha_limite: desplazar(hoy, entre(1, 6)),
      estado: 'pendiente',
    });
  }

  /* ── Monitoreos y temas ─────────────────────────────────────────── */

  const CATEGORIAS = [
    'Operativo', 'Presupuestario', 'Administrativo / expediente', 'Recursos humanos',
    'Reclamo vecinal', 'Articulación entre áreas', 'Proveedores y contrataciones', 'Técnico / proyecto',
  ];

  const TEMAS = [
    'Demora en la entrega de materiales por parte del proveedor',
    'Reclamos vecinales por el estado de la calzada',
    'Falta de personal para cubrir el turno tarde',
    'Expediente detenido en el área de Legales',
    'Necesidad de coordinar con Servicios Públicos el corte de calle',
    'Diferencia entre el certificado presentado y lo ejecutado en obra',
    'Pedido de ampliación del cupo del programa',
    'Equipamiento fuera de servicio en el centro de atención',
    'Requerimiento de refuerzo presupuestario para la etapa siguiente',
    'Superposición de cronogramas con otra área',
  ];

  // Cobertura despareja a propósito: dos áreas quedan sin monitoreos, para que
  // el panel «monitoreos por área» muestre para qué sirve.
  for (const area of areas.slice(0, 5)) {
    for (let i = 0; i < entre(1, 3); i += 1) {
      const fecha = desplazar(hoy, -entre(1, 60));
      const m = {
        id: nuevoId('mon'),
        fecha,
        area,
        cerrado: true,
        activo: true,
        creado_por: usuario,
        creado_en: marcaTiempo(fecha, 16),
      };
      bd.monitoreos.push(m);
      asentar('monitoreos', m.id, 'alta', [], m.creado_en);

      const proyectosArea = porArea(area);
      for (let t = 0; t < entre(2, 5); t += 1) {
        const requiereAccion = azar() < 0.4;
        const idProyecto = azar() < 0.7 && proyectosArea.length ? elegir(proyectosArea).id_proyecto : null;
        const criticidad = azar() < 0.2 ? 'alta' : azar() < 0.55 ? 'media' : 'baja';
        const fechaLimite = requiereAccion ? desplazar(fecha, entre(7, 40)) : null;

        const tema = {
          id: nuevoId('tem'),
          id_monitoreo: m.id,
          id_proyecto: idProyecto,
          categoria: elegir(CATEGORIAS),
          descripcion: elegir(TEMAS),
          criticidad,
          requiere_accion: requiereAccion,
          responsable: requiereAccion ? elegir(personas) : '',
          fecha_limite: fechaLimite,
          resuelto: criticidad !== 'alta' ? azar() < 0.6 : azar() < 0.5,
          activo: true,
          creado_por: usuario,
          creado_en: m.creado_en,
        };

        if (requiereAccion) {
          const c = crearCompromiso({
            origen_tipo: 'monitoreo',
            id_origen: m.id,
            area,
            id_proyecto: idProyecto,
            fecha_limite: fechaLimite,
            estado: azar() < 0.35 ? 'cumplido' : 'pendiente',
          });
          c.descripcion = tema.descripcion;
          tema.id_compromiso = c.id;
        }

        bd.temas_monitoreo.push(tema);
        asentar('temas_monitoreo', tema.id, 'alta', [], tema.creado_en, idProyecto);
      }
    }
  }

  /* ── CASO DE BORDE · temas de criticidad alta sin resolver ──────── */
  const criticosSinResolver = bd.temas_monitoreo.filter((t) => t.criticidad === 'alta').slice(0, 3);
  for (const t of criticosSinResolver) t.resuelto = false;
  // Si el azar no produjo suficientes, se fuerzan.
  if (criticosSinResolver.length < 3) {
    for (const t of bd.temas_monitoreo.slice(0, 3 - criticosSinResolver.length)) {
      t.criticidad = 'alta';
      t.resuelto = false;
    }
  }

  /* ── Mesas de trabajo ───────────────────────────────────────────── */

  const MESAS = [
    ['Mesa de Movilidad Urbana', 'temática', 'mensual', 'Coordina el ordenamiento del tránsito y el transporte.'],
    ['Mesa de Gestión Ambiental', 'temática', 'bimestral', 'Articula las políticas ambientales entre áreas.'],
    ['Mesa de Niñez y Adolescencia', 'temática', 'mensual', 'Espacio intersectorial de políticas de infancia.'],
    ['Mesa Barrial Los Álamos', 'barrial', 'mensual', 'Espacio de participación con referentes del barrio.'],
    ['Mesa Barrial Villa Esperanza', 'barrial', 'quincenal', 'Seguimiento de obras y servicios del barrio.'],
    ['Mesa Barrial San Ignacio', 'barrial', 'mensual', 'Articulación con instituciones del barrio.'],
    ['Plan de Modernización Administrativa', 'otros proyectos', 'trimestral', 'Seguimiento del plan de digitalización de trámites.'],
    ['Convenio con Universidad Regional', 'otros proyectos', 'trimestral', 'Cooperación técnica y formación.'],
  ];

  for (const [nombre, tipo, periodicidad, descripcion] of MESAS) {
    const mesa = {
      id: nuevoId('mes'),
      nombre,
      tipo,
      descripcion,
      referente: elegir(personas),
      periodicidad,
      estado: azar() < 0.85 ? 'activa' : 'latente',
      proyectos_vinculados: proyectos.slice(entre(0, 20), entre(21, 24)).map((p) => p.id_proyecto).slice(0, 3),
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(desplazar(hoy, -180), 10),
    };
    bd.mesas.push(mesa);
    asentar('mesas', mesa.id, 'alta', [], mesa.creado_en);

    // Reuniones pasadas
    for (let i = 1; i <= entre(2, 4); i += 1) {
      const fecha = desplazar(hoy, -i * entre(25, 40));
      const r = {
        id: nuevoId('reu'),
        id_mesa: mesa.id,
        fecha,
        asistentes: [elegir(personas), elegir(personas), elegir(personas)].join(', '),
        temas: 'Revisión de compromisos anteriores y estado de los proyectos vinculados.',
        activo: true,
        creado_por: usuario,
        creado_en: marcaTiempo(fecha, 18),
      };
      bd.reuniones_mesa.push(r);
      asentar('reuniones_mesa', r.id, 'alta', [], r.creado_en);

      if (azar() < 0.6) {
        crearCompromiso({
          origen_tipo: 'mesa',
          id_origen: mesa.id,
          area: elegir(areas),
          id_proyecto: mesa.proyectos_vinculados[0] ?? null,
          fecha_limite: desplazar(fecha, entre(15, 45)),
          estado: azar() < 0.5 ? 'cumplido' : 'pendiente',
        });
      }
    }

    // Próxima reunión agendada, que se refleja en el calendario del dashboard
    if (mesa.estado === 'activa' && azar() < 0.7) {
      const fecha = desplazar(hoy, entre(3, 25));
      const r = {
        id: nuevoId('reu'),
        id_mesa: mesa.id,
        fecha,
        asistentes: '',
        temas: 'Agenda a confirmar.',
        activo: true,
        creado_por: usuario,
        creado_en: marcaTiempo(hoy, 12),
      };
      bd.reuniones_mesa.push(r);
      asentar('reuniones_mesa', r.id, 'alta', [], r.creado_en);
    }
  }

  /* ── CASO DE BORDE · mesa mensual sin reunión desde hace 70 días ── */
  const mesaAtrasada = bd.mesas.find((m) => m.periodicidad === 'mensual' && m.estado === 'activa');
  if (mesaAtrasada) {
    bd.reuniones_mesa = bd.reuniones_mesa.filter((r) => r.id_mesa !== mesaAtrasada.id);
    const fecha = desplazar(hoy, -70);
    bd.reuniones_mesa.push({
      id: nuevoId('reu'),
      id_mesa: mesaAtrasada.id,
      fecha,
      asistentes: [elegir(personas), elegir(personas)].join(', '),
      temas: 'Última reunión registrada de la mesa.',
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(fecha, 18),
    });
  }

  /* ── Eventos y requerimientos ───────────────────────────────────── */

  const EVENTOS = [
    ['Inauguración de plaza renovada', 'Inauguración', 'Plaza central de Los Álamos'],
    ['Feria de emprendedores locales', 'Feria', 'Predio municipal'],
    ['Jornada de salud en el barrio', 'Jornada', 'Centro de salud de Villa Esperanza'],
    ['Operativo integral de servicios', 'Operativo territorial', 'Barrio San Ignacio'],
    ['Muestra de la escuela de arte', 'Actividad cultural', 'Centro cultural municipal'],
    ['Torneo intercolegial', 'Actividad deportiva', 'Polideportivo municipal'],
    ['Acto por el aniversario del distrito', 'Acto institucional', 'Palacio municipal'],
    ['Feria del libro barrial', 'Feria', 'Plaza de Las Acacias'],
  ];

  const ITEMS_REQ = ['Sonido', 'Escenario', 'Sillas', 'Vallado', 'Baños químicos', 'Seguridad', 'Limpieza', 'Gacebos', 'Energía', 'Difusión'];

  EVENTOS.forEach(([nombre, tipo, lugar], indice) => {
    // Mezcla de eventos pasados y futuros
    const dias = indice === 0 ? 3 : indice < 4 ? entre(8, 45) : -entre(5, 60);
    const fecha = desplazar(hoy, dias);
    const evento = {
      id: nuevoId('eve'),
      nombre,
      fecha,
      hora: `${entre(10, 19)}:00`,
      lugar,
      area_organizadora: elegir(areas),
      tipo,
      id_proyecto: azar() < 0.5 ? elegir(proyectos).id_proyecto : null,
      estado: dias < 0 ? 'realizado' : azar() < 0.7 ? 'confirmado' : 'previsto',
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(desplazar(fecha, -30), 11),
    };
    bd.eventos.push(evento);
    asentar('eventos', evento.id, 'alta', [], evento.creado_en, evento.id_proyecto);

    // CASO DE BORDE · el evento a 3 días queda con requerimientos sin confirmar
    const esElCasoDeBorde = indice === 0;
    const items = ITEMS_REQ.slice(0, esElCasoDeBorde ? 6 : entre(3, 7));

    items.forEach((item, i) => {
      const estado = esElCasoDeBorde
        ? i < 4
          ? 'confirmado'
          : 'solicitado'
        : dias < 0
          ? 'entregado'
          : azar() < 0.65
            ? 'confirmado'
            : 'solicitado';
      const r = {
        id: nuevoId('req'),
        id_evento: evento.id,
        item,
        cantidad: entre(1, 60),
        area_responsable: elegir(areas),
        estado,
        activo: true,
        creado_por: usuario,
        creado_en: evento.creado_en,
      };
      bd.requerimientos_evento.push(r);
      asentar('requerimientos_evento', r.id, 'alta', [], r.creado_en);
    });
  });

  /* ── Planificación anual ────────────────────────────────────────── */

  for (const p of proyectos) {
    // Se planifica la mayoría, no todo: el comparativo tiene que poder mostrar
    // proyectos sin planificación cargada.
    if (azar() < 0.12) continue;

    const metaAnual = p.objetivo;
    // Desvíos deliberados en ambos sentidos: algunos proyectos adelantados,
    // otros muy atrasados respecto de su meta trimestral.
    const sesgo = azar();
    const curva = sesgo < 0.3 ? [0.35, 0.6, 0.85, 1] : sesgo < 0.7 ? [0.25, 0.5, 0.75, 1] : [0.15, 0.35, 0.6, 1];

    const plan = {
      id: nuevoId('pla'),
      id_proyecto: p.id_proyecto,
      anio,
      meta_anual: metaAnual,
      metas_trimestrales: curva.map((c) => Math.round(metaAnual * c)),
      monto_planificado: p.monto_planificado,
      hitos: [
        { id: nuevoId('hit'), descripcion: 'Inicio de ejecución', fecha: p.fecha_inicio },
        { id: nuevoId('hit'), descripcion: 'Certificación intermedia', fecha: desplazar(p.fecha_inicio, 90) },
        { id: nuevoId('hit'), descripcion: 'Cierre previsto', fecha: p.fecha_fin_prevista },
      ],
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(p.fecha_inicio, 10),
    };
    bd.planificacion_anual.push(plan);
    asentar('planificacion_anual', plan.id, 'alta', [], plan.creado_en, p.id_proyecto);
  }

  /* ── Cartera estratégica ────────────────────────────────────────── */

  // Seis proyectos, con los tres orígenes representados: uno declarado desde la
  // base maestra, uno promovido desde un tema de monitoreo y uno desde un
  // seguimiento. En un set de demostración importa que se vean los tres.
  const motivos = bd.catalogos.motivos_estrategicos.map((m) => m.nombre);
  const temasCriticos = bd.temas_monitoreo.filter((t) => t.criticidad === 'alta');
  // Se saltean los que quedaron congelados en -45 días: declararlos estratégicos
  // agrega un asiento más nuevo y les levantaría la última actualización, que es
  // justo el caso de borde que esos tres proyectos existen para mostrar.
  const paraEstrategicos = proyectos
    .filter((p) => p.estado !== 'suspendido' && !sinActualizar.includes(p))
    .slice(0, 6);

  paraEstrategicos.forEach((p, i) => {
    const origen = i % 3 === 0 ? 'base' : i % 3 === 1 ? 'monitoreo' : 'seguimiento';
    const cuando = desplazar(hoy, -entre(25, 220));
    p.estrategico = true;
    p.prioridad_estrategica = i < 3 ? 'alta' : 'media';
    p.motivo_estrategico = motivos[i % motivos.length];
    p.responsable_politico = elegir(personas);
    p.compromiso_publico = COMPROMISOS_PUBLICOS[i % COMPROMISOS_PUBLICOS.length];
    p.fecha_compromiso = desplazar(cuando, entre(120, 400));
    p.origen_estrategico = origen;
    p.id_origen_estrategico =
      origen === 'monitoreo'
        ? (temasCriticos[i]?.id ?? temasCriticos[0]?.id ?? null)
        : origen === 'seguimiento'
          ? (seguimientos[i]?.id ?? seguimientos[0]?.id ?? null)
          : null;
    p.fecha_marcado_estrategico = cuando;
    asentar(
      'proyectos',
      p.id_proyecto,
      'edicion',
      [{ campo: 'estrategico', antes: false, despues: true }],
      marcaTiempo(cuando, 11),
      p.id_proyecto,
    );
  });

  /* ── Posicionamiento ───────────────────────────────────────────── */

  const organismos = bd.catalogos.organismos.map((o) => o.nombre);
  const estrategicos = proyectos.filter((p) => p.estrategico);

  /**
   * Las nueve acciones del set cubren el embudo entero —de identificada a no
   * prosperó— y las dos filas que el módulo existe para mostrar: una
   * convocatoria que cierra esta semana y otra que ya se pasó de fecha.
   */
  const GUION = [
    ['Hermanamiento', 'vigente', -520, 60],
    ['Red de ciudades', 'vigente', -400, 90],
    ['Postulación a fondo', 'presentada', -150, -20],
    ['Postulación a fondo', 'en preparación', -40, 12],
    ['Postulación a fondo', 'identificada', -15, 4],
    ['Premio o distinción', 'en preparación', -90, -6],
    ['Convenio de cooperación', 'cerrada', -600, -400],
    ['Misión o visita', 'no prosperó', -300, -240],
    ['Evento internacional', 'identificada', -10, 120],
  ];

  GUION.forEach(([tipo, estado, diasInicio, diasLimite], i) => {
    const inicio = desplazar(hoy, diasInicio);
    const plantillas = PLANTILLAS_POSICIONAMIENTO[tipo];
    const nombre = plantillas[i % plantillas.length].replace(
      '{ciudad}',
      CIUDADES_EXTRANJERAS[i % CIUDADES_EXTRANJERAS.length],
    );
    const conPlata = tipo === 'Postulación a fondo';
    const accion = {
      id: nuevoId('int'),
      nombre,
      tipo,
      organismo: organismos[i % organismos.length],
      estado,
      area: areas[i % areas.length],
      referente: elegir(personas),
      descripcion: `${nombre}. Gestión impulsada por la coordinación de relaciones internacionales del municipio.`,
      fecha_inicio: inicio,
      fecha_limite: desplazar(hoy, diasLimite),
      fecha_resolucion: ['vigente', 'cerrada', 'no prosperó'].includes(estado)
        ? desplazar(hoy, diasLimite + 20)
        : null,
      financiamiento_usd: conPlata ? entre(40, 600) * 5_000 : 0,
      ods: i % 2 === 0 ? [11, 1 + (i % 16)] : [1 + (i % 17)],
      ids_proyecto: estrategicos[i % estrategicos.length] ? [estrategicos[i % estrategicos.length].id_proyecto] : [],
      resultado:
        estado === 'no prosperó'
          ? 'No se alcanzó el puntaje mínimo en la evaluación técnica.'
          : estado === 'cerrada'
            ? 'Ejecutada y rendida en tiempo y forma.'
            : '',
      activo: true,
      creado_por: usuario,
      creado_en: marcaTiempo(inicio, 10),
    };
    bd.proyectos_posicionamiento.push(accion);
    asentar('proyectos_posicionamiento', accion.id, 'alta', [], accion.creado_en, accion.ids_proyecto[0] ?? null);
  });

  /* ── CASO DE BORDE · silencios, al final de todo ─────────────────── */
  //
  // Los dos umbrales del sistema, uno al lado del otro: la cartera general
  // alerta a los 30 días sin novedades y la estratégica a los 15. El
  // estratégico se corta en 21 para que caiga entre los dos y dispare SÓLO su
  // alerta; si se pasara de 30 dispararía la otra y no se vería la diferencia.
  const silencios = [
    ...sinActualizar.map((p) => [p, 45]),
    ...proyectos.filter((p) => p.estrategico && p.estado === 'en ejecución').slice(0, 1).map((p) => [p, 21]),
  ];
  for (const [p, dias] of silencios) {
    const viejo = marcaTiempo(desplazar(hoy, -dias), 10);
    for (const h of bd.historial) {
      if (h.id_proyecto === p.id_proyecto && h.creado_en > viejo) h.creado_en = viejo;
    }
  }

  /* ── Reportes guardados ─────────────────────────────────────────── */

  bd.reportes_guardados.push({
    id: nuevoId('rep'),
    nombre: 'Informe semanal Obras',
    filtros: { area: 'Secretaría de Obras', rango: 'semana' },
    bloques: { proyectos: true, compromisos: true, graficos: true, alertas: true, minutas: false, temas: false },
    activo: true,
    creado_por: usuario,
    creado_en: marcaTiempo(desplazar(hoy, -14), 9),
  });
  bd.reportes_guardados.push({
    id: nuevoId('rep'),
    nombre: 'Proyectos prioritarios con alertas',
    filtros: { solo_prioritarios: true, solo_con_alertas: true, rango: 'mes' },
    bloques: { proyectos: true, compromisos: true, graficos: false, alertas: true, minutas: false, temas: true },
    activo: true,
    creado_por: usuario,
    creado_en: marcaTiempo(desplazar(hoy, -7), 9),
  });

  // La bitácora se ordena por fecha (y secuencia, para desempatar) de modo que
  // el feed del inicio salga coherente.
  bd.historial.sort(
    (a, b) => String(a.creado_en).localeCompare(String(b.creado_en)) || a.secuencia - b.secuencia,
  );

  return bd;
}
