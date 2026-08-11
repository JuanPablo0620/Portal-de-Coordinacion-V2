/**
 * Carga incremental de temas — el comportamiento central del módulo.
 *
 * Se crea el monitoreo (fecha + área) y se habilita el formulario de UN tema.
 * Al confirmarlo, el tema queda fijado como tarjeta y se habilita
 * automáticamente el formulario del siguiente, con la MISMA estructura, sin
 * límite. Cierra con «Finalizar monitoreo».
 */
import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, Radar } from 'lucide-react';
import { Aviso, Boton, Chip, Criticidad, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoRadios, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { CRITICIDADES } from '../../datos/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const TEMA_VACIO = {
  categoria: '',
  id_proyecto: '',
  descripcion: '',
  criticidad: 'media',
  requiere_accion: false,
  responsable: '',
  fecha_limite: '',
};

/** `areaInicial` viene de la hoja de una secretaría: llegar con el área ya elegida. */
export function CargarMonitoreo({ alTerminar, areaInicial = '' }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const opcionesCategoria = useOpciones('categorias_tema');

  const [cabecera, setCabecera] = useState({ fecha: hoy, area: areaInicial });
  const [monitoreo, setMonitoreo] = useState(null);
  const [temasCargados, setTemasCargados] = useState([]);
  const [tema, setTema] = useState({ ...TEMA_VACIO });
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function iniciar() {
    if (!cabecera.area || !cabecera.fecha) {
      setError('Indicá la fecha y el área del monitoreo.');
      return;
    }
    setError('');
    setTrabajando(true);
    try {
      setMonitoreo(await acciones.crearMonitoreo(cabecera));
    } finally {
      setTrabajando(false);
    }
  }

  async function confirmarTema() {
    if (!tema.categoria) return setError('Elegí la categoría del tema.');
    if (!tema.descripcion.trim()) return setError('Describí el tema.');
    if (tema.requiere_accion && !tema.responsable.trim()) return setError('Indicá el responsable de la acción.');
    if (tema.requiere_accion && tema.fecha_limite && tema.fecha_limite < hoy) {
      return setError('La fecha límite no puede ser anterior a hoy.');
    }
    setError('');
    setTrabajando(true);
    try {
      const { tema: creado, compromiso } = await acciones.agregarTema(monitoreo.id, {
        ...tema,
        id_proyecto: tema.id_proyecto || null,
        fecha_limite: tema.fecha_limite || null,
      });
      setTemasCargados((t) => [...t, { ...creado, generoCompromiso: Boolean(compromiso) }]);
      // Se limpia y queda habilitado el formulario del tema siguiente.
      setTema({ ...TEMA_VACIO });
    } finally {
      setTrabajando(false);
    }
  }

  async function finalizar() {
    if (!temasCargados.length) {
      setError('No se puede finalizar un monitoreo sin al menos un tema.');
      return;
    }
    setTrabajando(true);
    try {
      await acciones.finalizarMonitoreo(monitoreo.id);
      alTerminar?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  /* ── Paso 1: crear el monitoreo ─────────────────────────────────── */

  if (!monitoreo) {
    return (
      <Tarjeta titulo="Nuevo monitoreo" descripcion="Fecha y área. Después se cargan los temas, uno atrás de otro.">
        <GrillaCampos columnas={2} className="max-w-2xl">
          <CampoFecha
            etiqueta="Fecha"
            requerido
            value={cabecera.fecha}
            onChange={(e) => setCabecera((c) => ({ ...c, fecha: e.target.value }))}
          />
          <CampoSelect
            etiqueta="Área"
            requerido
            opciones={opcionesArea}
            value={cabecera.area}
            onChange={(e) => setCabecera((c) => ({ ...c, area: e.target.value }))}
          />
        </GrillaCampos>
        {error && (
          <div className="mt-3 max-w-2xl">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}
        <div className="mt-4">
          <Boton variante="primario" icono={Radar} onClick={iniciar} disabled={trabajando}>
            Iniciar monitoreo
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  /* ── Paso 2: temas encadenados ──────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3">
          <Chip tono="acento">{fFecha(monitoreo.fecha)}</Chip>
          <span className="text-sm font-medium text-tinta">{monitoreo.area}</span>
          <span className="text-xs text-gris">
            {temasCargados.length} tema{temasCargados.length === 1 ? '' : 's'} cargado
            {temasCargados.length === 1 ? '' : 's'}
          </span>
          <Boton
            variante="primario"
            icono={ClipboardCheck}
            onClick={finalizar}
            disabled={trabajando || !temasCargados.length}
            className="ml-auto"
          >
            Finalizar monitoreo
          </Boton>
        </div>
        {!temasCargados.length && (
          <p className="mt-2 text-xs text-tenue">
            Hace falta al menos un tema para poder finalizar.
          </p>
        )}
      </Tarjeta>

      {/* Temas ya fijados */}
      {temasCargados.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {temasCargados.map((t, i) => (
            <article key={t.id} className="tarjeta flex flex-col gap-2 p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-enregla-suave text-enregla-texto">
                  <CheckCircle2 size={14} />
                </span>
                <span className="text-xs font-semibold text-tinta">Tema {i + 1}</span>
                <Criticidad nivel={t.criticidad} />
              </div>
              <p className="text-sm leading-snug text-tinta">{t.descripcion}</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tono="neutro">{t.categoria}</Chip>
                {t.id_proyecto && <Chip tono="acento">{t.id_proyecto}</Chip>}
                {t.generoCompromiso && <Chip tono="proximo">Genera compromiso</Chip>}
              </div>
              {t.requiere_accion && (
                <p className="text-[11px] text-tenue">
                  {t.responsable} {t.fecha_limite ? `· vence ${fFecha(t.fecha_limite)}` : ''}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Formulario del tema siguiente — siempre la misma estructura */}
      <Tarjeta
        titulo={`Tema ${temasCargados.length + 1}`}
        descripcion="Estructura estandarizada: la misma para todos los temas, siempre."
      >
        <div className="flex flex-col gap-3">
          <GrillaCampos columnas={2}>
            <CampoSelect
              etiqueta="Categoría"
              requerido
              opciones={opcionesCategoria}
              value={tema.categoria}
              onChange={(e) => setTema((t) => ({ ...t, categoria: e.target.value }))}
            />
            <CampoRadios
              etiqueta="Criticidad"
              requerido
              opciones={CRITICIDADES}
              valor={tema.criticidad}
              alCambiar={(v) => setTema((t) => ({ ...t, criticidad: v }))}
            />
          </GrillaCampos>

          <SelectorProyecto
            etiqueta="Proyecto vinculado"
            ayuda="opcional"
            valor={tema.id_proyecto}
            alCambiar={(v) => setTema((t) => ({ ...t, id_proyecto: v }))}
            maxAltura={160}
          />

          <CampoArea
            etiqueta="Descripción"
            requerido
            filas={3}
            value={tema.descripcion}
            onChange={(e) => setTema((t) => ({ ...t, descripcion: e.target.value }))}
            placeholder="Ej.: Demora en la entrega de materiales por parte del proveedor."
          />

          <div className="rounded-chip border border-borde p-3">
            <CampoCheck
              etiqueta="Requiere acción"
              descripcion="Si lo marcás, se genera automáticamente un compromiso en la lista general."
              checked={tema.requiere_accion}
              onChange={(e) => setTema((t) => ({ ...t, requiere_accion: e.target.checked }))}
            />
            {tema.requiere_accion && (
              <GrillaCampos columnas={2} className="mt-3">
                <CampoTexto
                  etiqueta="Responsable"
                  requerido
                  value={tema.responsable}
                  onChange={(e) => setTema((t) => ({ ...t, responsable: e.target.value }))}
                />
                <CampoFecha
                  etiqueta="Fecha límite"
                  min={hoy}
                  value={tema.fecha_limite}
                  onChange={(e) => setTema((t) => ({ ...t, fecha_limite: e.target.value }))}
                />
              </GrillaCampos>
            )}
          </div>

          {error && <Aviso tono="error">{error}</Aviso>}

          <div className="flex justify-end gap-2 border-t border-borde pt-3">
            <Boton variante="primario" icono={Plus} onClick={confirmarTema} disabled={trabajando}>
              Confirmar tema y cargar el siguiente
            </Boton>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
