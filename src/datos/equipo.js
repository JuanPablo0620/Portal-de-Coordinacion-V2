/** La identidad es la cuenta: el nombre sólo sirve para mostrarla. */
export function responsablesEquipo(bd) {
  return (bd?.equipo ?? []).filter((p) => p.activo && p.recibe_compromisos)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function nombreResponsable(bd, id) {
  if (!id) return 'Sin asignar';
  return bd?.equipo?.find((p) => p.id === id)?.nombre ?? 'Responsable no disponible';
}

export function puedeEditarEquipo(perfil) {
  return ['admin', 'coordinacion'].includes(perfil?.rol);
}

export function puedeGestionarCompromiso(perfil, compromiso) {
  return puedeEditarEquipo(perfil) || Boolean(perfil?.id && compromiso?.id_responsable === perfil.id);
}

export function puedePrepararReunion(bd, perfil, tipo) {
  if (!puedeEditarEquipo(perfil)) return false;
  return tipo === 'direccion' || Boolean(bd?.equipo?.find((p) => p.id === perfil?.id)?.organiza_secretaria);
}

/** Unión por identidad, nunca por nombre ni por intersección con las áreas. */
export function filtrarMiSeguimiento(filas, perfilId, areas, vista = 'todos') {
  return filas.filter((c) => {
    const personal = Boolean(perfilId) && c.id_responsable === perfilId;
    const deArea = areas.includes(c.area);
    return vista === 'asignados' ? personal : vista === 'areas' ? deArea : personal || deArea;
  });
}

export function validarResponsable(bd, id, { requerido = false } = {}) {
  if (!id) {
    if (requerido) throw new Error('Elegí quién se hará cargo del compromiso.');
    return;
  }
  if (!responsablesEquipo(bd).some((p) => p.id === id)) {
    throw new Error('La persona elegida no está habilitada para recibir compromisos.');
  }
}

/** Dirección no toma una selección de Secretaría: incluye todo lo vigente. */
export function temasDeReunionEquipo(bd, reunion) {
  const temas = (bd.temas_reunion_equipo ?? []).filter((t) => t.reunion_id === reunion.id);
  const porCompromiso = new Map(temas.filter((t) => t.compromiso_id).map((t) => [t.compromiso_id, t]));
  if (reunion.tipo !== 'direccion' || reunion.cerrada) return temas.slice().sort((a, b) => a.orden - b.orden);
  const compromisos = (bd.compromisos ?? []).filter((c) => c.activo !== false);
  const ids = new Set(compromisos.map((c) => c.id));
  return [
    ...compromisos.map((c) => porCompromiso.get(c.id) ?? {
      reunion_id: reunion.id, compromiso_id: c.id, titulo: c.descripcion,
      revisado: false, acuerdo: '', orden: 0,
    }),
    ...temas.filter((t) => !t.compromiso_id || !ids.has(t.compromiso_id)),
  ];
}
