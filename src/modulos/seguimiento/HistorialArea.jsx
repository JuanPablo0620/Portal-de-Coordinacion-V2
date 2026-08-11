/**
 * Historial por área: línea de tiempo completa de un área — seguimientos,
 * compromisos cumplidos y pendientes, y evolución del avance de sus proyectos.
 */
import { useMemo } from 'react';
import { Building2, Download } from 'lucide-react';
import {
  BarraAvance,
  Boton,
  Chip,
  EstadoProyecto,
  Metrica,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { descargarCSV } from '../../datos/csv.js';
import { calcularAlertas, filtrarAlertas } from '../../datos/alertas.js';
import { historialArea, hoyISO } from '../../datos/selectores.js';
import { fecha as fFecha, haceCuanto, numero, sufijoArchivo } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';

export function HistorialArea({ bd, filtros, setFiltros }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const area = filtros.area;

  const datos = useMemo(() => (bd && area ? historialArea(bd, area, hoy) : null), [bd, area, hoy]);
  const alertas = useMemo(
    () => (bd && area ? filtrarAlertas(calcularAlertas(bd, hoy), { area }) : []),
    [bd, area, hoy],
  );

  /** Una sola línea de tiempo con todo lo del área, ordenada por fecha. */
  const linea = useMemo(() => {
    if (!datos) return [];
    const eventos = [
      ...datos.seguimientos.map((s) => ({
        clave: `s${s.id}`,
        fecha: s.fecha,
        clase: 'Seguimiento',
        titulo: s.tipo === 'programado' ? 'Seguimiento agendado' : 'Seguimiento realizado',
        detalle: s.resumen || s.temas || `${(s.ids_proyecto ?? []).length} proyecto(s)`,
        extra: s.participantes,
      })),
      ...datos.monitoreos.map((m) => ({
        clave: `m${m.id}`,
        fecha: m.fecha,
        clase: 'Monitoreo',
        titulo: `Monitoreo con ${m.cantidad_temas} tema(s)`,
        detalle: m.criticidad_maxima ? `Criticidad máxima: ${m.criticidad_maxima}` : '',
        extra: '',
      })),
      ...datos.compromisos.map((c) => ({
        clave: `c${c.id}`,
        fecha: c.fecha_limite,
        clase: 'Compromiso',
        titulo: c.descripcion,
        detalle: c.responsable ? `Responsable: ${c.responsable}` : '',
        estado: c.estado_efectivo,
        dias: c.dias_restantes,
        atraso: c.dias_atraso,
      })),
    ];
    return eventos.sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
  }, [datos]);

  if (!area) {
    return (
      <Tarjeta titulo="Historial por área">
        <CampoSelect
          etiqueta="Área"
          opciones={opcionesArea}
          value={area}
          onChange={(e) => setFiltros({ area: e.target.value })}
          placeholder="Elegí un área"
          className="mb-4 max-w-80"
        />
        <Vacio
          icono={Building2}
          titulo="Elegí un área"
          descripcion="Vas a ver su línea de tiempo completa: seguimientos, compromisos cumplidos y pendientes, y la evolución del avance de sus proyectos."
        />
      </Tarjeta>
    );
  }

  const cumplidos = datos.compromisos.filter((c) => c.estado_efectivo === 'cumplido').length;
  const vencidos = datos.compromisos.filter((c) => c.estado_efectivo === 'vencido').length;

  function exportar() {
    descargarCSV(
      `historial-${sufijoArchivo(area)}`,
      linea,
      [
        { clave: 'fecha', titulo: 'Fecha', formatoCSV: fFecha },
        { clave: 'clase', titulo: 'Tipo' },
        { clave: 'titulo', titulo: 'Detalle' },
        { clave: 'detalle', titulo: 'Observación' },
        { clave: 'estado', titulo: 'Estado' },
      ],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Historial por área"
        acciones={
          <Boton tamanio="sm" icono={Download} onClick={exportar}>
            Exportar CSV
          </Boton>
        }
      >
        <CampoSelect
          etiqueta="Área"
          opciones={opcionesArea}
          value={area}
          onChange={(e) => setFiltros({ area: e.target.value })}
          className="max-w-80"
        />
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={datos.proyectos.length} etiqueta="Proyectos" />
        <Metrica valor={datos.seguimientos.length} etiqueta="Seguimientos" />
        <Metrica valor={cumplidos} etiqueta="Compromisos cumplidos" />
        <Metrica valor={vencidos} etiqueta="Compromisos vencidos" tono={vencidos ? 'vencido' : 'neutro'} />
      </div>

      {alertas.length > 0 && (
        <Tarjeta titulo="Alertas activas del área" descripcion="Calculadas por el motor central, las mismas que ve el inicio." sinPadding>
          <ListaAlertas alertas={alertas} limite={8} />
        </Tarjeta>
      )}

      <Tarjeta titulo="Evolución del avance de sus proyectos" sinPadding>
        <Tabla
          nombreExport={`proyectos-${sufijoArchivo(area)}`}
          filas={datos.proyectos}
          claveFila={(f) => f.id_proyecto}
          columnas={[
            { clave: 'id_proyecto', titulo: 'ID', ancho: 120, render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip> },
            { clave: 'proyecto', titulo: 'Proyecto' },
            { clave: 'estado', titulo: 'Estado', ancho: 120, render: (f) => <EstadoProyecto estado={f.estado} /> },
            {
              clave: 'porcentaje_avance',
              titulo: 'Avance',
              ancho: 160,
              render: (f) => (
                <div>
                  <BarraAvance valor={f.porcentaje_avance} />
                  <p className="tabular mt-0.5 text-[11px] text-tenue">
                    {numero(f.avance)} / {numero(f.objetivo)} {f.unidad}
                  </p>
                </div>
              ),
            },
            {
              clave: 'ultima_actualizacion',
              titulo: 'Últ. actualización',
              ancho: 140,
              render: (f) => <span className="text-xs text-gris">{f.ultima_actualizacion ? haceCuanto(f.ultima_actualizacion) : '—'}</span>,
              formatoCSV: (v) => (v ? fFecha(v) : ''),
            },
          ]}
          vacio={<Vacio compacto titulo="El área no tiene proyectos cargados" />}
        />
      </Tarjeta>

      <Tarjeta titulo="Línea de tiempo" descripcion="Seguimientos, monitoreos y compromisos del área, del más reciente al más antiguo.">
        {linea.length === 0 ? (
          <Vacio compacto titulo="Sin movimientos registrados para esta área" />
        ) : (
          <ol className="flex flex-col">
            {linea.slice(0, 40).map((e) => (
              <li key={e.clave} className="flex gap-3 border-b border-borde/60 py-2.5 last:border-0">
                <div className="w-20 shrink-0 pt-0.5 text-right">
                  <p className="tabular text-xs text-tinta">{fFecha(e.fecha)}</p>
                </div>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acento-medio" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tono={e.clase === 'Compromiso' ? 'neutro' : 'acento'}>{e.clase}</Chip>
                    {e.estado && (
                      <Semaforo
                        nivel={e.estado === 'cumplido' ? 'enregla' : nivelPorDias(e.dias)}
                        texto={e.estado === 'vencido' ? `vencido · ${e.atraso} d` : e.estado}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-tight text-tinta">{e.titulo}</p>
                  {e.detalle && <p className="text-[11px] text-tenue">{e.detalle}</p>}
                  {e.extra && <p className="text-[11px] text-tenue">{e.extra}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>
    </div>
  );
}
