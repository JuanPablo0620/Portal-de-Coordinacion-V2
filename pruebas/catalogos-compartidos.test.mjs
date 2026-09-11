/**
 * Los catálogos dejaron de vivir en el navegador, y eso cambió qué es el `id`
 * de un ítem: en la maqueta era `ar_coord`, en la base es un uuid.
 *
 * Tres pantallas excluyen un ítem puntual de su desplegable —Coordinación no
 * impulsa acciones de posicionamiento, «Compromisos» no es un eje de proyecto—
 * y lo hacían comparando ese id. Con los catálogos remotos, esa comparación no
 * falla: simplemente deja de excluir nada, y la opción reaparece sin que nadie
 * se entere. Por eso pasó a compararse el `slug`, que sí es estable, y por eso
 * estas pruebas: son las que avisan si la semilla y la base se desalinean.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGOS_SEMILLA, CATALOGOS_ADMINISTRABLES } from '../src/datos/catalogos.js';
import { CLAVES } from '../src/datos/supabaseCatalogos.js';

const porNombre = (clave, nombre) =>
  CATALOGOS_SEMILLA[clave].find((i) => i.nombre === nombre);

test('la semilla trae los slugs de los que dependen los desplegables', () => {
  assert.equal(porNombre('areas', 'Coordinación').slug, 'coordinacion');
  assert.equal(porNombre('ejes', 'Compromisos').slug, 'compromisos');
});

test('todo catálogo administrable sabe guardarse en la base', () => {
  const sinRuta = CATALOGOS_ADMINISTRABLES
    .map((c) => c.clave)
    .filter((clave) => !CLAVES.includes(clave));
  assert.deepEqual(
    sinRuta,
    [],
    `Configuración deja editar ${sinRuta.join(', ')} pero no hay dónde guardarlo: ` +
      'el cambio se quedaría en el navegador de quien lo hizo.',
  );
});

test('no se ofrece guardar un catálogo que Configuración no edita', () => {
  const administrables = new Set(CATALOGOS_ADMINISTRABLES.map((c) => c.clave));
  const sobrantes = CLAVES.filter((clave) => !administrables.has(clave));
  assert.deepEqual(sobrantes, []);
});
