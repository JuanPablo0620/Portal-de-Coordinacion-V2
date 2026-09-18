/**
 * Carga de un seguimiento realizado.
 *
 * El orden de la pantalla sigue el orden real del trabajo: primero de qué
 * reunión se trata y después los campos (compromisos, avances, problemas). Nada se
 * persiste hasta confirmar: recién ahí se escriben seguimiento y compromisos.
 * El paso «Lo conversado» (texto crudo + transferencia) se sacó del front el
 * 18/09/2026; `separarMinuta` y `Transferencia` siguen existiendo por si se
 * los reincorpora.
 *
 * A qué proyecto pertenece cada cosa es una decisión de CADA FILA —compromiso,
 * avance o problema—, no del seguimiento entero (20/08/2026, a pedido de JP):
 * "hablar con Sistemas porque un CAPS no tiene internet" no es de ningún
 * proyecto, y "hablar con Legales por el suministro" sí es del túnel Hornos.
 * Por eso no hay un selector de "proyectos tratados" en la sección 1: cada
 * fila de las tres listas de la sección 2 tiene su propio selector opcional de
 * proyecto (24/08/2026), acotado a los proyectos del ÁREA elegida en la
 * sección 1 —no tiene sentido ofrecer un proyecto de Salud en un seguimiento
 * de Trabajo y Producción—. `seguimientos_proyectos` —para que el historial
 * de un proyecto siga mostrando sus seguimientos— se arma solo, derivado de a
 * qué proyectos terminó vinculada alguna fila de la carga.
 */
import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Aviso, Boton, Chip, Semaforo, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoHora, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorUnidad } from '../../componentes/SelectorUnidad.jsx';
import { hoyISO, proyectos as selProyectos } from '../../datos/selectores.js';
import { numero } from '../../utilidades/formato.js';
import { sumarDias } from '../../datos/tiempo.js';
import { UMBRALES } from '../../datos/catalogos.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

const nuevaClave = () => Math.random().toString(36).slice(2);

/**
 * Un compromiso nuevo nace con fecha límite en el PRÓXIMO seguimiento.
 *
 * No es un default de conveniencia: es la regla de gestión (ver «Seguimiento»
 * en el glosario). Los seguimientos son cada seis semanas, y salvo que alguien
 * elija otra fecha, un compromiso se revisa en el siguiente. El que carga puede
 * cambiarla, pero no puede dejarla vacía — sin fecha límite el compromiso nunca
 * pasa a `alerta` y queda pendiente para siempre, que es exactamente lo que
 * pasó con los compromisos históricos de los `_db`.
 */
const filaCompromisoVacia = (fechaSeguimiento) => ({
  clave: nuevaClave(),
  descripcion: '',
  id_subsecretaria: '',
  id_direccion: '',
  fecha_limite: sumarDias(fechaSeguimiento, UMBRALES.DIAS_ENTRE_SEGUIMIENTOS),
  id_proyecto: '',
});

// `avance`: sólo lo usa el bloque "Avances informados" (`conAvance` en
// BloqueTexto) — un número nuevo para el proyecto elegido en esa fila,
// independiente de la nota de texto. En "Problemas / trabas" queda sin uso.
const filaTextoVacia = () => ({ clave: nuevaClave(), descripcion: '', id_proyecto: '', avance: '' });

export function CargarSeguimiento({ alTerminar }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');

  const [area, setArea] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState('');
  const [participantes, setParticipantes] = useState('');

  const [compromisos, setCompromisos] = useState([]);
  const [avances, setAvances] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const hayCampos = compromisos.length + avances.length + problemas.length > 0;

  function validar() {
    if (!area) return 'Elegí el área.';
    if (!fecha) return 'Indicá la fecha del seguimiento.';
    // Validación §8.6: las fechas límite no pueden ser anteriores a la carga.
    for (const c of compromisos) {
      if (!c.descripcion.trim()) continue;
      // Obligatoria: sin fecha límite el compromiso no puede pasar nunca a
      // `alerta` y queda pendiente para siempre. Es el agujero por el que se
      // colaron los compromisos arrastrados de los `_db`.
      if (!c.fecha_limite) {
        return `Falta la fecha límite de «${c.descripcion.slice(0, 40)}…».`;
      }
      if (c.fecha_limite < hoy) {
        return `La fecha límite de «${c.descripcion.slice(0, 40)}…» es anterior a hoy.`;
      }
    }
    return '';
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const avancesAGuardar = avances.filter((a) => a.descripcion.trim());
      // El número de avance viaja en la misma fila que la nota de texto,
      // pero es independiente de ella: una fila puede traer sólo el número,
      // sólo el texto, o los dos.
      const avancesProyectoAGuardar = avances.filter(
        (a) => a.id_proyecto && a.avance !== '' && !Number.isNaN(Number(a.avance)),
      );
      const problemasAGuardar = problemas.filter((p) => p.descripcion.trim());

      // A qué proyectos "tocó" este seguimiento se deriva de a cuáles quedó
      // vinculada alguna fila —compromiso, avance, problema o actualización
      // de avance—, no es una declaración aparte. Así el historial de un
      // proyecto sigue mostrando el seguimiento sin que haga falta aclarar
      // de entrada de qué proyectos se habla.
      const idsProyectoDerivados = [
        ...new Set(
          [...compromisos, ...avancesAGuardar, ...problemasAGuardar, ...avancesProyectoAGuardar]
            .map((f) => f.id_proyecto)
            .filter(Boolean),
        ),
      ];

      // Guardar una minuta son varias escrituras —el seguimiento y sus
      // compromisos— que para quien carga son un solo acto. En lote se
      // persiste una vez y la pantalla no se repinta con la minuta a medio
      // guardar.
      await acciones.enLote(async () => {
        const seguimiento = await acciones.crearSeguimiento({
          ids_proyecto: idsProyectoDerivados,
          area,
          fecha,
          hora,
          tipo: 'realizado',
          participantes,
          temas: '',
          texto_crudo: '',
          resumen: avancesAGuardar[0]?.descripcion ?? '',
          avances: avancesAGuardar,
          problemas: problemasAGuardar,
        });

        const aCrear = compromisos
          .filter((c) => c.descripcion.trim())
          .map((c) => ({
            origen_tipo: 'seguimiento',
            id_origen: seguimiento.id,
            id_proyecto: c.id_proyecto || null,
            area,
            id_subsecretaria: c.id_subsecretaria || null,
            id_direccion: c.id_direccion || null,
            descripcion: c.descripcion.trim(),
            fecha_limite: c.fecha_limite || null,
          }));
        if (aCrear.length) await acciones.crearCompromisos(aCrear);

        for (const a of avancesProyectoAGuardar) {
          await acciones.actualizarProyecto(a.id_proyecto, { avance: Number(a.avance) });
        }
      });

      alTerminar?.();
    } catch (err) {
      setError(`No se pudo guardar el seguimiento: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · De qué reunión se trata */}
      <Tarjeta titulo="1 · De qué seguimiento se trata" descripcion="Área, fecha y participantes.">
        <GrillaCampos columnas={3} className="mb-3">
          <CampoSelect etiqueta="Área" requerido opciones={opcionesArea} value={area} onChange={(e) => setArea(e.target.value)} />
          <CampoFecha etiqueta="Fecha del seguimiento" requerido value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <CampoHora etiqueta="Hora" value={hora} onChange={(e) => setHora(e.target.value)} />
        </GrillaCampos>
        <CampoTexto
          etiqueta="Participantes"
          value={participantes}
          onChange={(e) => setParticipantes(e.target.value)}
          placeholder="Nombres separados por coma"
        />
      </Tarjeta>

      {/* 2 · Campos, editables */}
      <Tarjeta
        titulo="2 · Compromisos, avances y problemas"
        descripcion={
          area
            ? 'Cargalos con los botones «Agregar». El selector de proyecto de cada fila muestra solo los de esta área.'
            : 'Cargalos con los botones «Agregar». Elegí el área en la sección 1 para poder vincular cada fila a un proyecto.'
        }
      >
        {!hayCampos && (
          <div className="mb-3">
            <Aviso tono="info">Todavía no cargaste nada. Usá los botones «Agregar» de cada bloque.</Aviso>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <BloqueCompromisos filas={compromisos} setFilas={setCompromisos} hoy={hoy} area={area} fechaSeguimiento={fecha} />
          <BloqueTexto
            titulo="Avances informados"
            tono="enregla"
            items={avances}
            setItems={setAvances}
            placeholder="Ej.: Se ejecutaron 200 metros de cordón cuneta."
            area={area}
            conAvance
          />
          <BloqueTexto
            titulo="Problemas / trabas"
            tono="vencido"
            items={problemas}
            setItems={setProblemas}
            placeholder="Ej.: Falta la conformidad del área técnica."
            area={area}
          />
        </div>
      </Tarjeta>

      {/* 3 · Confirmación */}
      <Tarjeta>
        {error && (
          <div className="mb-3">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-tenue">
            Se va a registrar el seguimiento, crear{' '}
            {compromisos.filter((c) => c.descripcion.trim()).length} compromiso(s) y actualizar el avance de{' '}
            {avances.filter((a) => a.id_proyecto && a.avance !== '').length} proyecto(s).
          </span>
          <Boton variante="primario" icono={Check} onClick={guardar} disabled={guardando}>
            Guardar seguimiento
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

/**
 * Selector compacto de proyecto, acotado al área del seguimiento —no busca
 * entre TODOS los proyectos del sistema como `SelectorProyecto`, solo entre
 * los del área ya elegida en la sección 1. Un `<select>` alcanza porque la
 * lista ya viene recortada: no hace falta buscador.
 */
function SelectorProyectoCompacto({ area, valor, alCambiar }) {
  const bd = useBD();
  const proyectosArea = useMemo(() => (bd && area ? selProyectos(bd, { area }) : []), [bd, area]);

  return (
    <select
      className="campo-base py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Proyecto"
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      disabled={!area}
      title={area ? undefined : 'Elegí el área en la sección 1'}
    >
      <option value="">{area ? 'Sin proyecto' : 'Elegí el área primero'}</option>
      {proyectosArea.map((p) => (
        <option key={p.id_proyecto} value={p.id_proyecto}>
          {p.proyecto}
        </option>
      ))}
    </select>
  );
}

function BloqueCompromisos({ filas, setFilas, hoy, area, fechaSeguimiento }) {
  const actualizar = (clave, campo, valor) =>
    setFilas((f) => f.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)));

  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        Compromisos
        <Chip tono="acento">{filas.filter((f) => f.descripcion.trim()).length}</Chip>
      </legend>
      <div className="flex flex-col gap-2 p-3">
        {filas.length === 0 && (
          <p className="py-2 text-center text-xs text-tenue">
            Sin compromisos. Agregá uno a mano o transferilos desde el texto.
          </p>
        )}
        {filas.map((fila) => {
          const fechaFalta = fila.descripcion.trim() && !fila.fecha_limite;
          const fechaInvalida = fila.fecha_limite && fila.fecha_limite < hoy;
          return (
            <div key={fila.clave} className="rounded-chip border border-borde p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr_140px_auto]">
              <SelectorProyectoCompacto
                area={area}
                valor={fila.id_proyecto}
                alCambiar={(id) => actualizar(fila.clave, 'id_proyecto', id)}
              />
              <input
                className="campo-base py-1.5 text-sm"
                placeholder="Descripción de la acción comprometida"
                value={fila.descripcion}
                onChange={(e) => actualizar(fila.clave, 'descripcion', e.target.value)}
              />
              <div>
                <input
                  type="date"
                  className="campo-base py-1.5 text-sm"
                  value={fila.fecha_limite}
                  onChange={(e) => actualizar(fila.clave, 'fecha_limite', e.target.value)}
                  style={fechaInvalida || fechaFalta ? { borderColor: 'var(--color-vencido)' } : undefined}
                />
                {fechaInvalida && <p className="mt-0.5 text-[10px] text-vencido-texto">Anterior a hoy</p>}
                {fechaFalta && <p className="mt-0.5 text-[10px] text-vencido-texto">Obligatoria</p>}
              </div>
              <button
                type="button"
                onClick={() => setFilas((f) => f.filter((x) => x.clave !== fila.clave))}
                className="shrink-0 self-start rounded-chip p-2 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                aria-label="Quitar compromiso"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <SelectorUnidad
              area={area}
              idSubsecretaria={fila.id_subsecretaria}
              idDireccion={fila.id_direccion}
              alCambiar={(parcial) =>
                setFilas((f) => f.map((x) => (x.clave === fila.clave ? { ...x, ...parcial } : x)))
              }
            />
            </div>
          );
        })}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setFilas((f) => [...f, filaCompromisoVacia(fechaSeguimiento)])} className="self-start">
          Agregar compromiso
        </Boton>
      </div>
    </fieldset>
  );
}

/**
 * `conAvance` (sólo lo usa "Avances informados") agrega, en la misma fila,
 * un número de avance nuevo para el proyecto elegido — independiente de la
 * nota de texto: una fila puede traer sólo el número, sólo el texto, o los
 * dos. Es el mismo dato que alimenta la barra de progreso del proyecto en
 * el resto del sistema, no una nota aparte.
 */
function BloqueTexto({ titulo, tono, items, setItems, placeholder, area, conAvance = false }) {
  const bd = useBD();
  const actualizar = (clave, campo, valor) =>
    setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)));

  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        {titulo}
        <Chip tono={tono}>{items.filter((i) => i.descripcion.trim()).length}</Chip>
      </legend>
      <div className="flex flex-col gap-2 p-3">
        {items.length === 0 && <p className="py-2 text-center text-xs text-tenue">Sin registros.</p>}
        {items.map((item) => {
          const proyecto = conAvance ? bd?.proyectos?.find((p) => p.id_proyecto === item.id_proyecto) : null;
          return (
            <div
              key={item.clave}
              className={`grid grid-cols-1 gap-2 sm:items-start ${
                conAvance ? 'sm:grid-cols-[170px_110px_1fr_auto]' : 'sm:grid-cols-[170px_1fr_auto]'
              }`}
            >
              <SelectorProyectoCompacto
                area={area}
                valor={item.id_proyecto}
                alCambiar={(id) => actualizar(item.clave, 'id_proyecto', id)}
              />
              {conAvance && (
                <input
                  type="number"
                  className="campo-base tabular py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Avance nuevo"
                  aria-label="Avance nuevo del proyecto"
                  value={item.avance ?? ''}
                  onChange={(e) => actualizar(item.clave, 'avance', e.target.value)}
                  disabled={!item.id_proyecto}
                  title={
                    proyecto
                      ? `Actual: ${numero(proyecto.avance)} / ${numero(proyecto.objetivo)} ${proyecto.unidad ?? ''}`
                      : 'Elegí un proyecto para poder cargar su avance'
                  }
                />
              )}
              <div className="flex items-start gap-2">
                <Semaforo nivel={tono} soloPunto />
                <textarea
                  rows={1}
                  className="campo-base min-h-9 resize-y py-1.5 text-sm"
                  value={item.descripcion}
                  placeholder={placeholder}
                  aria-label={`${titulo}`}
                  onChange={(e) => actualizar(item.clave, 'descripcion', e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setItems((xs) => xs.filter((x) => x.clave !== item.clave))}
                className="shrink-0 self-start rounded-chip p-2 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                aria-label={`Quitar de ${titulo}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setItems((xs) => [...xs, filaTextoVacia()])} className="self-start">
          Agregar
        </Boton>
      </div>
    </fieldset>
  );
}
