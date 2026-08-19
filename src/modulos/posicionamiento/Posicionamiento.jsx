/**
 * MÓDULO DE POSICIONAMIENTO INTERNACIONAL.
 *
 * Registra lo que el municipio hace para existir fuera de sus límites:
 * hermanamientos, redes de ciudades, postulaciones a fondos, premios, misiones
 * y convenios. No son proyectos de la base maestra —no tienen objetivo físico
 * ni avance— pero se apoyan en ellos, y por eso cada acción puede declarar qué
 * proyectos respalda.
 *
 * Lo que el módulo tiene que responder de un vistazo es una sola pregunta: qué
 * hay que presentar antes de que cierre, porque una convocatoria que se pasa de
 * fecha no se reabre.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BarChart3, Globe2, Handshake, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  Aviso,
  Boton,
  Chip,
  EstadoProyecto,
  Metrica,
  Pestanias,
  Semaforo,
  Tarjeta,
  Vacio,
} from '../../componentes/Basicos.jsx';
import { GraficoBarras } from '../../componentes/Graficos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { Alternadores, GrillaFiltros, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { FormularioAccion } from './FormularioAccion.jsx';
import { nombreODS } from './SelectorODS.jsx';
import { ESTADOS_INTERNACIONAL, ODS } from '../../datos/catalogos.js';
import {
  accionesInternacionales,
  accionesPorDimension,
  hoyISO,
  resumenPosicionamiento,
} from '../../datos/selectores.js';
import { dolares, fecha as fFecha, textoVencimiento } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';
import { acciones as repo, useBD } from '../../estado/tienda.js';

const DEFAULTS = {
  tab: 'tablero',
  tipo: '',
  organismo: '',
  pais: '',
  estado: '',
  area: '',
  ods: '',
  solo_abiertas: false,
  accion: '',
};

/** Lo que limpia el botón: filtros, nunca la pestaña ni la acción abierta. */
const CLAVES_FILTRO = ['tipo', 'organismo', 'pais', 'estado', 'area', 'ods', 'solo_abiertas'];

/** Tono del chip de estado. Es el mismo embudo que ordena el tablero. */
const TONO_ESTADO = {
  identificada: 'neutro',
  'en preparación': 'atencion',
  presentada: 'proximo',
  vigente: 'enregla',
  cerrada: 'neutro',
  'no prosperó': 'vencido',
};

export default function Posicionamiento() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [aBorrar, setABorrar] = useState(null);

  const criterios = useMemo(
    () => ({
      tipo: filtros.tipo,
      organismo: filtros.organismo,
      pais: filtros.pais,
      estado: filtros.estado,
      area: filtros.area,
      ods: filtros.ods,
      solo_abiertas: filtros.solo_abiertas,
    }),
    [filtros],
  );

  const lista = useMemo(() => (bd ? accionesInternacionales(bd, criterios, hoy) : []), [bd, criterios, hoy]);
  const resumen = useMemo(() => (bd ? resumenPosicionamiento(bd, criterios, hoy) : null), [bd, criterios, hoy]);

  const pestanias = [
    { valor: 'tablero', titulo: 'Tablero', icono: BarChart3 },
    { valor: 'acciones', titulo: 'Acciones', icono: ListChecks, cantidad: lista.length },
    { valor: 'alianzas', titulo: 'Alianzas y ODS', icono: Handshake },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Posicionamiento internacional"
        descripcion="Hermanamientos, redes, postulaciones y convenios que ponen a Tres de Febrero en el mapa. Cada acción declara a qué ODS contribuye y qué proyectos respalda."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFormulario({})}>
            Nueva acción
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v, accion: '' })} />

        {filtros.tab === 'tablero' && <Tablero resumen={resumen} lista={lista} setFiltros={setFiltros} />}
        {filtros.tab === 'acciones' && (
          <PanelAcciones
            bd={bd}
            lista={lista}
            filtros={filtros}
            setFiltros={setFiltros}
            alEditar={(a) => setFormulario(a)}
            alBorrar={(a) => setABorrar(a)}
          />
        )}
        {filtros.tab === 'alianzas' && <PanelAlianzas bd={bd} criterios={criterios} hoy={hoy} resumen={resumen} />}
      </Pagina>

      {formulario && (
        <FormularioAccion
          abierto
          accion={formulario.id ? formulario : null}
          alCerrar={() => setFormulario(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(aBorrar)}
        alCerrar={() => setABorrar(null)}
        alConfirmar={() => repo.bajaAccionInternacional(aBorrar.id)}
        titulo="Dar de baja la acción"
        mensaje={`«${aBorrar?.nombre ?? ''}» deja de contar en el tablero. No se borra: queda en el historial con su asiento de baja.`}
        textoConfirmar="Dar de baja"
        variante="peligro"
      />
    </>
  );
}

/* ── Tablero ────────────────────────────────────────────────────────── */

function Tablero({ resumen, lista, setFiltros }) {
  if (!resumen) return null;

  const cierres = resumen.proximos_cierres.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica valor={resumen.total} etiqueta="Acciones registradas" icono={Globe2} />
        <Metrica valor={resumen.abiertas} etiqueta="En juego" detalle="identificadas, en preparación, presentadas o vigentes" />
        <Metrica
          valor={resumen.tasa_exito === null ? '—' : `${resumen.tasa_exito}%`}
          etiqueta="Tasa de éxito"
          detalle="sobre lo ya resuelto"
          icono={Award}
        />
        <Metrica
          valor={resumen.vigentes}
          etiqueta="Vínculos vigentes"
          detalle={`${resumen.organismos} organismo(s) · ${resumen.paises} país(es)`}
        />
      </div>

      <Metrica
        valor={dolares(resumen.financiamiento_en_gestion)}
        etiqueta="Financiamiento en gestión"
        detalle="lo que está en juego en las postulaciones abiertas"
      />

      <ProyectosEnCurso />

      <Tarjeta
        titulo="Qué cierra primero"
        descripcion="Lo único del módulo que tiene reloj: una convocatoria que se pasa de fecha no se reabre."
        sinPadding
      >
        {cierres.length === 0 ? (
          <div className="p-4">
            <Vacio compacto icono={ListChecks} titulo="Sin convocatorias con fecha de cierre" descripcion="Las acciones identificadas o en preparación con fecha aparecen acá." />
          </div>
        ) : (
          <ul className="divide-y divide-borde/60">
            {cierres.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Semaforo nivel={a.nivel} soloPunto />
                <button
                  type="button"
                  onClick={() => setFiltros({ tab: 'acciones', accion: a.id })}
                  className="min-w-40 flex-1 text-left"
                >
                  <p className="text-sm font-medium leading-tight text-tinta">{a.nombre}</p>
                  <p className="text-[11px] text-tenue">
                    {a.tipo} · {a.organismo || 'sin organismo'}
                  </p>
                </button>
                <Chip tono={TONO_ESTADO[a.estado] ?? 'neutro'}>{a.estado}</Chip>
                <span className="tabular w-32 shrink-0 text-right text-xs text-gris">
                  {fFecha(a.fecha_limite)}
                  <span className="block text-[11px] text-tenue">{textoVencimiento(a.dias_al_cierre)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Por tipo de acción" descripcion="Con qué instrumento se sale al mundo.">
        <GraficoBarras
          datos={agrupar(lista, 'tipo')}
          horizontal
          anchoEtiqueta={150}
          alto={230}
          series={[{ clave: 'cantidad', titulo: 'Acciones' }]}
        />
      </Tarjeta>
    </div>
  );
}

/**
 * Un módulo por cada proyecto real de Posicionamiento — dato relevado a mano
 * de `Coordinacion_db` (ver `datos/posicionamiento-real.js`), no generado por
 * demo.js. Es lo primero que responde la pregunta "¿qué se está llevando a
 * cabo hoy?", antes de cualquier métrica agregada.
 */
/**
 * Un módulo por cada proyecto real de Posicionamiento — leído de `bd.proyectos`
 * como cualquier otra pantalla del sistema, NO de una lista fija. Lo que hace
 * que un proyecto aparezca acá es tener `programa === 'Posicionamiento'`, sea
 * cual sea su origen: el botón de Configuración que carga los 8 relevados de
 * Coordinacion_db, el alta manual desde "Nuevo proyecto", o —el día de
 * mañana— la migración real desde Supabase. La interfaz no sabe ni le
 * importa de dónde salió el dato.
 */
function ProyectosEnCurso() {
  const bd = useBD();
  const [cargando, setCargando] = useState(false);

  const proyectos = useMemo(
    () =>
      (bd?.proyectos ?? [])
        .filter((p) => p.activo !== false && p.programa === 'Posicionamiento')
        .sort((a, b) => a.proyecto.localeCompare(b.proyecto, 'es')),
    [bd],
  );

  async function cargarReales() {
    setCargando(true);
    try {
      await repo.cargarProyectosPosicionamientoReales();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Proyectos de Posicionamiento en curso"
      descripcion="Se lee de la base maestra de proyectos, filtrado por programa — no es una lista fija."
    >
      {proyectos.length === 0 ? (
        <Vacio
          compacto
          icono={Globe2}
          titulo="Todavía no hay proyectos cargados con programa Posicionamiento"
          descripcion="Podés cargar los relevados de Coordinacion_db o dar de alta uno nuevo desde Proyectos."
          accion={{
            texto: cargando ? 'Cargando…' : 'Cargar los relevados de Coordinacion_db',
            alHacerClic: cargarReales,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {proyectos.map((p) => (
            <article key={p.id_proyecto} className="flex flex-col gap-2 rounded-chip border border-borde p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight text-tinta">{p.proyecto}</h3>
                {p.observaciones?.includes('[Sin fila en "Estado de proyectos"') && (
                  <span title="No figura en la pestaña maestra; puede estar desactualizado" className="shrink-0">
                    <Chip tono="atencion">a confirmar</Chip>
                  </span>
                )}
              </div>
              <EstadoProyecto estado={p.estado} />
              <p className="line-clamp-3 text-xs leading-relaxed text-gris">{p.observaciones}</p>
              {p.fecha_carga && <p className="mt-auto text-[11px] text-tenue">Actualizado {fFecha(p.fecha_carga)}</p>}
            </article>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

/** Conteo por campo sobre la lista ya filtrada, para los gráficos del tablero. */
function agrupar(lista, campo) {
  const cuenta = new Map();
  for (const a of lista) {
    const clave = a[campo] || 'Sin definir';
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
}

/* ── Acciones ───────────────────────────────────────────────────────── */

function PanelAcciones({ bd, lista, filtros, setFiltros, alEditar, alBorrar }) {
  const opcionesTipo = useOpciones('tipos_accion_internacional');
  const opcionesOrganismo = useOpciones('organismos_internacionales');
  const opcionesPais = useOpciones('paises_contraparte');
  const opcionesArea = useOpciones('areas');

  const elegida = filtros.accion ? lista.find((a) => a.id === filtros.accion) : null;

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <GrillaFiltros columnas={4}>
          <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={filtros.tipo} onChange={(e) => setFiltros({ tipo: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="Organismo" opciones={opcionesOrganismo} value={filtros.organismo} onChange={(e) => setFiltros({ organismo: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="País" opciones={opcionesPais} value={filtros.pais} onChange={(e) => setFiltros({ pais: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="Estado" opciones={ESTADOS_INTERNACIONAL} value={filtros.estado} onChange={(e) => setFiltros({ estado: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="Área que la impulsa" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect
            etiqueta="ODS"
            opciones={ODS.map((o) => ({ valor: String(o.numero), titulo: `${o.numero} · ${o.nombre}` }))}
            value={filtros.ods}
            onChange={(e) => setFiltros({ ods: e.target.value })}
            placeholder="Todos"
          />
        </GrillaFiltros>
        <Alternadores
          filtros={filtros}
          setFiltros={setFiltros}
          opciones={[['solo_abiertas', 'Sólo las que están en juego', 'Identificadas, en preparación, presentadas o vigentes']]}
        >
          <span className="tabular ml-1 text-xs text-tenue">
            {lista.length} acci{lista.length === 1 ? 'ón' : 'ones'} en la vista
          </span>
        </Alternadores>
      </TarjetaFiltros>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="acciones-internacionales"
          filas={lista}
          columnas={[
            {
              clave: 'nombre',
              titulo: 'Acción',
              render: (a) => (
                <div className="min-w-0">
                  <p className="truncate text-sm text-tinta">{a.nombre}</p>
                  <p className="truncate text-[11px] text-tenue">
                    {a.organismo || 'sin organismo'}
                    {a.pais ? ` · ${a.pais}` : ''}
                  </p>
                </div>
              ),
            },
            { clave: 'tipo', titulo: 'Tipo', ancho: 170 },
            {
              clave: 'estado',
              titulo: 'Estado',
              ancho: 130,
              render: (a) => <Chip tono={TONO_ESTADO[a.estado] ?? 'neutro'}>{a.estado}</Chip>,
            },
            {
              clave: 'fecha_limite',
              titulo: 'Cierre',
              ancho: 140,
              formatoCSV: fFecha,
              render: (a) =>
                a.fecha_limite ? (
                  <div className="flex items-center gap-1.5">
                    <Semaforo nivel={a.nivel} soloPunto />
                    <span className="tabular text-sm text-tinta">{fFecha(a.fecha_limite)}</span>
                  </div>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
            {
              clave: 'financiamiento_usd',
              titulo: 'Financiamiento',
              ancho: 140,
              alinear: 'derecha',
              render: (a) => (a.financiamiento_usd ? dolares(a.financiamiento_usd) : <span className="text-tenue">—</span>),
            },
            {
              clave: 'ods',
              titulo: 'ODS',
              ancho: 120,
              sinOrdenar: true,
              formatoCSV: (v) => (v ?? []).join(' · '),
              render: (a) =>
                a.ods.length ? (
                  <div className="flex flex-wrap gap-1">
                    {a.ods.map((n) => (
                      <span key={n} title={nombreODS(n)} className="tabular rounded-chip border border-borde px-1.5 text-[11px] text-gris">
                        {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
          ]}
          alHacerClicFila={(a) => setFiltros({ accion: a.id })}
          vacio={
            <Vacio
              icono={Globe2}
              titulo="Sin acciones internacionales"
              descripcion="Cargá la primera para empezar a registrar el posicionamiento del municipio."
            />
          }
        />
      </Tarjeta>

      {elegida && (
        <FichaAccion bd={bd} accion={elegida} alEditar={alEditar} alBorrar={alBorrar} alCerrar={() => setFiltros({ accion: '' })} />
      )}
    </div>
  );
}

function FichaAccion({ bd, accion, alEditar, alBorrar, alCerrar }) {
  const navegar = useNavigate();
  const proyectos = (accion.ids_proyecto ?? [])
    .map((id) => (bd?.proyectos ?? []).find((p) => p.id_proyecto === id))
    .filter(Boolean);

  return (
    <Tarjeta
      titulo={accion.nombre}
      descripcion={`${accion.tipo} · ${accion.alcance}`}
      acciones={
        <>
          <Boton tamanio="sm" icono={Pencil} onClick={() => alEditar(accion)}>
            Editar
          </Boton>
          <Boton tamanio="sm" icono={Trash2} onClick={() => alBorrar(accion)}>
            Dar de baja
          </Boton>
          <Boton tamanio="sm" variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tono={TONO_ESTADO[accion.estado] ?? 'neutro'}>{accion.estado}</Chip>
          {accion.organismo && <Chip tono="acento">{accion.organismo}</Chip>}
          {accion.pais && <Chip tono="neutro">{accion.pais}</Chip>}
          {accion.area && <Chip tono="neutro">{accion.area}</Chip>}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Dato titulo="Inicio de gestión" valor={fFecha(accion.fecha_inicio)} />
          <Dato titulo="Cierre" valor={accion.fecha_limite ? fFecha(accion.fecha_limite) : '—'} />
          <Dato titulo="Resolución" valor={accion.fecha_resolucion ? fFecha(accion.fecha_resolucion) : '—'} />
          <Dato titulo="Financiamiento" valor={accion.financiamiento_usd ? dolares(accion.financiamiento_usd) : '—'} />
          <Dato titulo="Referente" valor={accion.referente || '—'} />
        </dl>

        {accion.descripcion && <p className="text-sm leading-relaxed text-gris">{accion.descripcion}</p>}

        {accion.resultado && (
          <Aviso tono={accion.estado === 'no prosperó' ? 'error' : 'info'} titulo="Resultado">
            {accion.resultado}
          </Aviso>
        )}

        {accion.ods.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-gris">ODS a los que contribuye</p>
            <ul className="flex flex-col gap-0.5">
              {accion.ods.map((n) => (
                <li key={n} className="text-[11px] text-tenue">
                  <span className="tabular font-medium text-gris">ODS {n}</span> · {nombreODS(n)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-gris">Proyectos que respalda</p>
          {proyectos.length === 0 ? (
            <p className="text-[11px] text-tenue">
              Ninguno declarado. Vincular proyectos es lo que permite responder con qué obra concreta
              se respalda la postulación.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {proyectos.map((p) => (
                <button key={p.id_proyecto} type="button" onClick={() => navegar(`/proyectos/${p.id_proyecto}`)}>
                  <Chip tono="acento">
                    {p.id_proyecto} · {p.proyecto}
                  </Chip>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div>
      <dt className="text-[11px] text-tenue">{titulo}</dt>
      <dd className="tabular text-sm text-tinta">{valor}</dd>
    </div>
  );
}

/* ── Alianzas y ODS ─────────────────────────────────────────────────── */

function PanelAlianzas({ bd, criterios, hoy, resumen }) {
  const porOrganismo = useMemo(
    () => (bd ? accionesPorDimension(bd, 'organismo', criterios, hoy).slice(0, 12) : []),
    [bd, criterios, hoy],
  );
  const porPais = useMemo(
    () => (bd ? accionesPorDimension(bd, 'pais', criterios, hoy).slice(0, 12) : []),
    [bd, criterios, hoy],
  );
  const porODS = useMemo(() => {
    if (!bd) return [];
    const cuenta = new Map(accionesPorDimension(bd, 'ods', criterios, hoy).map((d) => [d.nombre, d.cantidad]));
    // Los diecisiete, en orden y con los ceros: el hueco es la información.
    return ODS.map((o) => ({ nombre: `${o.numero}`, cantidad: cuenta.get(`ODS ${o.numero}`) ?? 0 }));
  }, [bd, criterios, hoy]);

  const sinCubrir = porODS.filter((o) => o.cantidad === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica valor={resumen?.organismos ?? 0} etiqueta="Organismos y redes" />
        <Metrica valor={resumen?.paises ?? 0} etiqueta="Países contraparte" />
        <Metrica
          valor={`${resumen?.ods_cubiertos ?? 0} / 17`}
          etiqueta="ODS cubiertos"
          tono={sinCubrir > 8 ? 'vencido' : 'neutro'}
          detalle={sinCubrir ? `${sinCubrir} sin ninguna acción` : 'los diecisiete tienen acción'}
        />
      </div>

      <Tarjeta
        titulo="Cobertura de la Agenda 2030"
        descripcion="Cada barra es un ODS. Las que están en cero son las que no se pueden declarar en ninguna postulación."
      >
        <GraficoBarras
          datos={porODS}
          alto={240}
          series={[
            {
              clave: 'cantidad',
              titulo: 'Acciones',
              colorPorItem: (d) => (d.cantidad === 0 ? 'var(--color-vencido)' : 'var(--color-serie-1)'),
            },
          ]}
        />
      </Tarjeta>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Por organismo o red" descripcion="Con quién se sostiene el vínculo.">
          <GraficoBarras datos={porOrganismo} horizontal anchoEtiqueta={210} alto={Math.max(220, porOrganismo.length * 30)} series={[{ clave: 'cantidad', titulo: 'Acciones' }]} />
        </Tarjeta>
        <Tarjeta titulo="Por país contraparte" descripcion="Dónde está puesto el esfuerzo.">
          <GraficoBarras datos={porPais} horizontal anchoEtiqueta={150} alto={Math.max(220, porPais.length * 30)} series={[{ clave: 'cantidad', titulo: 'Acciones' }]} />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Referencia de los ODS" descripcion="Los diecisiete objetivos de la Agenda 2030, para leer los gráficos de arriba.">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
          {ODS.map((o) => (
            <li key={o.numero} className="flex items-baseline gap-2 text-xs text-gris">
              <span className="tabular w-5 shrink-0 text-right font-semibold text-tinta">{o.numero}</span>
              {o.nombre}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}
