import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Target, Trash2, Upload } from 'lucide-react';
import { Aviso, Boton, Chip, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoNumero, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { ImportarPlanificacion } from './ImportarPlanificacion.jsx';
import { hoyISO, planificacionDe, proyectoPorId } from '../../datos/selectores.js';
import { fecha as fFecha, moneda, numero } from '../../utilidades/formato.js';
import { nuevoId } from '../../datos/ids.js';
import { acciones, useBD } from '../../estado/tienda.js';

const VACIO = { meta_anual: '', metas_trimestrales: ['', '', '', ''], monto_planificado: '', hitos: [] };

export function CargarPlanificacion({ filtros, setFiltros }) {
  const bd = useBD();
  const hoy = hoyISO();
  const anio = Number(filtros.anio) || Number(hoy.slice(0, 4));
  const idProyecto = filtros.proyecto ?? '';

  const [datos, setDatos] = useState(VACIO);
  const [guardado, setGuardado] = useState(false);
  const [importando, setImportando] = useState(false);

  const proyecto = useMemo(() => (bd && idProyecto ? proyectoPorId(bd, idProyecto) : null), [bd, idProyecto]);
  const existente = useMemo(
    () => (bd && idProyecto ? planificacionDe(bd, idProyecto, anio) : null),
    [bd, idProyecto, anio],
  );

  // Al cambiar de proyecto se carga su planificación si ya existe, para editarla
  // en lugar de duplicarla.
  useEffect(() => {
    if (existente) {
      setDatos({
        meta_anual: existente.meta_anual ?? '',
        metas_trimestrales: (existente.metas_trimestrales ?? ['', '', '', '']).map((m) => m ?? ''),
        monto_planificado: existente.monto_planificado ?? '',
        hitos: existente.hitos ?? [],
      });
    } else if (proyecto) {
      setDatos({ ...VACIO, meta_anual: proyecto.objetivo ?? '', monto_planificado: proyecto.monto_planificado ?? '' });
    } else {
      setDatos(VACIO);
    }
    setGuardado(false);
  }, [existente, proyecto]);

  const sumaTrimestres = datos.metas_trimestrales.reduce((s, m) => s + (Number(m) || 0), 0);
  const ultimoTrimestre = Number(datos.metas_trimestrales[3]) || 0;
  // Las metas son ACUMULADAS: el T4 debería coincidir con la meta anual.
  const desajuste = Number(datos.meta_anual) > 0 && ultimoTrimestre > 0 && ultimoTrimestre !== Number(datos.meta_anual);

  async function guardar() {
    await acciones.guardarPlanificacion({
      id_proyecto: idProyecto,
      anio,
      meta_anual: Number(datos.meta_anual) || 0,
      metas_trimestrales: datos.metas_trimestrales.map((m) => Number(m) || 0),
      monto_planificado: Number(datos.monto_planificado) || 0,
      hitos: datos.hitos,
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Planificación anual por proyecto"
        descripcion="Meta anual, desagregación trimestral acumulada, monto e hitos."
        acciones={
          <Boton tamanio="sm" icono={Upload} onClick={() => setImportando(true)}>
            Importar CSV
          </Boton>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_140px]">
          <SelectorProyecto
            etiqueta="Proyecto"
            requerido
            valor={idProyecto}
            alCambiar={(v) => setFiltros({ proyecto: v })}
            maxAltura={180}
          />
          <CampoNumero
            etiqueta="Año"
            value={anio}
            onChange={(e) => setFiltros({ anio: e.target.value })}
            className="self-start"
          />
        </div>
      </Tarjeta>

      {!proyecto ? (
        <Tarjeta>
          <Vacio
            icono={Target}
            titulo="Elegí un proyecto"
            descripcion="La planificación se carga sobre un proyecto de la base maestra: no se crea una entidad nueva ni se vuelve a escribir su nombre."
          />
        </Tarjeta>
      ) : (
        <>
          <Tarjeta
            titulo={`${proyecto.proyecto} · ${anio}`}
            descripcion={`${proyecto.area} · avance actual ${numero(proyecto.avance)} de ${numero(proyecto.objetivo)} ${proyecto.unidad ?? ''}`}
            acciones={
              <>
                {existente && <Chip tono="acento">Ya planificado</Chip>}
                {guardado && <Chip tono="enregla">Guardado</Chip>}
                <Boton variante="primario" tamanio="sm" icono={Save} onClick={guardar}>
                  Guardar planificación
                </Boton>
              </>
            }
          >
            <GrillaCampos columnas={2} className="mb-4 max-w-2xl">
              <CampoNumero
                etiqueta="Meta anual"
                ayuda={proyecto.unidad}
                value={datos.meta_anual}
                onChange={(e) => setDatos((d) => ({ ...d, meta_anual: e.target.value }))}
              />
              <CampoNumero
                etiqueta="Monto planificado"
                ayuda="$"
                value={datos.monto_planificado}
                onChange={(e) => setDatos((d) => ({ ...d, monto_planificado: e.target.value }))}
              />
            </GrillaCampos>

            <p className="mb-2 text-xs font-semibold text-gris">
              Metas trimestrales <span className="font-normal text-tenue">(acumuladas)</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {datos.metas_trimestrales.map((meta, i) => (
                <CampoNumero
                  key={i}
                  etiqueta={`T${i + 1}`}
                  value={meta}
                  onChange={(e) =>
                    setDatos((d) => ({
                      ...d,
                      metas_trimestrales: d.metas_trimestrales.map((m, j) => (j === i ? e.target.value : m)),
                    }))
                  }
                />
              ))}
            </div>

            {desajuste && (
              <div className="mt-3">
                <Aviso tono="alerta">
                  La meta del T4 ({numero(ultimoTrimestre)}) no coincide con la meta anual (
                  {numero(datos.meta_anual)}). Como las metas son acumuladas, deberían coincidir. Se
                  puede guardar igual: es un aviso, no un bloqueo.
                </Aviso>
              </div>
            )}
            <p className="mt-2 text-[11px] text-tenue">
              Suma nominal de los cuatro valores: {numero(sumaTrimestres)}. Lo que se compara contra el
              avance real es el valor del trimestre en curso, no la suma.
            </p>
          </Tarjeta>

          <PanelHitos datos={datos} setDatos={setDatos} />
        </>
      )}

      {importando && <ImportarPlanificacion abierto alCerrar={() => setImportando(false)} anio={anio} />}
    </div>
  );
}

function PanelHitos({ datos, setDatos }) {
  const [nuevo, setNuevo] = useState({ descripcion: '', fecha: '' });

  function agregar() {
    if (!nuevo.descripcion.trim() || !nuevo.fecha) return;
    setDatos((d) => ({ ...d, hitos: [...d.hitos, { id: nuevoId('hit'), ...nuevo }] }));
    setNuevo({ descripcion: '', fecha: '' });
  }

  return (
    <Tarjeta titulo="Hitos" descripcion="Alimentan los próximos vencimientos del inicio. Acordate de guardar después de agregarlos.">
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
        <CampoTexto
          etiqueta="Descripción"
          value={nuevo.descripcion}
          onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
          placeholder="Ej.: Certificación intermedia"
        />
        <CampoFecha etiqueta="Fecha" value={nuevo.fecha} onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} />
        <div className="flex items-end">
          <Boton icono={Plus} onClick={agregar} disabled={!nuevo.descripcion.trim() || !nuevo.fecha}>
            Agregar
          </Boton>
        </div>
      </div>

      {datos.hitos.length === 0 ? (
        <Vacio compacto titulo="Sin hitos cargados" descripcion="Los hitos con fecha aparecen en los vencimientos del inicio." />
      ) : (
        <ul className="flex flex-col rounded-chip border border-borde">
          {[...datos.hitos]
            .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
            .map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-b border-borde/60 px-3 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm text-tinta">{h.descripcion}</span>
                <span className="tabular shrink-0 text-xs text-gris">{fFecha(h.fecha)}</span>
                <button
                  type="button"
                  onClick={() => setDatos((d) => ({ ...d, hitos: d.hitos.filter((x) => x.id !== h.id) }))}
                  className="shrink-0 rounded p-1 text-tenue transition hover:bg-vencido-suave hover:text-vencido"
                  aria-label="Quitar hito"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </Tarjeta>
  );
}
