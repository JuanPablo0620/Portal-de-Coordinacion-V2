/**
 * Importación masiva de planificación anual por CSV.
 *
 * Mismo flujo que la de proyectos: subir o pegar → mapeo → vista previa con
 * validación → confirmar. La validación clave acá es que el `id_proyecto`
 * exista en la base maestra: sin eso, la planificación quedaría huérfana.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileUp, Upload } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Vacio } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoSelect } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { filasAObjetos, parsearCSV } from '../../datos/csv.js';
import { activos } from '../../datos/selectores.js';
import { numero } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';

const CAMPOS = [
  { clave: 'id_proyecto', titulo: 'ID de proyecto', requerido: true },
  { clave: 'anio', titulo: 'Año', numerico: true },
  { clave: 'meta_anual', titulo: 'Meta anual', requerido: true, numerico: true },
  { clave: 't1', titulo: 'Meta T1', numerico: true },
  { clave: 't2', titulo: 'Meta T2', numerico: true },
  { clave: 't3', titulo: 'Meta T3', numerico: true },
  { clave: 't4', titulo: 'Meta T4', numerico: true },
  { clave: 'monto_planificado', titulo: 'Monto planificado', numerico: true },
];

const PLANTILLA = CAMPOS.map((c) => c.clave).join(',');

export function ImportarPlanificacion({ abierto, alCerrar, anio }) {
  const bd = useBD();
  const [texto, setTexto] = useState('');
  const [mapeo, setMapeo] = useState({});
  const [resultado, setResultado] = useState(null);
  const [importando, setImportando] = useState(false);

  const idsValidos = useMemo(
    () => new Set(activos(bd?.proyectos ?? []).map((p) => p.id_proyecto)),
    [bd],
  );

  const parseado = useMemo(() => (texto.trim() ? parsearCSV(texto) : null), [texto]);

  function alCargarTexto(contenido) {
    setTexto(contenido);
    setResultado(null);
    const { encabezados } = parsearCSV(contenido);
    const propuesto = {};
    for (const campo of CAMPOS) {
      const i = encabezados.findIndex(
        (e) => e.toLowerCase().replace(/[\s_]/g, '') === campo.clave.toLowerCase().replace(/[\s_]/g, ''),
      );
      if (i >= 0) propuesto[campo.clave] = String(i);
    }
    setMapeo(propuesto);
  }

  const validadas = useMemo(() => {
    if (!parseado) return null;
    const objetos = filasAObjetos(parseado.filas, mapeo);
    const aceptadas = [];
    const rechazadas = [];

    objetos.forEach((crudo, i) => {
      const motivos = [];
      const limpio = {};

      for (const campo of CAMPOS) {
        const valor = (crudo[campo.clave] ?? '').trim();
        if (campo.requerido && !valor) {
          motivos.push(`falta ${campo.titulo.toLowerCase()}`);
          continue;
        }
        if (!valor) continue;
        if (campo.numerico) {
          const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
          if (!Number.isFinite(n)) motivos.push(`${campo.titulo.toLowerCase()} no es un número`);
          else limpio[campo.clave] = n;
        } else {
          limpio[campo.clave] = valor;
        }
      }

      if (limpio.id_proyecto && !idsValidos.has(limpio.id_proyecto)) {
        motivos.push(`el proyecto «${limpio.id_proyecto}» no existe en la base maestra`);
      }

      if (motivos.length) {
        rechazadas.push({ id: `r${i}`, fila: i + 2, id_proyecto: crudo.id_proyecto || '(sin id)', motivo: motivos.join(' · ') });
      } else {
        aceptadas.push({
          id: `a${i}`,
          id_proyecto: limpio.id_proyecto,
          anio: limpio.anio ?? anio,
          meta_anual: limpio.meta_anual,
          metas_trimestrales: [limpio.t1 ?? 0, limpio.t2 ?? 0, limpio.t3 ?? 0, limpio.t4 ?? limpio.meta_anual],
          monto_planificado: limpio.monto_planificado ?? 0,
          hitos: [],
        });
      }
    });

    return { aceptadas, rechazadas };
  }, [parseado, mapeo, idsValidos, anio]);

  async function importar() {
    setImportando(true);
    try {
      const r = await acciones.importarPlanificacion(validadas.aceptadas.map(({ id, ...resto }) => resto));
      setResultado({ ...r, rechazadas: validadas.rechazadas.length });
    } finally {
      setImportando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="xl"
      titulo="Importar planificación anual"
      descripcion="Carga masiva por CSV sobre proyectos ya existentes en la base maestra."
      pie={
        resultado ? (
          <Boton variante="primario" onClick={alCerrar}>
            Cerrar
          </Boton>
        ) : (
          <>
            <Boton onClick={alCerrar}>Cancelar</Boton>
            <Boton variante="primario" icono={Upload} onClick={importar} disabled={!validadas?.aceptadas.length || importando}>
              Importar {validadas?.aceptadas.length ?? 0} fila(s)
            </Boton>
          </>
        )
      }
    >
      {resultado ? (
        <Aviso tono={resultado.errores.length ? 'alerta' : 'info'} titulo="Importación terminada">
          Se guardaron <strong>{resultado.importados}</strong> planificaciones.
          {resultado.rechazadas > 0 && ` Quedaron ${resultado.rechazadas} filas sin importar.`}
        </Aviso>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-chip border border-borde-fuerte bg-card px-3.5 py-2 text-sm font-medium text-tinta transition hover:bg-paper">
              <FileUp size={16} />
              Subir archivo
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const a = e.target.files?.[0];
                  if (a) alCargarTexto(await a.text());
                }}
              />
            </label>
            <span className="text-xs text-tenue">o pegá el contenido abajo</span>
          </div>

          <CampoArea
            etiqueta="Contenido CSV"
            filas={5}
            value={texto}
            onChange={(e) => alCargarTexto(e.target.value)}
            placeholder={`${PLANTILLA}\nOBR-${anio}-001,${anio},400,100,200,300,400,85000000`}
            className="font-mono"
          />

          {parseado && (
            <>
              <fieldset className="rounded-chip border border-borde p-3">
                <legend className="px-1 text-xs font-semibold text-gris">Mapeo de columnas</legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                  {CAMPOS.map((campo) => (
                    <CampoSelect
                      key={campo.clave}
                      etiqueta={campo.titulo}
                      requerido={campo.requerido}
                      placeholder="— ignorar —"
                      value={mapeo[campo.clave] ?? ''}
                      onChange={(e) => setMapeo((m) => ({ ...m, [campo.clave]: e.target.value }))}
                      opciones={parseado.encabezados.map((e, i) => ({ valor: String(i), titulo: e || `Columna ${i + 1}` }))}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="tarjeta overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-borde bg-enregla-suave px-3 py-2">
                    <Check size={15} className="text-enregla" />
                    <span className="text-xs font-semibold text-tinta">{validadas.aceptadas.length} listas</span>
                  </div>
                  {validadas.aceptadas.length ? (
                    <Tabla
                      densidad="compacta"
                      conBusqueda={false}
                      maxAltura={200}
                      filas={validadas.aceptadas}
                      columnas={[
                        { clave: 'id_proyecto', titulo: 'Proyecto' },
                        { clave: 'meta_anual', titulo: 'Meta anual', alinear: 'derecha', render: (f) => numero(f.meta_anual) },
                        {
                          clave: 'metas_trimestrales',
                          titulo: 'T1–T4',
                          render: (f) => <span className="tabular text-xs">{f.metas_trimestrales.join(' · ')}</span>,
                        },
                      ]}
                    />
                  ) : (
                    <Vacio compacto titulo="Ninguna fila válida" />
                  )}
                </div>

                <div className="tarjeta overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-borde bg-vencido-suave px-3 py-2">
                    <AlertTriangle size={15} className="text-vencido" />
                    <span className="text-xs font-semibold text-tinta">{validadas.rechazadas.length} rechazadas</span>
                  </div>
                  {validadas.rechazadas.length ? (
                    <Tabla
                      densidad="compacta"
                      conBusqueda={false}
                      maxAltura={200}
                      filas={validadas.rechazadas}
                      columnas={[
                        { clave: 'fila', titulo: 'Fila', ancho: 50, alinear: 'derecha' },
                        { clave: 'id_proyecto', titulo: 'Proyecto' },
                        { clave: 'motivo', titulo: 'Motivo', render: (f) => <span className="text-xs text-vencido">{f.motivo}</span> },
                      ]}
                    />
                  ) : (
                    <Vacio compacto titulo="Sin rechazos" />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
