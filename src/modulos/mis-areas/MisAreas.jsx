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
import { ClipboardList, Save, UserCheck } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { TarjetaSecretaria } from '../monitoreo/TableroSecretarias.jsx';
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
 * Columnas de "Compromisos pendientes". Mismo criterio de recorte: sin
 * Responsable, y el punto de color se muda al lado del nombre del
 * compromiso en vez de ir adentro del pill de Estado — que queda solo con
 * el fondo tintado y el texto (`Semaforo sinPunto`).
 */
const COLUMNAS_PENDIENTES = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => {
      const nivel = f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes);
      return (
        <div className="flex min-w-40 items-start gap-2">
          <span className="mt-1.5">
            <Semaforo nivel={nivel} soloPunto texto={f.estado_efectivo} />
          </span>
          <div>
            <p className="leading-tight text-tinta">{f.descripcion}</p>
            <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
          </div>
        </div>
      );
    },
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
    render: (f) => {
      const nivel = f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes);
      return <Semaforo nivel={nivel} sinPunto texto={f.estado_efectivo} />;
    },
  },
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

            <Tarjeta
              titulo="Compromisos pendientes de tus áreas"
              descripcion="Vigentes, no recortados por período: son estado, no historia. Los vencidos no se repiten acá — están arriba, en su propia tabla. Un clic en la fila abre el compromiso en Seguimiento."
              sinPadding
            >
              <Tabla
                nombreExport="mis-areas-compromisos"
                filas={compromisosPropios}
                conBusqueda={false}
                columnas={COLUMNAS_PENDIENTES}
                alHacerClicFila={(c) => navegar(`/seguimiento?tab=compromisos&compromiso=${c.id}`)}
                vacio={
                  <Vacio
                    compacto
                    icono={ClipboardList}
                    titulo="Sin compromisos pendientes en tus áreas"
                  />
                }
              />
            </Tarjeta>

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

/* ── Selector de áreas asignadas ─────────────────────────────────────── */

function SelectorAreas({ usuario, areasCatalogo, asignadas }) {
  const [seleccion, setSeleccion] = useState(asignadas);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

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

  const huboCambios = seleccion.slice().sort().join('|') !== asignadas.slice().sort().join('|');

  async function guardar() {
    setGuardando(true);
    try {
      await acciones.guardarAsignacionesMonitoreo(usuario, seleccion);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
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
          <Boton variante="primario" tamanio="sm" icono={Save} onClick={guardar} disabled={guardando || !huboCambios}>
            Guardar
          </Boton>
        </>
      }
    >
      {areasCatalogo.length === 0 ? (
        <Aviso tono="info">No hay áreas cargadas en el catálogo todavía.</Aviso>
      ) : (
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
      )}
    </Tarjeta>
  );
}
