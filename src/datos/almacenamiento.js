/**
 * ─────────────────────────────────────────────────────────────────────
 * ÚNICO archivo del repositorio autorizado a tocar el almacenamiento del
 * navegador. `npm run verificar` falla si aparece `localStorage` en
 * cualquier otro archivo de `src/`.
 *
 * Al migrar a persistencia real este archivo desaparece: sólo cambian los
 * cuerpos de las funciones de `repositorio.js` por llamadas HTTP. Ningún
 * componente se entera.
 * ─────────────────────────────────────────────────────────────────────
 */

export const CLAVE = 'coord3f_bd_v1';

/**
 * Hay entornos sin almacenamiento: Node (tests y prueba de humo) y los modos
 * privados de algunos navegadores. Ahí el sistema funciona igual —la copia en
 * memoria del repositorio alcanza para la sesión—, sólo que no persiste. Se
 * comprueba una vez y en silencio: avisar en cada escritura llenaría la consola
 * de ruido sin decir nada nuevo.
 */
export const disponible = (() => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const sonda = '__coord3f_sonda__';
    localStorage.setItem(sonda, '1');
    localStorage.removeItem(sonda);
    return true;
  } catch {
    return false;
  }
})();

/** Lee la base persistida. Devuelve null si no hay nada o si está corrupta. */
export function leerBD() {
  if (!disponible) return null;
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch (error) {
    // Sí se avisa: hay almacenamiento pero el contenido no se puede leer.
    console.error('No se pudo leer la base persistida', error);
    return null;
  }
}

/** Persiste la base completa. */
export function escribirBD(bd) {
  if (!disponible) return false;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(bd));
    return true;
  } catch (error) {
    // El caso realista es exceder la cuota (~5 MB). No se pierde la sesión en
    // curso —la copia en memoria sigue viva—, pero el usuario tiene que saberlo.
    console.error('No se pudo persistir la base', error);
    return false;
  }
}

/** Borra la base persistida. */
export function limpiar() {
  if (!disponible) return;
  try {
    localStorage.removeItem(CLAVE);
  } catch (error) {
    console.error('No se pudo limpiar la base persistida', error);
  }
}
