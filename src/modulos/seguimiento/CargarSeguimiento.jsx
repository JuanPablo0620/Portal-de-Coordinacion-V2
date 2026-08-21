/**
 * Carga de un seguimiento realizado.
 *
 * El orden de la pantalla sigue el orden real del trabajo: primero de qué
 * reunión se trata, después el texto crudo, después la transferencia a campos
 * revisables. La transferencia PRECARGA los tres bloques; no persiste nada. El
 * usuario corrige y recién al confirmar se escriben seguimiento y compromisos.
 *
 * A qué proyecto pertenece cada cosa es una decisión de CADA COMPROMISO, no
 * del seguimiento entero — un seguimiento habla de una secretaría, no de una
 * lista fija de proyectos tratados (20/08/2026, a pedido de JP): "hablar con
 * Sistemas porque un CAPS no tiene internet" no es de ningún proyecto, y
 * "hablar con Legales por el suministro" sí es del túnel Hornos, y esa
 * distinción se hace compromiso por compromiso. Por eso no hay un selector de
 * "proyectos tratados" acá arriba: cada fila de compromiso tiene su propio
 * vínculo opcional a un proyecto (colapsado por defecto, igual que en
 * `CargarMonitoreo.jsx`), y `seguimientos_proyectos` —para que el historial de
 * un proyecto siga mostrando sus seguimientos— se arma solo, derivado de a
 * qué proyectos terminaron vinculados los compromisos de la carga.
 */
import { useState } from 'react';
import { Check, Link2, Plus, Trash2, X } from 'lucide-react';
import { Aviso, Boton, Chip, Semaforo, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoHora, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { Transferencia } from '../../componentes/Transferencia.jsx';
import { separarMinuta } from '../../datos/minutas/separarMinuta.js';
import { hoyISO } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const filaVacia = () => ({
  clave: Math.random().toString(36).slice(2),
  descripcion: '',
  responsable: '',
  fecha_limite: '',
  id_proyecto: '',
});

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
    setCompromisos(r.compromisos.map((c) => ({ ...c, id_proyecto: '', clave: Math.random().toString(36).slice(2) })));
    setAvances(r.avances);
    setProblemas(r.problemas);
    setTransferido(true);
  }

  function validar() {
    if (!area) return 'Elegí el área.';
    if (!fecha) return 'Indicá la fecha del seguimiento.';
    // Validación §8.6: las fechas límite no pueden ser anteriores a la carga.
    for (const c of compromisos) {
      if (c.descripcion.trim() && c.fecha_limite && c.fecha_limite < hoy) {
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
      // A qué proyectos "tocó" este seguimiento se deriva de a cuáles quedaron
      // vinculados sus compromisos — no es una declaración aparte. Así el
      // historial de un proyecto sigue mostrando el seguimiento sin que haga
      // falta aclarar de entrada de qué proyectos se habla.
      const idsProyectoDerivados = [...new Set(compromisos.map((c) => c.id_proyecto).filter(Boolean))];

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
          resumen: avances[0] ?? '',
          avances,
          problemas,
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
        descripcion="Todos editables. Podés corregir, borrar y agregar filas a mano."
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
          <BloqueCompromisos filas={compromisos} setFilas={setCompromisos} hoy={hoy} />
          <BloqueTexto
            titulo="Avances informados"
            tono="enregla"
            items={avances}
            setItems={setAvances}
            placeholder="Ej.: Se ejecutaron 200 metros de cordón cuneta."
          />
          <BloqueTexto
            titulo="Problemas / trabas"
            tono="vencido"
            items={problemas}
            setItems={setProblemas}
            placeholder="Ej.: Falta la conformidad del área técnica."
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

function BloqueCompromisos({ filas, setFilas, hoy }) {
  const actualizar = (clave, campo, valor) =>
    setFilas((f) => f.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)));

  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        Compromisos
        <Chip tono="acento">{filas.filter((f) => f.descripcion.trim()).length}</Chip>
      </legend>
      <div className="flex flex-col gap-3 p-3">
        {filas.length === 0 && (
          <p className="py-2 text-center text-xs text-tenue">
            Sin compromisos. Agregá uno a mano o transferilos desde el texto.
          </p>
        )}
        {filas.map((fila) => {
          const fechaInvalida = fila.fecha_limite && fila.fecha_limite < hoy;
          return (
            <div key={fila.clave} className="rounded-chip border border-borde/60 p-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_140px_auto]">
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
                    style={fechaInvalida ? { borderColor: 'var(--color-vencido)' } : undefined}
                  />
                  {fechaInvalida && <p className="mt-0.5 text-[10px] text-vencido-texto">Anterior a hoy</p>}
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

              <VinculoProyecto
                valor={fila.id_proyecto}
                alCambiar={(id) => actualizar(fila.clave, 'id_proyecto', id)}
              />
            </div>
          );
        })}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setFilas((f) => [...f, filaVacia()])} className="self-start">
          Agregar compromiso
        </Boton>
      </div>
    </fieldset>
  );
}

/**
 * Vínculo opcional de un compromiso a un proyecto puntual — arranca plegado
 * (mismo patrón que el proyecto vinculado de un tema en `CargarMonitoreo.jsx`):
 * la mayoría de los compromisos no son de ningún proyecto en particular
 * («hablar con Sistemas porque un CAPS no tiene internet»), así que mostrar el
 * buscador entero en cada fila por las dudas sería ruido para el caso común.
 */
function VinculoProyecto({ valor, alCambiar }) {
  const [abierto, setAbierto] = useState(Boolean(valor));

  if (!abierto) {
    return (
      <Boton tamanio="sm" variante="fantasma" icono={Link2} onClick={() => setAbierto(true)} className="mt-2">
        Vincular a un proyecto
      </Boton>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <SelectorProyecto
        etiqueta="Proyecto"
        ayuda="opcional — dejalo vacío si el compromiso no es de ningún proyecto puntual"
        valor={valor}
        alCambiar={alCambiar}
        maxAltura={160}
        className="flex-1"
      />
      {!valor && (
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="mt-6 shrink-0 rounded-chip p-1.5 text-tenue transition hover:bg-paper hover:text-tinta"
          aria-label="Cerrar el vínculo a proyecto"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function BloqueTexto({ titulo, tono, items, setItems, placeholder }) {
  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        {titulo}
        <Chip tono={tono}>{items.filter((i) => i.trim()).length}</Chip>
      </legend>
      <div className="flex flex-col gap-2 p-3">
        {items.length === 0 && <p className="py-2 text-center text-xs text-tenue">Sin registros.</p>}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <Semaforo nivel={tono} soloPunto />
            <textarea
              rows={1}
              className="campo-base min-h-9 resize-y py-1.5 text-sm"
              value={item}
              placeholder={placeholder}
              aria-label={`${titulo} ${i + 1}`}
              onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              type="button"
              onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
              className="shrink-0 rounded-chip p-2 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
              aria-label={`Quitar de ${titulo}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setItems((xs) => [...xs, ''])} className="self-start">
          Agregar
        </Boton>
      </div>
    </fieldset>
  );
}
