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
import { HistorialProyecto } from '../../src/modulos/proyectos/HistorialProyecto.jsx';
import { FormularioTema } from '../../src/modulos/monitoreo/CargarMonitoreo.jsx';
import { separarTemas } from '../../src/datos/minutas/separarTemas.js';
import { CATALOGOS_SEMILLA } from '../../src/datos/catalogos.js';
import { establecerBD } from '../../src/estado/tienda.js';
import { generarDemo } from '../../src/datos/demo.js';
import { generarBaseCompleta } from '../../src/datos/base-completa.js';
import { bdVacia } from '../../src/datos/esquema.js';
import { hoyISO, proyectoPorId } from '../../src/datos/selectores.js';
import { auditarAccesibilidad } from './accesibilidad.js';

/**
 * Componentes que no se alcanzan por URL porque viven detrás de estado local
 * (una pestaña, un modal). Se montan sueltos para que igual entren en la prueba.
 */
const CATEGORIAS = CATALOGOS_SEMILLA.categorias_tema.map((c) => ({ valor: c.nombre, titulo: c.nombre }));

const COMPONENTES = {
  HistorialProyecto: (bd, proyecto) => <HistorialProyecto bd={bd} proyecto={proyecto} />,

  /**
   * El formulario de tema, cargado con un borrador REAL de la transferencia y
   * con el buscador de proyectos desplegado: es la pantalla que ve quien
   * corrige lo que propuso el sistema.
   */
  FormularioTema: (bd, proyecto) => (
    <FormularioTema
      tema={{
        ...separarTemas('Ferreyra va a elevar el expediente antes del 15/09.', {
          hoy: hoyISO(),
          categorias: CATEGORIAS,
        })[0],
        id_proyecto: proyecto.id_proyecto,
      }}
      alCambiar={() => {}}
      opcionesCategoria={CATEGORIAS}
      hoy={hoyISO()}
    />
  ),
};

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
function probar(entradas, etiqueta, fallos, conAccesibilidad = false) {
  for (const [ruta, marcador] of entradas) {
    try {
      const html = render(ruta);
      if (!html) {
        fallos.push(`[${etiqueta}] ${ruta}: sin marcado`);
      } else if (marcador && !html.includes(marcador)) {
        fallos.push(`[${etiqueta}] ${ruta}: no aparece «${marcador}» (${html.length} caracteres)`);
      }
      if (html && conAccesibilidad) auditarAccesibilidad(html, ruta, fallos);
    } catch (e) {
      fallos.push(`[${etiqueta}] ${ruta}: ${e.message}`);
    }
  }
}

/**
 * @param {[string, string][]} rutasDemo pares `[ruta, marcador]` con la demo cargada
 * @param {[string, string][]} rutasVacio pares `[ruta, marcador]` con el sistema vacío
 * @param {[string, string][]} rutasProfundas `{id}` se reemplaza por un id real
 * @param {[string, string][]} componentes pares `[nombre, marcador]` de `COMPONENTES`
 * @param {[string, string][]} rutasCompletas pares `[ruta, marcador]` con la base a escala real
 */
export function correr(rutasDemo, rutasVacio, rutasProfundas = [], componentes = [], rutasCompletas = []) {
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

    // 3 · Componentes detrás de estado local, montados sueltos.
    const derivado = proyectoPorId(demo, proyecto.id_proyecto);
    for (const [nombre, marcador] of componentes) {
      const fabricar = COMPONENTES[nombre];
      if (!fabricar) {
        fallos.push(`[componente] ${nombre}: no está registrado en entrada.jsx`);
        continue;
      }
      try {
        const html = renderToString(
          <StaticRouter location="/">{fabricar(demo, derivado)}</StaticRouter>,
        );
        if (!html.includes(marcador)) {
          fallos.push(`[componente] ${nombre}: no aparece «${marcador}» (${html.length} caracteres)`);
        }
      } catch (e) {
        fallos.push(`[componente] ${nombre}: ${e.message}`);
      }
    }
  }

  // 4 · Con la base a escala real: las mismas pantallas, con miles de registros.
  // Es lo único que atrapa lo que sólo falla con volumen —una tabla que no
  // corta, un tablero que recorre la bitácora entera por fila— antes de que lo
  // encuentre el uso real.
  if (rutasCompletas.length) {
    establecerBD(generarBaseCompleta(hoyISO()));
    probar(rutasCompletas, 'completa', fallos, true);
  }

  // 5 · Con el sistema vacío: los estados vacíos tienen que renderizar igual.
  establecerBD(bdVacia());
  probar(rutasVacio, 'vacío', fallos);

  // 6 · Ningún aviso de React queda sin atender.
  for (const aviso of [...new Set(avisos)]) fallos.push(`[React] ${aviso}`);

  return fallos;
}
