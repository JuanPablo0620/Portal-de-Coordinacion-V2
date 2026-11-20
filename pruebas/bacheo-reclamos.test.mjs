/**
 * Bacheo: reclamos del My Maps y su cruce con la programación.
 *
 * El KML es sintético (el repo es público), pero tiene la forma exacta del que
 * exporta el My Maps del área: CDATA en la descripción, columnas con tilde y
 * «Reclamos en el mismo punto» como número decimal («3.0»).
 *
 * El cruce se validó el 20/11/2026 contra el mapa de afuera del portal
 * (semana del 16/11, 157 puntos, 22 trabajos ubicados): mismo estado en los
 * 157. Estas pruebas fijan los bordes de la regla de metros.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cruzarReclamos,
  distanciaATrabajo,
  leerKmlReclamos,
  reclamosPorTrabajo,
  resumenReclamos,
} from '../src/datos/bacheo/reclamos.js';

const lugar = (nombre, lng, lat, datos) => `
      <Placemark>
        <name>${nombre}</name>
        <description><![CDATA[Categoría: Bacheo<br>Reclamo: algo]]></description>
        <styleUrl>#icon-1899-F57C00</styleUrl>
        <ExtendedData>
          ${Object.entries(datos)
            .map(([k, v]) => `<Data name="${k}"><value>${v}</value></Data>`)
            .join('\n          ')}
        </ExtendedData>
        <Point><coordinates>${lng},${lat},0</coordinates></Point>
      </Placemark>`;

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Prueba</name><Folder><name>Caseros y Ciudadela </name>
${lugar('Calle Uno y Calle Dos', -58.56, -34.6, {
  Categoría: 'Bacheo / calle en mal estado',
  Reclamo: 'Bache &amp; pozo',
  'N° de reporte': 'VP-1/1',
  Ubicación: 'Calle Uno y Calle Dos',
  Localidad: 'Caseros',
  Precisión: 'Esquina',
  'Reclamos en el mismo punto': '3.0',
})}
${lugar('Sin tabla', -58.55, -34.61, {})}
      <Placemark><name>Una línea</name><LineString><coordinates>-58.5,-34.6,0 -58.51,-34.6,0</coordinates></LineString></Placemark>
</Folder></Document></kml>`;

test('lee los puntos del My Maps con sus columnas y descarta lo que no es punto', () => {
  const r = leerKmlReclamos(KML);
  assert.equal(r.length, 2);
  assert.deepEqual(
    { ...r[0] },
    {
      id: 'reclamo-1',
      ubicacion: 'Calle Uno y Calle Dos',
      localidad: 'Caseros',
      reclamo: 'Bache & pozo',
      reporte: 'VP-1/1',
      precision: 'Esquina',
      nota: '',
      cantidad: 3,
      lat: -34.6,
      lng: -58.56,
    },
  );
  // Sin columnas: el nombre del punto hace de ubicación y cuenta como un reclamo.
  assert.equal(r[1].ubicacion, 'Sin tabla');
  assert.equal(r[1].cantidad, 1);
});

// A esta latitud, 0,0001° de longitud son unos 9,2 m y 0,0001° de latitud, 11 m.
const base = { lat: -34.6, lng: -58.56 };
const corrido = (metrosEste) => ({ ...base, lng: base.lng + metrosEste / (111320 * Math.cos((34.6 * Math.PI) / 180)) });
const esquina = { type: 'Point', coordinates: [base.lng, base.lat] };
const tramo = { type: 'LineString', coordinates: [[base.lng, base.lat - 0.001], [base.lng, base.lat + 0.001]] };
const cuadrante = {
  type: 'Polygon',
  coordinates: [[[-58.561, -34.601], [-58.559, -34.601], [-58.559, -34.599], [-58.561, -34.599], [-58.561, -34.601]]],
};

test('distancia en metros a esquina, tramo y cuadrante', () => {
  assert.equal(Math.round(distanciaATrabajo(corrido(20), esquina).metros), 20);
  assert.equal(Math.round(distanciaATrabajo(corrido(20), tramo).metros), 20);
  assert.equal(distanciaATrabajo(corrido(20), cuadrante).metros, 0);
  assert.equal(distanciaATrabajo(base, null), null);
});

test('los bordes de la regla: 25 m de esquina, 15 m de tramo, adentro del cuadrante, y 50 m más para «cerca»', () => {
  const estado = (punto, geometria) => cruzarReclamos([{ ...punto, cantidad: 1 }], [{ id: 't', geometria }])[0].estado;
  assert.equal(estado(corrido(24), esquina), 'con_trabajo');
  assert.equal(estado(corrido(26), esquina), 'cerca');
  assert.equal(estado(corrido(74), esquina), 'cerca');
  assert.equal(estado(corrido(76), esquina), 'sin_trabajo');
  assert.equal(estado(corrido(14), tramo), 'con_trabajo');
  assert.equal(estado(corrido(16), tramo), 'cerca');
  assert.equal(estado(corrido(66), tramo), 'sin_trabajo');
  // El cuadrante llega a 0,001° (unos 92 m) al este del centro.
  assert.equal(estado(corrido(80), cuadrante), 'con_trabajo');
  assert.equal(estado(corrido(130), cuadrante), 'cerca');
  assert.equal(estado(corrido(150), cuadrante), 'sin_trabajo');
});

test('un reclamo toma el estado más firme y se cuenta en cada trabajo que lo alcanza', () => {
  const trabajos = [
    { id: 'lejos', geometria: { type: 'Point', coordinates: [corrido(40).lng, base.lat] } },
    { id: 'area', geometria: cuadrante },
    { id: 'sin-ubicar', geometria: null },
  ];
  const [r] = cruzarReclamos([{ ...base, cantidad: 3 }], trabajos);
  assert.equal(r.estado, 'con_trabajo');
  assert.deepEqual(
    r.trabajos.map((t) => [t.id, t.estado]),
    [['area', 'con_trabajo'], ['lejos', 'cerca']],
  );
  assert.deepEqual(resumenReclamos([r]), { total: 3, con_trabajo: 3, cerca: 0, sin_trabajo: 0 });
  const porTrabajo = reclamosPorTrabajo([r]);
  assert.deepEqual(porTrabajo.get('area'), { con_trabajo: 3, cerca: 0 });
  assert.deepEqual(porTrabajo.get('lejos'), { con_trabajo: 0, cerca: 3 });
});
