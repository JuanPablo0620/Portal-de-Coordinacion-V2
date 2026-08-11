import { useMemo, useState } from 'react';
import { CalendarPlus, Pencil, Plus } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Pestanias, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { FichaMesa } from './FichaMesa.jsx';
import { FormularioMesa } from './FormularioMesa.jsx';
import { RegistrarReunion } from './RegistrarReunion.jsx';
import { CONFIG_TIPO, configDe } from './tipos.js';
import { TIPOS_MESA } from '../../datos/catalogos.js';
import { hoyISO, mesas as selMesas, mesasSinReunion } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

/**
 * La separación por tipo es ESTRUCTURAL, no un filtro: cada tipo tiene su
 * pestaña y su color. Es criterio de aceptación que se vean separadas sin que
 * el usuario tenga que aplicar nada.
 */
const DEFAULTS = { tipo: 'temática', mesa: '' };

export default function Mesas() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [registrando, setRegistrando] = useState(null);

  const todas = useMemo(() => (bd ? selMesas(bd, {}) : []), [bd]);
  const atrasadas = useMemo(() => (bd ? new Set(mesasSinReunion(bd, hoy).map((m) => m.id)) : new Set()), [bd, hoy]);

  const pestanias = TIPOS_MESA.map((tipo) => ({
    valor: tipo,
    titulo: CONFIG_TIPO[tipo].titulo,
    icono: CONFIG_TIPO[tipo].icono,
    color: CONFIG_TIPO[tipo].color,
    cantidad: todas.filter((m) => m.tipo === tipo).length,
  }));

  const delTipo = todas.filter((m) => m.tipo === filtros.tipo);
  const cfg = configDe(filtros.tipo);
  const mesaAbierta = filtros.mesa ? todas.find((m) => m.id === filtros.mesa) : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Mesas de trabajo"
        descripcion="Mesas temáticas, barriales y otros proyectos, con su historial de reuniones y compromisos."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFormulario({ tipo: filtros.tipo })}>
            Nueva mesa
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tipo} alCambiar={(v) => setFiltros({ tipo: v, mesa: '' })} />

        {mesaAbierta ? (
          <FichaMesa
            mesa={mesaAbierta}
            atrasada={atrasadas.has(mesaAbierta.id)}
            alVolver={() => setFiltros({ mesa: '' })}
            alEditar={() => setFormulario(mesaAbierta)}
            alRegistrar={() => setRegistrando(mesaAbierta)}
          />
        ) : (
          <>
            <div
              className="flex items-center gap-2.5 rounded-card border-l-4 bg-card px-4 py-2.5"
              style={{ borderColor: cfg.color }}
            >
              <cfg.icono size={17} style={{ color: cfg.color }} />
              <div>
                <p className="text-sm font-semibold text-tinta">Mesas {cfg.titulo.toLowerCase()}</p>
                <p className="text-xs text-gris">{cfg.descripcion}</p>
              </div>
            </div>

            {delTipo.length === 0 ? (
              <Tarjeta>
                <Vacio
                  icono={cfg.icono}
                  titulo={`Sin mesas ${cfg.titulo.toLowerCase()}`}
                  descripcion="Creá la primera para registrar sus reuniones, sus compromisos y sus proyectos vinculados."
                  accion={{ texto: 'Nueva mesa', icono: Plus, alHacerClic: () => setFormulario({ tipo: filtros.tipo }) }}
                />
              </Tarjeta>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {delTipo.map((m) => (
                  <TarjetaMesa
                    key={m.id}
                    mesa={m}
                    color={cfg.color}
                    atrasada={atrasadas.has(m.id)}
                    alAbrir={() => setFiltros({ mesa: m.id })}
                    alRegistrar={() => setRegistrando(m)}
                    alEditar={() => setFormulario(m)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Pagina>

      {formulario && <FormularioMesa abierto alCerrar={() => setFormulario(null)} mesa={formulario.id ? formulario : null} tipoInicial={formulario.tipo} />}
      {registrando && <RegistrarReunion abierto alCerrar={() => setRegistrando(null)} mesa={registrando} />}
    </>
  );
}

function TarjetaMesa({ mesa, color, atrasada, alAbrir, alRegistrar, alEditar }) {
  const TONO_ESTADO = { activa: 'enregla', latente: 'atencion', cerrada: 'neutro' };
  return (
    <article className="tarjeta flex flex-col overflow-hidden border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={alAbrir} className="min-w-0 text-left">
            {/* h2 y no h3: cada tarjeta de mesa cuelga directamente del título
                de la página, sin una sección intermedia. Saltar un nivel rompe
                la navegación por encabezados de un lector de pantalla. */}
            <h2 className="truncate text-sm font-semibold text-tinta hover:text-acento">{mesa.nombre}</h2>
          </button>
          <button
            type="button"
            onClick={alEditar}
            className="shrink-0 rounded p-1 text-tenue transition hover:bg-paper hover:text-tinta"
            aria-label="Editar mesa"
          >
            <Pencil size={13} />
          </button>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-gris">{mesa.descripcion || 'Sin descripción'}</p>

        <div className="flex flex-wrap gap-1.5">
          <Chip tono={TONO_ESTADO[mesa.estado] ?? 'neutro'}>{mesa.estado}</Chip>
          <Chip tono="neutro">{mesa.periodicidad}</Chip>
          {atrasada && <Chip tono="vencido">Sin reunión en su período</Chip>}
        </div>

        <dl className="mt-auto flex flex-col gap-0.5 pt-2 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-tenue">Referente</dt>
            <dd className="truncate text-tinta">{mesa.referente || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tenue">Última reunión</dt>
            <dd className="tabular text-tinta">{mesa.ultima_reunion ? fFecha(mesa.ultima_reunion) : 'sin registro'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tenue">Reuniones</dt>
            <dd className="tabular text-tinta">{mesa.cantidad_reuniones}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-tenue">Proyectos vinculados</dt>
            <dd className="tabular text-tinta">{(mesa.proyectos_vinculados ?? []).length}</dd>
          </div>
        </dl>
      </div>

      <footer className="flex gap-2 border-t border-borde bg-paper px-3 py-2">
        <Boton tamanio="sm" variante="fantasma" onClick={alAbrir} className="flex-1">
          Ver ficha
        </Boton>
        <Boton tamanio="sm" icono={CalendarPlus} onClick={alRegistrar}>
          Reunión
        </Boton>
      </footer>
    </article>
  );
}
