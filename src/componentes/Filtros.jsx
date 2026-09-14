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
import { useId, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Boton, BotonAlternable, Chip, Tarjeta } from './Basicos.jsx';
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
 * @param {boolean} desplegable  arranca plegada, en una sola línea. Ver abajo.
 */
export function TarjetaFiltros({
  filtros,
  defaults = {},
  claves,
  alLimpiar,
  titulo = 'Filtros',
  descripcion = DESCRIPCION_POR_DEFECTO,
  acciones,
  desplegable = false,
  children,
}) {
  const aplicables = claves ? Object.fromEntries(claves.map((c) => [c, filtros[c]])) : filtros;
  const cantidad = contarFiltros(aplicables, defaults);

  const botonLimpiar = cantidad > 0 && alLimpiar && (
    <Boton tamanio="sm" variante="fantasma" icono={X} onClick={alLimpiar}>
      Limpiar ({cantidad})
    </Boton>
  );

  if (desplegable) {
    return (
      <FiltrosPlegables
        titulo={titulo}
        descripcion={descripcion}
        cantidad={cantidad}
        acciones={acciones}
        botonLimpiar={botonLimpiar}
      >
        {children}
      </FiltrosPlegables>
    );
  }

  return (
    <Tarjeta
      titulo={titulo}
      descripcion={descripcion}
      acciones={
        (acciones || botonLimpiar) && (
          <>
            {acciones}
            {botonLimpiar}
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">{children}</div>
    </Tarjeta>
  );
}

/**
 * La misma tarjeta, plegada hasta que alguien la abre.
 *
 * Por qué existe: en Monitoreo los filtros ocupan tres bloques —área, período
 * y alternadores— y quedan arriba de todo, así que al entrar lo primero que se
 * ve es el panel de filtros y hay que bajar para llegar a los datos. La mayor
 * parte de las visitas no toca ningún filtro.
 *
 * Plegada NO esconde estado. Si hay filtros puestos, el encabezado dice cuántos
 * y deja el botón de limpiar a mano: una lista filtrada que parece completa es
 * peor que una tarjeta grande. Por eso el contador va en la línea plegada y no
 * adentro.
 *
 * El estado abierto/cerrado es local y no se recuerda entre visitas:
 * persistirlo obligaría a pasar por la capa de datos —el único lugar del repo
 * autorizado a guardar en el navegador, ver `npm run verificar`— y no vale
 * abrir ese camino para una preferencia de una pantalla. Los filtros en sí sí
 * se conservan: viven en la URL (`useFiltrosUrl`), que es lo que importa para
 * compartir la vista.
 */
function FiltrosPlegables({ titulo, descripcion, cantidad, acciones, botonLimpiar, children }) {
  const [abierta, setAbierta] = useState(false);
  const idPanel = useId();

  return (
    <section className="tarjeta bloque-reporte flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* El título sigue siendo un `h2` como en `Tarjeta`, con el botón
            adentro: es el patrón de «disclosure» accesible y, además, sacarlo
            de la cadena de encabezados dejaba a /monitoreo saltando de h1 a h3
            (lo levanta la auditoría de `npm run verificar`). */}
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            aria-controls={idPanel}
            className="flex w-full items-center gap-2 text-left"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-gris" aria-hidden="true" />
            <span className="text-sm font-semibold text-tinta">{titulo}</span>
            {cantidad > 0 && (
              <Chip tono="acento">
                {cantidad} aplicado{cantidad === 1 ? '' : 's'}
              </Chip>
            )}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gris transition-transform ${abierta ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {acciones}
          {botonLimpiar}
        </div>
      </div>

      {/* `hidden` en vez de desmontar: los campos de adentro conservan su
          estado al plegar y desplegar, y el contenido queda en el DOM para
          buscarlo con Ctrl+F.

          Las clases de layout van SÓLO cuando está abierta, y no es un
          detalle de estilo: Tailwind declara `[hidden]` con `:where()`, que no
          suma especificidad, así que `.flex` —que vale lo mismo y se declara
          después— le gana y el panel se queda visible aunque `hidden` esté
          puesto. Con la clase condicionada no hay pelea posible. */}
      <div
        id={idPanel}
        hidden={!abierta}
        className={abierta ? 'flex flex-col gap-3 border-t border-borde px-4 py-3' : undefined}
      >
        {descripcion && <p className="text-xs text-gris">{descripcion}</p>}
        {children}
      </div>
    </section>
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
