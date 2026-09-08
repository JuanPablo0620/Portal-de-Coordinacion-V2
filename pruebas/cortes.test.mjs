/**
 * Cortes de calle: vigencia, estado derivado y control de período.
 *
 * Lo que se prueba acá es la regla de negocio del módulo de Mapa —cuándo un
 * corte corta— porque es la que no se ve mirando la pantalla: un corte
 * recurrente mal resuelto se nota recién el domingo, y un corte sin fecha de
 * fin que deja de aparecer es exactamente el error que hace inservible al mapa.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NIVEL_ESTADO_CORTE,
  cortesEnRango,
  cuadrasDe,
  descripcionTramo,
  diaSemanaDe,
  estadoCorte,
  ocurreEn,
  ocurreEnRango,
  sinFechaDeFin,
  tramosDe,
  ubicacionDe,
  textoAviso,
  vigenciaDe,
} from '../src/datos/cortes.js';
import { desplazarDia, resolverPeriodo } from '../src/modulos/mapa/periodoCortes.js';
import { agruparPorCalle, datosDeSeleccion, geometriaDe } from '../src/modulos/mapa/seleccionCuadras.js';
import { extremosDe, metrosEntre } from '../src/datos/geoportal.js';

/** Domingo. Elegido a propósito: los cortes recurrentes de verdad son ferias. */
const HOY = '2026-09-13';

const corteDeUnDia = {
  id: 'co_1',
  activo: true,
  forma: 'tramo',
  calle: 'Avenida San Martín',
  esquina_desde: 'Lavalle',
  esquina_hasta: 'Hornos',
  localidad: 'Caseros',
  alcance: 'total',
  motivo: 'evento',
  detalle_motivo: 'feria de emprendedores',
  vigencia_desde: HOY,
  vigencia_hasta: HOY,
  hora_desde: '08:00',
  hora_hasta: '14:00',
  dias_semana: [],
  fechas_excluidas: [],
  estado: 'previsto',
};

const obraDeVariosDias = {
  ...corteDeUnDia,
  id: 'co_2',
  motivo: 'obra',
  vigencia_desde: '2026-09-10',
  vigencia_hasta: '2026-09-20',
  hora_desde: '',
  hora_hasta: '',
};

const feriaDominical = {
  ...corteDeUnDia,
  id: 'co_3',
  vigencia_desde: '2026-01-04',
  vigencia_hasta: '2026-12-27',
  dias_semana: [0],
};

const corteAbierto = { ...corteDeUnDia, id: 'co_4', vigencia_hasta: null };

/* ── Día de la semana ───────────────────────────────────────────────── */

test('el día de la semana no se corre por la zona horaria', () => {
  // `new Date('2026-09-13').getDay()` da sábado en Argentina, porque interpreta
  // la fecha como medianoche UTC. El 13/09/2026 es domingo.
  assert.equal(diaSemanaDe('2026-09-13'), 0);
  assert.equal(diaSemanaDe('2026-09-14'), 1);
});

/* ── Ocurrencia ─────────────────────────────────────────────────────── */

test('un corte de un día corta ese día y ningún otro', () => {
  assert.equal(ocurreEn(corteDeUnDia, HOY), true);
  assert.equal(ocurreEn(corteDeUnDia, '2026-09-14'), false);
  assert.equal(ocurreEn(corteDeUnDia, '2026-09-12'), false);
});

test('una obra de varios días corta todos los días del rango', () => {
  assert.equal(ocurreEn(obraDeVariosDias, '2026-09-10'), true);
  assert.equal(ocurreEn(obraDeVariosDias, '2026-09-15'), true);
  assert.equal(ocurreEn(obraDeVariosDias, '2026-09-20'), true);
  assert.equal(ocurreEn(obraDeVariosDias, '2026-09-21'), false);
});

test('una feria dominical corta los domingos y sólo los domingos', () => {
  assert.equal(ocurreEn(feriaDominical, '2026-09-13'), true, 'domingo');
  assert.equal(ocurreEn(feriaDominical, '2026-09-14'), false, 'lunes');
  assert.equal(ocurreEn(feriaDominical, '2026-09-20'), true, 'domingo siguiente');
});

test('el domingo que no hay feria se saca con una fecha excluida', () => {
  const conExcepcion = { ...feriaDominical, fechas_excluidas: ['2026-09-20'] };
  assert.equal(ocurreEn(conExcepcion, '2026-09-13'), true);
  assert.equal(ocurreEn(conExcepcion, '2026-09-20'), false);
  assert.equal(ocurreEn(conExcepcion, '2026-09-27'), true);
});

test('un corte suspendido no corta, aunque su vigencia diga que sí', () => {
  assert.equal(ocurreEn({ ...corteDeUnDia, estado: 'suspendido' }, HOY), false);
});

test('un corte dado de baja no corta', () => {
  assert.equal(ocurreEn({ ...corteDeUnDia, activo: false }, HOY), false);
});

test('un corte sin fecha de fin sigue cortando meses después', () => {
  assert.equal(ocurreEn(corteAbierto, '2027-03-01'), true);
});

/* ── Rangos ─────────────────────────────────────────────────────────── */

test('el rango encuentra la feria aunque el período no empiece un domingo', () => {
  // Un lunes a viernes que NO contiene ningún domingo no debería traerla.
  assert.equal(ocurreEnRango(feriaDominical, '2026-09-14', '2026-09-18'), false);
  // Y una semana completa sí.
  assert.equal(ocurreEnRango(feriaDominical, '2026-09-14', '2026-09-20'), true);
});

test('un corte terminado no aparece en un período posterior', () => {
  assert.equal(ocurreEnRango(obraDeVariosDias, '2026-10-01', '2026-10-07'), false);
});

test('un corte abierto aparece en un período que arranca después de que empezó', () => {
  assert.equal(ocurreEnRango(corteAbierto, '2026-11-01', '2026-11-07'), true);
});

test('cortesEnRango filtra la base y ordena por fecha de inicio', () => {
  const bd = { cortes: [corteDeUnDia, obraDeVariosDias, feriaDominical] };
  const resultado = cortesEnRango(bd, HOY, HOY);
  assert.deepEqual(
    resultado.map((c) => c.id),
    ['co_3', 'co_2', 'co_1'],
  );
});

/* ── Estado derivado ────────────────────────────────────────────────── */

test('«vigente» se deduce del reloj y no se guarda', () => {
  assert.equal(estadoCorte(corteDeUnDia, HOY), 'vigente');
  assert.equal(estadoCorte(corteDeUnDia, '2026-09-14'), 'finalizado');
  assert.equal(estadoCorte(corteDeUnDia, '2026-09-01'), 'programado');
  // Ninguno de esos tres valores está guardado en el corte.
  assert.equal(corteDeUnDia.estado, 'previsto');
});

test('levantar un corte gana sobre su vigencia', () => {
  assert.equal(estadoCorte({ ...corteDeUnDia, estado: 'levantado' }, HOY), 'levantado');
  assert.equal(estadoCorte({ ...corteDeUnDia, estado: 'suspendido' }, HOY), 'suspendido');
});

test('la feria un martes está programada, no finalizada', () => {
  assert.equal(estadoCorte(feriaDominical, '2026-09-15'), 'programado');
});

test('cada estado tiene un nivel de semáforo', () => {
  for (const estado of ['vigente', 'programado', 'finalizado', 'levantado', 'suspendido']) {
    assert.ok(NIVEL_ESTADO_CORTE[estado], `falta el nivel de ${estado}`);
  }
  assert.equal(NIVEL_ESTADO_CORTE.vigente, 'vencido', 'lo que está cortado ahora se pinta en rojo');
});

test('sólo un corte abierto y sin levantar cuenta como sin fecha de fin', () => {
  assert.equal(sinFechaDeFin(corteAbierto), true);
  assert.equal(sinFechaDeFin(corteDeUnDia), false);
  assert.equal(sinFechaDeFin({ ...corteAbierto, estado: 'levantado' }), false);
});

/* ── Texto ──────────────────────────────────────────────────────────── */

test('la ubicación se puede leer en voz alta', () => {
  assert.equal(ubicacionDe(corteDeUnDia), 'Avenida San Martín entre Lavalle y Hornos');
  assert.equal(
    ubicacionDe({ ...corteDeUnDia, forma: 'punto', esquina_desde: 'Lavalle' }),
    'Avenida San Martín y Lavalle',
  );
});

test('la vigencia se dice distinto según el caso', () => {
  assert.match(vigenciaDe(corteDeUnDia, HOY), /13\/09 de 08:00 a 14:00/);
  assert.match(vigenciaDe(obraDeVariosDias, HOY), /Del 10\/09 al 20\/09/);
  assert.match(vigenciaDe(feriaDominical, HOY), /domingos/);
});

test('un corte sin fecha de fin lo dice en su vigencia', () => {
  assert.match(vigenciaDe(corteAbierto, HOY), /sin fecha de levantamiento/);
});

test('el aviso incluye ubicación, vigencia, alcance y a quién afecta', () => {
  const aviso = textoAviso(corteDeUnDia, [
    { clave: 'colectivos', titulo: 'Recorridos de colectivo', etiquetas: ['Línea 237'], cantidad: 1 },
  ]);
  assert.match(aviso, /Avenida San Martín entre Lavalle y Hornos/);
  assert.match(aviso, /Corte total/);
  assert.match(aviso, /feria de emprendedores/);
  assert.match(aviso, /Línea 237/);
});

/* ── Control de período ─────────────────────────────────────────────── */

test('el módulo abre en el día, nunca en todo el histórico', () => {
  assert.deepEqual(resolverPeriodo({}, HOY), { desde: HOY, hasta: HOY, unDia: true });
});

test('los períodos rápidos se resuelven a fechas', () => {
  assert.deepEqual(resolverPeriodo({ periodo: 'manana' }, HOY), {
    desde: '2026-09-14',
    hasta: '2026-09-14',
    unDia: true,
  });
  assert.deepEqual(resolverPeriodo({ periodo: '7d' }, HOY), {
    desde: HOY,
    hasta: '2026-09-19',
    unDia: false,
  });
  assert.deepEqual(resolverPeriodo({ periodo: 'todo' }, HOY), { desde: '', hasta: '', unDia: false });
});

test('con un solo día las flechas mueven el calendario', () => {
  assert.deepEqual(desplazarDia({ periodo: 'hoy' }, HOY, 1), {
    periodo: 'personalizado',
    desde: '2026-09-14',
    hasta: '2026-09-14',
  });
  // Volver al día de hoy limpia el filtro en vez de dejar la fecha escrita.
  assert.deepEqual(desplazarDia({ periodo: 'personalizado', desde: '2026-09-14', hasta: '2026-09-14' }, HOY, -1), {
    periodo: 'hoy',
    desde: '',
    hasta: '',
  });
});

test('con un período de varios días las flechas no hacen nada', () => {
  assert.equal(desplazarDia({ periodo: '7d' }, HOY, 1), null);
});

/* ── Selección de cuadras ───────────────────────────────────────────── */

/** Cuatro cuadras: tres seguidas de una calle y una de la transversal. */
const cuadras = [
  {
    fid: 1,
    calle: 'Fischetti',
    localidad: 'Caseros Norte',
    sentido: '1. Creciente',
    alturas: [500, 598],
    lineas: [[{ lat: -34.6, lng: -58.56 }, { lat: -34.6, lng: -58.559 }]],
  },
  {
    fid: 2,
    calle: 'Fischetti',
    localidad: 'Caseros Norte',
    sentido: '1. Creciente',
    alturas: [600, 698],
    lineas: [[{ lat: -34.6, lng: -58.559 }, { lat: -34.6, lng: -58.558 }]],
  },
  {
    fid: 3,
    calle: 'Fischetti',
    localidad: '',
    sentido: '',
    alturas: [700, 798],
    lineas: [[{ lat: -34.6, lng: -58.558 }, { lat: -34.6, lng: -58.557 }]],
  },
  {
    fid: 4,
    calle: 'Hornos',
    localidad: 'Caseros Norte',
    sentido: '2. Decreciente',
    alturas: [1200, 1298],
    lineas: [[{ lat: -34.6, lng: -58.557 }, { lat: -34.601, lng: -58.557 }]],
  },
];

test('las cuadras elegidas se agrupan por calle', () => {
  const tramos = agruparPorCalle(cuadras);
  assert.equal(tramos.length, 2, 'dos calles, dos tramos');
  assert.deepEqual(
    tramos.map((t) => t.calle),
    ['Fischetti', 'Hornos'],
  );
  assert.deepEqual(tramos[0].fids, [1, 2, 3]);
});

test('el tramo toma el rango de alturas de todas sus cuadras', () => {
  const [fischetti] = agruparPorCalle(cuadras);
  assert.deepEqual(fischetti.alturas, [500, 798]);
});

test('la localidad del tramo sale de la cuadra que la tenga', () => {
  // La tercera cuadra de Fischetti viene sin localidad; el tramo igual la tiene.
  const [fischetti] = agruparPorCalle(cuadras);
  assert.equal(fischetti.localidad, 'Caseros Norte');
});

test('una cuadra sin nombre de calle no arma tramo', () => {
  assert.deepEqual(agruparPorCalle([{ fid: 9, calle: '', lineas: [] }]), []);
});

test('la geometría del corte junta las líneas de todas las cuadras', () => {
  assert.equal(geometriaDe(cuadras).lineas.length, 4);
});

test('los extremos de un tramo son sus dos puntas, no dos puntos cualquiera', () => {
  const lineas = agruparPorCalle(cuadras)[0].lineas;
  const [a, b] = extremosDe(lineas);
  assert.equal(metrosEntre(a, b), metrosEntre({ lat: -34.6, lng: -58.56 }, { lat: -34.6, lng: -58.557 }));
});

test('datosDeSeleccion deja el primer tramo también en los campos sueltos', () => {
  const tramos = agruparPorCalle(cuadras).map((t) =>
    t.calle === 'Fischetti' ? { ...t, esquina_desde: 'Baldini', esquina_hasta: 'Sabattini' } : t,
  );
  const datos = datosDeSeleccion(cuadras, tramos);
  assert.equal(datos.calle, 'Fischetti');
  assert.equal(datos.esquina_desde, 'Baldini');
  assert.equal(datos.esquina_hasta, 'Sabattini');
  assert.equal(datos.forma, 'tramo');
  assert.equal(datos.cuadras.length, 4);
  assert.equal(datos.geometria.lineas.length, 4);
});

/* ── Descripción con varios tramos ──────────────────────────────────── */

test('un corte de varias calles se dice tramo por tramo', () => {
  const corte = {
    ...corteDeUnDia,
    tramos: [
      { calle: 'Fischetti', esquina_desde: 'Baldini', esquina_hasta: 'Sabattini' },
      { calle: 'Hornos', esquina_desde: 'Fischetti', esquina_hasta: 'Bonifacini' },
    ],
  };
  assert.equal(
    ubicacionDe(corte),
    'Fischetti entre Baldini y Sabattini; Hornos entre Fischetti y Bonifacini',
  );
});

test('sin esquinas resueltas, el tramo se dice por altura', () => {
  assert.equal(descripcionTramo({ calle: 'Fischetti', alturas: [560, 598] }), 'Fischetti al 500');
});

test('un corte viejo, sin tramos, se sigue leyendo igual', () => {
  // Los cortes cargados antes de la selección por cuadras tienen los datos en
  // campos sueltos. `tramosDe` los arma al vuelo.
  const tramos = tramosDe(corteDeUnDia);
  assert.equal(tramos.length, 1);
  assert.equal(tramos[0].calle, 'Avenida San Martín');
  assert.equal(ubicacionDe(corteDeUnDia), 'Avenida San Martín entre Lavalle y Hornos');
});

test('cuadrasDe cuenta sólo lo que el corte tiene guardado', () => {
  assert.equal(cuadrasDe({ cuadras }), 4);
  assert.equal(cuadrasDe(corteDeUnDia), 0);
});
