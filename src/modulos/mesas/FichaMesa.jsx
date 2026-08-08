import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Pencil } from 'lucide-react';
import {
  BarraAvance,
  Boton,
  Chip,
  EstadoProyecto,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { compromisos as selCompromisos, hoyISO, proyectoPorId, reunionesDe, diasHasta } from '../../datos/selectores.js';
import { DIAS_PERIODICIDAD } from '../../datos/catalogos.js';
import { fecha as fFecha, numero, textoVencimiento } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { CONFIG_TIPO } from './Mesas.jsx';

export function FichaMesa({ mesa, atrasada, alVolver, alEditar, alRegistrar }) {
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const cfg = CONFIG_TIPO[mesa.tipo] ?? CONFIG_TIPO['temática'];

  const reuniones = useMemo(() => (bd ? reunionesDe(bd, mesa.id) : []), [bd, mesa.id]);
  // Los compromisos de la mesa se leen de la lista GENERAL filtrando por origen:
  // no hay una colección paralela por mesa.
  const compromisos = useMemo(
    () => (bd ? selCompromisos(bd, { origen_tipo: 'mesa', id_origen: mesa.id }, hoy) : []),
    [bd, mesa.id, hoy],
  );
  const proyectos = useMemo(
    () => (bd ? (mesa.proyectos_vinculados ?? []).map((id) => proyectoPorId(bd, id)).filter(Boolean) : []),
    [bd, mesa.proyectos_vinculados],
  );

  const proxima = reuniones.filter((r) => diasHasta(r.fecha, hoy) >= 0).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const pasadas = reuniones.filter((r) => diasHasta(r.fecha, hoy) < 0);
  const limite = DIAS_PERIODICIDAD[mesa.periodicidad];
  const diasSinReunion = pasadas[0] ? Math.abs(diasHasta(pasadas[0].fecha, hoy)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="tarjeta border-l-4 p-4" style={{ borderLeftColor: cfg.color }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Chip tono="neutro">{cfg.titulo}</Chip>
              <Chip tono={mesa.estado === 'activa' ? 'enregla' : mesa.estado === 'latente' ? 'atencion' : 'neutro'}>
                {mesa.estado}
              </Chip>
              <Chip tono="neutro">{mesa.periodicidad}</Chip>
              {atrasada && (
                <Chip tono="vencido">
                  Sin reunión hace {diasSinReunion} días (esperado: cada {limite})
                </Chip>
              )}
            </div>
            <h2 className="text-base font-semibold text-tinta">{mesa.nombre}</h2>
            <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-gris">{mesa.descripcion || 'Sin descripción'}</p>
            <p className="mt-1 text-xs text-tenue">Referente: {mesa.referente || '—'}</p>
          </div>
          <div className="no-imprimir flex flex-wrap gap-2">
            <Boton icono={ArrowLeft} onClick={alVolver}>
              Volver
            </Boton>
            <Boton icono={Pencil} onClick={alEditar}>
              Editar
            </Boton>
            <Boton variante="primario" icono={CalendarPlus} onClick={alRegistrar}>
              Registrar reunión
            </Boton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Tarjeta titulo="Próxima reunión" descripcion="Se refleja en el calendario del inicio.">
          {proxima ? (
            <div className="flex items-center gap-3">
              <div className="w-14 shrink-0 rounded-chip bg-acento-suave py-2 text-center">
                <p className="tabular text-lg font-semibold leading-none text-acento-fuerte">{proxima.fecha.slice(8, 10)}</p>
                <p className="text-[10px] uppercase text-acento">{MES_CORTO[Number(proxima.fecha.slice(5, 7)) - 1]}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-tinta">{fFecha(proxima.fecha)}</p>
                <p className="text-xs text-gris">{textoVencimiento(diasHasta(proxima.fecha, hoy))}</p>
                {proxima.temas && <p className="mt-0.5 truncate text-[11px] text-tenue">{proxima.temas}</p>}
              </div>
            </div>
          ) : (
            <Vacio
              compacto
              titulo="Sin próxima reunión agendada"
              accion={{ texto: 'Registrar reunión', icono: CalendarPlus, alHacerClic: alRegistrar }}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo="Proyectos vinculados" sinPadding className="xl:col-span-2">
          {proyectos.length === 0 ? (
            <Vacio compacto titulo="Sin proyectos vinculados" descripcion="Editá la mesa para vincular proyectos de la base maestra." />
          ) : (
            <ul className="divide-y divide-borde/60">
              {proyectos.map((p) => (
                <li key={p.id_proyecto}>
                  <button
                    type="button"
                    onClick={() => navegar(`/proyectos/${p.id_proyecto}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-paper"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-tight text-tinta">{p.proyecto}</p>
                      <p className="truncate text-[11px] text-tenue">
                        {p.id_proyecto} · {p.area}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <BarraAvance valor={p.porcentaje_avance} />
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <EstadoProyecto estado={p.estado} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Historial de reuniones" sinPadding>
        <Tabla
          nombreExport={`reuniones-${mesa.nombre.replace(/\s+/g, '-').toLowerCase()}`}
          filas={reuniones}
          conBusqueda={false}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 110, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
            { clave: 'asistentes', titulo: 'Asistentes', ancho: 260 },
            { clave: 'temas', titulo: 'Temas' },
            {
              clave: 'cuando',
              titulo: '',
              ancho: 120,
              sinOrdenar: true,
              sinExportar: true,
              render: (f) =>
                diasHasta(f.fecha, hoy) >= 0 ? <Chip tono="acento">agendada</Chip> : <span className="text-[11px] text-tenue">realizada</span>,
            },
          ]}
          vacio={
            <Vacio
              titulo="Sin reuniones registradas"
              descripcion="Registrá la primera para empezar a llevar el historial de la mesa."
              accion={{ texto: 'Registrar reunión', icono: CalendarPlus, alHacerClic: alRegistrar }}
            />
          }
        />
      </Tarjeta>

      <Tarjeta
        titulo="Compromisos generados en la mesa"
        descripcion="Son los mismos de la lista general del módulo Seguimiento, filtrados por origen."
        sinPadding
      >
        <Tabla
          nombreExport={`compromisos-mesa-${mesa.nombre.replace(/\s+/g, '-').toLowerCase()}`}
          filas={compromisos}
          conBusqueda={false}
          columnas={[
            { clave: 'descripcion', titulo: 'Compromiso' },
            { clave: 'responsable', titulo: 'Responsable', ancho: 140 },
            { clave: 'area', titulo: 'Área', ancho: 180 },
            { clave: 'fecha_limite', titulo: 'Vence', ancho: 100, render: (f) => fFecha(f.fecha_limite), formatoCSV: fFecha },
            {
              clave: 'estado_efectivo',
              titulo: 'Estado',
              ancho: 140,
              render: (f) => (
                <Semaforo
                  nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
                  texto={f.estado_efectivo === 'vencido' ? `vencido · ${f.dias_atraso} d` : f.estado_efectivo}
                />
              ),
            },
          ]}
          vacio={<Vacio compacto titulo="Sin compromisos generados en esta mesa" />}
        />
      </Tarjeta>
    </div>
  );
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
