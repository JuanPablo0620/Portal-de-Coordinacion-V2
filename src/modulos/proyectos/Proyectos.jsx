import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, FolderKanban, Gem, HardHat } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import {
  BarraAvance,
  Boton,
  Chip,
  EstadoProyecto,
  Prioridad,
  Tarjeta,
  Vacio,
  tonoPorIdProyecto,
} from '../../componentes/Basicos.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { Alternadores, GrillaFiltros, TarjetaFiltros } from '../../componentes/Filtros.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { ESTADOS_PROYECTO, PRIORIDADES } from '../../datos/catalogos.js';
import { COLUMNAS_CSV_PROYECTO } from '../../datos/importacion.js';
import { proyectos as selProyectos, hoyISO } from '../../datos/selectores.js';
import { fecha as fFecha, haceCuanto, moneda, numero } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = {
  area: '',
  programa: '',
  eje: '',
  tipo: '',
  estado: '',
  prioridad: '',
  es_obra: false,
  solo_activos: false,
  solo_prioritarios: false,
  solo_estrategicos: false,
};

export default function Proyectos() {
  const bd = useBD();
  const navegar = useNavigate();
  const [filtros, setFiltros, limpiarFiltros] = useFiltrosUrl(DEFAULTS);
  const [confirmandoDemo, setConfirmandoDemo] = useState(false);

  const opcionesArea = useOpciones('areas');
  const opcionesPrograma = useOpciones('programas');
  const opcionesEje = useOpciones('ejes');
  const opcionesTipo = useOpciones('tipos');

  const filas = useMemo(() => (bd ? selProyectos(bd, filtros) : []), [bd, filtros]);
  const hayProyectos = (bd?.proyectos ?? []).some((p) => p.activo !== false);

  const columnas = [
    {
      clave: 'id_proyecto',
      titulo: 'ID',
      ancho: 130,
      render: (f) => <Chip tono={tonoPorIdProyecto(f.id_proyecto)}>{f.id_proyecto}</Chip>,
    },
    {
      clave: 'proyecto',
      titulo: 'Proyecto',
      render: (f) => (
        <div className="min-w-40">
          <p className="flex items-center gap-1.5 font-medium leading-tight text-tinta">
            {/* El diamante marca la cartera estratégica en la tabla maestra: sin
                esto, la única forma de saber si un proyecto es estratégico era
                abrir su ficha o cambiar de módulo. */}
            {f.estrategico && <Gem size={12} className="shrink-0 text-atencion-texto" aria-label="estratégico" />}
            {f.proyecto}
          </p>
          <p className="text-[11px] text-tenue">{f.programa || 'Sin programa'}</p>
        </div>
      ),
    },
    { clave: 'area', titulo: 'Área', ancho: 180 },
    { clave: 'eje', titulo: 'Eje', ancho: 150 },
    { clave: 'tipo', titulo: 'Tipo', ancho: 120 },
    { clave: 'estado', titulo: 'Estado', ancho: 120, render: (f) => <EstadoProyecto estado={f.estado} /> },
    { clave: 'prioridad', titulo: 'Prioridad', ancho: 95, render: (f) => <Prioridad nivel={f.prioridad} /> },
    {
      clave: 'porcentaje_avance',
      titulo: 'Avance',
      ancho: 150,
      render: (f) => (
        <div>
          <BarraAvance valor={f.porcentaje_avance} />
          <p className="tabular mt-0.5 text-[11px] text-tenue">
            {numero(f.avance)} / {numero(f.objetivo)} {f.unidad}
          </p>
        </div>
      ),
    },
    { clave: 'responsable', titulo: 'Responsable', ancho: 130 },
    {
      clave: 'fecha_fin_prevista',
      titulo: 'Fin previsto',
      ancho: 110,
      render: (f) => <span className="tabular text-xs">{fFecha(f.fecha_fin_prevista)}</span>,
      formatoCSV: (v) => fFecha(v),
    },
    {
      clave: 'ultima_actualizacion',
      titulo: 'Últ. actualización',
      ancho: 130,
      render: (f) => <span className="text-xs text-gris">{f.ultima_actualizacion ? haceCuanto(f.ultima_actualizacion) : '—'}</span>,
      formatoCSV: (v) => (v ? fFecha(v) : ''),
    },
    {
      clave: 'monto_planificado',
      titulo: 'Planificado',
      ancho: 120,
      alinear: 'derecha',
      render: (f) => <span className="text-xs">{moneda(f.monto_planificado)}</span>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Base maestra de proyectos"
        descripcion="Consultá y filtrá lo que ya está cargado. La carga se hace desde Planificación → Proyectos del POA."
      />

      <Pagina className="flex flex-col gap-4">
        <TarjetaFiltros filtros={filtros} defaults={DEFAULTS} alLimpiar={limpiarFiltros}>
          <GrillaFiltros columnas={6}>
            <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
            <CampoSelect etiqueta="Programa" opciones={opcionesPrograma} value={filtros.programa} onChange={(e) => setFiltros({ programa: e.target.value })} placeholder="Todos" />
            <CampoSelect etiqueta="Eje" opciones={opcionesEje} value={filtros.eje} onChange={(e) => setFiltros({ eje: e.target.value })} placeholder="Todos" />
            <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={filtros.tipo} onChange={(e) => setFiltros({ tipo: e.target.value })} placeholder="Todos" />
            <CampoSelect etiqueta="Estado" opciones={ESTADOS_PROYECTO} value={filtros.estado} onChange={(e) => setFiltros({ estado: e.target.value })} placeholder="Todos" />
            <CampoSelect etiqueta="Prioridad" opciones={PRIORIDADES} value={filtros.prioridad} onChange={(e) => setFiltros({ prioridad: e.target.value })} placeholder="Todas" />
          </GrillaFiltros>
          <Alternadores
            filtros={filtros}
            setFiltros={setFiltros}
            opciones={[
              ['solo_activos', 'Sólo activos'],
              ['es_obra', 'Sólo obras'],
              ['solo_prioritarios', 'Sólo prioritarios'],
              ['solo_estrategicos', 'Sólo estratégicos'],
            ]}
          >
            {filtros.es_obra && (
              <Boton
                tamanio="sm"
                variante="fantasma"
                icono={HardHat}
                onClick={() => navegar('/obras')}
                title="Mapa, desagregado por zona y alertas de obras"
              >
                Ver en el módulo de Obras
              </Boton>
            )}
          </Alternadores>
        </TarjetaFiltros>

        <Tarjeta sinPadding className="min-h-0">
          <Tabla
            columnas={columnas}
            // El CSV de la base maestra lleva los campos del modelo, no los de
            // la pantalla: es el archivo que se edita en planilla y se vuelve a
            // importar, así que tiene que traer todo lo obligatorio.
            columnasCSV={COLUMNAS_CSV_PROYECTO}
            filas={filas}
            nombreExport="proyectos"
            claveFila={(f) => f.id_proyecto}
            alHacerClicFila={(f) => navegar(`/proyectos/${f.id_proyecto}`)}
            ordenInicial={{ clave: 'id_proyecto', direccion: 'asc' }}
            vacio={
              hayProyectos ? undefined : (
                <Vacio
                  icono={FolderKanban}
                  titulo="La base maestra está vacía"
                  descripcion="La carga de proyectos del POA se hace desde Planificación, o usá los datos de demostración para ver el sistema funcionando."
                  accion={{
                    texto: 'Ir a cargar proyectos',
                    icono: FolderKanban,
                    alHacerClic: () => navegar('/planificacion?tab=proyectos'),
                  }}
                />
              )
            }
            acciones={
              !hayProyectos ? null : (
                <Boton
                  tamanio="sm"
                  variante="fantasma"
                  icono={Database}
                  onClick={() => setConfirmandoDemo(true)}
                  title="Reemplaza el contenido por un set de prueba"
                >
                  Demo
                </Boton>
              )
            }
          />
        </Tarjeta>
      </Pagina>

      {/* La carga de la demo BORRA todo lo cargado. Acá se disparaba con un
          solo clic, sin preguntar, al lado de la tabla de trabajo: el mismo
          botón que en Configuración pide confirmación. */}
      <ModalConfirmacion
        abierto={confirmandoDemo}
        alCerrar={() => setConfirmandoDemo(false)}
        alConfirmar={() => acciones.cargarDemo(hoyISO())}
        titulo="Cargar datos de demostración"
        mensaje="Se reemplaza todo el contenido actual del sistema por un set de prueba: proyectos, seguimientos, compromisos, monitoreos, mesas, eventos y bitácora. Lo que hayas cargado se pierde. ¿Confirmás?"
        textoConfirmar="Cargar demostración"
        variante="peligro"
      />
    </>
  );
}
