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
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search, Table2 } from 'lucide-react';
import { descargarCSV } from '../datos/csv.js';
import { Boton, Vacio } from './Basicos.jsx';

/**
 * Filas que se pintan de entrada.
 *
 * Con la base cargada de verdad, la lista de compromisos pasa de las
 * novecientas filas: son unos cinco mil nodos de DOM que el navegador rearma
 * ENTEROS con cada tecla de la búsqueda y con cada clic en un encabezado. El
 * tope corta eso sin esconder nada —el contador siempre dice el total, el CSV
 * exporta todo lo filtrado y hay un botón para traer el resto—.
 */
const TOPE_INICIAL = 150;

export function Tabla({
  columnas,
  /**
   * Columnas con las que se exporta, si el archivo tiene que decir más que la
   * pantalla. La tabla maestra de proyectos la usa para que su CSV se pueda
   * volver a importar: en pantalla muestra el avance como porcentaje, pero un
   * archivo que va a volver a entrar necesita la cantidad absoluta y los campos
   * obligatorios que la tabla no dibuja.
   */
  columnasCSV,
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
  /** Sin tope: lo usan las tablas que se imprimen, donde recortar mutila el PDF. */
  sinTope = false,
}) {
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState(ordenInicial ?? null);
  const [tope, setTope] = useState(TOPE_INICIAL);

  /** Texto de una celda tal como se ve, para que la búsqueda encuentre eso. */
  const textoDeCelda = (fila, columna) => {
    const valor = fila[columna.clave];
    // Las fechas se guardan en ISO y se muestran en dd/mm/aaaa: sin esto,
    // buscar «10/08» en una columna de vencimientos no encuentra nada.
    if (columna.formatoCSV) {
      try {
        return String(columna.formatoCSV(valor) ?? '');
      } catch {
        return '';
      }
    }
    return valor === null || valor === undefined ? '' : String(valor);
  };

  const filasFiltradas = useMemo(() => {
    if (!texto.trim()) return filas;
    const t = texto.toLowerCase();
    return filas.filter((f) =>
      columnas.some((c) => {
        const crudo = f[c.clave];
        if (crudo !== null && crudo !== undefined && String(crudo).toLowerCase().includes(t)) return true;
        return textoDeCelda(f, c).toLowerCase().includes(t);
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

  // Cualquier cambio de recorte vuelve a empezar por arriba: si el usuario
  // filtra, lo que quiere ver son las primeras filas del resultado nuevo.
  useEffect(() => {
    setTope(TOPE_INICIAL);
  }, [filas, texto, orden]);

  /**
   * Al imprimir se pinta TODO.
   *
   * El tope es un alivio de render, no un recorte de contenido: una hoja de
   * secretaría o un listado que sale en papel con las filas cortadas —y sin
   * decirlo— es peor que una pantalla lenta. El CSS no puede resolverlo, porque
   * las filas que faltan no están en el DOM.
   */
  useEffect(() => {
    if (sinTope || typeof window === 'undefined') return undefined;
    const expandir = () => setTope(Number.POSITIVE_INFINITY);
    const restaurar = () => setTope(TOPE_INICIAL);

    window.addEventListener('beforeprint', expandir);
    window.addEventListener('afterprint', restaurar);
    // Safari no dispara `beforeprint`: ahí el aviso llega por el media query.
    const consulta = window.matchMedia?.('print');
    const alCambiar = (e) => (e.matches ? expandir() : restaurar());
    consulta?.addEventListener?.('change', alCambiar);

    return () => {
      window.removeEventListener('beforeprint', expandir);
      window.removeEventListener('afterprint', restaurar);
      consulta?.removeEventListener?.('change', alCambiar);
    };
  }, [sinTope]);

  const filasPintadas = sinTope ? filasVisibles : filasVisibles.slice(0, tope);
  const restantes = filasVisibles.length - filasPintadas.length;

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
                // El placeholder no es una etiqueta: desaparece al escribir y no
                // todos los lectores de pantalla lo anuncian.
                aria-label={nombreExport ? `Buscar en ${nombreExport}` : 'Buscar en la tabla'}
                className="campo-base py-1.5 pl-8 text-xs"
              />
            </div>
          )}
          {/* Al buscar o filtrar, este número es la única respuesta que da la
              pantalla. Se anuncia para quien no lo ve cambiar. */}
          <span role="status" aria-live="polite" className="tabular whitespace-nowrap text-xs text-tenue">
            {filasVisibles.length} {filasVisibles.length === 1 ? 'registro' : 'registros'}
          </span>
          {acciones}
          {nombreExport && (
            <Boton
              tamanio="sm"
              icono={Download}
              onClick={() => descargarCSV(nombreExport, filasVisibles, columnasCSV ?? columnas)}
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
                      scope="col"
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
              {filasPintadas.map((fila, i) => (
                <tr
                  key={claveFila(fila, i)}
                  onClick={alHacerClicFila ? () => alHacerClicFila(fila) : undefined}
                  /* Una fila que se abre con el mouse tiene que abrirse con el
                     teclado. Se hace focusable y se atiende Enter y Espacio, en
                     lugar de ponerle `role="button"`: eso la sacaría de la
                     semántica de tabla y el lector de pantalla dejaría de decir
                     en qué fila y columna está. */
                  tabIndex={alHacerClicFila ? 0 : undefined}
                  onKeyDown={
                    alHacerClicFila
                      ? (e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          alHacerClicFila(fila);
                        }
                      : undefined
                  }
                  className={`border-b border-borde/60 last:border-0 ${
                    alHacerClicFila
                      ? 'cursor-pointer transition hover:bg-acento-suave/50 focus:bg-acento-suave/50 focus:outline-2 focus:outline-offset-[-2px] focus:outline-acento'
                      : ''
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

          {restantes > 0 && (
            <div className="no-imprimir flex flex-wrap items-center justify-center gap-2 border-t border-borde bg-paper/60 px-3 py-2">
              <span className="tabular text-xs text-tenue">
                Mostrando {filasPintadas.length} de {filasVisibles.length}
              </span>
              <Boton tamanio="sm" onClick={() => setTope((t) => t + TOPE_INICIAL)}>
                Mostrar {Math.min(restantes, TOPE_INICIAL)} más
              </Boton>
              {restantes > TOPE_INICIAL && (
                <Boton tamanio="sm" variante="fantasma" onClick={() => setTope(filasVisibles.length)}>
                  Mostrar las {filasVisibles.length}
                </Boton>
              )}
            </div>
          )}
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
