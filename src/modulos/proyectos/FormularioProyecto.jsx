import { useMemo, useState } from 'react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import {
  CampoArea,
  CampoCheck,
  CampoFecha,
  CampoNumero,
  CampoRadios,
  CampoSelect,
  CampoTexto,
  GrillaCampos,
} from '../../componentes/Campo.jsx';
import { ESTADOS_PROYECTO, PRIORIDADES } from '../../datos/catalogos.js';
import { generarIdProyecto } from '../../datos/ids.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useItems, useOpciones } from '../../utilidades/catalogos.js';

const VACIO = {
  proyecto: '',
  area: '',
  programa: '',
  eje: '',
  tipo: '',
  cantidad: '',
  objetivo: '',
  avance: '',
  unidad: '',
  estado: 'planificado',
  responsable: '',
  prioridad: 'media',
  fecha_inicio: '',
  fecha_fin_prevista: '',
  es_obra: false,
  monto_planificado: '',
  monto_ejecutado: '',
  zona: '',
  latitud: '',
  longitud: '',
  observaciones: '',
};

export function FormularioProyecto({ abierto, alCerrar, proyecto }) {
  const bd = useBD();
  const esEdicion = Boolean(proyecto);
  const [datos, setDatos] = useState(() => (proyecto ? { ...VACIO, ...proyecto } : { ...VACIO, fecha_inicio: hoyISO() }));
  const [errores, setErrores] = useState({});
  const [confirmarExceso, setConfirmarExceso] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const areas = useItems('areas');
  const tipos = useItems('tipos');
  const opcionesArea = useOpciones('areas');
  const opcionesPrograma = useOpciones('programas');
  const opcionesEje = useOpciones('ejes');
  const opcionesTipo = useOpciones('tipos');
  const opcionesUnidad = useOpciones('unidades');

  const cambiar = (campo) => (e) => {
    const valor = e?.target?.type === 'checkbox' ? e.target.checked : e?.target?.value ?? e;
    setDatos((d) => {
      const nuevo = { ...d, [campo]: valor };
      // El tipo de proyecto define si es obra: se autocompleta, pero queda editable.
      if (campo === 'tipo') {
        const item = tipos.find((t) => t.nombre === valor);
        if (item) nuevo.es_obra = Boolean(item.es_obra);
      }
      return nuevo;
    });
    setErrores((e2) => ({ ...e2, [campo]: undefined }));
  };

  // El id se muestra ya generado antes de guardar: el usuario ve con qué queda.
  const idPrevisto = useMemo(() => {
    if (esEdicion) return proyecto.id_proyecto;
    if (!bd || !datos.area) return '—';
    const area = areas.find((a) => a.nombre === datos.area);
    return generarIdProyecto(bd, area?.id, datos.fecha_inicio || hoyISO());
  }, [bd, datos.area, datos.fecha_inicio, areas, esEdicion, proyecto]);

  function validar() {
    const e = {};
    if (!datos.proyecto.trim()) e.proyecto = 'Requerido';
    if (!datos.area) e.area = 'Requerido';
    if (!datos.tipo) e.tipo = 'Requerido';
    if (!datos.unidad) e.unidad = 'Requerido';
    if (!datos.objetivo || Number(datos.objetivo) <= 0) e.objetivo = 'Debe ser mayor a cero';
    if (
      datos.fecha_inicio &&
      datos.fecha_fin_prevista &&
      datos.fecha_fin_prevista < datos.fecha_inicio
    ) {
      e.fecha_fin_prevista = 'No puede ser anterior al inicio';
    }
    /* Media coordenada no ubica nada: con una sola de las dos el punto no se
       puede dibujar, y guardarla haría creer que la obra quedó ubicada. */
    const hayLat = String(datos.latitud ?? '') !== '';
    const hayLon = String(datos.longitud ?? '') !== '';
    if (hayLat !== hayLon) {
      const falta = hayLat ? 'longitud' : 'latitud';
      e[falta] = 'Cargá las dos coordenadas o ninguna';
    }
    if (hayLat && Math.abs(Number(datos.latitud)) > 90) e.latitud = 'Tiene que estar entre -90 y 90';
    if (hayLon && Math.abs(Number(datos.longitud)) > 180) e.longitud = 'Tiene que estar entre -180 y 180';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  const excedeObjetivo = Number(datos.avance) > Number(datos.objetivo) && Number(datos.objetivo) > 0;

  async function guardar(forzado = false) {
    if (!validar()) return;
    // Validación §8.6: el avance no puede superar el objetivo sin confirmación.
    if (excedeObjetivo && !forzado) {
      setConfirmarExceso(true);
      return;
    }
    setGuardando(true);
    try {
      const area = areas.find((a) => a.nombre === datos.area);
      const payload = {
        ...datos,
        cantidad: Number(datos.cantidad) || 0,
        objetivo: Number(datos.objetivo) || 0,
        avance: Number(datos.avance) || 0,
        monto_planificado: Number(datos.monto_planificado) || 0,
        monto_ejecutado: Number(datos.monto_ejecutado) || 0,
        // Vacío es `null`, no cero: cero es una coordenada válida en el golfo
        // de Guinea, y el mapa la dibujaría.
        latitud: String(datos.latitud ?? '') === '' ? null : Number(datos.latitud),
        longitud: String(datos.longitud ?? '') === '' ? null : Number(datos.longitud),
        id_area: area?.id,
        fecha_carga: datos.fecha_carga ?? hoyISO(),
      };
      if (esEdicion) await acciones.actualizarProyecto(proyecto.id_proyecto, payload);
      else await acciones.crearProyecto(payload);
      alCerrar();
    } finally {
      setGuardando(false);
      setConfirmarExceso(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo={esEdicion ? 'Editar proyecto' : 'Nuevo proyecto'}
      descripcion={
        esEdicion
          ? 'Los cambios quedan registrados en el historial del proyecto.'
          : 'Se carga una sola vez y alimenta dashboard, seguimientos, planificación y reportes.'
      }
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={() => guardar()} disabled={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear proyecto'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-chip bg-paper px-3 py-2">
          <span className="text-xs text-gris">Identificador</span>
          <Chip tono="acento">{idPrevisto}</Chip>
          {!esEdicion && (
            <span className="text-[11px] text-tenue">Se asigna solo, según el prefijo del área y el año.</span>
          )}
        </div>

        <CampoTexto
          etiqueta="Nombre del proyecto"
          requerido
          value={datos.proyecto}
          onChange={cambiar('proyecto')}
          error={errores.proyecto}
          placeholder="Ej.: Repavimentación — Barrio Los Álamos"
        />

        <GrillaCampos columnas={3}>
          <CampoSelect etiqueta="Área" requerido opciones={opcionesArea} value={datos.area} onChange={cambiar('area')} error={errores.area} />
          <CampoSelect etiqueta="Programa" opciones={opcionesPrograma} value={datos.programa} onChange={cambiar('programa')} />
          <CampoSelect etiqueta="Eje estratégico" opciones={opcionesEje} value={datos.eje} onChange={cambiar('eje')} />
          <CampoSelect etiqueta="Tipo" requerido opciones={opcionesTipo} value={datos.tipo} onChange={cambiar('tipo')} error={errores.tipo} />
          <CampoSelect etiqueta="Estado" requerido opciones={ESTADOS_PROYECTO} value={datos.estado} onChange={cambiar('estado')} placeholder="" />
          <CampoTexto etiqueta="Responsable" value={datos.responsable} onChange={cambiar('responsable')} placeholder="Referente del área" />
        </GrillaCampos>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoRadios
            etiqueta="Prioridad"
            opciones={PRIORIDADES}
            valor={datos.prioridad}
            alCambiar={(v) => setDatos((d) => ({ ...d, prioridad: v }))}
          />
          <div className="flex items-end pb-1">
            <CampoCheck
              etiqueta="Es una obra"
              descripcion="Cuenta aparte en el contador de obras activas del inicio."
              checked={datos.es_obra}
              onChange={cambiar('es_obra')}
            />
          </div>
        </div>

        <fieldset className="rounded-chip border border-borde p-3">
          <legend className="px-1 text-xs font-semibold text-gris">Magnitudes</legend>
          <GrillaCampos columnas={4}>
            <CampoNumero etiqueta="Cantidad" ayuda="del período" value={datos.cantidad} onChange={cambiar('cantidad')} />
            <CampoNumero etiqueta="Objetivo" requerido value={datos.objetivo} onChange={cambiar('objetivo')} error={errores.objetivo} />
            <CampoNumero etiqueta="Avance" value={datos.avance} onChange={cambiar('avance')} />
            <CampoSelect etiqueta="Unidad" requerido opciones={opcionesUnidad} value={datos.unidad} onChange={cambiar('unidad')} error={errores.unidad} />
          </GrillaCampos>
          {excedeObjetivo && (
            <div className="mt-2.5">
              <Aviso tono="alerta">
                El avance ({datos.avance}) supera al objetivo ({datos.objetivo}). Se puede guardar
                igual, pero el sistema va a pedir confirmación.
              </Aviso>
            </div>
          )}
        </fieldset>

        <GrillaCampos columnas={4}>
          <CampoFecha etiqueta="Fecha de inicio" value={datos.fecha_inicio} onChange={cambiar('fecha_inicio')} />
          <CampoFecha
            etiqueta="Fin previsto"
            value={datos.fecha_fin_prevista}
            onChange={cambiar('fecha_fin_prevista')}
            error={errores.fecha_fin_prevista}
          />
          <CampoNumero etiqueta="Monto planificado" ayuda="$" value={datos.monto_planificado} onChange={cambiar('monto_planificado')} />
          <CampoNumero etiqueta="Monto ejecutado" ayuda="$" value={datos.monto_ejecutado} onChange={cambiar('monto_ejecutado')} />
        </GrillaCampos>

        <fieldset className="rounded-chip border border-borde p-3">
          <legend className="px-1 text-xs font-semibold text-gris">Ubicación</legend>
          <GrillaCampos columnas={3}>
            <CampoTexto
              etiqueta="Zona o barrio"
              value={datos.zona}
              onChange={cambiar('zona')}
              placeholder="Ej.: Villa Esperanza"
            />
            <CampoNumero
              etiqueta="Latitud"
              ayuda="decimal"
              step="0.00001"
              value={datos.latitud}
              onChange={cambiar('latitud')}
              error={errores.latitud}
              placeholder="-34.60110"
            />
            <CampoNumero
              etiqueta="Longitud"
              ayuda="decimal"
              step="0.00001"
              value={datos.longitud}
              onChange={cambiar('longitud')}
              error={errores.longitud}
              placeholder="-58.58200"
            />
          </GrillaCampos>
          <p className="mt-2 text-[11px] text-tenue">
            Con las dos coordenadas cargadas, la obra se dibuja en el mapa del módulo de Obras. Sin
            ellas entra igual al listado, marcada como «sin ubicar».
          </p>
        </fieldset>

        <CampoArea etiqueta="Observaciones" filas={3} value={datos.observaciones} onChange={cambiar('observaciones')} />
      </div>

      <Modal
        abierto={confirmarExceso}
        alCerrar={() => setConfirmarExceso(false)}
        titulo="El avance supera al objetivo"
        ancho="sm"
        pie={
          <>
            <Boton onClick={() => setConfirmarExceso(false)}>Revisar</Boton>
            <Boton variante="primario" onClick={() => guardar(true)}>
              Guardar igual
            </Boton>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-gris">
          El avance cargado ({datos.avance} {datos.unidad}) es mayor que el objetivo comprometido (
          {datos.objetivo} {datos.unidad}). El porcentaje de avance se va a mostrar acotado a 100 %.
          ¿Confirmás que el dato es correcto?
        </p>
      </Modal>
    </Modal>
  );
}
