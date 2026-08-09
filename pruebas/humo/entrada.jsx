/**
 * Entrada de la prueba de humo.
 *
 * Renderiza la aplicación completa en Node con React, para detectar errores de
 * montaje que el build no ve: un componente usado sin importar, una propiedad
 * leída de un objeto nulo, un selector que rompe con la colección vacía.
 *
 * Se compila con `vite build --ssr` desde `scripts/humo.mjs`, que además
 * sustituye `src/estado/tienda.js` por el doble de este directorio.
 */
import { StaticRouter } from 'react-router-dom/server';
import { renderToString } from 'react-dom/server';
import App from '../../src/App.jsx';
import { establecerBD } from '../../src/estado/tienda.js';
import { generarDemo } from '../../src/datos/demo.js';
import { bdVacia } from '../../src/datos/esquema.js';
import { hoyISO } from '../../src/datos/selectores.js';

/**
 * React avisa por consola de cosas que el build no considera errores pero que
 * en el navegador sí lo son: anidamiento de DOM inválido (`<div>` dentro de
 * `<p>`), listas sin `key`, props desconocidas. Se capturan y se tratan como
 * fallos, que es lo que son.
 */
const avisos = [];

function capturarAvisos() {
  for (const canal of ['error', 'warn']) {
    const original = console[canal];
    console[canal] = (...args) => {
      avisos.push(String(args[0]).replace(/%s/g, () => args.shift() ?? ''));
      original.apply(console, args);
    };
  }
}

function render(ruta) {
  return renderToString(
    <StaticRouter location={ruta}>
      <App />
    </StaticRouter>,
  );
}

/**
 * Cada ruta declara un texto que TIENE que aparecer en su marcado. Sin esto la
 * prueba pasaría con sólo la barra lateral renderizada, que es exactamente el
 * falso positivo que hay que evitar.
 */
function probar(entradas, etiqueta, fallos) {
  for (const [ruta, marcador] of entradas) {
    try {
      const html = render(ruta);
      if (!html) {
        fallos.push(`[${etiqueta}] ${ruta}: sin marcado`);
      } else if (marcador && !html.includes(marcador)) {
        fallos.push(`[${etiqueta}] ${ruta}: no aparece «${marcador}» (${html.length} caracteres)`);
      }
    } catch (e) {
      fallos.push(`[${etiqueta}] ${ruta}: ${e.message}`);
    }
  }
}

/**
 * @param {[string, string][]} rutasDemo pares `[ruta, marcador]` con la demo cargada
 * @param {[string, string][]} rutasVacio pares `[ruta, marcador]` con el sistema vacío
 * @param {[string, string][]} rutasProfundas `{id}` se reemplaza por un id real
 */
export function correr(rutasDemo, rutasVacio, rutasProfundas = []) {
  const fallos = [];
  capturarAvisos();
  const demo = generarDemo(hoyISO());

  // 1 · Con datos de demostración: todas las pantallas con contenido.
  establecerBD(demo);
  probar(rutasDemo, 'demo', fallos);

  // 2 · Rutas profundas que dependen de un id concreto.
  const proyecto = demo.proyectos[0];
  if (proyecto) {
    probar(
      rutasProfundas.map(([r, m]) => [
        r.replace('{id}', proyecto.id_proyecto),
        m === '{proyecto}' ? proyecto.proyecto : m,
      ]),
      'demo',
      fallos,
    );
  }

  // 3 · Con el sistema vacío: los estados vacíos tienen que renderizar igual.
  establecerBD(bdVacia());
  probar(rutasVacio, 'vacío', fallos);

  // 4 · Ningún aviso de React queda sin atender.
  for (const aviso of [...new Set(avisos)]) fallos.push(`[React] ${aviso}`);

  return fallos;
}
