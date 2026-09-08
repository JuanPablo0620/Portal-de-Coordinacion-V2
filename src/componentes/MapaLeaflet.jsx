/**
 * ─────────────────────────────────────────────────────────────────────
 * MAPA CON CARTOGRAFÍA REAL — Leaflet sobre el callejero del municipio.
 *
 * Es el segundo mapa del sistema y tiene otro propósito que `MapaObras`. Aquel
 * dibuja obras sobre un plano de coordenadas SIN calles, y era la decisión
 * correcta cuando el portal no tenía backend ni podía pedir cartografía. Un
 * corte de calle no se puede mostrar así: "está cortada San Martín entre
 * Lavalle y Hornos" sólo se entiende sobre un mapa que tenga esas calles
 * dibujadas y con su nombre.
 *
 * Las teselas las pide el navegador de quien mira, por HTTPS, directo al
 * servidor de mapas: el portal no proxea nada y no necesita backend para esto.
 *
 * ── Leaflet se importa DENTRO del efecto, no arriba del archivo. Dos razones,
 * y la primera es dura: Leaflet toca `window` al evaluarse, así que un import
 * estático rompe la prueba de humo —que renderiza todas las rutas en Node— y
 * la rompe entera, no sólo esta ruta, porque `App.jsx` importa el módulo. La
 * segunda es que así la biblioteca y su hoja de estilos quedan en un fragmento
 * aparte, y quien nunca abre el mapa no las descarga.
 *
 * Leaflet es imperativo y React declarativo, así que el patrón acá es el
 * habitual: una instancia por montaje guardada en `useRef`, y efectos que
 * sincronizan capas cuando cambian las props. Los marcadores son vectoriales
 * (`circleMarker`), no los `Marker` con imagen de Leaflet: los íconos por
 * defecto se sirven desde rutas relativas al CSS y se rompen al empaquetar.
 *
 * El color NO se pasa por opciones de Leaflet —que lo escribiría como atributo
 * SVG— sino por `className`: así los cortes se pintan con los tokens del
 * sistema desde `index.css`, como el resto de la aplicación.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { WMS_CAPA_BASE, WMS_OWS } from '../datos/geoportal.js';

/** Centro y zoom de arranque: el partido entero en pantalla. */
const CENTRO_PARTIDO = [-34.6, -58.565];
const ZOOM_PARTIDO = 13;

export const CAPAS_BASE = Object.freeze([
  { valor: 'osm', titulo: 'Calles' },
  { valor: 'municipal', titulo: 'Callejero municipal' },
]);

function crearCapaBase(L, cual) {
  if (cual === 'municipal') {
    // La capa oficial del municipio. Es el respaldo natural si el servicio de
    // teselas público no está disponible desde la red del municipio.
    return L.tileLayer.wms(WMS_OWS, {
      layers: WMS_CAPA_BASE,
      format: 'image/png',
      transparent: false,
      version: '1.3.0',
      attribution: 'Geoportal Municipalidad de Tres de Febrero',
    });
  }
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  });
}

/**
 * @param {object[]} formas  `{ id, tipo: 'linea'|'punto', puntos, clase, titulo }`
 *   — `puntos` es un array de polilíneas para `linea` y un `{lat,lng}` para `punto`.
 *   Opcionales: `grosor` (ancho del trazo), `interactiva: false` (no responde al
 *   clic) y `mostrarPuntas: false` (sin los círculos de los extremos).
 * @param {function} alClicMapa  recibe `{lat,lng}`. Su presencia activa el modo dibujo.
 * @param {function} alMoverse   recibe `{norte, sur, este, oeste, zoom}` al mover el mapa.
 * @param {number}   zoomMinimo  si el mapa está más lejos que esto, se acerca solo.
 */
export function MapaLeaflet({
  formas = [],
  seleccionada = null,
  alSeleccionar,
  alClicMapa,
  alMoverse,
  zoomMinimo = null,
  capaBase = 'osm',
  encuadrar = null,
  alto = 520,
  className = '',
}) {
  const contenedor = useRef(null);
  const leaflet = useRef(null);
  const mapa = useRef(null);
  const capaFormas = useRef(null);
  const capaTeselas = useRef(null);
  const [listo, setListo] = useState(false);
  // Los callbacks entran por ref y no por dependencia del efecto: si el efecto
  // se rehiciera en cada render por una función nueva, el mapa se desmontaría y
  // volvería a montarse en cada tecla del formulario.
  const enClic = useRef(alClicMapa);
  const enSeleccion = useRef(alSeleccionar);
  const enMovimiento = useRef(alMoverse);
  enClic.current = alClicMapa;
  enSeleccion.current = alSeleccionar;
  enMovimiento.current = alMoverse;

  /* Montaje. Una sola vez por vida del componente. */
  useEffect(() => {
    let vivo = true;
    let instancia = null;
    let reloj = null;

    (async () => {
      const [modulo] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      // Desmontado mientras se descargaba la biblioteca.
      if (!vivo || !contenedor.current) return;
      const L = modulo.default ?? modulo;
      leaflet.current = L;

      instancia = L.map(contenedor.current, {
        center: CENTRO_PARTIDO,
        zoom: ZOOM_PARTIDO,
        zoomControl: true,
        // El scroll de la página no debería cambiar el zoom del mapa al pasar
        // por encima: se hace zoom con los botones, con pinza, o con ctrl+rueda.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instancia);
      capaFormas.current = L.layerGroup().addTo(instancia);
      instancia.on('click', (e) => {
        enClic.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // Qué área está mirando el usuario. Lo consume el modo de selección de
      // cuadras, que pide al geoportal sólo lo que entra en pantalla.
      const avisarArea = () => {
        if (!enMovimiento.current) return;
        const limites = instancia.getBounds();
        enMovimiento.current({
          norte: limites.getNorth(),
          sur: limites.getSouth(),
          este: limites.getEast(),
          oeste: limites.getWest(),
          zoom: instancia.getZoom(),
        });
      };
      instancia.on('moveend zoomend', avisarArea);
      mapa.current = instancia;

      // El contenedor suele montarse con alto todavía sin resolver (paneles con
      // grid): sin esto el mapa calcula mal su tamaño y deja una franja gris.
      reloj = setTimeout(() => {
        instancia.invalidateSize();
        // Después de `invalidateSize`, porque antes los límites son los de un
        // contenedor sin alto resuelto y el área reportada sería falsa.
        avisarArea();
      }, 60);
      setListo(true);
    })();

    return () => {
      vivo = false;
      clearTimeout(reloj);
      instancia?.remove();
      mapa.current = null;
      capaFormas.current = null;
      capaTeselas.current = null;
      setListo(false);
    };
  }, []);

  /* Un modo nuevo (entrar a seleccionar cuadras) necesita saber el área ya
     visible, sin esperar a que el usuario mueva el mapa. */
  useEffect(() => {
    if (!listo || !mapa.current || !alMoverse) return;
    const limites = mapa.current.getBounds();
    alMoverse({
      norte: limites.getNorth(),
      sur: limites.getSouth(),
      este: limites.getEast(),
      oeste: limites.getWest(),
      zoom: mapa.current.getZoom(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, Boolean(alMoverse)]);

  /* Capa base. */
  useEffect(() => {
    const L = leaflet.current;
    if (!listo || !L || !mapa.current) return;
    capaTeselas.current?.remove();
    capaTeselas.current = crearCapaBase(L, capaBase).addTo(mapa.current);
    // Las teselas van SIEMPRE por debajo de los cortes.
    capaTeselas.current.bringToBack();
  }, [capaBase, listo]);

  /* Zoom mínimo. Entrar a elegir cuadras con el partido entero en pantalla no
     sirve: no se puede acertar un clic en una cuadra de veinte metros. */
  useEffect(() => {
    if (!listo || !mapa.current || !zoomMinimo) return;
    // Sin animación: los movimientos de vista que dispara un cambio de props
    // pueden quedar a mitad de camino si el componente se desmonta —abrir o
    // cerrar el modal desmonta uno de los dos mapas— y Leaflet revienta
    // buscando la posición de un pane que ya no está («_leaflet_pos»).
    if (mapa.current.getZoom() < zoomMinimo) mapa.current.setZoom(zoomMinimo, { animate: false });
  }, [zoomMinimo, listo]);

  /* Formas. Se redibujan enteras: son pocas y comparar una por una costaría
     más código que rehacerlas. */
  // Firma barata en lugar de serializar la geometría entera: con doscientas
  // cuadras dibujadas, un `JSON.stringify` completo por render se nota. La
  // geometría de una forma no cambia sin que cambie su id, su cantidad de
  // puntos o su primer vértice.
  const firma = useMemo(
    () =>
      formas
        .map((f) => {
          const primero = f.tipo === 'punto' ? f.puntos : f.puntos?.[0]?.[0];
          const cuantos = f.tipo === 'punto' ? 1 : (f.puntos ?? []).reduce((n, l) => n + l.length, 0);
          return `${f.id}|${f.clase}|${f.grosor ?? ''}|${cuantos}|${primero?.lat ?? ''}`;
        })
        .join(','),
    [formas],
  );
  useEffect(() => {
    const L = leaflet.current;
    const grupo = capaFormas.current;
    if (!listo || !L || !grupo) return;
    grupo.clearLayers();

    for (const forma of formas) {
      const seleccion = forma.id && forma.id === seleccionada;
      const clase = `corte-forma ${forma.clase ?? ''} ${seleccion ? 'corte-sel' : ''}`.trim();
      const capas = [];

      if (forma.tipo === 'punto') {
        if (forma.puntos) capas.push(L.circleMarker(forma.puntos, { radius: seleccion ? 11 : 8, className: clase }));
      } else {
        const grosor = forma.grosor ?? (seleccion ? 9 : 6);
        for (const linea of forma.puntos ?? []) {
          if (linea?.length >= 2) capas.push(L.polyline(linea, { weight: grosor, className: clase }));
        }
        // Las puntas del tramo, que son las esquinas: sin ellas un tramo corto
        // se lee como una mancha y no se ve dónde empieza y dónde termina.
        const vertices = (forma.puntos ?? []).flat();
        if (vertices.length && forma.mostrarPuntas !== false) {
          for (const punta of [vertices[0], vertices.at(-1)]) {
            capas.push(L.circleMarker(punta, { radius: 4, className: `corte-punta ${forma.clase ?? ''}` }));
          }
        }
      }

      for (const capa of capas) {
        if (forma.titulo) capa.bindTooltip(forma.titulo, { direction: 'top', sticky: true });
        if (forma.id && forma.interactiva !== false) {
          capa.on('click', (e) => {
            // Sin esto el clic también cae en el mapa y, en modo dibujo,
            // seleccionar un corte existente movería el punto que se está
            // cargando.
            L.DomEvent.stopPropagation(e);
            enSeleccion.current?.(forma.id);
          });
        }
        capa.addTo(grupo);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, seleccionada, listo]);

  /* Encuadre. */
  useEffect(() => {
    const L = leaflet.current;
    if (!listo || !L || !mapa.current || !encuadrar?.length) return;
    const puntos = encuadrar.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
    if (!puntos.length) return;
    if (puntos.length === 1) {
      mapa.current.setView([puntos[0].lat, puntos[0].lng], Math.max(mapa.current.getZoom(), 16), {
        animate: false,
      });
      return;
    }
    mapa.current.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])).pad(0.25), {
      maxZoom: 17,
      animate: false,
    });
  }, [encuadrar, listo]);

  return (
    <div
      ref={contenedor}
      style={{ height: alto }}
      className={`mapa-leaflet w-full overflow-hidden rounded-chip border border-borde ${
        alClicMapa ? 'mapa-dibujando' : ''
      } ${className}`}
      // El mapa es una imagen operable con mouse y dedo; el recorrido por
      // teclado del módulo pasa por la lista de cortes y por los desplegables
      // de esquina, que son controles reales.
      role="application"
      aria-label="Mapa de cortes de calle"
    >
      {!listo && <p className="p-3 text-sm text-tenue">Cargando el mapa…</p>}
    </div>
  );
}
