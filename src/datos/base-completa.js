/**
 * ─────────────────────────────────────────────────────────────────────
 * BASE COMPLETA — la forma que tendría la base con dos años y medio de
 * uso real del sistema.
 *
 * El set de `demo.js` sirve para MOSTRAR el sistema: es chico, se lee de
 * un vistazo y cada caso de borde está puesto a mano. Este otro sirve para
 * PROBARLO en serio: catorce áreas, tres años de proyectos, veinticuatro
 * meses de seguimiento y monitoreo mes a mes, y varios miles de registros.
 * Es con lo que se contesta «¿esto sigue andando cuando la base está
 * cargada de verdad?» —tablas, filtros, tableros, reportes e impresión—
 * antes de que lo conteste el uso real.
 *
 * Reglas que se mantienen respecto del set chico:
 *
 *  · Todo es SINTÉTICO y evidentemente ficticio: áreas, barrios, personas
 *    y proyectos inventados. Nunca datos reales del municipio.
 *  · Todo se genera RELATIVO a `hoy`, nunca con fechas fijas: el set sigue
 *    mostrando los mismos casos dentro de seis meses.
 *  · El azar tiene semilla: dos cargas producen la misma base, así que un
 *    problema que aparece se puede volver a mirar.
 *
 * Lo que agrega, además del volumen:
 *
 *  · Historia coherente: un proyecto viejo está finalizado, uno de este año
 *    recién empieza, y el avance de cada uno tiene una serie de ediciones
 *    en la bitácora que lo explica.
 *  · Distribución despareja a propósito —áreas grandes y chicas, meses sin
 *    monitoreo, áreas nuevas sin cobertura—, que es lo que hace que los
 *    tableros comparativos digan algo.
 *  · Bajas lógicas en proyectos y en catálogos, para que se vea que el
 *    sistema no borra nada.
 * ─────────────────────────────────────────────────────────────────────
 */
import { bdVacia } from './esquema.js';
import { nuevoId } from './ids.js';
import { BARRIOS, MS_DIA, PERSONAS, crearAzar, desplazar, marcaTiempo } from './sintetico.js';
import {
  AREAS,
  CATEGORIAS_TEMA,
  DESCRIPCIONES_COMPROMISO,
  EQUIPO,
  FRASES_AVANCE,
  FRASES_COMPROMISO,
  FRASES_PROBLEMA,
  ITEMS_REQUERIMIENTO,
  TEMAS_MONITOREO,
  TEMAS_SEGUIMIENTO,
  armarCatalogos,
} from './base-completa-vocabulario.js';

const pad = (n) => String(n).padStart(2, '0');

/** Los últimos `cantidad` meses terminando en el de `hoy`, como 'AAAA-MM'. */
function mesesAtras(hoy, cantidad) {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const salida = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const indice = anio * 12 + (mes - 1) - i;
    salida.push(`${Math.floor(indice / 12)}-${pad((indice % 12) + 1)}`);
  }
  return salida;
}

const DIAS_DEL_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Un día concreto dentro de un mes 'AAAA-MM', nunca posterior a `hoy`. */
function diaEnMes(mes, dia, hoy) {
  const numeroMes = Number(mes.slice(5, 7));
  const tope = DIAS_DEL_MES[numeroMes - 1] ?? 28;
  const fecha = `${mes}-${pad(Math.min(Math.max(dia, 1), tope))}`;
  return fecha > hoy ? hoy : fecha;
}

/* ── Generador principal ────────────────────────────────────────────── */

export function generarBaseCompleta(hoy) {
  const bd = bdVacia();
  const azar = crearAzar(20260810);
  const elegir = (arr) => arr[Math.floor(azar() * arr.length)];
  const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
  const chance = (p) => azar() < p;
  /** `n` elementos distintos de un arreglo. */
  const tomar = (arr, n) => {
    const copia = [...arr];
    const salida = [];
    for (let i = 0; i < n && copia.length; i += 1) salida.push(...copia.splice(Math.floor(azar() * copia.length), 1));
    return salida;
  };

  const anio = Number(hoy.slice(0, 4));
  const ANIOS = [anio - 2, anio - 1, anio];
  /** Meses de historia de seguimiento y monitoreo. */
  const MESES = mesesAtras(hoy, 24);

  bd.config.usuario = 'Coordinación';
  bd.catalogos = armarCatalogos();

  /** Asiento de bitácora con fecha explícita, para poder fabricar antigüedad. */
  let secuencia = 0;
  const asentar = (entidad, id_entidad, accion, cambios, cuando, id_proyecto = null, quien = 'Coordinación') => {
    secuencia += 1;
    bd.historial.push({
      id: nuevoId('h'),
      entidad,
      id_entidad,
      accion,
      cambios,
      id_proyecto,
      creado_por: quien,
      creado_en: cuando,
      secuencia,
    });
  };

  /* ── Proyectos ──────────────────────────────────────────────────── */

  const usados = new Set();

  for (const area of AREAS) {
    let correlativo = 0;
    ANIOS.forEach((anioProyecto, indiceAnio) => {
      correlativo = 0;
      const cantidad = area.porAnio[indiceAnio];

      for (let i = 0; i < cantidad; i += 1) {
        correlativo += 1;
        const id = `${area.prefijo}-${anioProyecto}-${pad(correlativo).padStart(3, '0')}`;
        const [nombreBase, tipo, unidad] = elegir(area.plantillas);
        const esObra = tipo === 'Obra';
        const firma = elegir(EQUIPO);

        // Nombre único: barrio, y si ya existía esa combinación, una etapa.
        let nombre = `${nombreBase} — ${elegir(BARRIOS)}`;
        let etapa = 1;
        while (usados.has(nombre)) {
          etapa += 1;
          nombre = `${nombreBase} — ${elegir(BARRIOS)} (etapa ${etapa})`;
        }
        usados.add(nombre);

        // El proyecto arranca en su año; los del año en curso, nunca después de hoy.
        const mesInicio = entre(1, anioProyecto === anio ? Number(hoy.slice(5, 7)) : 12);
        const inicio = diaEnMes(`${anioProyecto}-${pad(mesInicio)}`, entre(1, 28), hoy);
        const duracion = esObra ? entre(150, 480) : entre(90, 330);
        const finPrevisto = desplazar(inicio, duracion);

        /* Avance esperado según el tiempo transcurrido, corregido por el ritmo
           del proyecto. Sin ese factor todo lo que ya cumplió su plazo aparece
           terminado, y entonces no hay un solo proyecto vencido en ejecución:
           justo la fila que el sistema tiene que mostrar en rojo. */
        const transcurrido = Math.min(Math.max((Date.parse(hoy) - Date.parse(inicio)) / (duracion * MS_DIA), 0), 1.2);
        const ritmo = chance(0.82) ? 0.95 + azar() * 0.3 : 0.5 + azar() * 0.45;
        const proporcion = Math.min(Math.max(transcurrido * ritmo + (azar() - 0.45) * 0.12, 0), 1);

        const objetivo = esObra ? entre(20, 480) : entre(120, 6000);
        let avance = Math.round(objetivo * proporcion);

        const vencido = finPrevisto < hoy;
        let estado;
        if (vencido && proporcion > 0.92) estado = 'finalizado';
        else if (vencido) estado = chance(0.22) ? 'suspendido' : 'demorado';
        else if (proporcion <= 0.01) estado = 'planificado';
        else estado = chance(0.16) ? 'demorado' : 'en ejecución';

        if (estado === 'finalizado') avance = objetivo;
        if (estado === 'planificado') avance = 0;

        const planificado = (esObra ? entre(25, 900) : entre(3, 180)) * 1_000_000;
        const ejecutado = Math.round(
          planificado * Math.min(Math.max(proporcion + (azar() - 0.5) * 0.22, 0), 1.18),
        );

        bd.proyectos.push({
          id_proyecto: id,
          area: area.nombre,
          programa: elegir(area.programas),
          proyecto: nombre,
          eje: area.eje,
          tipo,
          cantidad: entre(1, 14),
          objetivo,
          avance,
          unidad,
          estado,
          responsable: elegir(PERSONAS),
          prioridad: chance(0.2) ? 'alta' : chance(0.55) ? 'media' : 'baja',
          fecha_carga: inicio,
          fecha_inicio: inicio,
          fecha_fin_prevista: finPrevisto,
          es_obra: esObra,
          monto_planificado: planificado,
          monto_ejecutado: ejecutado,
          activo: true,
          creado_por: firma,
          creado_en: marcaTiempo(inicio, 9, entre(0, 59)),
        });

        asentar('proyectos', id, 'alta', [], marcaTiempo(inicio, 9, entre(0, 59)), id, firma);

        /* Serie de avance: varias ediciones repartidas entre el inicio y hoy.
           Es lo que alimenta el gráfico de la ficha y la «última actualización»:
           sin estas ediciones todo proyecto se vería congelado en su alta. */
        const finReal = finPrevisto < hoy ? finPrevisto : hoy;
        const dias = Math.round((Date.parse(finReal) - Date.parse(inicio)) / MS_DIA);
        const ediciones = avance > 0 ? entre(2, 6) : 0;
        let previo = 0;
        for (let e = 1; e <= ediciones; e += 1) {
          const cuando = desplazar(inicio, Math.round((dias * e) / (ediciones + 1)) + entre(0, 6));
          if (cuando > hoy) break;
          const valor = Math.round((avance * e) / ediciones);
          if (valor === previo) continue;
          asentar(
            'proyectos',
            id,
            'edicion',
            [{ campo: 'avance', antes: previo, despues: valor }],
            marcaTiempo(cuando, entre(9, 17), entre(0, 59)),
            id,
            elegir(EQUIPO),
          );
          previo = valor;
        }

        // El cambio de estado también queda asentado: es lo que se audita.
        if (estado === 'finalizado' || estado === 'suspendido') {
          asentar(
            'proyectos',
            id,
            'edicion',
            [{ campo: 'estado', antes: 'en ejecución', despues: estado }],
            marcaTiempo(finReal, 12, entre(0, 59)),
            id,
            elegir(EQUIPO),
          );
        }
      }
    });
  }

  /* ── CASO · proyectos dados de baja ─────────────────────────────── */
  // Cargas duplicadas o proyectos que no llegaron a arrancar. Quedan en la base
  // con `activo: false` y su asiento de baja: nada se borra nunca.
  const candidatosBaja = bd.proyectos.filter((p) => p.estado === 'suspendido');
  for (const p of tomar(candidatosBaja, Math.min(6, candidatosBaja.length))) {
    p.activo = false;
    asentar(
      'proyectos',
      p.id_proyecto,
      'baja',
      [{ campo: 'activo', antes: true, despues: false }],
      marcaTiempo(desplazar(hoy, -entre(40, 400)), 11, entre(0, 59)),
      p.id_proyecto,
      elegir(EQUIPO),
    );
  }

  /** Pool de referencia: nada se vincula a un proyecto dado de baja. */
  const vigentes = bd.proyectos.filter((p) => p.activo !== false);
  const porArea = new Map();
  for (const p of vigentes) {
    if (!porArea.has(p.area)) porArea.set(p.area, []);
    porArea.get(p.area).push(p);
  }
  const proyectosDe = (nombreArea) => porArea.get(nombreArea) ?? [];
  const porId = new Map(vigentes.map((p) => [p.id_proyecto, p]));

  /* ── Compromisos (constructor común) ────────────────────────────── */

  const crearCompromiso = ({
    origen_tipo, id_origen, area, id_proyecto, fecha_limite, estado, descripcion, responsable, creado_en,
  }) => {
    const firma = elegir(EQUIPO);
    const c = {
      id: nuevoId('com'),
      origen_tipo,
      id_origen,
      id_proyecto: id_proyecto ?? null,
      area,
      descripcion: descripcion ?? elegir(DESCRIPCIONES_COMPROMISO),
      responsable: responsable ?? elegir(PERSONAS),
      fecha_limite,
      estado,
      fecha_cumplimiento: estado === 'cumplido' ? desplazar(fecha_limite, -entre(0, 8)) : null,
      activo: true,
      creado_por: firma,
      creado_en: creado_en ?? marcaTiempo(desplazar(fecha_limite, -entre(10, 30)), 14, entre(0, 59)),
    };
    bd.compromisos.push(c);
    asentar('compromisos', c.id, 'alta', [], c.creado_en, c.id_proyecto, firma);
    if (estado === 'cumplido') {
      asentar(
        'compromisos',
        c.id,
        'edicion',
        [{ campo: 'estado', antes: 'pendiente', despues: 'cumplido' }],
        marcaTiempo(c.fecha_cumplimiento, entre(9, 18), entre(0, 59)),
        c.id_proyecto,
        firma,
      );
    }
    return c;
  };

  /**
   * Estado plausible de un compromiso, según su antigüedad y según cómo cumple
   * el área.
   *
   * Las dos variables importan. Sin la antigüedad, la lista muestra vencidos de
   * hace dos años que nadie arrastraría. Sin el rendimiento por área, TODAS las
   * áreas terminan con algún vencido y el tablero de secretarías sale entero en
   * rojo: deja de ordenar por urgencia, que es para lo que existe.
   */
  const cumplimientoDe = new Map(AREAS.map((a) => [a.nombre, a.cumplimiento]));
  const estadoSegunEdad = (fechaLimite, area) => {
    const base = cumplimientoDe.get(area) ?? 0.93;
    const dias = Math.round((Date.parse(fechaLimite) - Date.parse(hoy)) / MS_DIA);
    if (dias < -120) return chance(Math.min(base + 0.04, 1)) ? 'cumplido' : 'pendiente';
    if (dias < -30) return chance(base) ? 'cumplido' : 'pendiente';
    if (dias < 0) return chance(base - 0.12) ? 'cumplido' : chance(0.5) ? 'pendiente' : 'en curso';
    return chance(0.3) ? 'cumplido' : chance(0.45) ? 'en curso' : 'pendiente';
  };

  /* ── Seguimientos ───────────────────────────────────────────────── */

  const seguimientosRealizados = [];

  for (const area of AREAS) {
    const proyectosArea = proyectosDe(area.nombre);
    // Las áreas grandes se siguen casi todos los meses; las chicas, salteado.
    const frecuencia = proyectosArea.length > 25 ? 0.92 : proyectosArea.length > 14 ? 0.75 : 0.55;

    for (const mes of MESES) {
      if (!chance(frecuencia)) continue;
      const fecha = diaEnMes(mes, entre(3, 26), hoy);
      if (fecha >= hoy) continue;

      const vinculados = tomar(
        proyectosArea.filter((p) => p.fecha_inicio <= fecha),
        entre(1, 3),
      ).map((p) => p.id_proyecto);

      const avances = tomar(FRASES_AVANCE, entre(1, 3));
      const problemas = tomar(FRASES_PROBLEMA, entre(0, 2));
      const pedidos = tomar(FRASES_COMPROMISO, entre(1, 3));
      const firma = elegir(EQUIPO);

      const s = {
        id: nuevoId('seg'),
        ids_proyecto: vinculados,
        area: area.nombre,
        fecha,
        hora: `${entre(9, 17)}:${chance(0.5) ? '00' : '30'}`,
        tipo: 'realizado',
        participantes: tomar(PERSONAS, entre(2, 4)).join(', '),
        temas: tomar(TEMAS_SEGUIMIENTO, 2).join(', '),
        texto_crudo: [
          'Se revisó el estado general de los proyectos del área.',
          ...avances,
          ...problemas,
          ...pedidos,
        ].join(' '),
        resumen: problemas.length
          ? 'Revisión de avance con puntos pendientes de resolución.'
          : 'Revisión de avance y definición de próximos pasos.',
        avances,
        problemas,
        estado_reportado: problemas.length > 1 ? 'demorado' : 'en ejecución',
        activo: true,
        creado_por: firma,
        creado_en: marcaTiempo(fecha, entre(15, 19), entre(0, 59)),
      };
      bd.seguimientos.push(s);
      seguimientosRealizados.push(s);
      asentar('seguimientos', s.id, 'alta', [], s.creado_en, vinculados[0] ?? null, firma);

      // Un compromiso por cada pedido detectado en la minuta.
      for (const pedido of pedidos) {
        const limite = desplazar(fecha, entre(10, 60));
        crearCompromiso({
          origen_tipo: 'seguimiento',
          id_origen: s.id,
          area: area.nombre,
          id_proyecto: vinculados[0] ?? null,
          fecha_limite: limite,
          estado: estadoSegunEdad(limite, area.nombre),
          descripcion: elegir(DESCRIPCIONES_COMPROMISO),
          creado_en: s.creado_en,
        });
      }
    }

    // Seguimientos ya agendados hacia adelante.
    for (let i = 0; i < (chance(0.75) ? 2 : 1); i += 1) {
      const fecha = desplazar(hoy, entre(2, 45));
      const firma = elegir(EQUIPO);
      const s = {
        id: nuevoId('seg'),
        ids_proyecto: tomar(proyectosArea, Math.min(2, proyectosArea.length)).map((p) => p.id_proyecto),
        area: area.nombre,
        fecha,
        hora: `${entre(9, 16)}:30`,
        tipo: 'programado',
        participantes: tomar(PERSONAS, 2).join(', '),
        temas: elegir(TEMAS_SEGUIMIENTO),
        texto_crudo: '',
        resumen: '',
        avances: [],
        problemas: [],
        estado_reportado: '',
        activo: true,
        creado_por: firma,
        creado_en: marcaTiempo(desplazar(hoy, -entre(1, 20)), 12, entre(0, 59)),
      };
      bd.seguimientos.push(s);
      asentar('seguimientos', s.id, 'alta', [], s.creado_en, s.ids_proyecto[0] ?? null, firma);
    }
  }

  /* ── Monitoreos y temas ─────────────────────────────────────────── */

  // Cobertura despareja a propósito: las dos direcciones nuevas todavía no
  // entraron al circuito de monitoreo, y eso es exactamente lo que el tablero
  // de secretarías tiene que dejar a la vista.
  const SIN_MONITOREO = new Set(['Dirección de Modernización', 'Dirección de Género y Diversidad']);
  // Un área que se monitoreaba y dejó de hacerlo hace más de un mes.
  const MONITOREO_INTERRUMPIDO = 'Dirección de Juventud';

  for (const area of AREAS) {
    if (SIN_MONITOREO.has(area.nombre)) continue;
    const proyectosArea = proyectosDe(area.nombre);
    const frecuencia = proyectosArea.length > 25 ? 0.88 : proyectosArea.length > 14 ? 0.72 : 0.5;

    for (const mes of MESES) {
      if (!chance(frecuencia)) continue;
      const fecha = diaEnMes(mes, entre(4, 27), hoy);
      if (fecha >= hoy) continue;
      // El área interrumpida no tiene monitoreos en los últimos 45 días.
      if (area.nombre === MONITOREO_INTERRUMPIDO && fecha > desplazar(hoy, -45)) continue;

      const firma = elegir(EQUIPO);
      const m = {
        id: nuevoId('mon'),
        fecha,
        area: area.nombre,
        cerrado: true,
        activo: true,
        creado_por: firma,
        creado_en: marcaTiempo(fecha, entre(14, 18), entre(0, 59)),
      };
      bd.monitoreos.push(m);
      asentar('monitoreos', m.id, 'alta', [], m.creado_en, null, firma);

      const disponibles = proyectosArea.filter((p) => p.fecha_inicio <= fecha);
      for (let t = 0; t < entre(2, 6); t += 1) {
        const requiereAccion = chance(0.42);
        const proyecto = chance(0.72) && disponibles.length ? elegir(disponibles) : null;
        /* La criticidad y la resolución siguen el mismo rendimiento del área que
           gobierna los compromisos: donde se cumple, los temas críticos son
           menos y se cierran; donde no, se acumulan. Es lo que hace que el
           semáforo del tablero distinga áreas en vez de pintarlas todas igual. */
        const rinde = cumplimientoDe.get(area.nombre) ?? 0.93;
        const criticidad = chance(rinde <= 0.9 ? 0.24 : 0.1) ? 'alta' : chance(0.55) ? 'media' : 'baja';
        const fechaLimite = requiereAccion ? desplazar(fecha, entre(7, 50)) : null;
        const antiguedad = Math.round((Date.parse(hoy) - Date.parse(fecha)) / MS_DIA);
        // Lo viejo está mayormente resuelto; lo crítico tarda más en cerrarse.
        const resuelto = criticidad === 'alta'
          ? antiguedad > 90 ? chance(Math.min(rinde + 0.02, 1)) : chance(rinde - 0.2)
          : antiguedad > 45 ? chance(0.94) : chance(0.7);

        const tema = {
          id: nuevoId('tem'),
          id_monitoreo: m.id,
          id_proyecto: proyecto?.id_proyecto ?? null,
          categoria: elegir(CATEGORIAS_TEMA),
          descripcion: elegir(TEMAS_MONITOREO),
          criticidad,
          requiere_accion: requiereAccion,
          responsable: requiereAccion ? elegir(PERSONAS) : '',
          fecha_limite: fechaLimite,
          resuelto,
          activo: true,
          creado_por: firma,
          creado_en: m.creado_en,
        };

        if (requiereAccion) {
          const c = crearCompromiso({
            origen_tipo: 'monitoreo',
            id_origen: m.id,
            area: area.nombre,
            id_proyecto: tema.id_proyecto,
            fecha_limite: fechaLimite,
            estado: resuelto ? 'cumplido' : estadoSegunEdad(fechaLimite, area.nombre),
            descripcion: tema.descripcion,
            responsable: tema.responsable,
            creado_en: m.creado_en,
          });
          tema.id_compromiso = c.id;
        }

        bd.temas_monitoreo.push(tema);
        asentar('temas_monitoreo', tema.id, 'alta', [], tema.creado_en, tema.id_proyecto, firma);
      }
    }
  }

  /* ── Mesas de trabajo ───────────────────────────────────────────── */

  const MESAS = [
    ['Mesa de Movilidad Urbana', 'temática', 'mensual', 'Coordina el ordenamiento del tránsito y el transporte público.'],
    ['Mesa de Gestión Ambiental', 'temática', 'bimestral', 'Articula las políticas ambientales entre áreas.'],
    ['Mesa de Niñez y Adolescencia', 'temática', 'mensual', 'Espacio intersectorial de políticas de infancia.'],
    ['Mesa de Seguridad Vial', 'temática', 'mensual', 'Seguimiento del plan de seguridad vial y siniestralidad.'],
    ['Mesa de Economía Social', 'temática', 'quincenal', 'Articulación con cooperativas y emprendedores.'],
    ['Mesa de Salud Comunitaria', 'temática', 'mensual', 'Coordinación entre centros de salud y áreas sociales.'],
    ['Mesa Barrial Los Álamos', 'barrial', 'mensual', 'Espacio de participación con referentes del barrio.'],
    ['Mesa Barrial Villa Esperanza', 'barrial', 'quincenal', 'Seguimiento de obras y servicios del barrio.'],
    ['Mesa Barrial San Ignacio', 'barrial', 'mensual', 'Articulación con instituciones del barrio.'],
    ['Mesa Barrial El Progreso', 'barrial', 'mensual', 'Seguimiento del plan de urbanización.'],
    ['Mesa Barrial Las Acacias', 'barrial', 'bimestral', 'Espacio de participación vecinal.'],
    ['Mesa Barrial La Estación', 'barrial', 'mensual', 'Seguimiento de obras de infraestructura.'],
    ['Plan de Modernización Administrativa', 'otros proyectos', 'trimestral', 'Seguimiento del plan de digitalización de trámites.'],
    ['Convenio con Universidad Regional', 'otros proyectos', 'trimestral', 'Cooperación técnica y formación.'],
    ['Programa de Cooperación Intermunicipal', 'otros proyectos', 'trimestral', 'Articulación con municipios de la región.'],
    ['Comité de Emergencias Climáticas', 'otros proyectos', 'bimestral', 'Protocolo conjunto ante eventos climáticos.'],
  ];

  const DIAS_ENTRE_REUNIONES = { semanal: 7, quincenal: 15, mensual: 30, bimestral: 60, trimestral: 90 };

  bd.mesas = [];
  MESAS.forEach(([nombre, tipo, periodicidad, descripcion], indice) => {
    const firma = elegir(EQUIPO);
    const estado = indice % 7 === 6 ? 'latente' : indice % 11 === 10 ? 'cerrada' : 'activa';
    const mesa = {
      id: nuevoId('mes'),
      nombre,
      tipo,
      descripcion,
      referente: elegir(PERSONAS),
      periodicidad,
      estado,
      proyectos_vinculados: tomar(vigentes, entre(2, 5)).map((p) => p.id_proyecto),
      activo: true,
      creado_por: firma,
      creado_en: marcaTiempo(desplazar(hoy, -entre(400, 720)), 10, entre(0, 59)),
    };
    bd.mesas.push(mesa);
    asentar('mesas', mesa.id, 'alta', [], mesa.creado_en, null, firma);

    // Reuniones hacia atrás, respetando la periodicidad declarada con desvíos.
    const paso = DIAS_ENTRE_REUNIONES[periodicidad] ?? 30;
    const historia = estado === 'cerrada' ? 400 : 540;
    let dias = estado === 'latente' ? entre(70, 120) : entre(4, Math.round(paso * 0.8));
    while (dias < historia) {
      const fecha = desplazar(hoy, -dias);
      const firmaReunion = elegir(EQUIPO);
      const r = {
        id: nuevoId('reu'),
        id_mesa: mesa.id,
        fecha,
        asistentes: tomar(PERSONAS, entre(3, 6)).join(', '),
        temas: 'Revisión de compromisos anteriores y estado de los proyectos vinculados.',
        activo: true,
        creado_por: firmaReunion,
        creado_en: marcaTiempo(fecha, entre(17, 20), entre(0, 59)),
      };
      bd.reuniones_mesa.push(r);
      asentar('reuniones_mesa', r.id, 'alta', [], r.creado_en, null, firmaReunion);

      if (chance(0.55)) {
        const limite = desplazar(fecha, entre(15, 50));
        // El compromiso de una mesa recae sobre el área dueña del proyecto
        // tratado; sólo si la mesa no tiene proyectos se sortea un área.
        const idProyectoMesa = mesa.proyectos_vinculados[0] ?? null;
        const areaCompromiso = porId.get(idProyectoMesa)?.area ?? elegir(AREAS).nombre;
        crearCompromiso({
          origen_tipo: 'mesa',
          id_origen: mesa.id,
          area: areaCompromiso,
          id_proyecto: idProyectoMesa,
          fecha_limite: limite,
          estado: estadoSegunEdad(limite, areaCompromiso),
          creado_en: r.creado_en,
        });
      }
      dias += paso + entre(-4, 10);
    }

    // Próxima reunión agendada, que aparece en el calendario unificado.
    if (estado === 'activa' && chance(0.7)) {
      const fecha = desplazar(hoy, entre(2, Math.max(4, paso)));
      const firmaAgenda = elegir(EQUIPO);
      const r = {
        id: nuevoId('reu'),
        id_mesa: mesa.id,
        fecha,
        asistentes: '',
        temas: 'Agenda a confirmar.',
        activo: true,
        creado_por: firmaAgenda,
        creado_en: marcaTiempo(desplazar(hoy, -entre(1, 10)), 12, entre(0, 59)),
      };
      bd.reuniones_mesa.push(r);
      asentar('reuniones_mesa', r.id, 'alta', [], r.creado_en, null, firmaAgenda);
    }
  });

  /* ── CASO · mesas activas fuera de su periodicidad ──────────────── */
  const atrasadas = bd.mesas.filter((m) => m.estado === 'activa' && m.periodicidad === 'mensual').slice(0, 2);
  for (const mesa of atrasadas) {
    bd.reuniones_mesa = bd.reuniones_mesa.filter((r) => r.id_mesa !== mesa.id || r.fecha < desplazar(hoy, -75));
    if (!bd.reuniones_mesa.some((r) => r.id_mesa === mesa.id)) {
      const fecha = desplazar(hoy, -entre(80, 110));
      bd.reuniones_mesa.push({
        id: nuevoId('reu'),
        id_mesa: mesa.id,
        fecha,
        asistentes: tomar(PERSONAS, 3).join(', '),
        temas: 'Última reunión registrada de la mesa.',
        activo: true,
        creado_por: 'Coordinación',
        creado_en: marcaTiempo(fecha, 18, 30),
      });
    }
  }

  /* ── Eventos y requerimientos ───────────────────────────────────── */

  const NOMBRES_EVENTO = [
    ['Inauguración de plaza renovada', 'Inauguración'],
    ['Feria de emprendedores locales', 'Feria'],
    ['Jornada de salud en el barrio', 'Jornada'],
    ['Operativo integral de servicios', 'Operativo territorial'],
    ['Muestra de la escuela de arte', 'Actividad cultural'],
    ['Torneo intercolegial', 'Actividad deportiva'],
    ['Acto por el aniversario del distrito', 'Acto institucional'],
    ['Feria del libro barrial', 'Feria'],
    ['Jornada de vacunación antigripal', 'Jornada'],
    ['Inauguración de playón deportivo', 'Inauguración'],
    ['Capacitación en oficios para jóvenes', 'Capacitación'],
    ['Asamblea vecinal de presupuesto participativo', 'Asamblea barrial'],
    ['Festival de bandas emergentes', 'Actividad cultural'],
    ['Operativo de descacharrado', 'Operativo territorial'],
    ['Jornada de forestación comunitaria', 'Jornada'],
    ['Encuentro de mujeres emprendedoras', 'Jornada'],
  ];

  const LUGARES = [
    'Plaza central', 'Predio municipal', 'Centro de salud', 'Polideportivo municipal',
    'Centro cultural municipal', 'Palacio municipal', 'Delegación barrial', 'Club social y deportivo',
    'Escuela municipal', 'Salón de usos múltiples',
  ];

  /** Eventos repartidos entre los últimos 20 meses y los próximos tres. */
  const crearEvento = (dias, forzarPendientes = false) => {
    const [nombre, tipo] = elegir(NOMBRES_EVENTO);
    const fecha = desplazar(hoy, dias);
    const area = elegir(AREAS);
    const proyectosArea = proyectosDe(area.nombre);
    const firma = elegir(EQUIPO);

    const evento = {
      id: nuevoId('eve'),
      nombre: `${nombre} — ${elegir(BARRIOS)}`,
      fecha,
      hora: `${entre(9, 20)}:${chance(0.5) ? '00' : '30'}`,
      lugar: `${elegir(LUGARES)} de ${elegir(BARRIOS)}`,
      area_organizadora: area.nombre,
      tipo,
      id_proyecto: chance(0.45) && proyectosArea.length ? elegir(proyectosArea).id_proyecto : null,
      estado: dias < 0 ? (chance(0.94) ? 'realizado' : 'suspendido') : chance(0.68) ? 'confirmado' : 'previsto',
      activo: true,
      creado_por: firma,
      creado_en: marcaTiempo(desplazar(fecha, -entre(20, 60)) > hoy ? hoy : desplazar(fecha, -entre(20, 60)), 11, entre(0, 59)),
    };
    bd.eventos.push(evento);
    asentar('eventos', evento.id, 'alta', [], evento.creado_en, evento.id_proyecto, firma);

    for (const item of tomar(ITEMS_REQUERIMIENTO, entre(4, 9))) {
      const estado = forzarPendientes
        ? chance(0.45) ? 'confirmado' : 'solicitado'
        : dias < 0
          ? chance(0.9) ? 'entregado' : 'confirmado'
          : chance(0.7) ? 'confirmado' : 'solicitado';
      const r = {
        id: nuevoId('req'),
        id_evento: evento.id,
        item,
        cantidad: entre(1, 80),
        area_responsable: elegir(AREAS).nombre,
        estado,
        activo: true,
        creado_por: firma,
        creado_en: evento.creado_en,
      };
      bd.requerimientos_evento.push(r);
      asentar('requerimientos_evento', r.id, 'alta', [], r.creado_en, null, firma);
    }
    return evento;
  };

  for (let i = 0; i < 52; i += 1) crearEvento(-entre(5, 600));
  for (let i = 0; i < 14; i += 1) crearEvento(entre(8, 95));
  /* CASO · eventos inminentes con requerimientos sin confirmar */
  crearEvento(2, true);
  crearEvento(4, true);

  /* ── Planificación anual ────────────────────────────────────────── */

  for (const p of vigentes) {
    // La planificación se carga por año de ejecución. No todos los proyectos la
    // tienen: el comparativo tiene que poder mostrar los que faltan cargar.
    const anioPlan = Number(p.fecha_inicio.slice(0, 4));
    if (chance(0.14)) continue;

    const metaAnual = p.objetivo;
    const sesgo = azar();
    const curva = sesgo < 0.28 ? [0.35, 0.6, 0.85, 1] : sesgo < 0.68 ? [0.25, 0.5, 0.75, 1] : [0.15, 0.35, 0.6, 1];
    const firma = elegir(EQUIPO);

    const plan = {
      id: nuevoId('pla'),
      id_proyecto: p.id_proyecto,
      anio: anioPlan,
      meta_anual: metaAnual,
      metas_trimestrales: curva.map((c) => Math.round(metaAnual * c)),
      monto_planificado: p.monto_planificado,
      hitos: [
        { id: nuevoId('hit'), descripcion: 'Inicio de ejecución', fecha: p.fecha_inicio },
        { id: nuevoId('hit'), descripcion: 'Certificación intermedia', fecha: desplazar(p.fecha_inicio, 90) },
        { id: nuevoId('hit'), descripcion: 'Rendición del período', fecha: desplazar(p.fecha_inicio, 180) },
        { id: nuevoId('hit'), descripcion: 'Cierre previsto', fecha: p.fecha_fin_prevista },
      ],
      activo: true,
      creado_por: firma,
      creado_en: marcaTiempo(p.fecha_inicio, 10, entre(0, 59)),
    };
    bd.planificacion_anual.push(plan);
    asentar('planificacion_anual', plan.id, 'alta', [], plan.creado_en, p.id_proyecto, firma);

    // Los proyectos que siguen en curso este año tienen además la planificación
    // del año corriente: es lo que compara el tablero de planificado vs. real.
    if (anioPlan !== anio && ['planificado', 'en ejecución', 'demorado'].includes(p.estado)) {
      const restante = Math.max(metaAnual - p.avance, Math.round(metaAnual * 0.2));
      const planActual = {
        id: nuevoId('pla'),
        id_proyecto: p.id_proyecto,
        anio,
        meta_anual: restante,
        metas_trimestrales: [0.3, 0.55, 0.8, 1].map((c) => Math.round(restante * c)),
        monto_planificado: Math.round(p.monto_planificado * 0.6),
        hitos: [
          { id: nuevoId('hit'), descripcion: 'Reprogramación de la etapa', fecha: `${anio}-02-15` },
          { id: nuevoId('hit'), descripcion: 'Cierre previsto', fecha: p.fecha_fin_prevista },
        ],
        activo: true,
        creado_por: firma,
        creado_en: marcaTiempo(`${anio}-02-01`, 10, entre(0, 59)),
      };
      bd.planificacion_anual.push(planActual);
      asentar('planificacion_anual', planActual.id, 'alta', [], planActual.creado_en, p.id_proyecto, firma);
    }
  }

  /* ── CASO · proyectos activos sin novedades hace más de 30 días ── */
  // Se corren TODOS los asientos del proyecto hacia atrás: la «última
  // actualización» mira la bitácora entera, no sólo los cambios de la ficha.
  const enMarcha = vigentes.filter((p) => ['en ejecución', 'demorado'].includes(p.estado));
  for (const p of tomar(enMarcha, Math.min(18, enMarcha.length))) {
    const viejo = marcaTiempo(desplazar(hoy, -entre(35, 150)), 10, entre(0, 59));
    for (const h of bd.historial) {
      if (h.id_proyecto === p.id_proyecto && h.creado_en > viejo) h.creado_en = viejo;
    }
  }

  /* ── CASO · compromisos vencidos y por vencer ───────────────────── */
  // El azar ya produce varios, pero la cantidad no está garantizada y estos son
  // los dos casos que el sistema existe para mostrar: se aseguran a mano. Los
  // vencidos se concentran en las áreas que ya vienen cumpliendo peor —no
  // repartidos al azar—, porque una deuda que aparece siempre en las mismas
  // áreas es lo que un tablero de gestión tiene que dejar ver.
  const conDeuda = AREAS.filter((a) => a.cumplimiento <= 0.9).map((a) => a.nombre);
  const proyectoDeArea = (nombreArea) => {
    const lista = proyectosDe(nombreArea);
    return lista.length ? elegir(lista) : elegir(vigentes);
  };

  for (let i = 0; i < 14; i += 1) {
    const p = proyectoDeArea(elegir(conDeuda));
    crearCompromiso({
      origen_tipo: 'seguimiento',
      id_origen: elegir(seguimientosRealizados).id,
      area: p.area,
      id_proyecto: p.id_proyecto,
      fecha_limite: desplazar(hoy, -entre(2, 45)),
      estado: chance(0.5) ? 'pendiente' : 'en curso',
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const p = elegir(vigentes);
    crearCompromiso({
      origen_tipo: 'seguimiento',
      id_origen: elegir(seguimientosRealizados).id,
      area: p.area,
      id_proyecto: p.id_proyecto,
      fecha_limite: desplazar(hoy, entre(0, 6)),
      estado: chance(0.5) ? 'pendiente' : 'en curso',
    });
  }

  /* ── CASO · temas críticos abiertos ─────────────────────────────── */
  const criticos = bd.temas_monitoreo.filter((t) => t.criticidad === 'alta');
  for (const t of tomar(criticos, Math.min(8, criticos.length))) t.resuelto = false;

  /* ── Reportes guardados ─────────────────────────────────────────── */

  const REPORTES = [
    ['Informe semanal Obras Públicas', { area: 'Secretaría de Obras Públicas', rango: 'semana' },
      { proyectos: true, compromisos: true, graficos: true, alertas: true, minutas: false, temas: false }],
    ['Proyectos prioritarios con alertas', { solo_prioritarios: true, solo_con_alertas: true, rango: 'mes' },
      { proyectos: true, compromisos: true, graficos: false, alertas: true, minutas: false, temas: true }],
    ['Tablero mensual de intendencia', { rango: 'mes' },
      { proyectos: true, compromisos: true, graficos: true, alertas: true, minutas: false, temas: true }],
    ['Obras en ejecución', { tipo: 'Obra', estado: 'en ejecución' },
      { proyectos: true, compromisos: false, graficos: true, alertas: false, minutas: false, temas: false }],
    ['Compromisos vencidos por área', { rango: 'trimestre' },
      { proyectos: false, compromisos: true, graficos: false, alertas: true, minutas: false, temas: false }],
    ['Monitoreo de Desarrollo Social', { area: 'Secretaría de Desarrollo Social', rango: 'trimestre' },
      { proyectos: true, compromisos: true, graficos: false, alertas: false, minutas: true, temas: true }],
  ];

  for (const [nombre, filtros, bloques] of REPORTES) {
    const firma = elegir(EQUIPO);
    const r = {
      id: nuevoId('rep'),
      nombre,
      filtros,
      bloques,
      activo: true,
      creado_por: firma,
      creado_en: marcaTiempo(desplazar(hoy, -entre(3, 120)), 9, entre(0, 59)),
    };
    bd.reportes_guardados.push(r);
    asentar('reportes_guardados', r.id, 'alta', [], r.creado_en, null, firma);
  }

  // La bitácora se ordena por fecha (y secuencia, para desempatar) de modo que
  // el feed del inicio y los historiales salgan coherentes.
  bd.historial.sort(
    (a, b) => String(a.creado_en).localeCompare(String(b.creado_en)) || a.secuencia - b.secuencia,
  );

  return bd;
}

/** Conteo por colección, para mostrar el volumen sin recorrer la base a mano. */
export function conteoBD(bd) {
  const conteo = {};
  let total = 0;
  for (const [clave, valor] of Object.entries(bd ?? {})) {
    if (!Array.isArray(valor)) continue;
    conteo[clave] = valor.length;
    total += valor.length;
  }
  return { ...conteo, total };
}
