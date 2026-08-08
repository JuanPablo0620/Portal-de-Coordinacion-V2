/**
 * Importación de proyectos por CSV.
 *
 * Flujo: subir o pegar → mapeo de columnas → vista previa con validación contra
 * los catálogos → confirmar. Se importan sólo las filas aceptadas; las
 * rechazadas se muestran con el motivo, en lugar de un total opaco.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileUp, Upload } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip, Vacio } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoSelect } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { filasAObjetos, parsearCSV } from '../../datos/csv.js';
import { ESTADOS_PROYECTO, PRIORIDADES } from '../../datos/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones } from '../../estado/tienda.js';
import { useItems } from '../../utilidades/catalogos.js';

/** Campos importables. Los marcados como requeridos rechazan la fila si faltan. */
const CAMPOS = [
  { clave: 'proyecto', titulo: 'Nombre del proyecto', requerido: true },
  { clave: 'area', titulo: 'Área', requerido: true, catalogo: 'areas' },
  { clave: 'programa', titulo: 'Programa', catalogo: 'programas' },
  { clave: 'eje', titulo: 'Eje', catalogo: 'ejes' },
  { clave: 'tipo', titulo: 'Tipo', requerido: true, catalogo: 'tipos' },
  { clave: 'unidad', titulo: 'Unidad', requerido: true, catalogo: 'unidades' },
  { clave: 'objetivo', titulo: 'Objetivo', requerido: true, numerico: true },
  { clave: 'avance', titulo: 'Avance', numerico: true },
  { clave: 'cantidad', titulo: 'Cantidad', numerico: true },
  { clave: 'estado', titulo: 'Estado', lista: ESTADOS_PROYECTO },
  { clave: 'prioridad', titulo: 'Prioridad', lista: PRIORIDADES },
  { clave: 'responsable', titulo: 'Responsable' },
  { clave: 'fecha_inicio', titulo: 'Fecha de inicio', fecha: true },
  { clave: 'fecha_fin_prevista', titulo: 'Fin previsto', fecha: true },
  { clave: 'monto_planificado', titulo: 'Monto planificado', numerico: true },
  { clave: 'monto_ejecutado', titulo: 'Monto ejecutado', numerico: true },
];

const PLANTILLA = CAMPOS.map((c) => c.clave).join(',');

export function ImportarProyectos({ abierto, alCerrar }) {
  const [texto, setTexto] = useState('');
  const [mapeo, setMapeo] = useState({});
  const [resultado, setResultado] = useState(null);
  const [importando, setImportando] = useState(false);

  const catalogos = {
    areas: useItems('areas'),
    programas: useItems('programas'),
    ejes: useItems('ejes'),
    tipos: useItems('tipos'),
    unidades: useItems('unidades'),
  };

  const parseado = useMemo(() => (texto.trim() ? parsearCSV(texto) : null), [texto]);

  /** Al parsear, se propone un mapeo automático por coincidencia de nombre. */
  function alCargarTexto(contenido) {
    setTexto(contenido);
    setResultado(null);
    const { encabezados } = parsearCSV(contenido);
    const propuesto = {};
    for (const campo of CAMPOS) {
      const indice = encabezados.findIndex(
        (e) => e.toLowerCase().replace(/[\s_]/g, '') === campo.clave.toLowerCase().replace(/[\s_]/g, ''),
      );
      if (indice >= 0) propuesto[campo.clave] = String(indice);
    }
    setMapeo(propuesto);
  }

  async function alSubirArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    alCargarTexto(await archivo.text());
  }

  /** Valida cada fila contra los catálogos y devuelve aceptadas y rechazadas. */
  const validadas = useMemo(() => {
    if (!parseado) return null;
    const objetos = filasAObjetos(parseado.filas, mapeo);
    const aceptadas = [];
    const rechazadas = [];

    objetos.forEach((crudo, i) => {
      const motivos = [];
      const limpio = { ...crudo };

      for (const campo of CAMPOS) {
        const valor = (crudo[campo.clave] ?? '').trim();

        if (campo.requerido && !valor) {
          motivos.push(`falta ${campo.titulo.toLowerCase()}`);
          continue;
        }
        if (!valor) continue;

        if (campo.catalogo) {
          const item = catalogos[campo.catalogo].find(
            (x) => x.nombre.toLowerCase() === valor.toLowerCase(),
          );
          if (!item) motivos.push(`«${valor}» no está en el catálogo de ${campo.titulo.toLowerCase()}`);
          else limpio[campo.clave] = item.nombre;
        }
        if (campo.lista && !campo.lista.includes(valor.toLowerCase())) {
          motivos.push(`«${valor}» no es un valor válido de ${campo.titulo.toLowerCase()}`);
        }
        if (campo.numerico) {
          const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
          if (!Number.isFinite(n)) motivos.push(`${campo.titulo.toLowerCase()} no es un número`);
          else limpio[campo.clave] = n;
        }
        if (campo.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
          // Se acepta DD/MM/AAAA y se normaliza a ISO.
          const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (m) limpio[campo.clave] = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
          else motivos.push(`${campo.titulo.toLowerCase()} debe ser DD/MM/AAAA o AAAA-MM-DD`);
        }
      }

      if (motivos.length) {
        rechazadas.push({ id: `r${i}`, fila: i + 2, proyecto: crudo.proyecto || '(sin nombre)', motivo: motivos.join(' · ') });
      } else {
        const area = catalogos.areas.find((a) => a.nombre === limpio.area);
        const tipo = catalogos.tipos.find((t) => t.nombre === limpio.tipo);
        aceptadas.push({
          id: `a${i}`,
          ...limpio,
          id_area: area?.id,
          es_obra: Boolean(tipo?.es_obra),
          estado: limpio.estado || 'planificado',
          prioridad: limpio.prioridad || 'media',
          fecha_carga: limpio.fecha_inicio || hoyISO(),
        });
      }
    });

    return { aceptadas, rechazadas };
  }, [parseado, mapeo, catalogos]);

  async function importar() {
    setImportando(true);
    try {
      const r = await acciones.importarProyectos(validadas.aceptadas.map(({ id, ...resto }) => resto));
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
      titulo="Importar proyectos desde CSV"
      descripcion="Se importan sólo las filas que pasan la validación contra los catálogos."
      pie={
        resultado ? (
          <Boton variante="primario" onClick={alCerrar}>
            Cerrar
          </Boton>
        ) : (
          <>
            <Boton onClick={alCerrar}>Cancelar</Boton>
            <Boton
              variante="primario"
              icono={Upload}
              onClick={importar}
              disabled={!validadas?.aceptadas.length || importando}
            >
              Importar {validadas?.aceptadas.length ?? 0} {validadas?.aceptadas.length === 1 ? 'fila' : 'filas'}
            </Boton>
          </>
        )
      }
    >
      {resultado ? (
        <div className="flex flex-col gap-3">
          <Aviso tono={resultado.errores.length ? 'alerta' : 'info'} titulo="Importación terminada">
            Se crearon <strong>{resultado.importados}</strong> proyectos.
            {resultado.rechazadas > 0 && ` Quedaron ${resultado.rechazadas} filas sin importar por errores de validación.`}
          </Aviso>
          {resultado.errores.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-vencido">
              {resultado.errores.map((e) => (
                <li key={e.fila}>
                  Fila {e.fila}: {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-chip border border-borde-fuerte bg-card px-3.5 py-2 text-sm font-medium text-tinta transition hover:bg-paper">
                <FileUp size={16} />
                Subir archivo
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={alSubirArchivo} />
              </label>
              <span className="text-xs text-tenue">o pegá el contenido abajo</span>
            </div>
            <CampoArea
              etiqueta="Contenido CSV"
              filas={5}
              value={texto}
              onChange={(e) => alCargarTexto(e.target.value)}
              placeholder={`${PLANTILLA}\nRepavimentación Los Álamos,Secretaría de Obras Públicas,…`}
              className="font-mono"
            />
            <p className="text-[11px] text-tenue">
              Columnas reconocidas: <code className="rounded bg-paper px-1">{PLANTILLA}</code>. Se
              detecta coma o punto y coma como separador.
            </p>
          </div>

          {parseado && (
            <>
              <fieldset className="rounded-chip border border-borde p-3">
                <legend className="px-1 text-xs font-semibold text-gris">
                  Mapeo de columnas ({parseado.encabezados.length} detectadas)
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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
                    <span className="text-xs font-semibold text-tinta">
                      {validadas.aceptadas.length} filas listas para importar
                    </span>
                  </div>
                  {validadas.aceptadas.length ? (
                    <Tabla
                      densidad="compacta"
                      conBusqueda={false}
                      maxAltura={220}
                      filas={validadas.aceptadas}
                      columnas={[
                        { clave: 'proyecto', titulo: 'Proyecto' },
                        { clave: 'area', titulo: 'Área' },
                        { clave: 'objetivo', titulo: 'Objetivo', alinear: 'derecha' },
                      ]}
                    />
                  ) : (
                    <Vacio compacto titulo="Ninguna fila pasa la validación" />
                  )}
                </div>

                <div className="tarjeta overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-borde bg-vencido-suave px-3 py-2">
                    <AlertTriangle size={15} className="text-vencido" />
                    <span className="text-xs font-semibold text-tinta">
                      {validadas.rechazadas.length} filas rechazadas
                    </span>
                  </div>
                  {validadas.rechazadas.length ? (
                    <Tabla
                      densidad="compacta"
                      conBusqueda={false}
                      maxAltura={220}
                      filas={validadas.rechazadas}
                      columnas={[
                        { clave: 'fila', titulo: 'Fila', ancho: 50, alinear: 'derecha' },
                        { clave: 'proyecto', titulo: 'Proyecto' },
                        { clave: 'motivo', titulo: 'Motivo', render: (f) => <span className="text-xs text-vencido">{f.motivo}</span> },
                      ]}
                    />
                  ) : (
                    <Vacio compacto titulo="Sin rechazos" descripcion="Todas las filas pasan la validación." />
                  )}
                </div>
              </div>

              <Aviso tono="info">
                Los valores de área, programa, eje, tipo y unidad tienen que existir en los
                catálogos. Si falta alguno, agregalo primero en{' '}
                <Chip tono="acento">Configuración → Catálogos</Chip> y volvé a importar.
              </Aviso>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
