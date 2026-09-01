/**
 * Carga de un seguimiento realizado.
 *
 * El orden de la pantalla sigue el orden real del trabajo: primero de qué
 * reunión se trata, después el texto crudo, después la transferencia a campos
 * revisables. La transferencia PRECARGA los tres bloques; no persiste nada. El
 * usuario corrige y recién al confirmar se escriben seguimiento y compromisos.
 *
 * A qué proyecto pertenece cada cosa es una decisión de CADA FILA —compromiso,
 * avance o problema—, no del seguimiento entero (20/08/2026, a pedido de JP):
 * "hablar con Sistemas porque un CAPS no tiene internet" no es de ningún
 * proyecto, y "hablar con Legales por el suministro" sí es del túnel Hornos.
 * Por eso no hay un selector de "proyectos tratados" en la sección 1: cada
 * fila de las tres listas de la sección 3 tiene su propio selector opcional de
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
import { Transferencia } from '../../componentes/Transferencia.jsx';
import { separarMinuta } from '../../datos/minutas/separarMinuta.js';
import { hoyISO, proyectos as selProyectos } from '../../datos/selectores.js';
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
  responsable: '',
  fecha_limite: sumarDias(fechaSeguimiento, UMBRALES.DIAS_ENTRE_SEGUIMIENTOS),
  id_proyecto: '',
});

const filaTextoVacia = () => ({ clave: nuevaClave(), descripcion: '', id_proyecto: '' });

const EJEMPLO =
  'Ej.: Se ejecutaron 200 metros de cordón cuneta en el sector norte. Falta la conformidad ' +
  'del área técnica para avanzar. Ferreyra va a presentar el informe actualizado antes del 15/09.';

export function CargarSeguimiento({ alTerminar }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');

  const [area, setArea] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [texto, setTexto] = useState('');

  const [compromisos, setCompromisos] = useState([]);
  const [avances, setAvances] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [transferido, setTransferido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const hayCampos = compromisos.length + avances.length + problemas.length > 0;

  function transferir() {
    const r = separarMinuta(texto, hoy);
    setCompromisos(
      r.compromisos.map((c) => ({
        ...c,
        // La minuta casi nunca trae fecha límite explícita. Si no la trae, va
        // la del próximo seguimiento, igual que en el alta a mano.
        fecha_limite: c.fecha_limite || sumarDias(fecha, UMBRALES.DIAS_ENTRE_SEGUIMIENTOS),
        id_proyecto: '',
        clave: nuevaClave(),
      })),
    );
    setAvances(r.avances.map((descripcion) => ({ clave: nuevaClave(), descripcion, id_proyecto: '' })));
    setProblemas(r.problemas.map((descripcion) => ({ clave: nuevaClave(), descripcion, id_proyecto: '' })));
    setTransferido(true);
  }

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
      const problemasAGuardar = problemas.filter((p) => p.descripcion.trim());

      // A qué proyectos "tocó" este seguimiento se deriva de a cuáles quedó
      // vinculada alguna fila —compromiso, avance o problema—, no es una
      // declaración aparte. Así el historial de un proyecto sigue mostrando
      // el seguimiento sin que haga falta aclarar de entrada de qué
      // proyectos se habla.
      const idsProyectoDerivados = [
        ...new Set(
          [...compromisos, ...avancesAGuardar, ...problemasAGuardar]
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
          texto_crudo: texto,
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
            descripcion: c.descripcion.trim(),
            responsable: c.responsable.trim(),
            fecha_limite: c.fecha_limite || null,
          }));
        if (aCrear.length) await acciones.crearCompromisos(aCrear);
      });

      alTerminar?.();
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

      {/* 2 · Texto crudo → transferencia */}
      <Transferencia
        titulo="2 · Lo conversado"
        descripcion="Volcá la minuta tal como salió de la reunión y transferila a campos."
        etiquetaCampo="Texto de la minuta"
        placeholder={EJEMPLO}
        ayuda="Al transferir, el texto se reparte en compromisos, avances y problemas. Nada se guarda todavía."
        texto={texto}
        alCambiarTexto={setTexto}
        alTransferir={transferir}
        transferido={transferido}
        resumen={
          `Se transfirieron ${compromisos.length} compromiso(s), ${avances.length} avance(s) ` +
          `y ${problemas.length} problema(s). Corregilos abajo.`
        }
      />

      {/* 3 · Campos transferidos, editables */}
      <Tarjeta
        titulo="3 · Campos transferidos"
        descripcion={
          area
            ? 'Todos editables. El selector de proyecto de cada fila muestra solo los de esta área.'
            : 'Todos editables. Elegí el área en la sección 1 para poder vincular cada fila a un proyecto.'
        }
      >
        {!transferido && !hayCampos && (
          <div className="mb-3">
            <Aviso tono="info">
              Todavía no transferiste nada. Pegá el texto arriba y apretá <strong>«Transferir»</strong>,
              o cargá los campos a mano con los botones «Agregar».
            </Aviso>
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

      {/* 4 · Confirmación */}
      <Tarjeta>
        {error && (
          <div className="mb-3">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-tenue">
            Se va a registrar el seguimiento y crear{' '}
            {compromisos.filter((c) => c.descripcion.trim()).length} compromiso(s).
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
            <div key={fila.clave} className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr_150px_140px_auto]">
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
              <input
                className="campo-base py-1.5 text-sm"
                placeholder="Responsable"
                value={fila.responsable}
                onChange={(e) => actualizar(fila.clave, 'responsable', e.target.value)}
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
          );
        })}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setFilas((f) => [...f, filaCompromisoVacia(fechaSeguimiento)])} className="self-start">
          Agregar compromiso
        </Boton>
      </div>
    </fieldset>
  );
}

function BloqueTexto({ titulo, tono, items, setItems, placeholder, area }) {
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
        {items.map((item) => (
          <div key={item.clave} className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr_auto] sm:items-start">
            <SelectorProyectoCompacto
              area={area}
              valor={item.id_proyecto}
              alCambiar={(id) => actualizar(item.clave, 'id_proyecto', id)}
            />
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
        ))}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setItems((xs) => [...xs, filaTextoVacia()])} className="self-start">
          Agregar
        </Boton>
      </div>
    </fieldset>
  );
}
