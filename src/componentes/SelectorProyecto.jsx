/**
 * Selector de proyectos con búsqueda sobre la base maestra.
 *
 * Es el punto donde el resto del sistema se engancha a la tabla maestra: los
 * seguimientos, los temas de monitoreo, las mesas y los eventos referencian
 * proyectos existentes en lugar de volver a nombrarlos. Ahí se sostiene la
 * regla de que ningún dato se carga dos veces.
 */
import { useMemo, useState } from 'react';
import { Check, FolderSearch, Search, X } from 'lucide-react';
import { useBD } from '../estado/tienda.js';
import { proyectos as selProyectos } from '../datos/selectores.js';
import { Chip, Vacio } from './Basicos.jsx';

export function SelectorProyecto({
  valor,
  alCambiar,
  multiple = false,
  etiqueta = 'Proyecto',
  requerido = false,
  ayuda,
  placeholder = 'Buscar por nombre, id o responsable…',
  className = '',
  maxAltura = 220,
}) {
  const bd = useBD();
  const [texto, setTexto] = useState('');

  const seleccionados = useMemo(
    () => (multiple ? (valor ?? []) : valor ? [valor] : []),
    [valor, multiple],
  );

  const todos = useMemo(() => (bd ? selProyectos(bd, {}) : []), [bd]);

  /**
   * Se listan cuarenta como mucho. El tope está bien —la lista es para elegir,
   * no para leer—, pero antes no se decía: con la base cargada el usuario veía
   * cuarenta de doscientos sesenta proyectos sin ninguna señal de que faltaban
   * los otros, y podía concluir que el suyo no estaba cargado.
   */
  const coincidencias = useMemo(() => {
    if (!texto.trim()) return todos;
    const t = texto.toLowerCase();
    return todos.filter((p) =>
      `${p.proyecto} ${p.id_proyecto} ${p.area} ${p.responsable ?? ''}`.toLowerCase().includes(t),
    );
  }, [todos, texto]);

  const filtrados = useMemo(() => coincidencias.slice(0, 40), [coincidencias]);
  const ocultos = coincidencias.length - filtrados.length;

  const mapa = useMemo(() => new Map(todos.map((p) => [p.id_proyecto, p])), [todos]);

  function alternar(id) {
    if (!multiple) {
      alCambiar(valor === id ? '' : id);
      return;
    }
    const actuales = valor ?? [];
    alCambiar(actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]);
  }

  return (
    <div className={className}>
      {etiqueta && (
        <label className="mb-1 block text-xs font-medium text-gris">
          {etiqueta}
          {requerido && <span className="ml-0.5 text-vencido-texto">*</span>}
          {ayuda && <span className="ml-1.5 font-normal text-tenue">{ayuda}</span>}
        </label>
      )}

      {seleccionados.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const p = mapa.get(id);
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-chip border border-acento-medio
                  bg-acento-suave px-2 py-1 text-xs text-acento-fuerte"
              >
                <span className="truncate">{p ? p.proyecto : id}</span>
                <button
                  type="button"
                  onClick={() => alternar(id)}
                  className="shrink-0 opacity-60 transition hover:opacity-100"
                  aria-label={`Quitar ${p?.proyecto ?? id}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-chip border border-borde-fuerte">
        <div className="relative border-b border-borde">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tenue" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={placeholder}
            aria-label={etiqueta ? `Buscar en ${etiqueta.toLowerCase()}` : 'Buscar proyecto'}
            className="w-full bg-card py-2 pl-8 pr-2.5 text-sm text-tinta placeholder:text-tenue focus:outline-2 focus:outline-offset-[-2px] focus:outline-acento"
          />
        </div>

        <div className="scroll-fino overflow-y-auto bg-card" style={{ maxHeight: maxAltura }}>
          {filtrados.length === 0 ? (
            <Vacio
              icono={FolderSearch}
              compacto
              titulo={todos.length ? 'Sin coincidencias' : 'No hay proyectos cargados'}
              descripcion={
                todos.length
                  ? 'Probá con otro término.'
                  : 'Cargá proyectos en la base maestra o usá los datos de demostración.'
              }
            />
          ) : (
            filtrados.map((p) => {
              const elegido = seleccionados.includes(p.id_proyecto);
              return (
                <button
                  key={p.id_proyecto}
                  type="button"
                  onClick={() => alternar(p.id_proyecto)}
                  className={`flex w-full items-center gap-2.5 border-b border-borde/60 px-2.5 py-2 text-left
                    transition last:border-0 hover:bg-paper ${elegido ? 'bg-acento-suave/60' : ''}`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      elegido ? 'border-acento bg-acento text-white' : 'border-borde-fuerte bg-card'
                    }`}
                  >
                    {elegido && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">{p.proyecto}</span>
                    <span className="block truncate text-[11px] text-tenue">
                      {p.id_proyecto} · {p.area}
                    </span>
                  </span>
                  <Chip tono="neutro">{p.porcentaje_avance}%</Chip>
                </button>
              );
            })
          )}
        </div>

        {ocultos > 0 && (
          <p className="border-t border-borde bg-paper/60 px-2.5 py-1.5 text-[11px] text-tenue">
            {filtrados.length} de {coincidencias.length}
            {texto.trim() ? ' coincidencias' : ' proyectos'} · afiná la búsqueda para ver el resto
          </p>
        )}
      </div>
    </div>
  );
}
