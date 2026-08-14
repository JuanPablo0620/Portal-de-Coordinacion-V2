import { useMemo, useState } from 'react';
import { Bookmark, Printer, Save, Trash2 } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Tarjeta } from '../../componentes/Basicos.jsx';
import { Alternadores, GrillaFiltros, TarjetaFiltros } from '../../componentes/Filtros.jsx';
import { CampoCheck, CampoFecha, CampoSelect, CampoTexto } from '../../componentes/Campo.jsx';
import { Modal } from '../../componentes/Modal.jsx';
import { VistaPrevia } from './VistaPrevia.jsx';
import { BLOQUES, MODULOS_ORIGEN, RANGOS, armarReporte } from '../../datos/reportes.js';
import { ESTADOS_PROYECTO, PRIORIDADES } from '../../datos/catalogos.js';
import { activos, hoyISO } from '../../datos/selectores.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { contarFiltros, useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = {
  area: '', programa: '', eje: '', tipo: '', estado: '', prioridad: '', responsable: '',
  id_proyecto: '', modulo: '', rango: '', desde: '', hasta: '',
  solo_obras: false, solo_prioritarios: false, solo_con_alertas: false,
};

const BLOQUES_INICIALES = {
  resumen: true, proyectos: true, graficos: true, compromisos: true,
  alertas: true, minutas: false, temas: false, mesas: false, eventos: false,
};

export default function Reportes() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros, limpiarFiltros, reemplazarFiltros] = useFiltrosUrl(DEFAULTS);
  const [bloques, setBloques] = useState(BLOQUES_INICIALES);
  const [guardando, setGuardando] = useState(false);

  const reporte = useMemo(() => armarReporte(bd, filtros, hoy), [bd, filtros, hoy]);
  const cantidadFiltros = contarFiltros(filtros, DEFAULTS);

  const guardados = useMemo(() => activos(bd?.reportes_guardados ?? []), [bd]);

  /** Aplicar una configuración guardada REEMPLAZA los filtros, no los mezcla. */
  function aplicarGuardado(r) {
    reemplazarFiltros(r.filtros ?? {});
    if (r.bloques) setBloques({ ...BLOQUES_INICIALES, ...r.bloques });
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Constructor de informes con filtros combinables. La vista previa es lo que se imprime."
        acciones={
          <>
            <Boton icono={Save} onClick={() => setGuardando(true)}>
              Guardar configuración
            </Boton>
            <Boton icono={Printer} variante="primario" onClick={() => window.print()}>
              Imprimir / PDF
            </Boton>
          </>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <div className="no-imprimir flex flex-col gap-4">
          <PanelFiltros
            filtros={filtros}
            setFiltros={setFiltros}
            limpiar={limpiarFiltros}
            bd={bd}
          />
          <SelectorBloques bloques={bloques} setBloques={setBloques} reporte={reporte} />
          {guardados.length > 0 && <ReportesGuardados guardados={guardados} alAplicar={aplicarGuardado} />}
        </div>

        <VistaPrevia reporte={reporte} bloques={bloques} hoy={hoy} filtros={filtros} />
      </Pagina>

      {guardando && (
        <ModalGuardar
          abierto
          alCerrar={() => setGuardando(false)}
          filtros={filtros}
          bloques={bloques}
          cantidadFiltros={cantidadFiltros}
        />
      )}
    </>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

function PanelFiltros({ filtros, setFiltros, limpiar, bd }) {
  const opcionesArea = useOpciones('areas');
  const opcionesPrograma = useOpciones('programas');
  const opcionesEje = useOpciones('ejes');
  const opcionesTipo = useOpciones('tipos');

  const responsables = useMemo(() => {
    const set = new Set(activos(bd?.proyectos ?? []).map((p) => p.responsable).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [bd]);

  const proyectos = useMemo(
    () => activos(bd?.proyectos ?? []).map((p) => ({ valor: p.id_proyecto, titulo: `${p.id_proyecto} · ${p.proyecto}` })),
    [bd],
  );

  return (
    <TarjetaFiltros
      filtros={filtros}
      defaults={DEFAULTS}
      alLimpiar={limpiar}
      descripcion="Todos combinables entre sí. Se reflejan en la dirección: esta configuración se comparte pegando el enlace."
    >
      <GrillaFiltros columnas={4}>
        <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
        <CampoSelect etiqueta="Programa" opciones={opcionesPrograma} value={filtros.programa} onChange={(e) => setFiltros({ programa: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Eje" opciones={opcionesEje} value={filtros.eje} onChange={(e) => setFiltros({ eje: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={filtros.tipo} onChange={(e) => setFiltros({ tipo: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Estado" opciones={ESTADOS_PROYECTO} value={filtros.estado} onChange={(e) => setFiltros({ estado: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Prioridad" opciones={PRIORIDADES} value={filtros.prioridad} onChange={(e) => setFiltros({ prioridad: e.target.value })} placeholder="Todas" />
        <CampoSelect etiqueta="Responsable" opciones={responsables} value={filtros.responsable} onChange={(e) => setFiltros({ responsable: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Proyecto" opciones={proyectos} value={filtros.id_proyecto} onChange={(e) => setFiltros({ id_proyecto: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Módulo de origen" opciones={MODULOS_ORIGEN} value={filtros.modulo} onChange={(e) => setFiltros({ modulo: e.target.value })} placeholder="Todos" />
        <CampoSelect etiqueta="Rango temporal" opciones={RANGOS.filter((r) => r.valor)} value={filtros.rango} onChange={(e) => setFiltros({ rango: e.target.value })} placeholder="Sin límite" />
        {filtros.rango === 'personalizado' && (
          <>
            <CampoFecha etiqueta="Desde" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
            <CampoFecha etiqueta="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
          </>
        )}
      </GrillaFiltros>

      <Alternadores
        filtros={filtros}
        setFiltros={setFiltros}
        opciones={[
          ['solo_con_alertas', 'Sólo con alertas activas'],
          ['solo_obras', 'Sólo obras'],
          ['solo_prioritarios', 'Sólo prioritarios'],
        ]}
      />
    </TarjetaFiltros>
  );
}

/* ── Selector de bloques ────────────────────────────────────────────── */

function SelectorBloques({ bloques, setBloques, reporte }) {
  const CANTIDAD = {
    proyectos: reporte.proyectos.length,
    compromisos: reporte.compromisos.length,
    alertas: reporte.alertas.length,
    minutas: reporte.seguimientos.filter((s) => s.texto_crudo).length,
    temas: reporte.temas.length,
    mesas: reporte.mesas.length,
    eventos: reporte.eventos.length,
  };

  return (
    <Tarjeta titulo="Bloques a incluir" descripcion="El reporte se arma sólo con lo que marques.">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {BLOQUES.map((b) => (
          <div key={b.clave} className="flex items-start gap-2 rounded-chip border border-borde px-3 py-2">
            <CampoCheck
              etiqueta={
                <span className="flex items-center gap-1.5">
                  {b.titulo}
                  {CANTIDAD[b.clave] !== undefined && <Chip tono="neutro">{CANTIDAD[b.clave]}</Chip>}
                </span>
              }
              descripcion={b.descripcion}
              checked={bloques[b.clave]}
              onChange={(e) => setBloques((x) => ({ ...x, [b.clave]: e.target.checked }))}
            />
          </div>
        ))}
      </div>
      <TamanioDelDocumento bloques={bloques} cantidad={CANTIDAD} />
    </Tarjeta>
  );
}

/**
 * Aviso de tamaño.
 *
 * Sin filtros y con todos los bloques marcados, el documento pasa las mil
 * doscientas filas: unas treinta páginas que salen recién al abrir el diálogo
 * de impresión, cuando ya es tarde para acotar el recorte. Decirlo antes cuesta
 * una línea. El umbral es alto a propósito: un informe largo puede ser
 * exactamente lo que se pidió, así que esto avisa, no impide.
 */
const FILAS_POR_PAGINA = 40;
const FILAS_QUE_PREOCUPAN = 300;

function TamanioDelDocumento({ bloques, cantidad }) {
  const filas = Object.entries(cantidad).reduce(
    (suma, [clave, n]) => suma + (bloques[clave] ? n : 0),
    0,
  );
  if (filas < FILAS_QUE_PREOCUPAN) return null;

  return (
    <p className="mt-3 text-xs text-gris">
      El documento tiene <span className="tabular font-semibold">{filas.toLocaleString('es-AR')}</span> filas:
      alrededor de <span className="tabular font-semibold">{Math.ceil(filas / FILAS_POR_PAGINA)}</span> páginas
      impresas. Acotá el período o desmarcá bloques si buscabas algo más corto.
    </p>
  );
}

/* ── Configuraciones guardadas ──────────────────────────────────────── */

function ReportesGuardados({ guardados, alAplicar }) {
  return (
    <Tarjeta titulo="Configuraciones guardadas" descripcion="Combinaciones de filtros reutilizables." sinPadding>
      <ul className="divide-y divide-borde/60">
        {guardados.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <Bookmark size={15} className="shrink-0 text-acento" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-tinta">{r.nombre}</p>
              <p className="truncate text-[11px] text-tenue">
                {Object.entries(r.filtros ?? {})
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k}: ${v === true ? 'sí' : v}`)
                  .join(' · ') || 'sin filtros'}
              </p>
            </div>
            <Boton tamanio="sm" onClick={() => alAplicar(r)}>
              Aplicar
            </Boton>
            <button
              type="button"
              onClick={() => acciones.borrarReporte(r.id)}
              className="shrink-0 rounded p-1.5 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
              aria-label="Borrar configuración"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function ModalGuardar({ abierto, alCerrar, filtros, bloques, cantidadFiltros }) {
  const [nombre, setNombre] = useState('');
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="sm"
      titulo="Guardar configuración de reporte"
      descripcion={`Se guardan los ${cantidadFiltros} filtro(s) aplicados y los bloques elegidos.`}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono={Save}
            disabled={!nombre.trim()}
            onClick={async () => {
              await acciones.guardarReporte(nombre.trim(), filtros, bloques);
              alCerrar();
            }}
          >
            Guardar
          </Boton>
        </>
      }
    >
      <CampoTexto
        etiqueta="Nombre"
        requerido
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej.: Informe semanal Obras Públicas"
      />
    </Modal>
  );
}
