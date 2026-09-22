/**
 * ─────────────────────────────────────────────────────────────────────
 * MI TRABAJO — lo que tengo que empujar yo.
 *
 * Antes se llamaba «Mis áreas» y sólo sabía de áreas: mostraba el tablero de
 * secretarías recortado a las que cada uno eligió seguir. El problema es que
 * un compromiso puede caer sobre una persona sin pasar por su área —sale de
 * una mesa, de un seguimiento de otra secretaría, de una derivación— y no
 * aparecía en ningún lado que fuera suyo.
 *
 * Ahora la pantalla une dos conjuntos, sin duplicados:
 *
 *   1. Los compromisos que están A MI NOMBRE, venga de donde venga.
 *   2. Los de las ÁREAS que elegí seguir.
 *
 * La unión es por identidad de cuenta (`perfil.id`), no por el nombre libre
 * de `config.usuario`: ese nombre se puede cambiar en Configuración, y atar
 * la bandeja de alguien a un texto editable significa que renombrarse la
 * vacía. El nombre queda para el selector de áreas, que sigue siendo una
 * preferencia de quien usa esta computadora.
 *
 * La parte 1 funciona sin haber elegido ninguna área: quien no monitorea
 * ninguna secretaría igual puede tener compromisos propios.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, Save, UserCheck } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  Aviso, Boton, Chip, Conmutador, Semaforo, Tarjeta, Vacio, nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { identidadArea } from '../../componentes/identidadArea.jsx';
import { TarjetaSecretaria } from '../monitoreo/TableroSecretarias.jsx';
import { descargarCSV } from '../../datos/csv.js';
import { calcularAlertas, TIPOS_ALERTA } from '../../datos/alertas.js';
import { filtrarMiTrabajo } from '../../datos/equipo.js';
import {
  areasAsignadas,
  compromisos as selCompromisos,
  hoyISO,
  resumenSecretarias,
} from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useItems } from '../../utilidades/catalogos.js';
import { acciones, useBD, useUsuario } from '../../estado/tienda.js';
import { usePerfil } from '../../estado/sesion.js';

const VISTAS = [
  { valor: 'todos', titulo: 'Todo' },
  { valor: 'asignados', titulo: 'A mi nombre' },
  { valor: 'areas', titulo: 'De mis áreas' },
];

/**
 * Columnas de «Vencidos». A propósito NO son las de `COLUMNAS_COMPROMISO`
 * (columnasCompromiso.jsx) — esa versión también la usan Seguimiento, la
 * ficha de proyecto y la hoja de secretaría, y ahí no se pidió este recorte.
 * El estado dice sólo «N días»: la tarjeta ya está tintada de rojo.
 */
const COLUMNAS_VENCIDOS = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => (
      <div className="min-w-40">
        <p className="leading-tight text-tinta">{f.descripcion}</p>
        <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
      </div>
    ),
  },
  { clave: 'area', titulo: 'Área', ancho: 170 },
  { clave: 'responsable_coordinacion', titulo: 'Responsable', ancho: 140 },
  {
    clave: 'fecha_limite',
    titulo: 'Vence',
    ancho: 100,
    render: (f) => <span className="tabular text-xs">{fFecha(f.fecha_limite)}</span>,
    formatoCSV: fFecha,
  },
  {
    clave: 'estado_efectivo',
    titulo: 'Estado',
    ancho: 120,
    render: (f) => <Semaforo nivel="vencido" texto={`${f.dias_atraso} días`} />,
  },
];

/**
 * Columnas de «pendientes» — hoy SÓLO para el CSV.
 *
 * La pantalla dejó de ser una tabla el 14/09/2026 (ver `PorVencimiento`), pero
 * la exportación sigue siendo tabular: un CSV agrupado no se abre en una
 * planilla.
 */
const COLUMNAS_PENDIENTES = [
  { clave: 'descripcion', titulo: 'Compromiso' },
  { clave: 'area', titulo: 'Área' },
  { clave: 'responsable_coordinacion', titulo: 'Responsable' },
  { clave: 'fecha_limite', titulo: 'Vence', formatoCSV: fFecha },
  { clave: 'estado_efectivo', titulo: 'Estado' },
  { clave: 'origen_tipo', titulo: 'Origen' },
];

export default function MiTrabajo() {
  const bd = useBD();
  const hoy = hoyISO();
  const usuario = useUsuario();
  const perfil = usePerfil();
  const navegar = useNavigate();
  const areasCatalogo = useItems('areas');
  const [vista, setVista] = useState('todos');

  const asignadas = useMemo(
    () => (bd ? areasAsignadas(bd, usuario, perfil?.id) : []),
    [bd, usuario, perfil?.id],
  );

  // Se piden TODOS los compromisos y se filtran acá: el filtro `area` del
  // selector devolvería sólo los de mis áreas, y lo que hace propia a esta
  // pantalla es justamente lo que cae afuera de ellas.
  const todos = useMemo(() => (bd ? selCompromisos(bd, {}, hoy) : []), [bd, hoy]);
  const mios = useMemo(
    () => filtrarMiTrabajo(todos, perfil?.id, asignadas, vista),
    [todos, perfil?.id, asignadas, vista],
  );

  // `alerta` y no `vencido`: es lo que devuelve `estadoCompromiso()`. La
  // pantalla vieja comparaba contra `vencido`, que el selector no emite
  // nunca, así que esta tabla no se mostraba jamás y los vencidos se colaban
  // entre los pendientes de abajo.
  const vencidos = useMemo(() => mios.filter((c) => c.estado_efectivo === 'alerta'), [mios]);
  const pendientes = useMemo(
    () => mios.filter((c) => c.estado_efectivo !== 'alerta' && c.estado_efectivo !== 'cumplido'),
    [mios],
  );

  const alertas = useMemo(() => (bd ? calcularAlertas(bd, hoy) : []), [bd, hoy]);
  const alertasPropias = useMemo(
    () => alertas.filter((a) => asignadas.includes(a.area)),
    [alertas, asignadas],
  );
  // Alertas críticas que no son un compromiso (ej. un cierre de posicionamiento
  // vencido): no tienen forma de compromiso, así que van en formato compacto.
  const otrasAlertasVencidas = useMemo(
    () => alertasPropias.filter(
      (a) => a.severidad === 'critica' && a.tipo !== TIPOS_ALERTA.COMPROMISO_VENCIDO,
    ),
    [alertasPropias],
  );

  const resumenes = useMemo(() => (bd ? resumenSecretarias(bd, {}, hoy) : []), [bd, hoy]);
  const propios = resumenes.filter((r) => asignadas.includes(r.area));
  const porArea = useMemo(() => {
    const cuenta = new Map();
    for (const a of alertasPropias) if (a.area) cuenta.set(a.area, (cuenta.get(a.area) ?? 0) + 1);
    return cuenta;
  }, [alertasPropias]);

  const abrir = (c) => navegar(
    `/seguimiento?tab=compromisos&area=${encodeURIComponent(c.area)}&compromiso=${c.id}`,
  );

  const aMiNombre = useMemo(
    () => (perfil?.id ? todos.filter((c) => c.id_responsable === perfil.id).length : 0),
    [todos, perfil?.id],
  );
  const sinNada = asignadas.length === 0 && aMiNombre === 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Mi trabajo"
        descripcion="Los compromisos que están a tu nombre y los de las secretarías que seguís de cerca, en un solo lugar."
      />
      <Pagina className="flex flex-col gap-4">
        {sinNada ? (
          <Tarjeta>
            <Vacio
              icono={UserCheck}
              titulo="Todavía no tenés nada acá"
              descripcion="No hay compromisos a tu nombre ni elegiste secretarías para seguir. Marcá abajo las que monitoreás y guardá."
            />
          </Tarjeta>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Conmutador
                etiqueta="Qué compromisos mostrar"
                opciones={VISTAS}
                valor={vista}
                alCambiar={setVista}
              />
              <p className="text-xs text-gris">
                {aMiNombre} a tu nombre · {asignadas.length} secretaría
                {asignadas.length === 1 ? '' : 's'} que seguís
              </p>
            </div>

            {/* Fondo apenas tintado de rojo para que se distinga de un vistazo
                sin ser disruptivo — mismo tono que los chips de «vencido». */}
            {vencidos.length > 0 && (
              <Tarjeta
                titulo="Vencidos"
                descripcion="Pasó la fecha límite y siguen abiertos. Un clic en la fila abre el compromiso en Seguimiento."
                sinPadding
                style={{ background: 'var(--color-vencido-suave)', borderColor: '#f0c7cb' }}
              >
                <Tabla
                  nombreExport="mi-trabajo-vencidos"
                  filas={vencidos}
                  conBusqueda={false}
                  columnas={COLUMNAS_VENCIDOS}
                  colorEncabezado="#f6d8dc"
                  alHacerClicFila={abrir}
                />
              </Tarjeta>
            )}

            <PorVencimiento
              compromisos={pendientes}
              areasCatalogo={areasCatalogo}
              perfilId={perfil?.id}
              alAbrir={abrir}
            />

            {otrasAlertasVencidas.length > 0 && (
              <Tarjeta
                titulo="Otras alertas vencidas"
                descripcion="Lo que ya venció y no es un compromiso — sale del mismo motor que el inicio y Monitoreo."
                sinPadding
              >
                <ListaAlertas alertas={otrasAlertasVencidas} limite={otrasAlertasVencidas.length} />
              </Tarjeta>
            )}

            {propios.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
                  Estado de tus secretarías
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {propios.map((r) => (
                    <TarjetaSecretaria
                      key={r.area}
                      resumen={r}
                      prefijo={areasCatalogo.find((a) => a.nombre === r.area)?.prefijo}
                      alertas={porArea.get(r.area) ?? 0}
                      alAbrir={() => navegar(
                        `/monitoreo?tab=secretarias&secretaria=${encodeURIComponent(r.area)}`,
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <SelectorAreas usuario={usuario} areasCatalogo={areasCatalogo} asignadas={asignadas} />
      </Pagina>
    </>
  );
}

/* ── Compromisos agrupados por vencimiento ──────────────────────────── */

/**
 * La fecha de vencimiento es un ENCABEZADO, no una celda repetida.
 *
 * La tabla anterior tenía cuatro columnas y tres escribían el mismo valor en
 * todas las filas: el área, la fecha y el estado. Con los seis compromisos de
 * Ambiente del 14/09/2026 eso era «Secretaría de Ambiente y Servicios
 * Públicos · 21/10/2026 · pendiente» seis veces — cerca del 45% del ancho
 * ocupado por texto que no distingue una fila de otra.
 *
 * Acá cada vencimiento se enuncia una sola vez, con los días que faltan —que
 * es el dato que decide si algo se trata hoy o la semana que viene— y cuántos
 * compromisos caen ahí. La fila queda en una línea.
 */
function PorVencimiento({ compromisos, areasCatalogo, perfilId, alAbrir }) {
  // `selCompromisos` ya devuelve ordenado por `fecha_limite` ascendente y con
  // los sin fecha al final; agrupar con un Map conserva ese orden.
  const grupos = useMemo(() => {
    const porFecha = new Map();
    for (const c of compromisos) {
      const clave = c.fecha_limite ?? 'sin-fecha';
      if (!porFecha.has(clave)) {
        porFecha.set(clave, { fecha: c.fecha_limite ?? null, dias: c.dias_restantes ?? null, filas: [] });
      }
      porFecha.get(clave).filas.push(c);
    }
    return [...porFecha.values()];
  }, [compromisos]);

  return (
    <Tarjeta
      titulo="Pendientes"
      descripcion="Vigentes, no recortados por período: son estado, no historia. Los vencidos no se repiten acá — están arriba. Un clic en la fila abre el compromiso en Seguimiento."
      sinPadding
      acciones={compromisos.length > 0 && (
        <Boton
          tamanio="sm"
          icono={Download}
          onClick={() => descargarCSV('mi-trabajo-compromisos', compromisos, COLUMNAS_PENDIENTES)}
          title="Exportar a CSV los compromisos de la lista"
        >
          CSV
        </Boton>
      )}
    >
      {grupos.length === 0 ? (
        <Vacio compacto icono={ClipboardList} titulo="Sin compromisos pendientes" />
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.fecha ?? 'sin-fecha'}>
            <header className="flex items-center gap-2 border-b border-t border-borde bg-paper px-4 py-2 first:border-t-0">
              <Semaforo nivel={nivelPorDias(grupo.dias)} soloPunto texto={tituloVencimiento(grupo)} />
              <h3 className="text-xs font-semibold text-tinta">{tituloVencimiento(grupo)}</h3>
              {grupo.fecha && <span className="tabular text-[11px] text-tenue">{fFecha(grupo.fecha)}</span>}
              <span className="tabular ml-auto text-[11px] text-tenue">
                {grupo.filas.length} compromiso{grupo.filas.length === 1 ? '' : 's'}
              </span>
            </header>
            {grupo.filas.map((c) => {
              const identidad = identidadArea(c.area, areasCatalogo);
              const esMio = Boolean(perfilId) && c.id_responsable === perfilId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alAbrir(c)}
                  className="flex w-full items-center gap-2.5 border-b border-borde px-4 py-2 text-left last:border-b-0 hover:bg-paper"
                >
                  <Chip tono={identidad.tono} title={identidad.nombreArea}>
                    {identidad.sigla}
                  </Chip>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-tinta">{c.descripcion}</span>
                  {/* Sólo se marca lo propio. Poner también el nombre ajeno
                      llenaba la fila de texto que se repite en cada renglón. */}
                  {esMio && <Chip tono="acento">A tu nombre</Chip>}
                  <span className="shrink-0 text-[11px] text-tenue">{c.origen_tipo}</span>
                </button>
              );
            })}
          </section>
        ))
      )}
    </Tarjeta>
  );
}

/**
 * Cuánto falta, en palabras. Los días importan más que la fecha —«en 37 días»
 * se entiende sin hacer la cuenta— así que van adelante y la fecha queda al
 * lado, en gris, para quien la necesite exacta.
 */
function tituloVencimiento({ fecha, dias }) {
  if (!fecha) return 'Sin fecha límite';
  if (dias === null || dias === undefined) return 'Vence';
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/* ── Selector de áreas asignadas ────────────────────────────────────── */

function SelectorAreas({ usuario, areasCatalogo, asignadas }) {
  const [seleccion, setSeleccion] = useState(asignadas);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);

  // Si `asignadas` cambia por fuera (otro nombre de usuario, u otra pestaña
  // guardó), la selección visible se resincroniza — si no, quedaría mostrando
  // lo de la persona anterior.
  const clave = asignadas.join('|');
  const [claveVista, setClaveVista] = useState(clave);
  if (clave !== claveVista) {
    setClaveVista(clave);
    setSeleccion(asignadas);
  }

  const alternar = (nombre) => setSeleccion(
    (s) => (s.includes(nombre) ? s.filter((n) => n !== nombre) : [...s, nombre]),
  );

  const nombresCatalogo = areasCatalogo.map((a) => a.nombre);
  const todasElegidas = nombresCatalogo.length > 0 && nombresCatalogo.every((n) => seleccion.includes(n));
  // «Elegir todo» es un toggle, no un botón de una sola dirección: con todas
  // marcadas, tocarlo tiene que vaciar la selección, no quedarse sin efecto.
  const alternarTodas = () => setSeleccion(todasElegidas ? [] : nombresCatalogo);

  const huboCambios = seleccion.slice().sort().join('|') !== asignadas.slice().sort().join('|');

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await acciones.guardarAsignacionesMonitoreo(usuario, seleccion);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      // Habia un try sin catch: si la base rechazaba la escritura, el error se
      // perdia y la pantalla mostraba el boton listo otra vez, como si hubiera
      // guardado.
      setError(e?.message ?? 'No se pudieron guardar tus áreas.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Secretarías que seguís"
      descripcion="Sumá acá las secretarías que monitoreás. Los compromisos que están a tu nombre aparecen arriba aunque no elijas ninguna."
      acciones={(
        <>
          {guardado && <Chip tono="enregla">Guardado</Chip>}
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton variante="primario" tamanio="sm" icono={Save} onClick={guardar} disabled={guardando || !huboCambios}>
            Guardar
          </Boton>
        </>
      )}
    >
      {areasCatalogo.length === 0 ? (
        <Aviso tono="info">No hay áreas cargadas en el catálogo todavía.</Aviso>
      ) : (
        <>
          <CampoCheck
            etiqueta={todasElegidas ? 'Quitar todas' : 'Elegir todas'}
            checked={todasElegidas}
            onChange={alternarTodas}
            className="mb-2.5 border-b border-borde pb-2.5 font-medium"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {areasCatalogo.map((a) => (
              <CampoCheck
                key={a.id}
                etiqueta={a.nombre}
                checked={seleccion.includes(a.nombre)}
                onChange={() => alternar(a.nombre)}
              />
            ))}
          </div>
        </>
      )}
    </Tarjeta>
  );
}
