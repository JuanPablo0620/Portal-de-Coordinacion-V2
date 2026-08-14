/**
 * ─────────────────────────────────────────────────────────────────────
 * TARJETA DE FILTROS — una sola forma para todos los módulos.
 *
 * La base maestra tenía filtros con contador y botón de limpiar; los
 * compromisos tenían filtros sin contador y con un botón de limpiar propio;
 * monitoreo tenía un `<select>` suelto adentro de una tarjeta llamada
 * «Filtros», y el tablero de secretarías tenía un buscador dentro de una
 * tarjeta llamada «Período». Cuatro pantallas que hacen lo mismo y se ven
 * distinto: el usuario tiene que aprender cada una por separado.
 *
 * Acá vive la forma única. La regla de la que sale el contador —«filtro
 * aplicado es el que difiere del valor por defecto»— es la misma de
 * `contarFiltros`, así que el número del botón y lo que efectivamente se filtra
 * no pueden separarse.
 * ─────────────────────────────────────────────────────────────────────
 */
import { X } from 'lucide-react';
import { Boton, BotonAlternable, Tarjeta } from './Basicos.jsx';
import { contarFiltros } from '../utilidades/filtrosUrl.js';

const DESCRIPCION_POR_DEFECTO =
  'Se reflejan en la dirección: podés compartir esta vista pegando el enlace.';

/**
 * @param {object} filtros    valores vigentes
 * @param {object} defaults   valores por defecto, para contar lo aplicado
 * @param {string[]} claves   qué claves son FILTROS. En un módulo con pestañas,
 *   `tab` vive en el mismo objeto y difiere del valor por defecto en cuanto el
 *   usuario cambia de solapa: sin esta lista, el botón anunciaba «Limpiar (1)»
 *   sobre una pantalla sin ningún filtro puesto.
 * @param {Function} alLimpiar  vuelve a los valores por defecto; sin esto no se
 *   dibuja el botón, que es lo correcto donde limpiar no tiene sentido
 */
export function TarjetaFiltros({
  filtros,
  defaults = {},
  claves,
  alLimpiar,
  titulo = 'Filtros',
  descripcion = DESCRIPCION_POR_DEFECTO,
  acciones,
  children,
}) {
  const aplicables = claves ? Object.fromEntries(claves.map((c) => [c, filtros[c]])) : filtros;
  const cantidad = contarFiltros(aplicables, defaults);
  return (
    <Tarjeta
      titulo={titulo}
      descripcion={descripcion}
      acciones={
        (acciones || (cantidad > 0 && alLimpiar)) && (
          <>
            {acciones}
            {cantidad > 0 && alLimpiar && (
              <Boton tamanio="sm" variante="fantasma" icono={X} onClick={alLimpiar}>
                Limpiar ({cantidad})
              </Boton>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">{children}</div>
    </Tarjeta>
  );
}

const COLUMNAS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

export function GrillaFiltros({ columnas = 4, children, className = '' }) {
  return <div className={`grid grid-cols-1 gap-3 ${COLUMNAS[columnas] ?? COLUMNAS[4]} ${className}`}>{children}</div>;
}

/**
 * Fila de interruptores booleanos.
 *
 * `opciones` es `[[clave, título, ayuda?]]`. El estado sale de `filtros[clave]`,
 * así que un interruptor nuevo es una línea y no puede quedar desconectado del
 * contador de la tarjeta.
 */
export function Alternadores({ opciones, filtros, setFiltros, children }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opciones.map(([clave, titulo, ayuda]) => (
        <BotonAlternable
          key={clave}
          activo={Boolean(filtros[clave])}
          title={ayuda}
          onClick={() => setFiltros({ [clave]: !filtros[clave] })}
        >
          {titulo}
        </BotonAlternable>
      ))}
      {children}
    </div>
  );
}

/**
 * Limpiador para módulos con pestañas.
 *
 * `limpiar()` del hook borra la URL entera, incluida la pestaña abierta: en la
 * base maestra da lo mismo, pero en monitoreo o en obras el usuario aprieta
 * «Limpiar» y además de los filtros pierde la pestaña donde estaba. Esto
 * devuelve a los valores por defecto SÓLO las claves de filtro que se le pasan.
 */
export function limpiarClaves(setFiltros, defaults, claves) {
  setFiltros(Object.fromEntries(claves.map((c) => [c, defaults[c] ?? ''])));
}
