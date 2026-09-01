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
import { Aviso, Boton, Chip, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { TarjetaSecretaria } from '../monitoreo/TableroSecretarias.jsx';
import { COLUMNAS_COMPROMISO } from '../seguimiento/columnasCompromiso.jsx';
import { calcularAlertas } from '../../datos/alertas.js';
import {
  areasAsignadas,
  compromisos as selCompromisos,
  hoyISO,
  resumenSecretarias,
} from '../../datos/selectores.js';
import { useItems } from '../../utilidades/catalogos.js';
import { acciones, useBD, useUsuario } from '../../estado/tienda.js';

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
  // Solo las vencidas (severidad 'critica' → semáforo rojo) se muestran acá arriba;
  // el resto de la situación de cada compromiso ya se ve en la tabla de abajo.
  const alertasVencidas = useMemo(
    () => alertasPropias.filter((a) => a.severidad === 'critica'),
    [alertasPropias],
  );

  const compromisosPropios = useMemo(
    () => (bd ? selCompromisos(bd, { area: asignadas, solo_vigentes: true }, hoy) : []),
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
            {alertasVencidas.length > 0 && (
              <Tarjeta
                titulo="Alertas vencidas de tus áreas"
                descripcion="Solo lo que ya está vencido. Salen del mismo motor que el inicio y Monitoreo: mismas alertas, mismos días de atraso."
                sinPadding
              >
                <ListaAlertas alertas={alertasVencidas} limite={alertasVencidas.length} />
              </Tarjeta>
            )}

            <Tarjeta
              titulo="Compromisos pendientes de tus áreas"
              descripcion="Vigentes, no recortados por período: son estado, no historia."
              sinPadding
            >
              <Tabla
                nombreExport="mis-areas-compromisos"
                filas={compromisosPropios}
                conBusqueda={false}
                columnas={COLUMNAS_COMPROMISO}
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
