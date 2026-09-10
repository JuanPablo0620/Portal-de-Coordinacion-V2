import { useState } from 'react';
import { Database, Layers, LogOut, MapPin, Plus, Trash2, Undo2 } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { CATALOGOS_ADMINISTRABLES } from '../../datos/catalogos.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones, useBD, useCatalogos } from '../../estado/tienda.js';
import { usePerfil, useSesion } from '../../estado/sesion.js';
import { nuevoId } from '../../datos/ids.js';

export default function Configuracion() {
  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Usuario que firma las cargas, catálogos institucionales y datos del sistema."
      />
      <Pagina className="flex flex-col gap-4">
        <SeccionUsuario />
        <SeccionCatalogos />
        <SeccionDatos />
      </Pagina>
    </>
  );
}

/* ── Usuario ────────────────────────────────────────────────────────── */

/** Nombre institucional del rol; el valor guardado es el técnico. */
const ROTULO_ROL = {
  admin: 'Control de Gestión',
  coordinacion: 'Control de Gestión',
  jefe_gabinete: 'Jefatura de Gabinete',
  intendencia: 'Intendencia',
  area: 'Secretaría',
};

/**
 * Identidad de quien está usando el portal.
 *
 * Antes era un campo de texto libre: cada uno escribía el nombre que quisiera
 * y el sistema lo estampaba en `creado_por` sin verificar nada. Desde que hay
 * login, el dato sale de la sesión y por eso ya no se edita acá — cambiarlo a
 * mano solo lograría que el próximo ingreso lo pisara de vuelta. El nombre se
 * corrige en la lista de usuarios de la base, y lo hace un administrador.
 */
function SeccionUsuario() {
  const perfil = usePerfil();
  const salir = useSesion((e) => e.salir);
  if (!perfil) return null;

  return (
    <Tarjeta
      titulo="Tu usuario"
      descripcion="Firma cada carga del sistema y aparece en el historial de cada registro."
    >
      <dl className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-tenue">Nombre</dt>
          <dd className="font-medium text-tinta">{perfil.nombre}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Mail</dt>
          <dd className="font-medium text-tinta">{perfil.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Rol</dt>
          <dd className="font-medium text-tinta">{ROTULO_ROL[perfil.rol] ?? perfil.rol}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton icono={LogOut} onClick={salir}>
          Cerrar sesión
        </Boton>
      </div>

      <div className="mt-3">
        <Aviso tono="info">
          El nombre sale de tu sesión, no se escribe a mano: es el que queda en{' '}
          <code className="rounded bg-card px-1">creado_por</code> de cada registro que cargues. Si
          está mal escrito, lo corrige un administrador en la lista de usuarios.
        </Aviso>
      </div>
    </Tarjeta>
  );
}

/* ── Catálogos ──────────────────────────────────────────────────────── */

function SeccionCatalogos() {
  return (
    <Tarjeta
      titulo="Catálogos"
      descripcion="Listas cerradas que alimentan todos los selectores. Nada se carga como texto libre."
      sinPadding
    >
      <div className="p-4">
        <Aviso tono="alerta" titulo="Lo que cambies acá lo ve todo el equipo">
          Los catálogos son el vocabulario compartido del sistema: de ellos salen los selectores,
          los filtros y los nombres que aparecen en los informes. Renombrar una secretaría o un eje
          se propaga a todas las pantallas a la vez. Por eso sólo los administradores pueden
          editarlos.
        </Aviso>
      </div>
      <div className="grid grid-cols-1 gap-px bg-borde lg:grid-cols-2">
        {CATALOGOS_ADMINISTRABLES.map((cfg) => (
          <PanelCatalogo key={cfg.clave} cfg={cfg} />
        ))}
      </div>
    </Tarjeta>
  );
}

function PanelCatalogo({ cfg }) {
  const catalogos = useCatalogos();
  const items = catalogos[cfg.clave] ?? [];
  const [nombre, setNombre] = useState('');
  const [prefijo, setPrefijo] = useState('');
  const [area, setArea] = useState('');
  // Las areas que ofrece el desplegable salen del catalogo de areas, que es la
  // misma lista que este panel edita mas arriba.
  const opcionesArea = useOpciones('areas');
  /*
   * Desde que los catalogos se guardan en la base, guardar puede fallar: la
   * escritura es solo de admin, y un nombre repetido choca con la restriccion
   * de unicidad. Sin esto, la promesa se rechazaba en silencio y el boton
   * parecia no hacer nada -- el mismo sintoma que ya habiamos tenido al crear
   * un evento.
   */
  const [error, setError] = useState(null);

  async function guardar(lista) {
    setError(null);
    try {
      await acciones.guardarCatalogo(cfg.clave, lista);
      return true;
    } catch (e) {
      setError(
        e?.code === '42501' || /permis/i.test(e?.message ?? '')
          ? 'No tenés permiso para editar los catálogos. Pedíselo a un administrador.'
          : e?.message ?? 'No se pudo guardar el cambio.',
      );
      return false;
    }
  }

  const activos = items.filter((i) => i.activo !== false);
  const dadosDeBaja = items.filter((i) => i.activo === false);

  async function agregar() {
    const limpio = nombre.trim();
    if (!limpio) return;
    if (activos.some((i) => i.nombre.toLowerCase() === limpio.toLowerCase())) return;
    const item = { id: nuevoId('cat'), nombre: limpio, activo: true };
    if (cfg.conPrefijo) item.prefijo = (prefijo.trim() || limpio.slice(0, 3)).toUpperCase().slice(0, 4);
    if (cfg.conArea) item.area = area;
    // El campo se limpia solo si el alta entro: si fallo, lo escrito sigue ahi
    // para poder reintentar sin volver a tipearlo.
    if (await guardar([...items, item])) {
      setNombre('');
      setPrefijo('');
      // El area NO se limpia: cargar varios programas de la misma secretaria de
      // corrido es el caso normal, y volver a elegirla cada vez es friccion.
    }
  }

  async function cambiarEstado(id, activo) {
    await guardar(items.map((i) => (i.id === id ? { ...i, activo } : i)));
  }

  async function renombrar(id, nuevoNombre) {
    await guardar(items.map((i) => (i.id === id ? { ...i, nombre: nuevoNombre } : i)));
  }

  return (
    <div className="bg-card p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-tinta">{cfg.titulo}</h3>
        <p className="text-xs text-gris">{cfg.descripcion}</p>
      </div>

      {error && (
        <div className="mb-2">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="mb-2.5 flex flex-wrap items-end gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Nuevo ítem…"
          aria-label={`Nuevo ítem de ${cfg.titulo}`}
          className="campo-base min-w-32 flex-1 py-1.5 text-xs"
        />
        {cfg.conArea && (
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label={'Secretaría del nuevo ítem de ' + cfg.titulo}
            className="campo-base min-w-40 py-1.5 text-xs"
          >
            <option value="">Elegí la secretaría…</option>
            {opcionesArea.map((o) => (
              <option key={o.id} value={o.nombre}>
                {o.nombre}
              </option>
            ))}
          </select>
        )}
        {cfg.conPrefijo && (
          <input
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder="PREF"
            aria-label={`Prefijo del nuevo ítem de ${cfg.titulo}`}
            maxLength={4}
            title="Prefijo del id de proyecto (SEC-AAAA-NNN)"
            className="campo-base w-20 py-1.5 text-xs uppercase"
          />
        )}
        <Boton
          tamanio="sm"
          icono={Plus}
          onClick={agregar}
          disabled={!nombre.trim() || (cfg.conArea && !area)}
        >
          Agregar
        </Boton>
      </div>

      {activos.length === 0 ? (
        <Vacio compacto titulo="Catálogo vacío" descripcion="Agregá el primer ítem para poder usarlo en los formularios." />
      ) : (
        <ul className="flex flex-col divide-y divide-borde/60 rounded-chip border border-borde">
          {activos.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <input
                defaultValue={item.nombre}
                onBlur={(e) => e.target.value.trim() && e.target.value !== item.nombre && renombrar(item.id, e.target.value.trim())}
                // Sin esto son ochenta y nueve campos idénticos y sin nombre en
                // esta pantalla: un lector de pantalla no puede decir cuál es cuál.
                aria-label={`Nombre de «${item.nombre}» en ${cfg.titulo}`}
                className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-tinta focus:bg-paper focus:outline-2 focus:outline-acento"
              />
              {cfg.conPrefijo && item.prefijo && <Chip tono="acento">{item.prefijo}</Chip>}
              {/* Sesenta y un programas en una lista plana de nombres no se
                  pueden distinguir: «Eventos» de Capital Humano y «Eventos» de
                  Coordinación se leen igual. La secretaría es lo que los separa. */}
              {cfg.conArea && item.area && (
                <span className="shrink-0 text-[11px] text-tenue">{item.area}</span>
              )}
              <button
                type="button"
                onClick={() => cambiarEstado(item.id, false)}
                className="shrink-0 rounded p-1 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                title="Dar de baja (el borrado es lógico: los registros existentes se conservan)"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {dadosDeBaja.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-tenue">
            {dadosDeBaja.length} dado{dadosDeBaja.length === 1 ? '' : 's'} de baja
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {dadosDeBaja.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-1 text-xs text-tenue">
                <span className="min-w-0 flex-1 truncate line-through">{item.nombre}</span>
                <button
                  type="button"
                  onClick={() => cambiarEstado(item.id, true)}
                  className="shrink-0 rounded p-1 transition hover:bg-paper hover:text-tinta"
                  title="Restituir"
                >
                  <Undo2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ── Datos del sistema ──────────────────────────────────────────────── */

function SeccionDatos() {
  const bd = useBD();
  const [confirmando, setConfirmando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [resumenReales, setResumenReales] = useState(null);

  const conteos = bd
    ? [
        ['Proyectos', bd.proyectos.length],
        ['Seguimientos', bd.seguimientos.length],
        ['Compromisos', bd.compromisos.length],
        ['Monitoreos', bd.monitoreos.length],
        ['Mesas', bd.mesas.length],
        ['Eventos', bd.eventos.length],
        ['Planificaciones', bd.planificacion_anual.length],
        ['Asientos de bitácora', bd.historial.length],
      ]
    : [];

  const hayDatos = conteos.some(([, n]) => n > 0);
  const totalRegistros = conteos.reduce((suma, [, n]) => suma + n, 0);

  async function ejecutar(accion) {
    setTrabajando(true);
    try {
      if (accion === 'demo') await acciones.cargarDemo(hoyISO());
      else if (accion === 'completa') await acciones.cargarBaseCompleta(hoyISO());
      else await acciones.vaciarSistema();
    } finally {
      setTrabajando(false);
    }
  }

  async function cargarReales() {
    setTrabajando(true);
    setResumenReales(null);
    try {
      const resumen = await acciones.cargarTodosLosProyectosReales();
      setResumenReales(resumen);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Tarjeta titulo="Datos del sistema" descripcion="Carga de un set de prueba y vaciado completo.">
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {conteos.map(([etiqueta, n]) => (
          <div key={etiqueta} className="flex items-baseline justify-between gap-2 border-b border-borde/60 pb-1">
            <span className="truncate text-xs text-gris">{etiqueta}</span>
            <span className="tabular text-sm font-semibold text-tinta">{n}</span>
          </div>
        ))}
      </div>

      {hayDatos && (
        <p className="mb-3 text-xs text-tenue">
          <span className="tabular font-semibold text-gris">{totalRegistros.toLocaleString('es-AR')}</span>{' '}
          registros cargados en total.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" icono={Database} onClick={() => setConfirmando('demo')} disabled={trabajando}>
          Cargar datos de demostración
        </Boton>
        <Boton icono={Layers} onClick={() => setConfirmando('completa')} disabled={trabajando}>
          Cargar base completa
        </Boton>
        <Boton variante="peligro" icono={Trash2} onClick={() => setConfirmando('vaciar')} disabled={trabajando || !hayDatos}>
          Vaciar sistema
        </Boton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-borde/60 pt-3">
        <Boton icono={MapPin} onClick={cargarReales} disabled={trabajando}>
          Cargar datos reales de las secretarías
        </Boton>
      </div>

      {resumenReales && (
        <p className="mt-2 text-xs text-tenue">
          Proyectos reales dados de alta:{' '}
          {Object.entries(resumenReales)
            .map(([area, n]) => `${area} (${n})`)
            .join(' · ')}
          . Los que ya estaban cargados no se repitieron.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Aviso tono="info" titulo="Sobre los datos de demostración">
          El set es sintético y evidentemente ficticio: áreas y proyectos inventados, nunca datos
          reales del municipio. Incluye a propósito compromisos vencidos, proyectos sin actualizar
          hace más de 30 días y un evento con requerimientos incompletos, para que se vean
          funcionando las alertas.
        </Aviso>
        <Aviso tono="info" titulo="Sobre la base completa">
          Es el mismo set ficticio pero a escala real: catorce áreas, tres años de proyectos,
          veinticuatro meses de seguimiento y monitoreo, y más de ocho mil registros contando la
          bitácora. Sirve para probar las tablas, los filtros, los tableros y la impresión con el
          volumen que van a tener en uso, en lugar de con treinta registros. Tarda un instante en
          generarse y reemplaza todo lo cargado.
        </Aviso>
        <Aviso tono="info" titulo="Sobre los datos reales de las secretarías">
          Relevados a mano el 19/08/2026 de la pestaña "Estado de proyectos" de cada `_db`
          (Ambiente, Capital Humano, Obras, Salud, Seguridad, Trabajo y Producción, más
          Posicionamiento de Coordinación). No sintéticos. Es aditivo: no borra nada de lo que ya
          esté cargado y no duplica un proyecto si ya está dado de alta.
        </Aviso>
      </div>

      <ModalConfirmacion
        abierto={confirmando === 'demo'}
        alCerrar={() => setConfirmando(null)}
        alConfirmar={() => ejecutar('demo')}
        titulo="Cargar datos de demostración"
        mensaje="Se reemplaza todo el contenido actual del sistema por un set de prueba. Lo que hayas cargado se pierde. ¿Confirmás?"
        textoConfirmar="Cargar demostración"
      />
      <ModalConfirmacion
        abierto={confirmando === 'completa'}
        alCerrar={() => setConfirmando(null)}
        alConfirmar={() => ejecutar('completa')}
        titulo="Cargar la base completa"
        mensaje="Se reemplaza todo el contenido actual por un set sintético de escala real: más de ocho mil registros, incluidos los catálogos, que pasan a ser los del set completo. Lo que hayas cargado se pierde. ¿Confirmás?"
        textoConfirmar="Cargar base completa"
      />
      <ModalConfirmacion
        abierto={confirmando === 'vaciar'}
        alCerrar={() => setConfirmando(null)}
        alConfirmar={() => ejecutar('vaciar')}
        titulo="Vaciar el sistema"
        mensaje="Se borra todo el contenido cargado: proyectos, seguimientos, compromisos, monitoreos, mesas, eventos y bitácora. Los catálogos vuelven a la lista de muestra. ¿Confirmás?"
        textoConfirmar="Vaciar todo"
        variante="peligro"
      />
    </Tarjeta>
  );
}
