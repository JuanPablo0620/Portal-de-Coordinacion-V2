/**
 * ─────────────────────────────────────────────────────────────────────
 * MAPA DE CORTES DE CALLE.
 *
 * Contesta tres preguntas y está ordenado por ellas: qué está cortado hoy
 * (el mapa abre en el día), qué se corta el sábado (el control de período), y
 * a quién hay que avisar (la ficha de cada corte, contra las capas del
 * geoportal).
 *
 * El control de período NO es un filtro más entre otros: es el eje del módulo.
 * Un mapa de cortes sin él acumula todo lo que se cargó alguna vez y a las dos
 * semanas ya no se puede leer.
 *
 * ── Cargar un corte son dos pasos. Primero se ELIGEN LAS CALLES con el
 * cursor: el botón «Agregar corte» pone el callejero municipal encima del mapa
 * y cada cuadra se prende y se apaga con un clic. Recién después se abre el
 * formulario con el motivo y el tiempo. El orden importa: es el mismo que
 * sigue la cabeza de quien carga —«esto, esto y esto están cortados; ahora te
 * cuento por qué»— y evita el formulario largo con un mapa adentro.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Construction,
  Layers,
  Loader2,
  MapPinOff,
  MousePointerClick,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  ZoomIn,
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Metrica, Semaforo, Vacio } from '../../componentes/Basicos.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { CampoFecha } from '../../componentes/Campo.jsx';
import { CAPAS_BASE, MapaLeaflet } from '../../componentes/MapaLeaflet.jsx';
import { FormularioCorte } from './FormularioCorte.jsx';
import { OPCIONES_PERIODO, desplazarDia, resolverPeriodo } from './periodoCortes.js';
import { resolverTramos } from './seleccionCuadras.js';
import {
  NIVEL_ESTADO_CORTE,
  TEXTO_ESTADO_CORTE,
  cortesEnRango,
  cuadrasDe,
  descripcionTramo,
  estadoCorte,
  lineasDeCorte,
  ocurreEn,
  puntoDeCorte,
  sinFechaDeFin,
  textoAlcance,
  textoAviso,
  textoMotivo,
  ubicacionDe,
  verticesDe,
  vigenciaDe,
} from '../../datos/cortes.js';
import { contextoDe, cuadrasEn, errorGeoportal, limitePartido } from '../../datos/geoportal.js';
import { hoyISO } from '../../datos/tiempo.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { periodo: 'hoy', desde: '', hasta: '', q: '', corte: '', capa: 'osm' };

/**
 * Zoom a partir del cual se dibujan las cuadras.
 *
 * Más lejos que esto no es que anden lentas: es que no se puede acertar un
 * clic en una cuadra de veinte metros de largo en pantalla, y el geoportal
 * tendría que mandar medio partido para dibujar algo inservible.
 */
const ZOOM_CUADRAS = 16;

export default function Mapa() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [limite, setLimite] = useState([]);

  useEffect(() => {
    let vigente = true;
    limitePartido().then((contornos) => {
      if (vigente) setLimite(contornos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  /** Paso 1 de la carga. `null` = no se está eligiendo nada. */
  const [seleccion, setSeleccion] = useState(null);

  const periodo = useMemo(() => resolverPeriodo(filtros, hoy), [filtros, hoy]);

  const enPeriodo = useMemo(
    () => (bd ? cortesEnRango(bd, periodo.desde, periodo.hasta) : []),
    [bd, periodo.desde, periodo.hasta],
  );

  const busqueda = filtros.q.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (!busqueda) return enPeriodo;
    return enPeriodo.filter((c) =>
      [c.calle, c.esquina_desde, c.esquina_hasta, c.localidad, c.detalle_motivo]
        .filter(Boolean)
        .some((t) => t.toLowerCase().includes(busqueda)),
    );
  }, [enPeriodo, busqueda]);

  const seleccionado = useMemo(
    () => visibles.find((c) => c.id === filtros.corte) ?? null,
    [visibles, filtros.corte],
  );

  const cortadosHoy = useMemo(() => (bd?.cortes ?? []).filter((c) => ocurreEn(c, hoy)).length, [bd, hoy]);
  const abiertos = useMemo(() => enPeriodo.filter(sinFechaDeFin).length, [enPeriodo]);

  /* ── Cuadras del callejero, sólo mientras se está eligiendo ───────── */

  const [area, setArea] = useState(null);
  const [cuadras, setCuadras] = useState([]);
  const [cargandoCuadras, setCargandoCuadras] = useState(false);
  const reloj = useRef(null);

  useEffect(() => {
    clearTimeout(reloj.current);
    if (!seleccion || !area || area.zoom < ZOOM_CUADRAS) {
      setCuadras([]);
      setCargandoCuadras(false);
      return undefined;
    }
    setCargandoCuadras(true);
    // Sin la espera, arrastrar el mapa dispara una consulta por cuadro.
    reloj.current = setTimeout(async () => {
      const lista = await cuadrasEn(area);
      setCuadras(lista);
      setCargandoCuadras(false);
    }, 350);
    return () => clearTimeout(reloj.current);
  }, [seleccion, area]);

  const elegidas = seleccion?.elegidas ?? {};
  const listaElegidas = useMemo(() => Object.values(elegidas), [elegidas]);

  function alternarCuadra(fid) {
    const cuadra = cuadras.find((c) => c.fid === fid) ?? elegidas[fid];
    if (!cuadra) return;
    setSeleccion((s) => {
      if (!s) return s;
      const proximas = { ...s.elegidas };
      if (proximas[fid]) delete proximas[fid];
      else proximas[fid] = cuadra;
      return { ...s, elegidas: proximas };
    });
  }

  async function continuar() {
    if (!listaElegidas.length) return;
    setSeleccion((s) => ({ ...s, resolviendo: true }));
    const tramos = await resolverTramos(listaElegidas);
    setFormulario({ corte: seleccion.corte, seleccion: { cuadras: listaElegidas, tramos } });
    setSeleccion(null);
  }

  /** Volver del formulario al mapa, conservando lo que ya estaba elegido. */
  function volverAElegir() {
    const previas = formulario?.seleccion?.cuadras ?? formulario?.corte?.cuadras ?? [];
    setSeleccion({
      corte: formulario?.corte ?? null,
      elegidas: Object.fromEntries(previas.map((c) => [c.fid, c])),
    });
    setFormulario(null);
  }

  /* ── Formas del mapa ──────────────────────────────────────────────── */

  const formas = useMemo(() => {
    const lista = limite.length
      ? [
          {
            id: null,
            tipo: 'linea',
            puntos: limite,
            clase: 'corte-limite-partido',
            grosor: 3,
            mostrarPuntas: false,
            interactiva: false,
          },
        ]
      : [];

    // Los cortes ya cargados se siguen viendo mientras se elige: sirve para no
    // cargar dos veces lo mismo y para ver qué hay alrededor.
    for (const c of visibles) {
      const estado = estadoCorte(c, hoy);
      lista.push({
        id: c.id,
        tipo: c.forma === 'punto' ? 'punto' : 'linea',
        puntos: c.forma === 'punto' ? puntoDeCorte(c) : lineasDeCorte(c),
        clase: `corte-${NIVEL_ESTADO_CORTE[estado]}${seleccion ? ' corte-atenuado' : ''}`,
        titulo: `${ubicacionDe(c)} — ${TEXTO_ESTADO_CORTE[estado]}`,
        interactiva: !seleccion,
      });
    }

    if (!seleccion) return lista;

    for (const cuadra of cuadras) {
      if (elegidas[cuadra.fid]) continue;
      lista.push({
        id: `cuadra:${cuadra.fid}`,
        tipo: 'linea',
        puntos: cuadra.lineas,
        clase: 'corte-cuadra',
        grosor: 9,
        mostrarPuntas: false,
        titulo: cuadra.calle,
      });
    }
    for (const cuadra of listaElegidas) {
      lista.push({
        id: `cuadra:${cuadra.fid}`,
        tipo: 'linea',
        puntos: cuadra.lineas,
        clase: 'corte-elegida',
        grosor: 9,
        mostrarPuntas: false,
        titulo: `${cuadra.calle} — clic para quitarla`,
      });
    }
    return lista;
  }, [limite, visibles, hoy, seleccion, cuadras, elegidas, listaElegidas]);

  function alClicEnForma(id) {
    if (String(id).startsWith('cuadra:')) {
      alternarCuadra(Number(String(id).slice(7)));
      return;
    }
    if (!seleccion) setFiltros({ corte: id });
  }

  const encuadre = useMemo(() => {
    if (seleccion) return null; // Mientras se elige, el mapa lo maneja el usuario.
    if (seleccionado) return verticesDe(seleccionado);
    return limite.flat();
  }, [seleccion, seleccionado, limite]);

  return (
    <>
      <EncabezadoPagina
        titulo="Mapa de cortes de calle"
        descripcion="Qué está cortado, cuándo, y a quién hay que avisar. Las calles salen del callejero oficial del municipio."
        acciones={
          seleccion ? (
            <Boton onClick={() => setSeleccion(null)}>Cancelar</Boton>
          ) : (
            <Boton
              variante="primario"
              icono={Plus}
              onClick={() => setSeleccion({ corte: null, elegidas: {} })}
            >
              Agregar corte
            </Boton>
          )
        }
      />

      <Pagina className="flex flex-col gap-4">
        {!seleccion && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metrica
              etiqueta="Cortado hoy"
              valor={cortadosHoy}
              icono={TriangleAlert}
              tono={cortadosHoy ? 'vencido' : 'neutro'}
            />
            <Metrica etiqueta="En el período" valor={enPeriodo.length} icono={CalendarRange} />
            <Metrica
              etiqueta="Sin fecha de fin"
              valor={abiertos}
              icono={Clock}
              tono={abiertos ? 'vencido' : 'neutro'}
              detalle={abiertos ? 'nadie los va a levantar solo' : ''}
            />
            <Metrica
              etiqueta="Cargados en total"
              valor={(bd?.cortes ?? []).filter((c) => c.activo !== false).length}
              icono={Construction}
            />
          </div>
        )}

        {!seleccion && <ControlPeriodo filtros={filtros} setFiltros={setFiltros} periodo={periodo} hoy={hoy} />}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-2">
            <MapaLeaflet
              formas={formas}
              seleccionada={seleccion ? null : filtros.corte || null}
              alSeleccionar={alClicEnForma}
              alMoverse={seleccion ? setArea : undefined}
              zoomMinimo={seleccion ? ZOOM_CUADRAS : null}
              capaBase={filtros.capa}
              encuadrar={encuadre}
              alto={seleccion ? 620 : 540}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {seleccion ? (
                <EstadoCuadras cargando={cargandoCuadras} cantidad={cuadras.length} zoom={area?.zoom} />
              ) : (
                <Leyenda />
              )}
              <SelectorCapa valor={filtros.capa} alCambiar={(capa) => setFiltros({ capa })} />
            </div>
          </div>

          {seleccion ? (
            <PanelSeleccion
              elegidas={listaElegidas}
              resolviendo={Boolean(seleccion.resolviendo)}
              alQuitar={alternarCuadra}
              alCancelar={() => setSeleccion(null)}
              alContinuar={continuar}
              editando={Boolean(seleccion.corte)}
            />
          ) : (
            <PanelLateral
              cortes={visibles}
              hoy={hoy}
              seleccionado={seleccionado}
              filtros={filtros}
              setFiltros={setFiltros}
              alEditar={(c) => setFormulario({ corte: c, seleccion: null })}
              alBorrar={setABorrar}
              bd={bd}
            />
          )}
        </div>
      </Pagina>

      {formulario && (
        <FormularioCorte
          abierto
          alCerrar={() => setFormulario(null)}
          corte={formulario.corte}
          seleccion={formulario.seleccion}
          alVolverAElegir={volverAElegir}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(aBorrar)}
        alCerrar={() => setABorrar(null)}
        titulo="Dar de baja el corte"
        mensaje={aBorrar ? `Se da de baja «${ubicacionDe(aBorrar)}». Queda en el historial, no se borra.` : ''}
        textoConfirmar="Dar de baja"
        alConfirmar={async () => {
          if (filtros.corte === aBorrar.id) setFiltros({ corte: '' });
          await acciones.eliminarCorte(aBorrar.id);
        }}
      />
    </>
  );
}

/* ── Paso 1: elegir las calles ──────────────────────────────────────── */

function EstadoCuadras({ cargando, cantidad, zoom }) {
  if (zoom !== undefined && zoom < ZOOM_CUADRAS) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-proximo-texto">
        <ZoomIn size={14} aria-hidden="true" />
        Acercá el mapa para que aparezcan las cuadras.
      </p>
    );
  }
  if (cargando) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-tenue">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        Trayendo las cuadras del callejero…
      </p>
    );
  }
  if (!cantidad) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-tenue">
        <TriangleAlert size={13} aria-hidden="true" />
        No llegaron cuadras de esta zona. Puede ser el geoportal.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-tenue">
      <MousePointerClick size={13} aria-hidden="true" />
      {cantidad} cuadras a la vista. Clic para elegir, clic de nuevo para quitar.
    </p>
  );
}

/** Rango de altura de una cuadra, que es como se la distingue de su vecina. */
function alturaDe(cuadra) {
  const [min, max] = cuadra.alturas ?? [];
  if (!Number.isFinite(min)) return 'sin altura';
  return max && max !== min ? `${min} a ${max}` : `${min}`;
}

function PanelSeleccion({ elegidas, resolviendo, alQuitar, alCancelar, alContinuar, editando }) {
  // Agrupado acá y no con `agruparPorCalle`: el panel necesita cada cuadra
  // suelta para poder quitarla, y el agrupador devuelve sólo los fids. Las
  // esquinas de cada tramo se resuelven recién al continuar, que es cuando
  // dejan de cambiar.
  const porCalle = useMemo(() => {
    const mapa = new Map();
    for (const cuadra of elegidas) {
      if (!mapa.has(cuadra.calle)) mapa.set(cuadra.calle, []);
      mapa.get(cuadra.calle).push(cuadra);
    }
    return [...mapa.entries()].map(([calle, lista]) => ({
      calle,
      localidad: lista.find((c) => c.localidad)?.localidad ?? '',
      cuadras: [...lista].sort((a, b) => (a.alturas?.[0] ?? 0) - (b.alturas?.[0] ?? 0)),
    }));
  }, [elegidas]);

  return (
    <div className="flex flex-col gap-3 rounded-chip border border-acento-medio bg-card p-3">
      <div>
        <p className="text-sm font-semibold text-tinta">
          {editando ? 'Cambiar las calles del corte' : 'Paso 1 · Elegí las calles a cortar'}
        </p>
        <p className="mt-0.5 text-xs text-gris">
          Hacé clic sobre cada cuadra que se corta. Podés elegir varias, de una calle o de todas las que haga falta.
        </p>
      </div>

      {elegidas.length === 0 ? (
        <Vacio
          compacto
          icono={MousePointerClick}
          titulo="Todavía no elegiste ninguna cuadra"
          descripcion="Las cuadras se marcan en azul sobre el mapa."
        />
      ) : (
        <ul className="scroll-fino flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
          {porCalle.map((grupo) => (
            <li key={grupo.calle} className="rounded-chip border border-borde px-3 py-2">
              <p className="text-sm leading-tight text-tinta">{grupo.calle}</p>
              <p className="text-[11px] text-tenue">
                {grupo.cuadras.length} cuadra{grupo.cuadras.length === 1 ? '' : 's'}
                {grupo.localidad ? ` · ${grupo.localidad}` : ''}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {grupo.cuadras.map((cuadra) => (
                  <li key={cuadra.fid}>
                    <button
                      type="button"
                      onClick={() => alQuitar(cuadra.fid)}
                      className="tabular inline-flex items-center gap-1 rounded-chip border border-borde px-1.5 py-0.5 text-[11px] text-gris transition hover:border-vencido hover:text-vencido-texto"
                      aria-label={`Quitar ${grupo.calle} altura ${alturaDe(cuadra)}`}
                    >
                      {alturaDe(cuadra)}
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton
          variante="primario"
          onClick={alContinuar}
          disabled={!elegidas.length || resolviendo}
          icono={resolviendo ? Loader2 : undefined}
        >
          {resolviendo ? 'Buscando las esquinas…' : `Continuar con ${elegidas.length} cuadra(s)`}
        </Boton>
        <Boton onClick={alCancelar}>Cancelar</Boton>
      </div>
    </div>
  );
}

/* ── Control de período ─────────────────────────────────────────────── */

function ControlPeriodo({ filtros, setFiltros, periodo, hoy }) {
  const puedeDesplazar = periodo.unDia;
  const mover = (dias) => {
    const nuevos = desplazarDia(filtros, hoy, dias);
    if (nuevos) setFiltros(nuevos);
  };

  return (
    <div className="flex flex-col gap-2 rounded-chip border border-borde bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-chip border border-borde p-0.5" role="group" aria-label="Período">
          {OPCIONES_PERIODO.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setFiltros({ periodo: o.valor, desde: '', hasta: '' })}
              aria-pressed={(filtros.periodo ?? 'hoy') === o.valor}
              className={`rounded-chip px-2.5 py-1.5 text-sm font-medium transition ${
                (filtros.periodo ?? 'hoy') === o.valor
                  ? 'bg-acento-suave text-acento-fuerte'
                  : 'text-gris hover:text-tinta'
              }`}
            >
              {o.titulo}
            </button>
          ))}
        </div>

        {/* Con un solo día el control deja de ser un filtro y pasa a ser un
            calendario: es como se usa de verdad («¿y el sábado?»). */}
        {puedeDesplazar && (
          <div className="flex items-center gap-1">
            <Boton icono={ChevronLeft} onClick={() => mover(-1)} aria-label="Día anterior" />
            <span className="tabular min-w-32 text-center text-sm font-medium text-tinta">
              {periodo.desde === hoy ? 'Hoy' : fFecha(periodo.desde)}
            </span>
            <Boton icono={ChevronRight} onClick={() => mover(1)} aria-label="Día siguiente" />
          </div>
        )}

        <p className="ml-auto text-xs text-tenue">
          {periodo.desde
            ? periodo.unDia
              ? `Cortes del ${fFecha(periodo.desde)}`
              : `Del ${fFecha(periodo.desde)}${periodo.hasta ? ` al ${fFecha(periodo.hasta)}` : ' en adelante'}`
            : 'Todos los cortes cargados'}
        </p>
      </div>

      {filtros.periodo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-2">
          <CampoFecha
            etiqueta="Desde"
            value={filtros.desde || hoy}
            onChange={(e) => setFiltros({ desde: e.target.value })}
            className="w-44"
          />
          <CampoFecha
            etiqueta="Hasta"
            value={filtros.hasta || filtros.desde || hoy}
            onChange={(e) => setFiltros({ hasta: e.target.value })}
            className="w-44"
          />
        </div>
      )}
    </div>
  );
}

function Leyenda() {
  const items = [
    ['vencido', 'Cortado hoy'],
    ['proximo', 'Programado'],
    ['enregla', 'Levantado'],
    ['sindato', 'Finalizado'],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(([nivel, texto]) => (
        <li key={nivel}>
          <Semaforo nivel={nivel} texto={texto} />
        </li>
      ))}
    </ul>
  );
}

function SelectorCapa({ valor, alCambiar }) {
  return (
    <div className="flex items-center gap-1.5">
      <Layers size={14} className="text-tenue" aria-hidden="true" />
      <div className="flex rounded-chip border border-borde p-0.5" role="group" aria-label="Capa base del mapa">
        {CAPAS_BASE.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => alCambiar(c.valor)}
            aria-pressed={valor === c.valor}
            className={`rounded-chip px-2 py-1 text-xs font-medium transition ${
              valor === c.valor ? 'bg-acento-suave text-acento-fuerte' : 'text-gris hover:text-tinta'
            }`}
          >
            {c.titulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Panel lateral ──────────────────────────────────────────────────── */

function PanelLateral({ cortes, hoy, seleccionado, filtros, setFiltros, alEditar, alBorrar, bd }) {
  if (seleccionado) {
    return (
      <FichaCorte
        corte={seleccionado}
        hoy={hoy}
        bd={bd}
        alVolver={() => setFiltros({ corte: '' })}
        alEditar={() => alEditar(seleccionado)}
        alBorrar={() => alBorrar(seleccionado)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-chip border border-borde-fuerte bg-card px-3 py-2">
        <Search size={15} className="shrink-0 text-tenue" aria-hidden="true" />
        <input
          type="search"
          className="w-full bg-transparent text-sm text-tinta outline-none placeholder:text-tenue"
          placeholder="Buscar por calle…"
          value={filtros.q}
          onChange={(e) => setFiltros({ q: e.target.value })}
          aria-label="Buscar un corte por calle"
        />
      </label>

      {cortes.length === 0 ? (
        <Vacio
          icono={MapPinOff}
          compacto
          titulo="No hay cortes en este período"
          descripcion="Cambiá el período o cargá el primero con el botón de arriba."
        />
      ) : (
        <ul className="scroll-fino flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
          {cortes.map((c) => {
            const estado = estadoCorte(c, hoy);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setFiltros({ corte: c.id })}
                  className="flex w-full flex-col gap-1 rounded-chip border border-borde bg-card px-3 py-2 text-left transition hover:border-acento-medio"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight text-tinta">{ubicacionDe(c)}</span>
                    <Semaforo nivel={NIVEL_ESTADO_CORTE[estado]} soloPunto />
                  </span>
                  <span className="text-xs text-gris">{vigenciaDe(c, hoy)}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <Chip>{textoAlcance(c)}</Chip>
                    {c.localidad && <Chip>{c.localidad}</Chip>}
                    {sinFechaDeFin(c) && <Chip tono="proximo">Sin fecha de fin</Chip>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Ficha ──────────────────────────────────────────────────────────── */

function FichaCorte({ corte, hoy, bd, alVolver, alEditar, alBorrar }) {
  const estado = estadoCorte(corte, hoy);
  const [contexto, setContexto] = useState(null);
  const [cargandoContexto, setCargandoContexto] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const evento = useMemo(
    () => (corte.id_evento ? (bd?.eventos ?? []).find((e) => e.id === corte.id_evento) : null),
    [bd, corte.id_evento],
  );

  useEffect(() => {
    let vigente = true;
    setCargandoContexto(true);
    setContexto(null);
    const geometria = corte.forma === 'punto' ? [[puntoDeCorte(corte)].filter(Boolean)] : lineasDeCorte(corte);
    contextoDe(geometria).then((resultado) => {
      if (!vigente) return;
      setContexto(resultado);
      setCargandoContexto(false);
    });
    return () => {
      vigente = false;
    };
  }, [corte]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoAviso(corte, contexto ?? []));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const tramos = corte.tramos ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-chip border border-borde bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-tinta">{ubicacionDe(corte)}</p>
          {corte.localidad && <p className="text-xs text-tenue">{corte.localidad}</p>}
        </div>
        <Boton onClick={alVolver}>Volver</Boton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Semaforo nivel={NIVEL_ESTADO_CORTE[estado]} texto={TEXTO_ESTADO_CORTE[estado]} />
        <Chip>{textoAlcance(corte)}</Chip>
        {cuadrasDe(corte) > 0 && <Chip>{cuadrasDe(corte)} cuadra(s)</Chip>}
        {corte.trazado_aproximado && <Chip tono="proximo">Trazado aproximado</Chip>}
      </div>

      {tramos.length > 1 && (
        <ul className="flex flex-col gap-0.5 rounded-chip bg-paper p-2 text-xs text-gris">
          {tramos.map((t, i) => (
            <li key={`${t.calle}-${i}`}>{descripcionTramo(t)}</li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1.5 text-sm">
        <Dato termino="Vigencia" valor={vigenciaDe(corte, hoy)} />
        <Dato termino="Motivo" valor={textoMotivo(corte)} />
        {corte.area_solicitante && <Dato termino="Solicita" valor={corte.area_solicitante} />}
        {corte.sentido && <Dato termino="Sentido" valor={corte.sentido.replace(/^\d+\.\s*/, '')} />}
        {evento && <Dato termino="Evento" valor={`${evento.nombre} (${fFecha(evento.fecha)})`} />}
        {corte.observaciones && <Dato termino="Observaciones" valor={corte.observaciones} />}
      </dl>

      {sinFechaDeFin(corte) && (
        <Aviso tono="alerta" titulo="Sin fecha de levantamiento">
          Mientras no tenga fecha de fin, este corte va a seguir apareciendo como vigente todos los días.
        </Aviso>
      )}

      <AQuienAvisar contexto={contexto} cargando={cargandoContexto} />

      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" icono={copiado ? Check : ClipboardCopy} onClick={copiar}>
          {copiado ? 'Aviso copiado' : 'Copiar aviso'}
        </Boton>
        {estado !== 'levantado' && (
          <Boton icono={Check} onClick={() => acciones.levantarCorte(corte.id)}>
            Levantar
          </Boton>
        )}
        <Boton icono={Pencil} onClick={alEditar}>
          Editar
        </Boton>
        <Boton icono={Trash2} onClick={alBorrar}>
          Dar de baja
        </Boton>
      </div>
    </div>
  );
}

function Dato({ termino, valor }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-2">
      <dt className="text-xs text-tenue">{termino}</dt>
      <dd className="text-sm text-tinta">{valor}</dd>
    </div>
  );
}

/**
 * A quién avisar: qué hay alrededor del corte, según las capas del geoportal.
 * Es lo que convierte al mapa en una herramienta de coordinación y no sólo en
 * un registro.
 */
function AQuienAvisar({ contexto, cargando }) {
  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-xs text-tenue">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        Consultando qué hay alrededor…
      </p>
    );
  }
  if (errorGeoportal() && !contexto?.length) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-tenue">
        <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        No se pudo consultar el geoportal. El corte se muestra igual con lo que tiene guardado.
      </p>
    );
  }
  if (!contexto?.length) {
    return <p className="text-xs text-tenue">Sin escuelas, centros de salud ni recorridos de colectivo alrededor.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-chip bg-paper p-2.5">
      <p className="text-xs font-semibold text-gris">A quién avisar</p>
      <ul className="flex flex-col gap-1.5">
        {contexto.map((capa) => (
          <li key={capa.clave} className="text-xs">
            <span className="font-medium text-tinta">{capa.titulo}</span>
            <span className="text-tenue"> · {capa.area}</span>
            <p className="text-gris">
              {capa.etiquetas.slice(0, 6).join(', ')}
              {capa.etiquetas.length > 6 ? ` y ${capa.etiquetas.length - 6} más` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
