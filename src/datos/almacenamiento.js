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

const CLAVE = 'coord3f_bd_v1';
const CLAVE_TEMA = 'coord3f_tema_v1';

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

const CLAVE_BORRADORES = 'coord3f_borradores_monitoreo_v1';

/**
 * Borradores de un monitoreo en curso, por id de monitoreo.
 *
 * Viven en una clave APARTE de la base: son trabajo a medio hacer de una
 * reunión, no datos del sistema. Si estuvieran dentro de `coord3f_bd_v1`, un
 * `limpiar()` de la base o una migración de esquema se los llevaría puestos, y
 * un borrador que sobrevive a un cierre de pestaña es justamente el motivo de
 * que existan. Se guardan por navegador: retomar el monitoreo desde otra
 * computadora no los trae.
 */
export function leerBorradoresMonitoreo(idMonitoreo) {
  if (!disponible) return null;
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADORES);
    return (crudo ? JSON.parse(crudo) : {})[idMonitoreo] ?? null;
  } catch (error) {
    console.error('No se pudieron leer los borradores del monitoreo', error);
    return null;
  }
}

/** Guarda los borradores de un monitoreo; con `null` (o vacío) borra su entrada. */
export function escribirBorradoresMonitoreo(idMonitoreo, borradores) {
  if (!disponible) return false;
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADORES);
    const todos = crudo ? JSON.parse(crudo) : {};
    if (borradores && Object.keys(borradores).length) todos[idMonitoreo] = borradores;
    else delete todos[idMonitoreo];
    localStorage.setItem(CLAVE_BORRADORES, JSON.stringify(todos));
    return true;
  } catch (error) {
    console.error('No se pudieron persistir los borradores del monitoreo', error);
    return false;
  }
}

/**
 * La apariencia es una preferencia local y no un dato de gestión: cada
 * persona puede elegir BlueNight sin cambiarle la vista a sus compañeros. Se
 * guarda en una clave separada para que una limpieza o migración de la base no
 * borre una elección de interfaz.
 */
export function leerTema() {
  if (!disponible) return 'claro';
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'bluenight' ? 'bluenight' : 'claro';
  } catch (error) {
    console.error('No se pudo leer la preferencia visual', error);
    return 'claro';
  }
}

/** Persiste la preferencia visual sin afectar la base de datos del portal. */
export function escribirTema(tema) {
  if (!disponible) return false;
  try {
    localStorage.setItem(CLAVE_TEMA, tema === 'bluenight' ? 'bluenight' : 'claro');
    return true;
  } catch (error) {
    console.error('No se pudo guardar la preferencia visual', error);
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
