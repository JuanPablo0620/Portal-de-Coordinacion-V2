/**
 * Reclamos de bacheo desde el My Maps del área (ver `datos/bacheo/reclamos.js`).
 *
 * Va aparte de `supabaseBacheo.js` porque no es la base: si el My Maps no
 * responde, la programación se sigue viendo igual y solo falta la capa. Y
 * aparte también para que las pruebas en Chrome lo reemplacen por un doble
 * sin tocar Google.
 *
 * Sin `VITE_MYMAPS_RECLAMOS_BACHEO` la capa no aparece. No es un error: es un
 * entorno (local, pruebas) que no la tiene configurada.
 */
import { leerKmlReclamos } from './bacheo/reclamos.js';

const env = import.meta.env ?? {};
const idMapa = env.VITE_MYMAPS_RECLAMOS_BACHEO ?? '';

export const reclamosDisponibles = () => Boolean(idMapa);

/** Enlace para abrir el My Maps original (lo muestra el pie del mapa). */
export const enlaceMyMaps = () => (idMapa ? `https://www.google.com/maps/d/viewer?mid=${encodeURIComponent(idMapa)}` : '');

let pedido = null;

/**
 * Los reclamos del My Maps. Se piden una vez por carga de la página: el área
 * los edita a mano, de a poco, y no tiene sentido volver a bajarlos con cada
 * cambio de período.
 */
export function leerReclamos() {
  if (!idMapa) return Promise.resolve([]);
  pedido ??= fetch(`https://www.google.com/maps/d/kml?mid=${encodeURIComponent(idMapa)}&forcekml=1`)
    .then((r) => {
      if (!r.ok) throw new Error(`Google respondió ${r.status} al pedir el My Maps de reclamos.`);
      return r.text();
    })
    .then(leerKmlReclamos)
    .catch((e) => {
      pedido = null;
      throw e;
    });
  return pedido;
}
