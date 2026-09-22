/**
 * ─────────────────────────────────────────────────────────────────────
 * EQUIPO — quién se hace cargo de cada compromiso.
 *
 * La identidad es la cuenta, no el nombre. Antes «quién carga esto» era el
 * texto libre de `config.usuario`, y con eso alcanzaba mientras no hubiera
 * login; desde que el portal autentica contra Supabase, atar la
 * responsabilidad a un nombre escrito a mano significa que renombrar a
 * alguien le vacía la bandeja. Acá se usa siempre `perfil.id`, y el nombre
 * queda para mostrar.
 *
 * Tener cuenta no implica recibir compromisos: el padrón se habilita de a
 * una persona con `recibe_compromisos`, desde Configuración → Equipo. Las
 * identidades reales no viven en este repositorio, que es público.
 * ─────────────────────────────────────────────────────────────────────
 */

export function responsablesEquipo(bd) {
  return (bd?.equipo ?? [])
    .filter((p) => p.activo && p.recibe_compromisos)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function nombreResponsable(bd, id) {
  if (!id) return 'Sin asignar';
  return bd?.equipo?.find((p) => p.id === id)?.nombre ?? 'Responsable no disponible';
}

/** Mismo alcance que `es_admin()` en la base: admin y coordinación. */
export function puedeEditarEquipo(perfil) {
  return ['admin', 'coordinacion'].includes(perfil?.rol);
}

/**
 * Una cuenta de sólo lectura puede mover el compromiso que tiene asignado, y
 * ninguno más. Es el espejo de las policies `responsable lee/actualiza su
 * compromiso`: si esto y la base se separan, gana la base y la pantalla
 * muestra un error en vez de un permiso que no existe.
 */
export function puedeGestionarCompromiso(perfil, compromiso) {
  return puedeEditarEquipo(perfil)
    || Boolean(perfil?.id && compromiso?.id_responsable === perfil.id);
}

/**
 * Unión por identidad, nunca por nombre ni por intersección con las áreas:
 * un compromiso a mi nombre entra aunque sea de un área que no sigo, que es
 * justamente el caso que esta pantalla vino a resolver.
 */
export function filtrarMiTrabajo(filas, perfilId, areas, vista = 'todos') {
  return filas.filter((c) => {
    const personal = Boolean(perfilId) && c.id_responsable === perfilId;
    const deArea = areas.includes(c.area);
    if (vista === 'asignados') return personal;
    if (vista === 'areas') return deArea;
    return personal || deArea;
  });
}

/**
 * Espeja el trigger `validar_responsable_compromiso` de 0037.
 *
 * `requerido` no es un capricho del que llama: sale de si hay padrón. En
 * producción hay 137 compromisos sin responsable —84 de la carga histórica y
 * 53 que cargó el equipo desde el portal— y a ninguno se le puede inventar un
 * dueño, así que la columna es nullable y el portal tiene que seguir
 * funcionando con el padrón vacío. Habilitar a la primera persona en
 * Configuración → Equipo es lo que activa la obligatoriedad.
 */
export function validarResponsable(bd, id, { requerido = false } = {}) {
  if (!id) {
    if (requerido) throw new Error('Elegí quién se hará cargo del compromiso.');
    return;
  }
  if (!responsablesEquipo(bd).some((p) => p.id === id)) {
    throw new Error('La persona elegida no está habilitada para recibir compromisos.');
  }
}

export function responsableEsObligatorio(bd) {
  return responsablesEquipo(bd).length > 0;
}

/**
 * Dirección no arma un temario: revisa todo lo vigente. Los compromisos que
 * todavía no tienen fila propia se devuelven como temas en borrador (sin
 * `id`), y se materializan al cerrar el encuentro.
 */
export function temasDeReunionDireccion(bd, reunion) {
  const temas = (bd.temas_reunion_direccion ?? []).filter((t) => t.reunion_id === reunion.id);
  if (reunion.cerrada) return temas.slice().sort((a, b) => a.orden - b.orden);

  const porCompromiso = new Map(temas.filter((t) => t.compromiso_id).map((t) => [t.compromiso_id, t]));
  const compromisos = (bd.compromisos ?? []).filter((c) => c.activo !== false);
  const ids = new Set(compromisos.map((c) => c.id));
  return [
    ...compromisos.map((c) => porCompromiso.get(c.id) ?? {
      reunion_id: reunion.id,
      compromiso_id: c.id,
      titulo: c.descripcion,
      revisado: false,
      acuerdo: '',
      nota: '',
      orden: 0,
    }),
    ...temas.filter((t) => !t.compromiso_id || !ids.has(t.compromiso_id)),
  ];
}
