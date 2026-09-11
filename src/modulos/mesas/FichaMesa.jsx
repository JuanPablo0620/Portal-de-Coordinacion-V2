import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CalendarPlus, FolderOpen, Pencil, Trash2 } from 'lucide-react';
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
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import {
  compromisosDeReunion,
  hoyISO,
  proyectoPorId,
  proximaReunionMesa,
  reunionesDe,
  diasHasta,
} from '../../datos/selectores.js';
import { DIAS_PERIODICIDAD } from '../../datos/catalogos.js';
import { fecha as fFecha, textoVencimiento } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { EditarReunion } from './EditarReunion.jsx';
import { configDe } from './tipos.js';

export function FichaMesa({ mesa, atrasada, alVolver, alEditar, alRegistrar, alAgendar }) {
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const cfg = configDe(mesa.tipo);
  const [borrando, setBorrando] = useState(false);
  const [editandoReunion, setEditandoReunion] = useState(null);

  const reuniones = useMemo(() => (bd ? reunionesDe(bd, mesa.id) : []), [bd, mesa.id]);
  const proyectos = useMemo(
    () => (bd ? (mesa.proyectos_vinculados ?? []).map((id) => proyectoPorId(bd, id)).filter(Boolean) : []),
    [bd, mesa.proyectos_vinculados],
  );

  const proxima = useMemo(() => (bd ? proximaReunionMesa(bd, mesa.id, hoy) : null), [bd, mesa.id, hoy]);
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
            <Boton icono={Trash2} onClick={() => setBorrando(true)}>
              Eliminar
            </Boton>
            <Boton icono={CalendarClock} onClick={alAgendar}>
              Agendar reunión
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
              accion={{ texto: 'Agendar reunión', icono: CalendarClock, alHacerClic: alAgendar }}
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

      <Tarjeta
        titulo="Historial de reuniones"
        descripcion="Cada reunión con los compromisos que salieron de ella."
        sinPadding
      >
        {reuniones.length === 0 ? (
          <Vacio
            titulo="Sin reuniones registradas"
            descripcion="Registrá la primera para empezar a llevar el historial de la mesa."
            accion={{ texto: 'Registrar reunión', icono: CalendarPlus, alHacerClic: alRegistrar }}
          />
        ) : (
          <ul className="divide-y divide-borde/60">
            {reuniones.map((r) => (
              <FilaReunion key={r.id} reunion={r} hoy={hoy} bd={bd} alEditar={() => setEditandoReunion(r)} />
            ))}
          </ul>
        )}
      </Tarjeta>

      <ModalConfirmacion
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        alConfirmar={() => {
          acciones.eliminarMesa(mesa.id);
          alVolver();
        }}
        titulo="Eliminar mesa"
        mensaje={`¿Estás seguro? «${mesa.nombre}» deja de aparecer en el listado. No se borra: queda en el historial con su asiento de baja.`}
        textoConfirmar="Eliminar"
        variante="peligro"
      />

      {editandoReunion && (
        <EditarReunion abierto reunion={editandoReunion} alCerrar={() => setEditandoReunion(null)} />
      )}
    </div>
  );
}

/**
 * Una reunión del historial, con sus compromisos adentro.
 *
 * Los compromisos se buscan por `id_reunion_origen` (`compromisosDeReunion`),
 * no por mesa: es lo que permite que cada reunión muestre sólo lo suyo.
 */
function FilaReunion({ reunion, hoy, bd, alEditar }) {
  const navegar = useNavigate();
  const agendada = diasHasta(reunion.fecha, hoy) >= 0;
  const compromisos = useMemo(
    () => (bd ? compromisosDeReunion(bd, reunion.id, hoy) : []),
    [bd, reunion.id, hoy],
  );

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-tinta">{fFecha(reunion.fecha)}</p>
            <Chip tono={agendada ? 'acento' : 'neutro'}>{agendada ? 'agendada' : 'realizada'}</Chip>
          </div>
          {reunion.asistentes && <p className="mt-0.5 text-xs text-gris">Asistentes: {reunion.asistentes}</p>}
          {reunion.temas && <p className="mt-0.5 whitespace-pre-line text-sm text-gris">{reunion.temas}</p>}
        </div>
        <div className="no-imprimir flex shrink-0 gap-1.5">
          {reunion.url_drive ? (
            <Boton
              tamanio="sm"
              icono={FolderOpen}
              onClick={() => window.open(reunion.url_drive, '_blank', 'noopener,noreferrer')}
            >
              Carpeta de Drive
            </Boton>
          ) : (
            <Boton tamanio="sm" icono={FolderOpen} onClick={alEditar}>
              Agregar carpeta
            </Boton>
          )}
          <Boton tamanio="sm" icono={Pencil} onClick={alEditar} aria-label="Editar reunión" />
        </div>
      </div>

      {compromisos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-borde pt-3">
          {compromisos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Semaforo
                nivel={c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes)}
                soloPunto
                texto={c.estado_efectivo}
              />
              <span className="min-w-0 flex-1 text-tinta">{c.descripcion}</span>
              <span className="text-[11px] text-tenue">{c.area}</span>
              {c.fecha_limite && (
                <button
                  type="button"
                  onClick={() => navegar(`/seguimiento?tab=compromisos&compromiso=${c.id}`)}
                  className="text-[11px] text-acento underline-offset-2 hover:underline"
                >
                  vence {fFecha(c.fecha_limite)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
