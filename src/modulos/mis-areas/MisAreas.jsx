/**
 * ─────────────────────────────────────────────────────────────────────
 * MIS ÁREAS — vista personal de monitoreo.
 *
 * Cada integrante de Coordinación sigue de cerca un subconjunto de
 * secretarías, no las siete. Esta pantalla es la versión recortada del
 * Tablero de secretarías (Monitoreo → Por secretaría): mismas tarjetas,
 * mismo semáforo, mismas alertas — solo que acotadas a las áreas que la
 * persona eligió, para no tener que mirar las siete cada vez.
 *
 * No hay login real en el sistema (ver `Configuración → Usuario actual`), así
 * que la identidad es el nombre libre de `config.usuario`. Cambiar ese nombre
 * cambia qué asignación se ve acá — es la misma convención que ya usa todo
 * el sistema para «quién carga esto», no una decisión nueva de este módulo.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, Save, UserCheck } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { identidadArea } from '../../componentes/identidadArea.jsx';
import { TarjetaSecretaria } from '../monitoreo/TableroSecretarias.jsx';
import { descargarCSV } from '../../datos/csv.js';
import { calcularAlertas, TIPOS_ALERTA } from '../../datos/alertas.js';
import {
  areasAsignadas,
  compromisos as selCompromisos,
  hoyISO,
  resumenSecretarias,
} from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useItems } from '../../utilidades/catalogos.js';
import { acciones, useBD, useUsuario } from '../../estado/tienda.js';

/**
 * Columnas de "Compromisos vencidos". A propósito NO son las de
 * `COLUMNAS_COMPROMISO` (columnasCompromiso.jsx) — esa versión también la
 * usan Seguimiento, la ficha de proyecto y la hoja de secretaría, y ahí no
 * se pidió este mismo recorte. Acá se saca Responsable, y el estado dice
 * sólo "N días" (sin la palabra "vencido" — ya está la tarjeta entera
 * tintada de rojo para eso).
 */
const COLUMNAS_VENCIDOS = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => (
      <div className="min-w-40">
        <p className="leading-tight text-tinta">{f.descripcion}</p>
        <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
      </div>
    ),
  },
  { clave: 'area', titulo: 'Área', ancho: 190 },
  {
    clave: 'fecha_limite',
    titulo: 'Vence',
    ancho: 100,
    render: (f) => <span className="tabular text-xs">{fFecha(f.fecha_limite)}</span>,
    formatoCSV: fFecha,
  },
  {
    clave: 'estado_efectivo',
    titulo: 'Estado',
    ancho: 130,
    render: (f) => <Semaforo nivel="vencido" texto={`${f.dias_atraso} días`} />,
  },
];

/**
 * Columnas de "Compromisos pendientes" — hoy SÓLO para el CSV.
 *
 * La pantalla dejó de ser una tabla el 14/09/2026 (ver
 * `PendientesPorVencimiento` más abajo), pero la exportación sigue siendo
 * tabular: un CSV agrupado no se puede abrir en una planilla. Estas columnas
 * son las que tenía la tabla, así que el archivo que baja hoy es idéntico al
 * que bajaba antes — cambió cómo se lee en pantalla, no lo que se exporta.
 *
 * `aCSV` sólo mira `clave`, `titulo` y `formatoCSV`; los `render` quedaron
 * porque describen el valor de la columna y sirven si algún día vuelve a
 * usarse en una tabla.
 */
const COLUMNAS_PENDIENTES = [
  { clave: 'descripcion', titulo: 'Compromiso' },
  { clave: 'area', titulo: 'Área' },
  { clave: 'fecha_limite', titulo: 'Vence', formatoCSV: fFecha },
  { clave: 'estado_efectivo', titulo: 'Estado' },
  { clave: 'origen_tipo', titulo: 'Origen' },
];

export default function MisAreas() {
  const bd = useBD();
  const hoy = hoyISO();
  const usuario = useUsuario();
  const navegar = useNavigate();
  const areasCatalogo = useItems('areas');

  const asignadas = useMemo(() => (bd ? areasAsignadas(bd, usuario) : []), [bd, usuario]);

  const alertas = useMemo(() => (bd ? calcularAlertas(bd, hoy) : []), [bd, hoy]);
  const alertasPropias = useMemo(
    () => alertas.filter((a) => asignadas.includes(a.area)),
    [alertas, asignadas],
  );
  // Compromisos vencidos: misma fuente y misma tabla que "pendientes" de más
  // abajo, filtrados al revés — así se ven exactamente igual en las dos
  // secciones, solo cambia qué filas entran en cada una.
  const compromisosVencidos = useMemo(
    () =>
      bd ? selCompromisos(bd, { area: asignadas }, hoy).filter((c) => c.estado_efectivo === 'vencido') : [],
    [bd, asignadas, hoy],
  );

  // Alertas críticas que no son un compromiso (ej. un cierre de posicionamiento
  // ya vencido) — no tienen la forma de un compromiso, así que siguen con el
  // formato compacto de alertas en vez de la tabla.
  const otrasAlertasVencidas = useMemo(
    () =>
      alertasPropias.filter((a) => a.severidad === 'critica' && a.tipo !== TIPOS_ALERTA.COMPROMISO_VENCIDO),
    [alertasPropias],
  );

  // Los vencidos ya se muestran arriba — acá abajo sólo lo que sigue en curso
  // (pendiente/en_curso) o se cumplió.
  const compromisosPropios = useMemo(
    () =>
      bd
        ? selCompromisos(bd, { area: asignadas, solo_vigentes: true }, hoy).filter(
            (c) => c.estado_efectivo !== 'vencido',
          )
        : [],
    [bd, asignadas, hoy],
  );

  const resumenes = useMemo(() => (bd ? resumenSecretarias(bd, {}, hoy) : []), [bd, hoy]);
  const propios = resumenes.filter((r) => asignadas.includes(r.area));
  const porArea = useMemo(() => {
    const cuenta = new Map();
    for (const a of alertasPropias) if (a.area) cuenta.set(a.area, (cuenta.get(a.area) ?? 0) + 1);
    return cuenta;
  }, [alertasPropias]);

  return (
    <>
      <EncabezadoPagina
        titulo="Mis áreas"
        descripcion={`Secretarías que ${usuario} monitorea de cerca — alertas, compromisos pendientes y estado, sin tener que mirar las siete.`}
      />
      <Pagina className="flex flex-col gap-4">
        <SelectorAreas usuario={usuario} areasCatalogo={areasCatalogo} asignadas={asignadas} />

        {asignadas.length === 0 ? (
          <Tarjeta>
            <Vacio
              icono={UserCheck}
              titulo="Todavía no elegiste ninguna área"
              descripcion="Marcá arriba las secretarías que seguís de cerca y guardá — el resto de esta pantalla se arma con lo que elijas."
            />
          </Tarjeta>
        ) : (
          <>
            {/* Fondo apenas tintado de rojo para que la tarjeta se distinga del resto
                de un vistazo, sin ser disruptiva — mismo tono que ya usa la app para
                sus chips de "vencido" (--color-vencido-suave). El borde va un poco
                más saturado, para que se note el recuadro. */}
            {compromisosVencidos.length > 0 && (
              <Tarjeta
                titulo="Alerta: Compromisos vencidos de tus áreas"
                descripcion="Un clic en la fila abre el compromiso en Seguimiento."
                sinPadding
                style={{ background: 'var(--color-vencido-suave)', borderColor: '#f0c7cb' }}
              >
                <Tabla
                  nombreExport="mis-areas-compromisos-vencidos"
                  filas={compromisosVencidos}
                  conBusqueda={false}
                  columnas={COLUMNAS_VENCIDOS}
                  colorEncabezado="#f6d8dc"
                  alHacerClicFila={(c) => navegar(`/seguimiento?tab=compromisos&compromiso=${c.id}`)}
                />
              </Tarjeta>
            )}

            {otrasAlertasVencidas.length > 0 && (
              <Tarjeta
                titulo="Otras alertas vencidas"
                descripcion="Lo que ya venció y no es un compromiso — sale del mismo motor que el inicio y Monitoreo."
                sinPadding
              >
                <ListaAlertas alertas={otrasAlertasVencidas} limite={otrasAlertasVencidas.length} />
              </Tarjeta>
            )}

            <PendientesPorVencimiento
              compromisos={compromisosPropios}
              areasCatalogo={areasCatalogo}
              alAbrir={(c) => navegar(`/seguimiento?tab=compromisos&compromiso=${c.id}`)}
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tenue">
                Estado de tus secretarías
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {propios.map((r) => (
                  <TarjetaSecretaria
                    key={r.area}
                    resumen={r}
                    prefijo={areasCatalogo.find((a) => a.nombre === r.area)?.prefijo}
                    alertas={porArea.get(r.area) ?? 0}
                    alAbrir={() =>
                      navegar(`/monitoreo?tab=secretarias&secretaria=${encodeURIComponent(r.area)}`)
                    }
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </Pagina>
    </>
  );
}

/* ── Compromisos pendientes, agrupados por vencimiento ───────────────── */

/**
 * La fecha de vencimiento es un ENCABEZADO, no una celda repetida.
 *
 * La tabla anterior tenía cuatro columnas y tres de ellas escribían el mismo
 * valor en todas las filas: el área (cuando se sigue una sola secretaría, que
 * es el caso habitual de esta pantalla), la fecha y el estado. Con los seis
 * compromisos de Ambiente del 14/09/2026 eso era «Secretaría de Ambiente y
 * Servicios Públicos · 21/10/2026 · pendiente» seis veces — cerca del 45% del
 * ancho ocupado por texto que no distingue una fila de otra.
 *
 * Acá cada vencimiento se enuncia una sola vez, con los días que faltan
 * —que es el dato que decide si algo se trata hoy o la semana que viene, y que
 * la tabla no mostraba— y cuántos compromisos caen ahí. La fila queda en una
 * línea: sigla del área, texto, origen.
 *
 * El estado no se escribe: los cumplidos y los vencidos no llegan hasta acá
 * (los primeros los saca `solo_vigentes`, los segundos tienen su propia tabla
 * arriba), así que el chip «pendiente» repetido no informaba nada. Lo que sí
 * varía —cuán cerca está el vencimiento— lo dice el punto del semáforo, con
 * la misma escala de `nivelPorDias` que usa el resto del portal.
 */
function PendientesPorVencimiento({ compromisos, areasCatalogo, alAbrir }) {
  // `selCompromisos` ya devuelve ordenado por `fecha_limite` ascendente y con
  // los sin fecha al final; agrupar con un Map conserva ese orden, así que no
  // hay que volver a ordenar ni replicar el criterio.
  const grupos = useMemo(() => {
    const porFecha = new Map();
    for (const c of compromisos) {
      const clave = c.fecha_limite ?? 'sin-fecha';
      if (!porFecha.has(clave)) {
        porFecha.set(clave, { fecha: c.fecha_limite ?? null, dias: c.dias_restantes ?? null, filas: [] });
      }
      porFecha.get(clave).filas.push(c);
    }
    return [...porFecha.values()];
  }, [compromisos]);

  return (
    <Tarjeta
      titulo="Compromisos pendientes de tus áreas"
      descripcion="Vigentes, no recortados por período: son estado, no historia. Los vencidos no se repiten acá — están arriba, en su propia tabla. Un clic en la fila abre el compromiso en Seguimiento."
      sinPadding
      acciones={
        compromisos.length > 0 && (
          <Boton
            tamanio="sm"
            icono={Download}
            onClick={() => descargarCSV('mis-areas-compromisos', compromisos, COLUMNAS_PENDIENTES)}
            title="Exportar a CSV los compromisos de la lista"
          >
            CSV
          </Boton>
        )
      }
    >
      {grupos.length === 0 ? (
        <Vacio compacto icono={ClipboardList} titulo="Sin compromisos pendientes en tus áreas" />
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.fecha ?? 'sin-fecha'}>
            <header className="flex items-center gap-2 border-b border-t border-borde bg-paper px-4 py-2 first:border-t-0">
              <Semaforo nivel={nivelPorDias(grupo.dias)} soloPunto texto={tituloVencimiento(grupo)} />
              <h3 className="text-xs font-semibold text-tinta">{tituloVencimiento(grupo)}</h3>
              {grupo.fecha && <span className="tabular text-[11px] text-tenue">{fFecha(grupo.fecha)}</span>}
              <span className="tabular ml-auto text-[11px] text-tenue">
                {grupo.filas.length} compromiso{grupo.filas.length === 1 ? '' : 's'}
              </span>
            </header>
            {grupo.filas.map((c) => {
              const identidad = identidadArea(c.area, areasCatalogo);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alAbrir(c)}
                  className="flex w-full items-center gap-2.5 border-b border-borde px-4 py-2 text-left last:border-b-0 hover:bg-paper"
                >
                  <Chip tono={identidad.tono} title={identidad.nombreArea}>
                    {identidad.sigla}
                  </Chip>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-tinta">{c.descripcion}</span>
                  <span className="shrink-0 text-[11px] text-tenue">{c.origen_tipo}</span>
                </button>
              );
            })}
          </section>
        ))
      )}
    </Tarjeta>
  );
}

/**
 * Cuánto falta, en palabras. Los días importan más que la fecha —«en 37 días»
 * se entiende sin hacer la cuenta— así que van adelante y la fecha queda al
 * lado, en gris, para quien la necesite exacta.
 */
function tituloVencimiento({ fecha, dias }) {
  if (!fecha) return 'Sin fecha límite';
  if (dias === null || dias === undefined) return 'Vence';
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/* ── Selector de áreas asignadas ─────────────────────────────────────── */

function SelectorAreas({ usuario, areasCatalogo, asignadas }) {
  const [seleccion, setSeleccion] = useState(asignadas);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);

  // Si `asignadas` cambia por fuera (otro nombre de usuario, u otra pestaña
  // guardó), la selección visible se resincroniza — si no, quedaría mostrando
  // lo de la persona anterior.
  const clave = asignadas.join('|');
  const [claveVista, setClaveVista] = useState(clave);
  if (clave !== claveVista) {
    setClaveVista(clave);
    setSeleccion(asignadas);
  }

  const alternar = (nombre) =>
    setSeleccion((s) => (s.includes(nombre) ? s.filter((n) => n !== nombre) : [...s, nombre]));

  const nombresCatalogo = areasCatalogo.map((a) => a.nombre);
  const todasElegidas = nombresCatalogo.length > 0 && nombresCatalogo.every((n) => seleccion.includes(n));
  // «Elegir todo» es un toggle, no un botón de una sola dirección: con todas
  // marcadas, tocarlo tiene que vaciar la selección, no quedarse sin efecto.
  const alternarTodas = () => setSeleccion(todasElegidas ? [] : nombresCatalogo);

  const huboCambios = seleccion.slice().sort().join('|') !== asignadas.slice().sort().join('|');

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await acciones.guardarAsignacionesMonitoreo(usuario, seleccion);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      // Habia un try sin catch: si la base rechazaba la escritura, el error se
      // perdia y la pantalla mostraba el boton listo otra vez, como si hubiera
      // guardado.
      setError(e?.message ?? 'No se pudieron guardar tus áreas.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Tus áreas"
      descripcion={`Elegí qué secretarías monitoreás como ${usuario}. Se guarda para este nombre de usuario — si otra persona usa esta computadora con su propio nombre, va a ver su propia selección.`}
      acciones={
        <>
          {guardado && <Chip tono="enregla">Guardado</Chip>}
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton variante="primario" tamanio="sm" icono={Save} onClick={guardar} disabled={guardando || !huboCambios}>
            Guardar
          </Boton>
        </>
      }
    >
      {areasCatalogo.length === 0 ? (
        <Aviso tono="info">No hay áreas cargadas en el catálogo todavía.</Aviso>
      ) : (
        <>
          <CampoCheck
            etiqueta={todasElegidas ? 'Quitar todas' : 'Elegir todas'}
            checked={todasElegidas}
            onChange={alternarTodas}
            className="mb-2.5 border-b border-borde pb-2.5 font-medium"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {areasCatalogo.map((a) => (
              <CampoCheck
                key={a.id}
                etiqueta={a.nombre}
                checked={seleccion.includes(a.nombre)}
                onChange={() => alternar(a.nombre)}
              />
            ))}
          </div>
        </>
      )}
    </Tarjeta>
  );
}
