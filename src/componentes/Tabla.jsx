/**
 * Tabla con orden, búsqueda y exportación a CSV en el encabezado.
 *
 * Es el componente de listado del sistema entero: la regla «todo listado es
 * exportable» se cumple sola usándolo. La exportación toma las filas VISIBLES
 * (ya filtradas y ordenadas), no la colección completa, para que el CSV
 * coincida con lo que el usuario tiene delante.
 *
 * `columnas`: [{ clave, titulo, ancho?, alinear?, render?, formatoCSV?,
 *               sinExportar?, sinOrdenar?, valorOrden? }]
 */
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search, Table2 } from 'lucide-react';
import { descargarCSV } from '../datos/csv.js';
import { Boton, Vacio } from './Basicos.jsx';

export function Tabla({
  columnas,
  filas,
  nombreExport,
  claveFila = (f, i) => f.id ?? f.id_proyecto ?? i,
  alHacerClicFila,
  conBusqueda = true,
  ordenInicial,
  vacio,
  acciones,
  densidad = 'normal',
  maxAltura,
}) {
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState(ordenInicial ?? null);

  const filasFiltradas = useMemo(() => {
    if (!texto.trim()) return filas;
    const t = texto.toLowerCase();
    return filas.filter((f) =>
      columnas.some((c) => {
        const v = f[c.clave];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(t);
      }),
    );
  }, [filas, texto, columnas]);

  const filasVisibles = useMemo(() => {
    if (!orden) return filasFiltradas;
    const columna = columnas.find((c) => c.clave === orden.clave);
    const extraer = columna?.valorOrden ?? ((f) => f[orden.clave]);
    const factor = orden.direccion === 'asc' ? 1 : -1;
    return [...filasFiltradas].sort((a, b) => {
      const va = extraer(a);
      const vb = extraer(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), 'es') * factor;
    });
  }, [filasFiltradas, orden, columnas]);

  function alternarOrden(clave) {
    setOrden((previo) => {
      if (previo?.clave !== clave) return { clave, direccion: 'asc' };
      if (previo.direccion === 'asc') return { clave, direccion: 'desc' };
      return null;
    });
  }

  const padding = densidad === 'compacta' ? 'px-2.5 py-1.5' : 'px-3 py-2.5';

  return (
    <div className="flex min-h-0 flex-col">
      {(conBusqueda || nombreExport || acciones) && (
        <div className="no-imprimir flex flex-wrap items-center gap-2 border-b border-borde px-3 py-2">
          {conBusqueda && (
            <div className="relative min-w-40 flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tenue" />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar…"
                className="campo-base py-1.5 pl-8 text-xs"
              />
            </div>
          )}
          <span className="tabular whitespace-nowrap text-xs text-tenue">
            {filasVisibles.length} {filasVisibles.length === 1 ? 'registro' : 'registros'}
          </span>
          {acciones}
          {nombreExport && (
            <Boton
              tamanio="sm"
              icono={Download}
              onClick={() => descargarCSV(nombreExport, filasVisibles, columnas)}
              disabled={!filasVisibles.length}
              title="Exportar a CSV lo que se ve en la tabla"
            >
              CSV
            </Boton>
          )}
        </div>
      )}

      {filasVisibles.length === 0 ? (
        vacio ?? (
          <Vacio
            icono={Table2}
            compacto
            titulo={texto ? 'Sin resultados' : 'Sin registros'}
            descripcion={texto ? 'Probá con otro término de búsqueda.' : undefined}
          />
        )
      ) : (
        <div className="scroll-fino min-h-0 overflow-auto" style={maxAltura ? { maxHeight: maxAltura } : undefined}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-paper">
              <tr>
                {columnas.map((c) => {
                  const ordenable = !c.sinOrdenar;
                  const activo = orden?.clave === c.clave;
                  const Icono = !activo ? ChevronsUpDown : orden.direccion === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.clave}
                      style={c.ancho ? { width: c.ancho } : undefined}
                      className={`border-b border-borde ${padding} text-left text-[11px] font-semibold uppercase
                        tracking-wide text-gris ${c.alinear === 'derecha' ? 'text-right' : ''}`}
                    >
                      {ordenable ? (
                        <button
                          type="button"
                          onClick={() => alternarOrden(c.clave)}
                          className={`inline-flex items-center gap-1 transition hover:text-tinta ${
                            activo ? 'text-tinta' : ''
                          } ${c.alinear === 'derecha' ? 'flex-row-reverse' : ''}`}
                        >
                          {c.titulo}
                          <Icono size={11} className={activo ? '' : 'opacity-40'} />
                        </button>
                      ) : (
                        c.titulo
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filasVisibles.map((fila, i) => (
                <tr
                  key={claveFila(fila, i)}
                  onClick={alHacerClicFila ? () => alHacerClicFila(fila) : undefined}
                  className={`border-b border-borde/60 last:border-0 ${
                    alHacerClicFila ? 'cursor-pointer transition hover:bg-acento-suave/50' : ''
                  } ${fila._resaltar ? 'bg-vencido-suave/60' : ''}`}
                >
                  {columnas.map((c) => (
                    <td
                      key={c.clave}
                      className={`${padding} align-middle text-tinta ${c.alinear === 'derecha' ? 'text-right tabular' : ''}`}
                    >
                      {c.render ? c.render(fila) : mostrar(fila[c.clave])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function mostrar(valor) {
  if (valor === null || valor === undefined || valor === '') return <span className="text-tenue">—</span>;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor);
}
