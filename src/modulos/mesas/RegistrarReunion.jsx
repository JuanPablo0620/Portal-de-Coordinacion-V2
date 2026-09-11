import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha } from '../../componentes/Campo.jsx';
import { SelectorUnidad } from '../../componentes/SelectorUnidad.jsx';
import { hoyISO, proximaReunionMesa } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

const filaVacia = (fechaLimitePropuesta = '') => ({
  clave: Math.random().toString(36).slice(2),
  descripcion: '',
  fecha_limite: fechaLimitePropuesta,
  area: '',
  id_subsecretaria: '',
  id_direccion: '',
});

/**
 * Los compromisos que salen de una reunión de mesa se crean con
 * `origen_tipo: 'mesa'` y van a la MISMA lista general de compromisos: no hay
 * una lista aparte por mesa.
 */
export function RegistrarReunion({ abierto, alCerrar, mesa }) {
  const bd = useBD();
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const [datos, setDatos] = useState({ fecha: hoy, temas: '' });
  const [compromisos, setCompromisos] = useState([]);
  const [error, setError] = useState('');

  // La fecha límite que se propone al agregar un compromiso: la próxima
  // reunión YA AGENDADA de esta mesa, si hay una. Si todavía no se agendó la
  // siguiente, el campo queda en blanco y se completa a mano, como antes.
  const proximaFecha = bd ? proximaReunionMesa(bd, mesa.id, hoy)?.fecha ?? '' : '';

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const actualizarFila = (clave, campo, valor) =>
    setCompromisos((f) =>
      f.map((x) => {
        if (x.clave !== clave) return x;
        // Cambiar de área invalida la unidad elegida: subsecretarías y
        // direcciones son de UNA secretaría, no del sistema entero.
        const limpiar = campo === 'area' ? { id_subsecretaria: '', id_direccion: '' } : {};
        return { ...x, [campo]: valor, ...limpiar };
      }),
    );

  async function guardar() {
    if (!datos.fecha) {
      setError('Indicá la fecha de la reunión.');
      return;
    }
    for (const c of compromisos) {
      if (!c.descripcion.trim()) continue;
      if (c.fecha_limite && c.fecha_limite < hoy) {
        setError('Las fechas límite no pueden ser anteriores a hoy.');
        return;
      }
      // Sin esto, el compromiso fallaba recién al guardar: la base exige
      // área y ahí no había mensaje (ver nota del catch, más abajo). Se
      // valida acá para no llegar a intentarlo sin área.
      if (!c.area) {
        setError('Elegí el área responsable de cada compromiso antes de guardar.');
        return;
      }
    }
    setError('');

    // Antes, un error de Supabase (por ejemplo el del área, arriba, u otro de
    // permisos) quedaba sin capturar: la promesa del onClick rechazaba en
    // silencio, el modal no se cerraba y el botón «no hacía nada» — pero la
    // reunión, que se crea antes que los compromisos, ya había quedado
    // guardada. Ahora cualquier error restante se muestra en vez de tragarse.
    try {
      await acciones.crearReunionMesa({ id_mesa: mesa.id, ...datos });

      const aCrear = compromisos
        .filter((c) => c.descripcion.trim())
        .map((c) => ({
          origen_tipo: 'mesa',
          id_origen: mesa.id,
          id_proyecto: mesa.proyectos_vinculados?.[0] ?? null,
          area: c.area || '',
          id_subsecretaria: c.id_subsecretaria || null,
          id_direccion: c.id_direccion || null,
          descripcion: c.descripcion.trim(),
          fecha_limite: c.fecha_limite || null,
        }));
      if (aCrear.length) await acciones.crearCompromisos(aCrear);

      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la reunión. Probá de nuevo.');
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo="Registrar reunión"
      descripcion={mesa.nombre}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar}>
            Guardar reunión
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoFecha etiqueta="Fecha" requerido value={datos.fecha} onChange={cambiar('fecha')} />

        <CampoArea etiqueta="Temas tratados" filas={4} value={datos.temas} onChange={cambiar('temas')} />

        <fieldset className="rounded-chip border border-borde">
          <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
            Compromisos generados
            <Chip tono="acento">{compromisos.filter((c) => c.descripcion.trim()).length}</Chip>
          </legend>
          <div className="flex flex-col gap-2 p-3">
            {compromisos.length === 0 && (
              <p className="py-1 text-center text-xs text-tenue">
                Se integran a la lista general de compromisos del módulo Seguimiento.
                {proximaFecha && ` La fecha límite se propone en la próxima reunión de la mesa (${fFecha(proximaFecha)}).`}
              </p>
            )}
            {compromisos.map((fila) => (
              <div key={fila.clave} className="rounded-chip border border-borde p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_130px_auto]">
                <input
                  className="campo-base py-1.5 text-sm"
                  placeholder="Acción comprometida"
                  aria-label="Acción comprometida"
                  value={fila.descripcion}
                  onChange={(e) => actualizarFila(fila.clave, 'descripcion', e.target.value)}
                />
                <select
                  className="campo-base py-1.5 text-sm"
                  aria-label="Área responsable del compromiso"
                  value={fila.area}
                  onChange={(e) => actualizarFila(fila.clave, 'area', e.target.value)}
                >
                  <option value="">Área…</option>
                  {opcionesArea.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.titulo}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="campo-base py-1.5 text-sm"
                  aria-label="Fecha límite del compromiso"
                  min={hoy}
                  value={fila.fecha_limite}
                  onChange={(e) => actualizarFila(fila.clave, 'fecha_limite', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setCompromisos((f) => f.filter((x) => x.clave !== fila.clave))}
                  className="shrink-0 self-start rounded-chip p-2 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                  aria-label="Quitar compromiso"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <SelectorUnidad
                area={fila.area}
                idSubsecretaria={fila.id_subsecretaria}
                idDireccion={fila.id_direccion}
                alCambiar={(parcial) =>
                  setCompromisos((f) => f.map((x) => (x.clave === fila.clave ? { ...x, ...parcial } : x)))
                }
              />
              </div>
            ))}
            <Boton
              tamanio="sm"
              variante="fantasma"
              icono={Plus}
              onClick={() => setCompromisos((f) => [...f, filaVacia(proximaFecha)])}
              className="self-start"
            >
              Agregar compromiso
            </Boton>
          </div>
        </fieldset>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
