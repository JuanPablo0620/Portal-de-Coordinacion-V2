/**
 * Comprobaciones de accesibilidad sobre el marcado real.
 *
 * Viven acá y no en `entrada.jsx` porque son otra cosa: esa entrada renderiza
 * las rutas y comprueba que cada pantalla muestre lo que dice mostrar; esto
 * mira el marcado que salió. Se corren sobre el render con la base completa,
 * que es donde hay tablas largas y catálogos enteros.
 *
 * Son las comprobaciones que se pueden hacer sin navegador y que además son las
 * que más se degradan solas: un control escrito a mano —sin pasar por `Campo`—
 * nace sin etiqueta, una fila clicable nace sin acceso por teclado y un
 * `outline-none` se copia y se pega sin pensar.
 *
 * Lo que NO cubre, y necesita un navegador de verdad: el orden real del foco,
 * el contraste efectivo tras aplicar el CSS —eso lo mide `contraste.test.mjs`
 * sobre los tokens— y el comportamiento con un lector de pantalla real.
 */

/** Texto visible de un fragmento de marcado, sin etiquetas. */
const textoDe = (html) => html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();

/**
 * Comprobaciones de accesibilidad sobre el marcado real.
 *
 * Son las que se pueden hacer sin navegador y que además son las que más se
 * degradan solas: un control escrito a mano —sin pasar por `Campo`— nace sin
 * etiqueta, y una fila clicable nace sin acceso por teclado. Se corren sobre el
 * render con la base completa, que es donde hay tablas largas y catálogos
 * enteros.
 */
export function auditarAccesibilidad(html, ruta, fallos) {
  const anotar = (problema) => fallos.push(`[a11y] ${ruta}: ${problema}`);

  for (const [, atributos, interior] of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (!textoDe(interior) && !/aria-label=|title=/.test(atributos)) {
      anotar(`botón sin nombre accesible (${atributos.trim().slice(0, 60)}…)`);
    }
  }

  const idsConEtiqueta = new Set([...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]));
  for (const etiqueta of ['input', 'select', 'textarea']) {
    for (const [, atributos] of html.matchAll(new RegExp(`<${etiqueta}([^>]*)>`, 'g'))) {
      if (/type="(hidden|submit|button)"/.test(atributos)) continue;
      const id = atributos.match(/\sid="([^"]+)"/)?.[1];
      if ((id && idsConEtiqueta.has(id)) || /aria-label=|aria-labelledby=|title=/.test(atributos)) continue;
      const pista = atributos.match(/placeholder="([^"]*)"/)?.[1] ?? atributos.trim().slice(0, 50);
      anotar(`<${etiqueta}> sin etiqueta asociada («${pista}»)`);
    }
  }

  // Una fila que se abre con el mouse tiene que abrirse con el teclado.
  for (const [, atributos] of html.matchAll(/<tr([^>]*cursor-pointer[^>]*)>/g)) {
    if (!/tabindex="0"/i.test(atributos)) anotar('fila clicable sin acceso por teclado');
  }

  for (const [, tabla] of [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => [null, m[0]])) {
    if (/<th/.test(tabla) && !/<th[^>]*scope=/.test(tabla)) anotar('tabla con <th> sin scope');
  }

  const niveles = [...html.matchAll(/<h([1-6])/g)].map((m) => Number(m[1]));
  let previo = 0;
  for (const n of niveles) {
    if (previo && n > previo + 1) anotar(`salto en la jerarquía de encabezados (h${previo} → h${n})`);
    previo = n;
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) anotar(`id duplicado: ${id}`);

  if (!/<main[\s>]/.test(html)) anotar('la página no tiene <main>');
  if (!/<nav[\s>]/.test(html)) anotar('la página no tiene <nav>');

  // Sin enlace de salto, cada pantalla arranca con diez tabulaciones de menú.
  const salto = html.match(/<a[^>]*href="#([^"]+)"[^>]*class="[^"]*saltar-al-contenido/);
  if (!salto) anotar('falta el enlace «saltar al contenido»');
  else if (!html.includes(`id="${salto[1]}"`)) anotar(`el enlace de salto apunta a #${salto[1]}, que no existe`);

  // Anular el contorno sin poner otro deja el foco invisible.
  for (const [, clases] of html.matchAll(/class="([^"]*outline-none[^"]*)"/g)) {
    if (!/focus(-visible)?:(outline|ring|border|bg)/.test(clases)) {
      anotar(`control con «outline-none» y sin indicador de foco (${clases.slice(0, 60)}…)`);
    }
  }
}
