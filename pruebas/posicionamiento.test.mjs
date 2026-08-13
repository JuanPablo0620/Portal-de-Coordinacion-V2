/**
 * Posicionamiento internacional: el embudo, el reloj de las convocatorias y la
 * tasa de éxito.
 *
 * La regla que más importa acá es la del reloj: sólo lo que todavía no se
 * presentó tiene plazo. Una acción ya presentada con fecha vieja no es un
 * problema, y si el sistema la marcara en rojo el panel de alertas se llenaría
 * de ruido que nadie puede accionar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { TIPOS_ALERTA, calcularAlertas, vencimientosProximos } from '../src/datos/alertas.js';
import {
  accionesInternacionales,
  accionesPorDimension,
  nivelAccionInternacional,
  resumenPosicionamiento,
  sumarDias,
} from '../src/datos/selectores.js';
import { CATALOGOS_SEMILLA } from '../src/datos/catalogos.js';
import { ACCIONES_INTERNACIONALES } from '../src/datos/sintetico.js';
import { armarCatalogos } from '../src/datos/base-completa-vocabulario.js';

const HOY = '2026-08-08';

async function limpio() {
  await repo.vaciarSistema();
  return repo.obtenerBD();
}

const base = (extra = {}) => ({
  nombre: 'Postulación de prueba',
  tipo: 'Postulación a fondo',
  organismo: 'PNUD',
  pais: 'Brasil',
  alcance: 'bilateral',
  estado: 'en preparación',
  area: 'Secretaría de Obras Públicas',
  fecha_inicio: sumarDias(HOY, -30),
  fecha_limite: sumarDias(HOY, 10),
  financiamiento_usd: 100_000,
  ods: [11],
  ...extra,
});

/* ── Alta y derivados ─────────────────────────────────────────────── */

test('una acción nace identificada y sin ODS ni proyectos si no se declaran', async () => {
  await limpio();
  const a = await repo.crearAccionInternacional({ nombre: 'Hermanamiento con Vila Serrana', tipo: 'Hermanamiento' });
  assert.equal(a.estado, 'identificada');
  assert.deepEqual(a.ods, []);
  assert.deepEqual(a.ids_proyecto, []);
});

test('sólo lo que todavía no se presentó tiene reloj', () => {
  const conPlazo = { estado: 'en preparación', fecha_limite: '2026-08-10', dias_al_cierre: 2 };
  assert.equal(nivelAccionInternacional(conPlazo), 'proximo');
  assert.equal(nivelAccionInternacional({ ...conPlazo, dias_al_cierre: -3 }), 'vencido');
  // Presentada, vigente y no prosperó leen el estado y no la fecha.
  assert.equal(nivelAccionInternacional({ ...conPlazo, estado: 'presentada' }), 'atencion');
  assert.equal(nivelAccionInternacional({ ...conPlazo, estado: 'vigente' }), 'enregla');
  assert.equal(nivelAccionInternacional({ ...conPlazo, estado: 'no prosperó' }), 'sindato');
});

test('la lista ordena por urgencia y filtra por lo que está en juego', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ nombre: 'Cierra pasado mañana', fecha_limite: sumarDias(HOY, 2) }));
  await repo.crearAccionInternacional(base({ nombre: 'Cierra en tres meses', fecha_limite: sumarDias(HOY, 90) }));
  await repo.crearAccionInternacional(base({ nombre: 'Ya cerrada', estado: 'cerrada' }));

  const bd = await repo.obtenerBD();
  const lista = accionesInternacionales(bd, {}, HOY);
  assert.equal(lista[0].nombre, 'Cierra pasado mañana', 'lo más urgente primero');

  const abiertas = accionesInternacionales(bd, { solo_abiertas: true }, HOY);
  assert.equal(abiertas.length, 2);
  assert.ok(!abiertas.some((a) => a.estado === 'cerrada'));
});

/* ── Alertas y vencimientos ───────────────────────────────────────── */

test('una convocatoria por cerrar alerta con 30 días de anticipación', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ nombre: 'Cierra en 20 días', fecha_limite: sumarDias(HOY, 20) }));
  await repo.crearAccionInternacional(base({ nombre: 'Cierra en 200 días', fecha_limite: sumarDias(HOY, 200) }));

  const bd = await repo.obtenerBD();
  const alertas = calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.CIERRE_INTERNACIONAL);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].titulo, 'Cierra en 20 días');
  assert.equal(alertas[0].severidad, 'alta');
});

test('una convocatoria que ya cerró sin presentarse es crítica', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ nombre: 'Se pasó de fecha', fecha_limite: sumarDias(HOY, -5) }));

  const bd = await repo.obtenerBD();
  const [alerta] = calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.CIERRE_INTERNACIONAL);
  assert.equal(alerta.severidad, 'critica');
  assert.equal(alerta.dias_atraso, 5);
});

test('una acción ya presentada no alerta aunque la fecha haya pasado', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ estado: 'presentada', fecha_limite: sumarDias(HOY, -40) }));

  const bd = await repo.obtenerBD();
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.CIERRE_INTERNACIONAL).length, 0);
});

test('el cierre entra en los vencimientos del inicio, no sólo en su módulo', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ nombre: 'Cierra en 5 días', fecha_limite: sumarDias(HOY, 5) }));

  const bd = await repo.obtenerBD();
  const items = vencimientosProximos(bd, HOY);
  const cierre = items.find((i) => i.clase === 'cierre internacional');
  assert.ok(cierre, 'el inicio tiene que mostrarlo junto al resto de los vencimientos');
  assert.equal(cierre.dias, 5);
});

/* ── Resumen ──────────────────────────────────────────────────────── */

test('la tasa de éxito se calcula sólo sobre lo resuelto', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ estado: 'vigente', financiamiento_usd: 200_000 }));
  await repo.crearAccionInternacional(base({ estado: 'cerrada', financiamiento_usd: 50_000 }));
  await repo.crearAccionInternacional(base({ estado: 'no prosperó', financiamiento_usd: 90_000 }));
  // En trámite: no puede bajar la tasa, todavía no se sabe cómo termina.
  await repo.crearAccionInternacional(base({ estado: 'presentada', financiamiento_usd: 300_000 }));
  await repo.crearAccionInternacional(base({ estado: 'identificada', financiamiento_usd: 10_000 }));

  const bd = await repo.obtenerBD();
  const r = resumenPosicionamiento(bd, {}, HOY);
  assert.equal(r.total, 5);
  assert.equal(r.abiertas, 3);
  assert.equal(r.tasa_exito, 67, '2 de 3 resueltas prosperaron');
  assert.equal(r.financiamiento_obtenido, 250_000, 'vigente y cerrada ya son plata conseguida');
  assert.equal(
    r.financiamiento_en_gestion,
    310_000,
    'lo vigente no se cuenta dos veces: en gestión es lo que todavía no se sabe',
  );
});

test('sin nada resuelto la tasa de éxito es desconocida, no cero', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ estado: 'presentada' }));
  const bd = await repo.obtenerBD();
  assert.equal(resumenPosicionamiento(bd, {}, HOY).tasa_exito, null);
});

test('los ODS son multivaluados y se cuentan una vez por objetivo', async () => {
  await limpio();
  await repo.crearAccionInternacional(base({ ods: [11, 13] }));
  await repo.crearAccionInternacional(base({ ods: [11] }));
  await repo.crearAccionInternacional(base({ ods: [] }));

  const bd = await repo.obtenerBD();
  const porODS = accionesPorDimension(bd, 'ods', {}, HOY);
  assert.equal(porODS.find((d) => d.nombre === 'ODS 11').cantidad, 2);
  assert.equal(porODS.find((d) => d.nombre === 'ODS 13').cantidad, 1);
  assert.equal(porODS.find((d) => d.nombre === 'Sin definir').cantidad, 1);

  assert.equal(accionesInternacionales(bd, { ods: 13 }, HOY).length, 1);
  assert.equal(resumenPosicionamiento(bd, {}, HOY).ods_cubiertos, 2);
});

/* ── Coherencia con los catálogos ─────────────────────────────────── */

test('los tipos del vocabulario existen en los dos catálogos', () => {
  const tiposPlantilla = Object.keys(ACCIONES_INTERNACIONALES);
  for (const catalogo of [CATALOGOS_SEMILLA, armarCatalogos()]) {
    const nombres = catalogo.tipos_accion_internacional.map((t) => t.nombre);
    for (const tipo of tiposPlantilla) {
      assert.ok(nombres.includes(tipo), `el catálogo no tiene el tipo «${tipo}»`);
    }
  }
});

test('la base a escala real trae todos los catálogos nuevos', () => {
  const catalogos = armarCatalogos();
  for (const clave of [
    'tipos_accion_internacional',
    'organismos_internacionales',
    'paises_contraparte',
    'motivos_estrategicos',
  ]) {
    assert.ok(catalogos[clave]?.length, `falta el catálogo ${clave} en la base completa`);
  }
});
