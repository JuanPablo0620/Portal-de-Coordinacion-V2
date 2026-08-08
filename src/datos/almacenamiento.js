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

/** Lee la base persistida. Devuelve null si no hay nada o si está corrupta. */
export function leerBD() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch (error) {
    console.error('No se pudo leer la base persistida', error);
    return null;
  }
}

/** Persiste la base completa. */
export function escribirBD(bd) {
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
  try {
    localStorage.removeItem(CLAVE);
  } catch (error) {
    console.error('No se pudo limpiar la base persistida', error);
  }
}
