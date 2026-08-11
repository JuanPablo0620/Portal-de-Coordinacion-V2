/**
 * Carga de un seguimiento realizado.
 *
 * El orden de la pantalla es el que pidió el área: proyecto → última
 * actualización como referencia → minuta → tres bloques revisables.
 *
 * La separación automática PRECARGA los tres bloques; no persiste nada. El
 * usuario corrige y recién al confirmar se escriben seguimiento, compromisos y
 * avances corregidos.
 */
import { useMemo, useState } from 'react';
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Aviso, Boton, Chip, Semaforo, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoHora, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { separarMinuta } from '../../datos/minutas/separarMinuta.js';
import { ESTADOS_PROYECTO } from '../../datos/catalogos.js';
import { hoyISO, porcentajeAvance, proyectoPorId, ultimaActualizacion } from '../../datos/selectores.js';
import { haceCuanto, numero } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

const filaVacia = () => ({ clave: Math.random().toString(36).slice(2), descripcion: '', responsable: '', fecha_limite: '' });

export function CargarSeguimiento({ alTerminar }) {
  const bd = useBD();
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');

  const [area, setArea] = useState('');
  const [ids, setIds] = useState([]);
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [texto, setTexto] = useState('');
  const [avancesCorregidos, setAvancesCorregidos] = useState({});
  const [estadoReportado, setEstadoReportado] = useState('');

  const [compromisos, setCompromisos] = useState([]);
  const [avances, setAvances] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [separado, setSeparado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const elegidos = useMemo(
    () => (bd ? ids.map((id) => proyectoPorId(bd, id)).filter(Boolean) : []),
    [bd, ids],
  );

  function separar() {
    const r = separarMinuta(texto, hoy);
    setCompromisos(r.compromisos.map((c) => ({ ...c, clave: Math.random().toString(36).slice(2) })));
    setAvances(r.avances);
    setProblemas(r.problemas);
    setSeparado(true);
  }

  function validar() {
    if (!area) return 'Elegí el área.';
    if (!ids.length) return 'Elegí al menos un proyecto.';
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
      // Guardar una minuta son varias escrituras —el seguimiento, sus
      // compromisos y el avance corregido de cada proyecto— que para quien
      // carga son un solo acto. En lote se persiste una vez y la pantalla no se
      // repinta con la minuta a medio guardar.
      await acciones.enLote(async () => {
        const seguimiento = await acciones.crearSeguimiento({
          ids_proyecto: ids,
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
          estado_reportado: estadoReportado,
        });

        const aCrear = compromisos
          .filter((c) => c.descripcion.trim())
          .map((c) => ({
            origen_tipo: 'seguimiento',
            id_origen: seguimiento.id,
            id_proyecto: ids[0] ?? null,
            area,
            descripcion: c.descripcion.trim(),
            responsable: c.responsable.trim(),
            fecha_limite: c.fecha_limite || null,
          }));
        if (aCrear.length) await acciones.crearCompromisos(aCrear);

        // Actualiza el avance de los proyectos que el usuario corrigió
        for (const [id, valor] of Object.entries(avancesCorregidos)) {
          if (valor === '' || valor === null) continue;
          const previo = proyectoPorId(bd, id);
          if (previo && Number(valor) !== Number(previo.avance)) {
            await acciones.actualizarProyecto(id, {
              avance: Number(valor),
              ...(estadoReportado ? { estado: estadoReportado } : {}),
            });
          }
        }
      });

      alTerminar?.();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · Proyecto */}
      <Tarjeta titulo="1 · Proyectos" descripcion="Selección múltiple sobre la base maestra.">
        <GrillaCampos columnas={3} className="mb-3">
          <CampoSelect etiqueta="Área" requerido opciones={opcionesArea} value={area} onChange={(e) => setArea(e.target.value)} />
          <CampoFecha etiqueta="Fecha del seguimiento" requerido value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <CampoHora etiqueta="Hora" value={hora} onChange={(e) => setHora(e.target.value)} />
        </GrillaCampos>
        <SelectorProyecto multiple valor={ids} alCambiar={setIds} etiqueta="Proyectos tratados" requerido />
        <CampoTexto
          etiqueta="Participantes"
          className="mt-3"
          value={participantes}
          onChange={(e) => setParticipantes(e.target.value)}
          placeholder="Nombres separados por coma"
        />
      </Tarjeta>

      {/* 2 · Última actualización */}
      {elegidos.length > 0 && (
        <Tarjeta
          titulo="2 · Última actualización registrada"
          descripcion="Estado y avance de la carga anterior. Confirmá o corregí el avance actual."
          sinPadding
        >
          <ul className="divide-y divide-borde/60">
            {elegidos.map((p) => {
              const ultima = ultimaActualizacion(bd, p.id_proyecto);
              const corregido = avancesCorregidos[p.id_proyecto];
              return (
                <li key={p.id_proyecto} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium leading-tight text-tinta">{p.proyecto}</p>
                    <p className="text-[11px] text-tenue">
                      {p.id_proyecto} · última carga {ultima ? haceCuanto(ultima) : 'sin registro'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gris">Registrado</p>
                    <p className="tabular text-sm text-tinta">
                      {numero(p.avance)} / {numero(p.objetivo)} {p.unidad}
                    </p>
                    <Chip tono="neutro">{p.estado}</Chip>
                  </div>
                  <div className="w-36 shrink-0">
                    <label className="mb-1 block text-[11px] font-medium text-gris" htmlFor={`avance-${p.id_proyecto}`}>
                      Avance actual
                    </label>
                    <input
                      id={`avance-${p.id_proyecto}`}
                      type="number"
                      className="campo-base tabular py-1.5 text-sm"
                      placeholder={String(p.avance)}
                      value={corregido ?? ''}
                      onChange={(e) =>
                        setAvancesCorregidos((a) => ({ ...a, [p.id_proyecto]: e.target.value }))
                      }
                    />
                    {corregido !== undefined && corregido !== '' && Number(corregido) !== Number(p.avance) && (
                      <p className="mt-0.5 text-[11px] text-acento">
                        {Number(corregido) > Number(p.avance) ? '+' : ''}
                        {numero(Number(corregido) - Number(p.avance))} ·{' '}
                        {porcentajeAvance({ avance: corregido, objetivo: p.objetivo })}%
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-borde px-4 py-3">
            <CampoSelect
              etiqueta="Estado reportado por el área"
              ayuda="se aplica a los proyectos con avance corregido"
              opciones={ESTADOS_PROYECTO}
              value={estadoReportado}
              onChange={(e) => setEstadoReportado(e.target.value)}
              placeholder="Sin cambios"
              className="max-w-64"
            />
          </div>
        </Tarjeta>
      )}

      {/* 3 · Minuta */}
      <Tarjeta
        titulo="3 · Lo conversado"
        descripcion="Volcá la minuta tal como salió de la reunión."
        acciones={
          <Boton variante="primario" tamanio="sm" icono={Sparkles} onClick={separar} disabled={!texto.trim()}>
            Separar automáticamente
          </Boton>
        }
      >
        <CampoArea
          filas={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          // El campo no lleva etiqueta visible porque el título de la tarjeta ya
          // dice qué es; el lector de pantalla no lee ese título al enfocar.
          aria-label="Texto de la minuta"
          placeholder={
            'Ej.: Se ejecutaron 200 metros de cordón cuneta en el sector norte. Falta la conformidad ' +
            'del área técnica para avanzar. Ferreyra va a presentar el informe actualizado antes del 15/09.'
          }
        />
      </Tarjeta>

      {/* 4 · Tres bloques */}
      <Tarjeta
        titulo="4 · Revisión antes de guardar"
        descripcion="Los tres bloques son editables. Nada se guarda hasta confirmar."
      >
        {separado && (
          <div className="mb-3">
            <Aviso tono="alerta" titulo="Separación automática">
              Los bloques se completaron con una propuesta del sistema. <strong>Revisá y corregí</strong>{' '}
              antes de confirmar: nada se guarda hasta que aprietes «Guardar seguimiento».
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

        {error && (
          <div className="mt-3">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-borde pt-4">
          <span className="mr-auto text-xs text-tenue">
            Se van a crear {compromisos.filter((c) => c.descripcion.trim()).length} compromiso(s).
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
      <div className="flex flex-col gap-2 p-3">
        {filas.length === 0 && (
          <p className="py-2 text-center text-xs text-tenue">
            Sin compromisos. Agregá uno a mano o usá la separación automática.
          </p>
        )}
        {filas.map((fila) => {
          const fechaInvalida = fila.fecha_limite && fila.fecha_limite < hoy;
          return (
            <div key={fila.clave} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_140px_auto]">
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
          );
        })}
        <Boton tamanio="sm" variante="fantasma" icono={Plus} onClick={() => setFilas((f) => [...f, filaVacia()])} className="self-start">
          Agregar compromiso
        </Boton>
      </div>
    </fieldset>
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
