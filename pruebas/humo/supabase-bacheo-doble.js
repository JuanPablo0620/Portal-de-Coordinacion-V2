/**
 * Doble de `src/datos/supabaseBacheo.js` para `scripts/verificar-bacheo.mjs`.
 *
 * Guarda todo en `window.__bacheo` y reproduce lo que hace la función
 * `publicar_semana_bacheo` de `0038_bacheo.sql`: una semana por lunes,
 * reemplazo de trabajos al republicar y memoria de lugares por clave. Así la
 * prueba recorre la pantalla entera sin tocar la base real.
 */
const base = () => {
  window.__bacheo ??= { semanas: [], trabajos: [], lugares: [] };
  return window.__bacheo;
};

export const bacheoDisponible = () => true;

export async function listarSemanas() {
  return [...base().semanas].sort((a, b) => b.lunes.localeCompare(a.lunes));
}

export async function trabajosDeSemana(semanaId) {
  return base()
    .trabajos.filter((t) => t.semana_id === semanaId)
    .sort((a, b) => a.orden - b.orden);
}

export async function cargarLugares() {
  return new Map(base().lugares.map((l) => [l.clave, l]));
}

export async function publicarSemana({ semana, trabajos, lugares }) {
  const bd = base();
  if (window.fallarPublicacionBacheo) throw new Error('Error de prueba al publicar');
  let fila = bd.semanas.find((s) => s.lunes === semana.lunes);
  if (!fila) {
    fila = { id: `semana-${semana.lunes}` };
    bd.semanas.push(fila);
  }
  Object.assign(fila, semana, { publicada_en: new Date().toISOString() });
  bd.trabajos = bd.trabajos.filter((t) => t.semana_id !== fila.id);
  trabajos.forEach((t, i) => bd.trabajos.push({ ...t, id: `${fila.id}-${i}`, semana_id: fila.id }));
  for (const l of lugares) {
    bd.lugares = bd.lugares.filter((x) => x.clave !== l.clave);
    bd.lugares.push(l);
  }
  return fila.id;
}
