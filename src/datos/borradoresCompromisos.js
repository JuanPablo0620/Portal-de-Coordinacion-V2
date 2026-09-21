/**
 * Cuándo un borrador de compromiso cuenta como actualización.
 *
 * Un borrador guarda SOLO lo que se tocó en el formulario (`estado`,
 * `fecha_limite`, `nuevaActualizacion`, unidad). Abrir un compromiso y cerrarlo
 * sin cambiar nada, o dejar el texto en blanco, no es una actualización: al
 * finalizar el monitoreo no se escribe nada para ese compromiso.
 *
 * Se compara contra el compromiso actual y no contra "hay algún campo" porque
 * el formulario puede devolver el mismo valor que ya tenía (p. ej. el usuario
 * cambia el estado y lo vuelve a poner), y eso tampoco es una novedad.
 */
const igual = (a, b) => (a || null) === (b || null);

export function esBorradorVacio(borrador, compromiso) {
  if (!borrador || !compromiso) return true;
  if (borrador.nuevaActualizacion?.trim()) return false;
  if (borrador.estado !== undefined && borrador.estado !== compromiso.estado) return false;
  if (borrador.fecha_limite !== undefined && !igual(borrador.fecha_limite, compromiso.fecha_limite)) return false;
  if (borrador.id_subsecretaria !== undefined && !igual(borrador.id_subsecretaria, compromiso.id_subsecretaria)) return false;
  if (borrador.id_direccion !== undefined && !igual(borrador.id_direccion, compromiso.id_direccion)) return false;
  return true;
}

/** Los borradores que efectivamente van a generar una actualización: [[id, borrador], ...]. */
export function borradoresAplicables(borradores, compromisos) {
  const porId = new Map(compromisos.map((c) => [c.id, c]));
  return Object.entries(borradores).filter(([id, b]) => !esBorradorVacio(b, porId.get(id)));
}
