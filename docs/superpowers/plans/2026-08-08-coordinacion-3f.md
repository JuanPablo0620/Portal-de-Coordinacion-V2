# Sistema de Coordinación y Seguimiento — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prototipo funcional de la herramienta de coordinación y seguimiento de proyectos del Área de Coordinación del Municipio de Tres de Febrero: siete módulos sobre una base maestra única, sin backend.

**Architecture:** SPA React con un store Zustand en memoria hidratado desde `localStorage`. Toda lectura y escritura pasa por `src/datos/repositorio.js`, cuyas funciones son `async` desde el día uno; `src/datos/almacenamiento.js` es el único archivo del repo que menciona `localStorage`. La derivación (porcentajes, vencimientos, agregados) vive en selectores puros; las alertas, en una única función consumida por dashboard, monitoreo y reportes.

**Tech Stack:** React 18 · Vite 5 · Tailwind 4 (`@tailwindcss/vite`) · React Router 6 · Recharts · lucide-react · Zustand. Tests con `node --test` (sin framework adicional).

**Spec:** `docs/superpowers/specs/2026-08-08-coordinacion-3f-design.md`

## Global Constraints

- **Sin backend, sin autenticación, sin roles.** Ninguna pantalla de login ni de usuarios.
- **Sin dependencias más allá de las listadas.** CSV, parser CSV y separador de minutas se escriben a mano. Nada de SheetJS, date-fns, lodash ni librerías de tablas.
- **`localStorage` sólo en `src/datos/almacenamiento.js`.** Verificado por `npm run verificar`; cualquier otra aparición hace fallar el script.
- **Todas las funciones de `repositorio.js` son `async`,** aunque hoy resuelvan sincrónicamente.
- **Idioma:** español rioplatense en toda la UI. Identificadores de código en español, siguiendo los nombres de campo del modelo.
- **Fechas** se muestran `DD/MM/AAAA` y se guardan ISO `AAAA-MM-DD`. **Montos** en pesos argentinos con separador de miles (`Intl.NumberFormat('es-AR')`).
- **Borrado lógico siempre** (`activo: false`). Ningún `delete`, ningún `splice` sobre colecciones.
- **Colores, radios y sombras sólo por tokens** del bloque `@theme` de `src/estilos/index.css`. Prohibido hardcodear un hex en un componente.
- **Toda vista sin datos** usa el componente `<Vacio>`. Nunca una pantalla en blanco.
- **Todo listado** lleva botón de exportar CSV en su encabezado.
- Los datos de demostración son **evidentemente ficticios**: áreas y proyectos inventados, nunca datos reales del municipio.

**Desvío respecto del orden de la spec (§12):** el motor de alertas (Task 9) se construye **antes** del dashboard (Task 10), no en la etapa 5. El dashboard necesita vencimientos a 15 días, que es lógica de alertas; construirlo antes evitaría una implementación descartable y violaría la regla de no duplicar. El resto del orden se respeta.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/datos/almacenamiento.js` | Único acceso a `localStorage`. `leerBD` / `escribirBD` / `limpiar` |
| `src/datos/esquema.js` | Forma de la BD, colecciones, `bdVacia()`, versión de esquema |
| `src/datos/catalogos.js` | Catálogos administrables (semilla) y constantes semánticas congeladas |
| `src/datos/ids.js` | `SEC-AAAA-NNN` y ids internos |
| `src/datos/bitacora.js` | Diff de campos y construcción de asientos |
| `src/datos/repositorio.js` | API pública de datos, toda `async` |
| `src/datos/selectores.js` | Derivación pura sobre `bd` |
| `src/datos/alertas.js` | `calcularAlertas(bd, hoy)` — motor único |
| `src/datos/csv.js` | Generar, descargar y parsear CSV |
| `src/datos/demo.js` | Set sintético de demostración |
| `src/datos/minutas/separarMinuta.js` | Separación de minutas — aislado, reemplazable |
| `src/estado/tienda.js` | Store Zustand: caché en memoria + hooks |
| `src/componentes/*` | UI compartida: Layout, Tabla, Vacio, Semaforo, Calendario, campos de formulario |
| `src/modulos/<modulo>/*` | Un directorio por módulo, con su vista y sus formularios |
| `src/estilos/index.css` | Tokens `@theme` |
| `src/estilos/impresion.css` | Hoja de impresión para PDF |
| `scripts/verificar.mjs` | build + tests + chequeo de aislamiento de `localStorage` |
| `pruebas/*.test.mjs` | Tests de los módulos puros |

Los módulos con lógica pura (`selectores`, `alertas`, `csv`, `ids`, `separarMinuta`, `bitacora`) llevan tests con `node --test`. La UI se valida con build limpio y recorrido manual de los criterios de aceptación: montar un entorno de testing de componentes es desproporcionado para un prototipo cuya prioridad declarada es la claridad visual.

---

## Task 1: Andamiaje, tokens y verificación

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`
- Create: `src/main.jsx`, `src/App.jsx`
- Create: `src/estilos/index.css`, `src/estilos/impresion.css`
- Create: `scripts/verificar.mjs`

**Interfaces:**
- Consumes: nada
- Produces: `npm run dev`, `npm run build`, `npm run test`, `npm run verificar`. Tokens CSS disponibles como utilidades Tailwind (`bg-paper`, `text-tinta`, `bg-acento`, `text-vencido`…).

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "coordinacion-3f",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test pruebas/",
    "verificar": "node scripts/verificar.mjs"
  },
  "dependencies": {
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.4",
    "recharts": "^2.15.4",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@vitejs/plugin-react": "^4.7.0",
    "tailwindcss": "^4.3.0",
    "vite": "^5.4.21"
  }
}
```

- [ ] **Step 2: Instalar y crear `vite.config.js` + `index.html`**

Run: `npm install`

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ plugins: [react(), tailwindcss()] });
```

`index.html` con `<html lang="es-AR">`, título «Coordinación · Municipio de Tres de Febrero», `<div id="root">` y `<script type="module" src="/src/main.jsx">`.

- [ ] **Step 3: Definir los tokens en `src/estilos/index.css`**

```css
@import "tailwindcss";

@theme {
  /* Superficies */
  --color-paper:   #F7F8FA;
  --color-card:    #FFFFFF;
  --color-borde:   #E2E6EB;
  --color-tinta:   #1B2430;
  --color-gris:    #5B6672;
  --color-tenue:   #8A94A0;

  /* Acento institucional */
  --color-acento:      #1D5FA8;
  --color-acento-suave:#E8F0F9;
  --color-acento-fuerte:#164A82;

  /* Semáforo diferencial — 4 niveles distinguibles de un vistazo.
     Los niveles claros llevan texto oscuro, nunca blanco. */
  --color-vencido:  #D64550;
  --color-proximo:  #E8974A;
  --color-atencion: #E6C34A;
  --color-enregla:  #4C9A6A;
  --color-sindato:  #D8DDE3;

  /* Capas del calendario */
  --color-capa-seguimiento: #1D5FA8;
  --color-capa-evento:      #8B5CB8;
  --color-capa-mesa:        #4C9A6A;
  --color-capa-vencimiento: #D64550;

  --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;
  --radius-card: 10px;
  --shadow-card: 0 1px 2px rgb(27 36 48 / 0.06), 0 1px 8px rgb(27 36 48 / 0.04);
}

@media print { /* la hoja de impresión se importa aparte */ }
```

`src/estilos/impresion.css`: oculta `.no-imprimir` (sidebar, botones, filtros), fuerza fondo blanco, evita cortes dentro de `.bloque-reporte` (`break-inside: avoid`), y muestra `.solo-impresion` (encabezado institucional y pie de filtros).

- [ ] **Step 4: `src/main.jsx` y un `src/App.jsx` mínimo**

`main.jsx` monta `<BrowserRouter><App/></BrowserRouter>` e importa ambas hojas de estilo. `App.jsx` devuelve por ahora un `<h1>` con el nombre del sistema — se reemplaza en Task 6.

- [ ] **Step 5: Escribir `scripts/verificar.mjs`**

```js
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PERMITIDO = 'src/datos/almacenamiento.js';

function archivos(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(js|jsx|mjs)$/.test(e)) acc.push(p);
  }
  return acc;
}

const infractores = archivos('src')
  .filter((p) => p.split('\\').join('/') !== PERMITIDO)
  .filter((p) => /localStorage|sessionStorage/.test(readFileSync(p, 'utf8')));

if (infractores.length) {
  console.error('Acceso directo a almacenamiento fuera de la capa de datos:');
  for (const p of infractores) console.error('  ' + p);
  process.exit(1);
}
console.log('OK · aislamiento de la capa de datos');

execSync('npm run test', { stdio: 'inherit' });
execSync('npm run build', { stdio: 'inherit' });
console.log('OK · tests y build');
```

- [ ] **Step 6: Verificar que el andamiaje corre**

Run: `npm run build`
Expected: build exitoso, sin errores.

Run: `npm run verificar`
Expected: `OK · aislamiento de la capa de datos` y build exitoso. (`npm run test` puede fallar por falta de la carpeta `pruebas/`; crear `pruebas/.gitkeep` y un `pruebas/humo.test.mjs` trivial que afirme `true`.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: andamiaje Vite + React + Tailwind 4, tokens y script de verificación"
```

---

## Task 2: Núcleo de datos — almacenamiento, esquema, catálogos, ids, bitácora

**Files:**
- Create: `src/datos/almacenamiento.js`, `src/datos/esquema.js`, `src/datos/catalogos.js`, `src/datos/ids.js`, `src/datos/bitacora.js`
- Test: `pruebas/ids.test.mjs`, `pruebas/bitacora.test.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `leerBD(): object|null` · `escribirBD(bd): void` · `limpiar(): void` · `CLAVE: string`
  - `VERSION_ESQUEMA: number` · `COLECCIONES: string[]` · `bdVacia(): BD`
  - `CATALOGOS_SEMILLA: object` · `ESTADOS_PROYECTO`, `PRIORIDADES`, `CRITICIDADES`, `ESTADOS_COMPROMISO`, `ESTADOS_REQUERIMIENTO`, `TIPOS_MESA`, `ESTADOS_MESA` (arrays congelados)
  - `generarIdProyecto(bd, idArea, fecha): string` · `nuevoId(prefijo): string`
  - `diffCampos(antes, despues, ignorar): Cambio[]` · `crearAsiento({entidad, id_entidad, accion, cambios, usuario}): Asiento`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// pruebas/ids.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarIdProyecto, nuevoId } from '../src/datos/ids.js';

const bd = { proyectos: [], catalogos: { areas: [{ id: 'a1', nombre: 'Obras Públicas', prefijo: 'OBR' }] } };

test('genera el primer id con correlativo 001', () => {
  assert.equal(generarIdProyecto(bd, 'a1', '2026-03-14'), 'OBR-2026-001');
});

test('continúa el correlativo por prefijo y año', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2026-001' }, { id_proyecto: 'OBR-2026-007' }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-05-02'), 'OBR-2026-008');
});

test('el correlativo no se mezcla entre años', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2025-009' }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-01-10'), 'OBR-2026-001');
});

test('el correlativo cuenta bajas lógicas para no reusar ids', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2026-001', activo: false }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-06-01'), 'OBR-2026-002');
});

test('nuevoId devuelve ids únicos con el prefijo pedido', () => {
  const a = nuevoId('sg'), b = nuevoId('sg');
  assert.match(a, /^sg_/);
  assert.notEqual(a, b);
});
```

```js
// pruebas/bitacora.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffCampos, crearAsiento } from '../src/datos/bitacora.js';

test('diffCampos detecta sólo los campos que cambiaron', () => {
  const cambios = diffCampos({ avance: 120, estado: 'planificado', area: 'Obras' },
                             { avance: 180, estado: 'planificado', area: 'Obras' });
  assert.deepEqual(cambios, [{ campo: 'avance', antes: 120, despues: 180 }]);
});

test('diffCampos ignora los campos de trazabilidad', () => {
  assert.deepEqual(diffCampos({ a: 1, creado_en: 'x' }, { a: 1, creado_en: 'y' }), []);
});

test('crearAsiento estampa entidad, acción, usuario y marca de tiempo', () => {
  const a = crearAsiento({ entidad: 'proyectos', id_entidad: 'OBR-2026-014',
                           accion: 'edicion', cambios: [], usuario: 'M. López' });
  assert.equal(a.entidad, 'proyectos');
  assert.equal(a.accion, 'edicion');
  assert.equal(a.creado_por, 'M. López');
  assert.match(a.creado_en, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(a.id);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/datos/ids.js'`.

- [ ] **Step 3: Implementar `almacenamiento.js`**

```js
// ÚNICO archivo del repositorio autorizado a tocar localStorage.
// Al migrar a persistencia real, este archivo desaparece y sólo cambian
// los cuerpos de las funciones de repositorio.js.
export const CLAVE = 'coord3f_bd_v1';

export function leerBD() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function escribirBD(bd) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(bd));
  } catch (e) {
    console.error('No se pudo persistir la base', e);
  }
}

export function limpiar() {
  localStorage.removeItem(CLAVE);
}
```

- [ ] **Step 4: Implementar `esquema.js` y `catalogos.js`**

`COLECCIONES = ['proyectos','seguimientos','compromisos','monitoreos','temas_monitoreo','mesas','reuniones_mesa','eventos','requerimientos_evento','planificacion_anual','historial','reportes_guardados']`.

`bdVacia()` devuelve `{ version: VERSION_ESQUEMA, config: { usuario: 'Coordinación' }, catalogos: structuredClone(CATALOGOS_SEMILLA), ...cada colección en [] }`.

`catalogos.js` exporta:
- **Administrables** (`CATALOGOS_SEMILLA`, viven en `bd.catalogos` y se editan en Configuración): `areas` (con `id`, `nombre`, `prefijo`), `programas`, `ejes`, `tipos`, `unidades`, `categorias_tema`, `items_requerimiento`, `tipos_evento`, `periodicidades`. Semilla mínima genérica y claramente provisoria — los catálogos institucionales reales están diferidos.
- **Congeladas** (`Object.freeze`, tienen semántica atada al código): `ESTADOS_PROYECTO = ['planificado','en ejecución','demorado','finalizado','suspendido']`, `PRIORIDADES = ['alta','media','baja']`, `CRITICIDADES = ['alta','media','baja']`, `ESTADOS_COMPROMISO = ['pendiente','en curso','cumplido']` (sin `vencido`: es derivado), `ESTADOS_REQUERIMIENTO = ['solicitado','confirmado','entregado']`, `TIPOS_MESA = ['temática','barrial','otros proyectos']`, `ESTADOS_MESA = ['activa','latente','cerrada']`.

- [ ] **Step 5: Implementar `ids.js`**

```js
export function generarIdProyecto(bd, idArea, fecha) {
  const area = bd.catalogos.areas.find((a) => a.id === idArea);
  const prefijo = area?.prefijo ?? 'GEN';
  const anio = String(fecha).slice(0, 4);
  const raiz = `${prefijo}-${anio}-`;
  // Cuenta también las bajas lógicas: un id dado de baja nunca se reutiliza.
  const usados = bd.proyectos
    .filter((p) => String(p.id_proyecto).startsWith(raiz))
    .map((p) => Number(String(p.id_proyecto).slice(raiz.length)))
    .filter((n) => Number.isFinite(n));
  const siguiente = (usados.length ? Math.max(...usados) : 0) + 1;
  return raiz + String(siguiente).padStart(3, '0');
}

let contador = 0;
export function nuevoId(prefijo) {
  contador += 1;
  return `${prefijo}_${Date.now().toString(36)}${contador.toString(36)}`;
}
```

- [ ] **Step 6: Implementar `bitacora.js`**

```js
import { nuevoId } from './ids.js';

const IGNORAR = ['creado_en', 'creado_por', 'id'];

export function diffCampos(antes, despues, ignorar = IGNORAR) {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  const cambios = [];
  for (const campo of campos) {
    if (ignorar.includes(campo)) continue;
    const a = antes?.[campo], d = despues?.[campo];
    if (JSON.stringify(a) !== JSON.stringify(d)) cambios.push({ campo, antes: a, despues: d });
  }
  return cambios;
}

export function crearAsiento({ entidad, id_entidad, accion, cambios = [], usuario, id_proyecto = null }) {
  return {
    id: nuevoId('h'), entidad, id_entidad, accion, cambios, id_proyecto,
    creado_por: usuario, creado_en: new Date().toISOString(),
  };
}
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npm run test`
Expected: PASS en `ids.test.mjs` y `bitacora.test.mjs`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: núcleo de datos — almacenamiento aislado, esquema, catálogos, ids y bitácora"
```

---

## Task 3: Repositorio y store

**Files:**
- Create: `src/datos/repositorio.js`, `src/estado/tienda.js`

**Interfaces:**
- Consumes: `almacenamiento`, `esquema`, `catalogos`, `ids`, `bitacora` de Task 2
- Produces (todas `async`):
  - `hidratar(): Promise<BD>` · `obtenerBD(): Promise<BD>`
  - `crear(entidad, datos, opciones): Promise<Registro>` · `actualizar(entidad, id, cambios, opciones): Promise<Registro>` · `bajaLogica(entidad, id): Promise<void>`
  - Envolturas con nombre: `getProyectos(filtros)`, `crearProyecto`, `actualizarProyecto`, `bajaProyecto`, `crearSeguimiento`, `actualizarSeguimiento`, `crearCompromiso`, `crearCompromisos(lista)`, `actualizarCompromiso`, `marcarCumplido(id, fecha)`, `crearMonitoreo`, `agregarTema(idMonitoreo, tema)`, `finalizarMonitoreo(id)`, `crearMesa`, `actualizarMesa`, `crearReunionMesa`, `crearEvento`, `actualizarEvento`, `crearRequerimiento`, `actualizarRequerimiento`, `guardarPlanificacion`, `guardarCatalogo(nombre, items)`, `guardarConfig(cambios)`, `guardarReporte(nombre, filtros)`, `borrarReporte(id)`, `cargarDemo()`, `vaciarSistema()`, `importarProyectos(filas)`, `importarPlanificacion(filas)`
  - Store: `useTienda`, `useBD()`, `useUsuario()`, `useAcciones()`

- [ ] **Step 1: Implementar el núcleo genérico de `repositorio.js`**

Mantiene una copia en memoria `bdActual`, sembrada por `hidratar()` desde `leerBD()` o `bdVacia()`. Cada mutación: (a) construye el registro, (b) calcula el diff contra el estado previo, (c) empuja el asiento a `bd.historial`, (d) llama a `escribirBD`, (e) notifica a los suscriptores.

```js
import { leerBD, escribirBD, limpiar } from './almacenamiento.js';
import { bdVacia, VERSION_ESQUEMA } from './esquema.js';
import { crearAsiento, diffCampos } from './bitacora.js';
import { nuevoId, generarIdProyecto } from './ids.js';

let bdActual = null;
const suscriptores = new Set();

function notificar() { for (const fn of suscriptores) fn(bdActual); }
export function suscribir(fn) { suscriptores.add(fn); return () => suscriptores.delete(fn); }

async function persistir() { escribirBD(bdActual); notificar(); }

export async function hidratar() {
  const guardada = leerBD();
  bdActual = guardada && guardada.version === VERSION_ESQUEMA ? guardada : bdVacia();
  return bdActual;
}

export async function obtenerBD() {
  if (!bdActual) await hidratar();
  return bdActual;
}

export async function crear(entidad, datos, { id_proyecto = null, clave = 'id' } = {}) {
  const bd = await obtenerBD();
  const registro = {
    [clave]: datos[clave] ?? nuevoId(entidad.slice(0, 2)),
    ...datos, activo: true,
    creado_por: bd.config.usuario, creado_en: new Date().toISOString(),
  };
  bd[entidad] = [...bd[entidad], registro];
  bd.historial = [...bd.historial, crearAsiento({
    entidad, id_entidad: registro[clave], accion: 'alta',
    cambios: [], usuario: bd.config.usuario, id_proyecto,
  })];
  await persistir();
  return registro;
}

export async function actualizar(entidad, id, cambios, { clave = 'id', id_proyecto = null } = {}) {
  const bd = await obtenerBD();
  const previo = bd[entidad].find((r) => r[clave] === id);
  if (!previo) throw new Error(`No existe ${entidad} ${id}`);
  const nuevo = { ...previo, ...cambios };
  bd[entidad] = bd[entidad].map((r) => (r[clave] === id ? nuevo : r));
  const diff = diffCampos(previo, nuevo);
  if (diff.length) {
    bd.historial = [...bd.historial, crearAsiento({
      entidad, id_entidad: id, accion: 'edicion', cambios: diff,
      usuario: bd.config.usuario, id_proyecto: id_proyecto ?? previo.id_proyecto ?? null,
    })];
  }
  await persistir();
  return nuevo;
}

export async function bajaLogica(entidad, id, { clave = 'id' } = {}) {
  return actualizar(entidad, id, { activo: false }, { clave });
}
```

- [ ] **Step 2: Escribir las envolturas con nombre**

Cada una delega en `crear` / `actualizar` fijando la entidad y los defaults del dominio. Ejemplos que fijan el contrato para tareas posteriores:

```js
export async function crearProyecto(datos) {
  const bd = await obtenerBD();
  const id_proyecto = datos.id_proyecto || generarIdProyecto(bd, datos.id_area, datos.fecha_carga);
  return crear('proyectos', { ...datos, id_proyecto }, { clave: 'id_proyecto', id_proyecto });
}

export async function actualizarProyecto(id, cambios) {
  return actualizar('proyectos', id, cambios, { clave: 'id_proyecto', id_proyecto: id });
}

export async function marcarCumplido(id, fecha) {
  return actualizarCompromiso(id, { estado: 'cumplido', fecha_cumplimiento: fecha });
}

export async function crearCompromisos(lista) {
  const creados = [];
  for (const c of lista) creados.push(await crearCompromiso(c));
  return creados;
}

export async function vaciarSistema() {
  limpiar();
  bdActual = bdVacia();
  await persistir();
  return bdActual;
}
```

`crearCompromiso(datos)` exige `origen_tipo` (`'seguimiento'|'monitoreo'|'mesa'`) e `id_origen`; lanza si falta alguno, para que ningún camino cree compromisos huérfanos.

`agregarTema(idMonitoreo, tema)` crea el tema y, si `tema.requiere_accion`, crea además el compromiso correspondiente con `origen_tipo: 'monitoreo'`, `id_origen: idMonitoreo` — devuelve `{ tema, compromiso }`.

`finalizarMonitoreo(id)` lanza si el monitoreo no tiene al menos un tema activo (validación §8.6).

- [ ] **Step 3: Implementar `src/estado/tienda.js`**

```js
import { create } from 'zustand';
import * as repo from '../datos/repositorio.js';

export const useTienda = create((set) => ({
  bd: null,
  cargando: true,
  async iniciar() {
    const bd = await repo.hidratar();
    repo.suscribir((nueva) => set({ bd: { ...nueva } }));
    set({ bd, cargando: false });
  },
}));

export const useBD = () => useTienda((e) => e.bd);
export const useUsuario = () => useTienda((e) => e.bd?.config?.usuario ?? 'Coordinación');
```

`useAcciones()` reexporta el repositorio para que los componentes escriban sin importar el módulo de datos directamente. El `set({ bd: { ...nueva } })` con copia superficial es lo que dispara el re-render en cada mutación.

- [ ] **Step 4: Verificar el aislamiento**

Run: `npm run verificar`
Expected: `OK · aislamiento de la capa de datos` — ni `repositorio.js` ni `tienda.js` mencionan `localStorage`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: repositorio async con bitácora automática y store Zustand"
```

---

## Task 4: Selectores puros

**Files:**
- Create: `src/datos/selectores.js`
- Test: `pruebas/selectores.test.mjs`

**Interfaces:**
- Consumes: la forma de `bd` de Task 2
- Produces:
  - `activos(coleccion): T[]`
  - `porcentajeAvance(proyecto): number` — acotado a 100
  - `estadoCompromiso(compromiso, hoy): 'pendiente'|'en curso'|'cumplido'|'vencido'`
  - `diasHasta(fechaISO, hoy): number`
  - `ultimaActualizacion(bd, idProyecto): string|null`
  - `proyectos(bd, filtros): Proyecto[]` · `proyectoPorId(bd, id)`
  - `compromisos(bd, filtros, hoy): Compromiso[]` (cada uno con `estado_efectivo` y `dias_atraso`)
  - `feedBitacora(bd, n): Asiento[]`
  - `eventosCalendario(bd, capas, desde, hasta): ItemCalendario[]` con `{fecha, capa, titulo, ruta}`
  - `resumenRequerimientos(bd, idEvento): {total, confirmados, porcentaje}`
  - `mesasSinReunion(bd, hoy): Mesa[]`
  - `historialArea(bd, area): {seguimientos, compromisos, proyectos}`
  - Agregados de planificación: `porDimension(bd, campo)`, `avancePorArea(bd)`, `gastoPorDimension(bd, campo)`, `ejecucionPresupuestaria(bd)`, `desvioTrimestral(bd, anio, trimestre)`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// pruebas/selectores.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { porcentajeAvance, estadoCompromiso, diasHasta, activos,
         resumenRequerimientos, ultimaActualizacion } from '../src/datos/selectores.js';

const HOY = '2026-08-08';

test('porcentajeAvance se acota a 100', () => {
  assert.equal(porcentajeAvance({ avance: 150, objetivo: 100 }), 100);
  assert.equal(porcentajeAvance({ avance: 25, objetivo: 100 }), 25);
});

test('porcentajeAvance devuelve 0 si el objetivo es cero o falta', () => {
  assert.equal(porcentajeAvance({ avance: 10, objetivo: 0 }), 0);
  assert.equal(porcentajeAvance({ avance: 10 }), 0);
});

test('un compromiso con fecha pasada y sin cumplir es vencido', () => {
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: '2026-08-01' }, HOY), 'vencido');
});

test('un compromiso cumplido nunca es vencido, aunque la fecha haya pasado', () => {
  assert.equal(estadoCompromiso({ estado: 'cumplido', fecha_limite: '2026-08-01' }, HOY), 'cumplido');
});

test('un compromiso que vence hoy todavía no está vencido', () => {
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: HOY }, HOY), 'pendiente');
});

test('diasHasta es negativo para fechas pasadas', () => {
  assert.equal(diasHasta('2026-08-11', HOY), 3);
  assert.equal(diasHasta('2026-08-05', HOY), -3);
});

test('activos filtra las bajas lógicas', () => {
  assert.equal(activos([{ activo: true }, { activo: false }, { activo: true }]).length, 2);
});

test('resumenRequerimientos cuenta confirmados y entregados como confirmados', () => {
  const bd = { requerimientos_evento: [
    { id_evento: 'e1', estado: 'solicitado', activo: true },
    { id_evento: 'e1', estado: 'confirmado', activo: true },
    { id_evento: 'e1', estado: 'entregado', activo: true },
    { id_evento: 'e2', estado: 'solicitado', activo: true },
  ] };
  assert.deepEqual(resumenRequerimientos(bd, 'e1'), { total: 3, confirmados: 2, porcentaje: 67 });
});

test('ultimaActualizacion toma el asiento de bitácora más reciente del proyecto', () => {
  const bd = { historial: [
    { id_proyecto: 'OBR-2026-001', creado_en: '2026-07-01T10:00:00' },
    { id_proyecto: 'OBR-2026-001', creado_en: '2026-08-05T10:00:00' },
    { id_proyecto: 'OBR-2026-002', creado_en: '2026-08-07T10:00:00' },
  ] };
  assert.equal(ultimaActualizacion(bd, 'OBR-2026-001'), '2026-08-05T10:00:00');
  assert.equal(ultimaActualizacion(bd, 'OBR-2026-999'), null);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/datos/selectores.js'`.

- [ ] **Step 3: Implementar `selectores.js`**

Todas las funciones son puras: reciben `bd` (o una colección) y devuelven derivaciones. No importan la tienda ni el almacenamiento. `hoy` siempre es un parámetro con default, nunca se lee del reloj dentro de una función pura sin poder inyectarlo — es lo que hace testeables los vencimientos.

```js
export function activos(coleccion = []) { return coleccion.filter((r) => r.activo !== false); }

export function porcentajeAvance(p) {
  const objetivo = Number(p?.objetivo) || 0;
  if (!objetivo) return 0;
  return Math.min(Math.round((Number(p.avance) || 0) / objetivo * 100), 100);
}

export function diasHasta(fechaISO, hoy) {
  const MS = 86400000;
  const a = Date.parse(String(fechaISO).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(String(hoy).slice(0, 10) + 'T00:00:00Z');
  return Math.round((a - b) / MS);
}

export function estadoCompromiso(c, hoy) {
  if (c.estado === 'cumplido') return 'cumplido';
  if (c.fecha_limite && diasHasta(c.fecha_limite, hoy) < 0) return 'vencido';
  return c.estado;
}

export function ultimaActualizacion(bd, idProyecto) {
  const asientos = (bd.historial ?? []).filter((h) => h.id_proyecto === idProyecto);
  if (!asientos.length) return null;
  return asientos.reduce((max, h) => (h.creado_en > max ? h.creado_en : max), asientos[0].creado_en);
}

export function resumenRequerimientos(bd, idEvento) {
  const reqs = activos(bd.requerimientos_evento).filter((r) => r.id_evento === idEvento);
  const confirmados = reqs.filter((r) => r.estado === 'confirmado' || r.estado === 'entregado').length;
  return { total: reqs.length, confirmados,
           porcentaje: reqs.length ? Math.round(confirmados / reqs.length * 100) : 0 };
}
```

El resto (`proyectos` con filtros combinables, `compromisos` con `estado_efectivo`, `eventosCalendario`, `historialArea`, agregados de planificación) sigue el mismo patrón: filtrar por `activos`, aplicar los filtros presentes en el objeto `filtros` ignorando los vacíos, y devolver arrays nuevos.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test`
Expected: PASS — todos los tests de selectores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: selectores puros con derivación de avance, vencimientos y agregados"
```

---

## Task 5: CSV — exportar, descargar, parsear

**Files:**
- Create: `src/datos/csv.js`
- Test: `pruebas/csv.test.mjs`

**Interfaces:**
- Consumes: nada
- Produces: `aCSV(filas, columnas): string` · `descargarCSV(nombre, filas, columnas): void` · `parsearCSV(texto): {encabezados: string[], filas: string[][]}`
- `columnas` es `[{ clave, titulo, formato? }]`. Lo usan todas las tablas de todos los módulos.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// pruebas/csv.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { aCSV, parsearCSV } from '../src/datos/csv.js';

const COLS = [{ clave: 'nombre', titulo: 'Nombre' }, { clave: 'monto', titulo: 'Monto' }];

test('aCSV escribe encabezados y filas con BOM', () => {
  const salida = aCSV([{ nombre: 'Plaza', monto: 100 }], COLS);
  assert.ok(salida.startsWith('\uFEFF'));
  assert.equal(salida.replace('\uFEFF', ''), 'Nombre,Monto\r\nPlaza,100');
});

test('aCSV entrecomilla los valores con coma, comilla o salto de línea', () => {
  const salida = aCSV([{ nombre: 'Plaza, Norte', monto: 'a"b' }], COLS).replace('\uFEFF', '');
  assert.equal(salida, 'Nombre,Monto\r\n"Plaza, Norte","a""b"');
});

test('aCSV escribe vacío donde el valor es null o undefined', () => {
  const salida = aCSV([{ nombre: null }], COLS).replace('\uFEFF', '');
  assert.equal(salida, 'Nombre,Monto\r\n,');
});

test('parsearCSV separa encabezados y filas', () => {
  const r = parsearCSV('Nombre,Monto\r\nPlaza,100\r\nCalle,200');
  assert.deepEqual(r.encabezados, ['Nombre', 'Monto']);
  assert.deepEqual(r.filas, [['Plaza', '100'], ['Calle', '200']]);
});

test('parsearCSV respeta comas y comillas escapadas dentro de campos', () => {
  const r = parsearCSV('Nombre,Monto\r\n"Plaza, Norte","a""b"');
  assert.deepEqual(r.filas, [['Plaza, Norte', 'a"b']]);
});

test('parsearCSV ignora el BOM y las líneas vacías del final', () => {
  const r = parsearCSV('\uFEFFNombre,Monto\r\nPlaza,100\r\n\r\n');
  assert.deepEqual(r.encabezados, ['Nombre', 'Monto']);
  assert.equal(r.filas.length, 1);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `csv.js`**

`aCSV` mapea cada fila por `columnas`, aplica `formato` si existe, y entrecomilla cuando el valor contiene `,`, `"`, `\r` o `\n`, duplicando las comillas internas. Prefija BOM UTF-8 para que Excel abra bien los acentos. `parsearCSV` es una máquina de estados que recorre el texto carácter a carácter llevando una bandera `dentroDeComillas` — no un `split(',')`, que rompe con campos entrecomillados. `descargarCSV` arma un `Blob` y dispara un `<a download>`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: generación y parseo de CSV con entrecomillado correcto"
```

---

## Task 6: Layout, navegación, componentes compartidos y Configuración

**Files:**
- Create: `src/componentes/Layout.jsx`, `BarraLateral.jsx`, `Tabla.jsx`, `Vacio.jsx`, `Semaforo.jsx`, `BarraAvance.jsx`, `Tarjeta.jsx`, `Modal.jsx`, `Campo.jsx`, `SelectorProyecto.jsx`, `Calendario.jsx`, `Chip.jsx`
- Create: `src/modulos/configuracion/Configuracion.jsx`
- Create: `src/utilidades/formato.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useBD`, `useTienda` de Task 3; `descargarCSV` de Task 5
- Produces:
  - `<Tabla columnas={[{clave,titulo,ancho?,render?,formato?}]} filas={} nombreExport="" alHacerClic={} />` — orden por columna, búsqueda, exportación CSV en el encabezado, `<Vacio>` automático si no hay filas
  - `<Vacio titulo="" descripcion="" accion={{texto, alHacerClic}} />`
  - `<Semaforo nivel="vencido|proximo|atencion|enregla|sindato" texto="" />`
  - `<BarraAvance valor={0..100} />`
  - `<Campo tipo="texto|numero|fecha|hora|select|multiselect|textarea|check" ... />` — todo select toma sus opciones de un catálogo
  - `<SelectorProyecto multiple={} valor={} alCambiar={} />` — búsqueda sobre la base maestra
  - `<Calendario mes={} items={} capas={} alCambiarCapas={} />` — grilla mensual con puntos de color por capa
  - `formato.js`: `fecha(iso)` → `DD/MM/AAAA` · `moneda(n)` → `$ 1.234.567` · `numero(n)` · `hoyISO()`

- [ ] **Step 1: Escribir `src/utilidades/formato.js`**

Con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })` para moneda y armado manual `DD/MM/AAAA` desde el ISO — no `toLocaleDateString`, que depende del locale del navegador y desplaza un día por zona horaria.

- [ ] **Step 2: Construir la barra lateral y el layout**

Nueve entradas con icono de lucide-react: Inicio · Proyectos · Seguimiento · Monitoreo · Planificación · Mesas · Eventos · Reportes · Configuración. Ítem activo con fondo `acento-suave` y borde izquierdo `acento`. La barra lleva la clase `no-imprimir`. El layout es sidebar fija + área de contenido con encabezado de página (título, descripción corta y acciones a la derecha).

- [ ] **Step 3: Construir los componentes compartidos**

`Tabla` es el que más rinde: ordenamiento por click en el encabezado, campo de búsqueda, botón «Exportar CSV» que llama a `descargarCSV(nombreExport, filasVisibles, columnas)` — **sobre las filas filtradas, no sobre todas**, para que la exportación coincida con lo que el usuario ve.

- [ ] **Step 4: Construir la pantalla de Configuración**

Tres secciones:
1. **Usuario actual** — campo de texto que escribe `bd.config.usuario` vía `guardarConfig`. Nota al pie: «Se usa para firmar cada carga. Al incorporarse el acceso por usuario, este campo se reemplaza.»
2. **Catálogos** — un panel por catálogo administrable, con alta, edición y baja lógica de ítems. El catálogo de áreas incluye el campo `prefijo` (tres letras, usado para el `id_proyecto`).
3. **Datos** — botones «Cargar datos de demostración» y «Vaciar sistema», ambos con confirmación previa. Se cablean en Task 8.

- [ ] **Step 5: Cablear el ruteo en `App.jsx`**

Rutas: `/` (dashboard) · `/proyectos` · `/seguimiento` · `/monitoreo` · `/planificacion` · `/mesas` · `/eventos` · `/reportes` · `/configuracion`. `App` llama a `useTienda.getState().iniciar()` en un `useEffect` de arranque y muestra un estado de carga hasta que `cargando` sea falso. Cada módulo aún no construido rinde un `<Vacio>` provisorio, reemplazado en su tarea.

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Navegar entre las nueve rutas: la barra marca el ítem activo, editar el usuario en Configuración persiste tras recargar la página.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: layout, navegación, componentes compartidos y pantalla de configuración"
```

---

## Task 7: Base maestra de proyectos

**Files:**
- Create: `src/modulos/proyectos/Proyectos.jsx`, `FormularioProyecto.jsx`, `FichaProyecto.jsx`, `ImportarProyectos.jsx`
- Create: `src/utilidades/filtrosUrl.js`

**Interfaces:**
- Consumes: `Tabla`, `Campo`, `Modal` de Task 6; `crearProyecto`, `actualizarProyecto`, `bajaProyecto`, `importarProyectos` de Task 3; `proyectos`, `porcentajeAvance`, `ultimaActualizacion` de Task 4
- Produces: `useFiltrosUrl(defaults): [filtros, setFiltros]` — sincroniza filtros con `searchParams` (regla §8.2), reutilizado por todos los módulos posteriores

- [ ] **Step 1: Implementar `useFiltrosUrl`**

Lee `useSearchParams`, devuelve un objeto de filtros y un setter que escribe de vuelta omitiendo los valores vacíos, para que la URL quede limpia y compartible.

- [ ] **Step 2: Construir el listado**

`Tabla` con columnas: id, proyecto, área, programa, eje, tipo, estado (`Semaforo`), prioridad (`Chip`), avance (`BarraAvance` + `porcentaje_avance`), responsable, fin previsto, última actualización. Filtros por área, programa, eje, tipo, estado y prioridad, más los conmutadores «sólo obras» y «sólo prioritarios» — todos vía `useFiltrosUrl`, para que el dashboard pueda linkear a `/proyectos?es_obra=1` desde sus contadores.

- [ ] **Step 3: Construir el formulario de alta y edición**

Todos los campos de catálogo son `select`; nunca texto libre. El `id_proyecto` se muestra generado y en sólo lectura al crear. Validaciones de §8.6: si `avance > objetivo`, un diálogo pide confirmación explícita antes de guardar; `fecha_fin_prevista` no puede ser anterior a `fecha_inicio`.

- [ ] **Step 4: Construir la ficha del proyecto**

Encabezado con nombre, id, estado y barra de avance. Pestañas: **Datos** (todos los campos) · **Seguimientos** (los que lo incluyen en `ids_proyecto`) · **Compromisos** · **Planificación** · **Historial** (asientos de bitácora del proyecto, con campo, antes → después, quién y cuándo). Las pestañas de seguimientos, compromisos y planificación quedan pobladas en sus tareas respectivas; hasta entonces muestran `<Vacio>`.

- [ ] **Step 5: Construir la importación CSV**

Subir archivo o pegar contenido → `parsearCSV` → mapeo de columnas del archivo a campos del modelo → vista previa con validación contra catálogos → tabla de filas aceptadas y rechazadas con el motivo del rechazo → confirmar. Sólo se importan las filas aceptadas.

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Crear un proyecto a mano: aparece en el listado, su ficha muestra el asiento de alta en Historial, y sobrevive a un refresh.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: base maestra de proyectos con ficha, historial e importación CSV"
```

---

## Task 8: Generador de datos de demostración

**Files:**
- Create: `src/datos/demo.js`
- Modify: `src/datos/repositorio.js` (cablear `cargarDemo`), `src/modulos/configuracion/Configuracion.jsx`

**Interfaces:**
- Consumes: `bdVacia`, `nuevoId`, `generarIdProyecto`, `crearAsiento`
- Produces: `generarDemo(hoyISO): BD` — devuelve una BD completa y coherente, lista para `escribirBD`

- [ ] **Step 1: Escribir `generarDemo`**

Genera **relativo a `hoyISO`**, nunca con fechas fijas: el set tiene que seguir mostrando los mismos casos de borde dentro de seis meses.

- 8 áreas y ~40 proyectos, inventados y evidentemente ficticios (áreas del tipo «Obras Públicas», «Desarrollo Social»; proyectos del tipo «Repavimentación Barrio Los Álamos»). Nunca datos reales del municipio.
- Distribución dispareja entre áreas y estados, para que los gráficos no salgan planos.
- Asientos de bitácora retroactivos, con fechas escalonadas, para que «Última actualización» y el feed del dashboard tengan contenido creíble.

**Casos de borde obligatorios:**

| Caso | Cómo se genera |
|---|---|
| Compromisos vencidos | 4 compromisos con `fecha_limite` entre `hoy-30` y `hoy-2`, estado `pendiente` |
| Vencimientos próximos | 3 compromisos entre `hoy+1` y `hoy+6` |
| Proyectos sin actualizar hace >30 días | 3 proyectos cuyo asiento más reciente es `hoy-45` |
| Proyecto vencido no finalizado | 2 con `fecha_fin_prevista` pasada y estado `en ejecución` |
| Evento con requerimientos incompletos | 1 evento a `hoy+3` con 6 requerimientos, 2 sin confirmar |
| Temas críticos sin resolver | 3 temas con `criticidad: 'alta'`, `resuelto: false` |
| Mesas de los tres tipos | ≥2 por tipo; una mesa mensual sin reunión desde `hoy-70` |
| Desvíos de planificación | proyectos por encima y por debajo de la meta trimestral |

- [ ] **Step 2: Cablear los botones de Configuración**

`cargarDemo()` reemplaza la BD entera por `generarDemo(hoyISO())` y persiste. `vaciarSistema()` ya existe de Task 3. Ambos piden confirmación explícita, advirtiendo que se pierde lo cargado.

- [ ] **Step 3: Verificar**

Run: `npm run verificar`
Expected: verde. Cargar la demo y recorrer `/proyectos`: ~40 filas con áreas y estados variados. Vaciar el sistema: `/proyectos` muestra el `<Vacio>` con su atajo de carga, sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: generador de datos de demostración con casos de borde"
```

---

## Task 9: Motor de alertas centralizado

**Files:**
- Create: `src/datos/alertas.js`
- Test: `pruebas/alertas.test.mjs`

**Interfaces:**
- Consumes: `selectores` de Task 4
- Produces:
  - `TIPOS_ALERTA` — constantes de los siete tipos
  - `calcularAlertas(bd, hoy): Alerta[]`, ordenadas por severidad y luego por días de atraso descendente
  - `Alerta = { id, tipo, severidad: 'critica'|'alta'|'media', titulo, detalle, area, id_proyecto, responsable, dias_atraso, ruta_origen }`
  - `alertasPorTipo(alertas): Record<tipo, Alerta[]>` · `vencimientosProximos(bd, hoy, dias)` para el dashboard

**Esta función es la única fuente de alertas del sistema.** Dashboard, panel de monitoreo y reportes la consumen. Ningún otro archivo puede recalcular vencimientos.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// pruebas/alertas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAlertas, TIPOS_ALERTA } from '../src/datos/alertas.js';

const HOY = '2026-08-08';
const base = { proyectos: [], compromisos: [], temas_monitoreo: [], eventos: [],
               requerimientos_evento: [], mesas: [], reuniones_mesa: [],
               planificacion_anual: [], historial: [], seguimientos: [], monitoreos: [] };

test('un compromiso vencido genera alerta crítica con los días de atraso', () => {
  const bd = { ...base, compromisos: [{ id: 'c1', activo: true, estado: 'pendiente',
    fecha_limite: '2026-08-01', area: 'Obras', responsable: 'J. Pérez',
    id_proyecto: 'OBR-2026-001', descripcion: 'Enviar pliego' }] };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, TIPOS_ALERTA.COMPROMISO_VENCIDO);
  assert.equal(a[0].severidad, 'critica');
  assert.equal(a[0].dias_atraso, 7);
  assert.equal(a[0].responsable, 'J. Pérez');
});

test('un compromiso cumplido fuera de término no genera alerta', () => {
  const bd = { ...base, compromisos: [{ id: 'c1', activo: true, estado: 'cumplido',
    fecha_limite: '2026-08-01', fecha_cumplimiento: '2026-08-06' }] };
  assert.equal(calcularAlertas(bd, HOY).length, 0);
});

test('un compromiso que vence dentro de 7 días genera alerta, uno a 8 días no', () => {
  const c = (id, f) => ({ id, activo: true, estado: 'pendiente', fecha_limite: f });
  const bd = { ...base, compromisos: [c('c1', '2026-08-14'), c('c2', '2026-08-16')] };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, TIPOS_ALERTA.COMPROMISO_POR_VENCER);
});

test('un proyecto vencido y no finalizado alerta; uno finalizado no', () => {
  const p = (id, estado) => ({ id_proyecto: id, activo: true, estado,
    fecha_fin_prevista: '2026-07-01', area: 'Obras' });
  const bd = { ...base, proyectos: [p('P1', 'en ejecución'), p('P2', 'finalizado')] };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].id_proyecto, 'P1');
});

test('un proyecto sin asientos hace más de 30 días alerta; uno reciente no', () => {
  const bd = { ...base,
    proyectos: [{ id_proyecto: 'P1', activo: true, estado: 'en ejecución' },
                { id_proyecto: 'P2', activo: true, estado: 'en ejecución' }],
    historial: [{ id_proyecto: 'P1', creado_en: '2026-06-01T10:00:00' },
                { id_proyecto: 'P2', creado_en: '2026-08-05T10:00:00' }] };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR);
  assert.equal(a.length, 1);
  assert.equal(a[0].id_proyecto, 'P1');
});

test('un tema de criticidad alta sin resolver alerta', () => {
  const bd = { ...base, temas_monitoreo: [
    { id: 't1', activo: true, criticidad: 'alta', resuelto: false, descripcion: 'Sin cuadrilla' },
    { id: 't2', activo: true, criticidad: 'alta', resuelto: true },
    { id: 't3', activo: true, criticidad: 'media', resuelto: false } ] };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.TEMA_CRITICO);
  assert.equal(a.length, 1);
});

test('un evento a 5 días o menos con requerimientos sin confirmar alerta', () => {
  const bd = { ...base,
    eventos: [{ id: 'e1', activo: true, nombre: 'Feria', fecha: '2026-08-11', estado: 'confirmado' },
              { id: 'e2', activo: true, nombre: 'Muestra', fecha: '2026-09-20', estado: 'confirmado' }],
    requerimientos_evento: [
      { id: 'r1', id_evento: 'e1', activo: true, estado: 'solicitado' },
      { id: 'r2', id_evento: 'e2', activo: true, estado: 'solicitado' } ] };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO);
  assert.equal(a.length, 1);
  assert.match(a[0].titulo, /Feria/);
});

test('las alertas salen ordenadas por severidad', () => {
  const bd = { ...base, compromisos: [
    { id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-12' },
    { id: 'c2', activo: true, estado: 'pendiente', fecha_limite: '2026-07-20' } ] };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a[0].severidad, 'critica');
});

test('las bajas lógicas no generan alertas', () => {
  const bd = { ...base, compromisos: [{ id: 'c1', activo: false, estado: 'pendiente',
    fecha_limite: '2026-07-01' }] };
  assert.equal(calcularAlertas(bd, HOY).length, 0);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `alertas.js`**

```js
export const TIPOS_ALERTA = Object.freeze({
  COMPROMISO_VENCIDO: 'compromiso_vencido',
  COMPROMISO_POR_VENCER: 'compromiso_por_vencer',
  PROYECTO_VENCIDO: 'proyecto_vencido',
  PROYECTO_SIN_ACTUALIZAR: 'proyecto_sin_actualizar',
  TEMA_CRITICO: 'tema_critico',
  EVENTO_INCOMPLETO: 'evento_incompleto',
  MESA_SIN_REUNION: 'mesa_sin_reunion',
});

const ORDEN = { critica: 0, alta: 1, media: 2 };

export function calcularAlertas(bd, hoy) {
  const alertas = [
    ...compromisosVencidos(bd, hoy),
    ...compromisosPorVencer(bd, hoy),
    ...proyectosVencidos(bd, hoy),
    ...proyectosSinActualizar(bd, hoy),
    ...temasCriticos(bd),
    ...eventosIncompletos(bd, hoy),
    ...mesasSinReunion(bd, hoy),
  ];
  return alertas.sort((a, b) =>
    ORDEN[a.severidad] - ORDEN[b.severidad] || (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0));
}
```

Umbrales, fijados por la spec: compromisos por vencer **≤ 7 días**; proyectos sin actualizar **> 30 días**; eventos incompletos **≤ 5 días**. Severidades: `critica` para vencidos, `alta` para por vencer, eventos incompletos y temas críticos, `media` para el resto. Cada alerta lleva `ruta_origen` (`/seguimiento?compromiso=c1`, `/proyectos/OBR-2026-001`…) para que la UI linkee al registro de origen sin recomponer la ruta.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test`
Expected: PASS — los diez tests de alertas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: motor de alertas centralizado con siete tipos y umbrales de la spec"
```

---

## Task 10: Módulo 1 — Dashboard

**Files:**
- Create: `src/modulos/dashboard/Dashboard.jsx`, `ProximosVencimientos.jsx`, `ProximosSeguimientos.jsx`, `ProyectosPrioritarios.jsx`, `FeedActualizaciones.jsx`, `Contadores.jsx`

**Interfaces:**
- Consumes: `calcularAlertas`, `vencimientosProximos` de Task 9; `feedBitacora`, `eventosCalendario`, `proyectos` de Task 4; `Calendario`, `Tarjeta`, `BarraAvance`, `Semaforo` de Task 6
- Produces: la ruta `/`

- [ ] **Step 1: Contadores**

Dos tarjetas numéricas: proyectos activos (estado ≠ `finalizado` y ≠ `suspendido`) y obras activas (además `es_obra`). Cada una navega al listado filtrado: `/proyectos?activos=1` y `/proyectos?activos=1&es_obra=1`.

- [ ] **Step 2: Próximos vencimientos**

`vencimientosProximos(bd, hoy, 15)` unifica compromisos, hitos de planificación y fechas de fin previstas. Orden por fecha ascendente. Semáforo: **rojo** vencido, **naranja** ≤ 3 días, **amarillo** ≤ 15 días. Cada fila linkea a su `ruta_origen`.

- [ ] **Step 3: Próximos seguimientos, prioritarios y feed**

Seguimientos con `tipo: 'programado'` y fecha ≥ hoy, con área, proyecto y fecha. Proyectos con `prioridad: 'alta'`, con barra de avance y estado. Feed: los 10 asientos de bitácora más recientes, en lenguaje natural («M. López actualizó el avance de Repavimentación Los Álamos · hace 2 h»).

- [ ] **Step 4: Calendario unificado**

`<Calendario>` con las cuatro capas (seguimientos, eventos, reuniones de mesa, vencimientos), cada una con su color de token, y conmutadores para encender y apagar cada una. El estado de las capas vive en `searchParams`.

- [ ] **Step 5: Componer la pantalla**

Una sola pantalla, sin scroll infinito: grilla de contadores arriba, dos columnas debajo (izquierda: vencimientos y seguimientos; derecha: calendario), prioritarios y feed al pie. En tablet colapsa a una columna.

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Con la demo cargada, los seis componentes tienen contenido; con el sistema vacío, cada uno muestra su `<Vacio>` con atajo de carga.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: módulo 1 — dashboard con vencimientos, calendario unificado y feed"
```

---

## Task 11: Módulo 2 — Seguimiento (con carga manual de los tres bloques)

**Files:**
- Create: `src/modulos/seguimiento/Seguimiento.jsx`, `AgendarSeguimiento.jsx`, `CargarSeguimiento.jsx`, `ListaCompromisos.jsx`, `HistorialArea.jsx`

**Interfaces:**
- Consumes: `crearSeguimiento`, `crearCompromisos`, `marcarCumplido` de Task 3; `compromisos`, `historialArea` de Task 4; `SelectorProyecto`, `Tabla`, `Calendario` de Task 6
- Produces: la ruta `/seguimiento` con cuatro pestañas — Calendario · Cargar · Compromisos · Historial por área

En esta tarea los tres bloques (compromisos, avances, problemas) se cargan **a mano**. La separación automática se conecta en Task 12 sin tocar esta UI.

- [ ] **Step 1: Calendario de próximos seguimientos**

Vistas de calendario y de lista, conmutables con un botón; la elección se refleja en `searchParams`.

- [ ] **Step 2: Agendar seguimiento**

Formulario: área, proyecto/s (`SelectorProyecto` múltiple), fecha, hora, participantes previstos, temas a tratar. Guarda con `tipo: 'programado'`.

- [ ] **Step 3: Cargar seguimiento realizado**

En el orden exacto de la spec:
1. `SelectorProyecto` con búsqueda y selección múltiple.
2. **Última actualización** — panel de sólo lectura por cada proyecto elegido, con estado y avance registrados en la carga anterior, más un campo para confirmar o corregir el avance actual.
3. Textarea extenso para la minuta.
4. Tres bloques editables — **Compromisos** (filas con `descripción` / `responsable` / `fecha_limite`), **Avances informados**, **Problemas / trabas** — con botón de agregar fila en cada uno.

Al confirmar: crea el seguimiento con `tipo: 'realizado'`, crea los compromisos con `origen_tipo: 'seguimiento'` e `id_origen`, y actualiza el `avance` de cada proyecto corregido. Validación: `fecha_limite` no anterior a la fecha de carga.

- [ ] **Step 4: Lista de compromisos**

`Tabla` sobre `compromisos(bd, filtros, hoy)`, con `estado_efectivo` y `dias_atraso`. Filtros por área, responsable, estado y rango de fechas. Los vencidos con fondo `vencido` tenue. Acción «Marcar cumplido» por fila, que pide la fecha de cumplimiento. Columna de origen con link al seguimiento, monitoreo o mesa que lo generó.

- [ ] **Step 5: Historial por área**

Selector de área → línea de tiempo cronológica con seguimientos, compromisos (cumplidos y pendientes) y evolución del avance de sus proyectos (gráfico de líneas de Recharts sobre los asientos de bitácora del campo `avance`). Exportable a CSV.

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Cargar un seguimiento con un compromiso vencido y comprobar que aparece en la lista de compromisos, en el panel de alertas y en el dashboard — el mismo registro, sin doble carga.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: módulo 2 — seguimiento, compromisos e historial por área"
```

---

## Task 12: Separación automática de minutas

**Files:**
- Create: `src/datos/minutas/separarMinuta.js`
- Test: `pruebas/minutas.test.mjs`
- Modify: `src/modulos/seguimiento/CargarSeguimiento.jsx`

**Interfaces:**
- Consumes: nada — módulo puro, sin dependencias
- Produces: `separarMinuta(texto): { compromisos: [{descripcion, responsable, fecha_limite}], avances: string[], problemas: string[] }`

El archivo abre con este comentario, que es parte del entregable:

```js
// ─────────────────────────────────────────────────────────────────────
// SEPARACIÓN DE MINUTAS — implementación simulada por reglas locales.
//
// En el prototipo no hay backend donde alojar una clave de API, así que
// la separación se aproxima con heurísticas. Al conectar un modelo de
// lenguaje, se reemplaza ÚNICAMENTE el cuerpo de separarMinuta(): la
// firma y la forma del valor devuelto no cambian, y la interfaz de carga
// ya está construida como funcionaría con procesamiento real.
// ─────────────────────────────────────────────────────────────────────
```

- [ ] **Step 1: Escribir los tests que fallan**

```js
// pruebas/minutas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { separarMinuta } from '../src/datos/minutas/separarMinuta.js';

test('detecta un compromiso con responsable y fecha', () => {
  const r = separarMinuta('Pérez va a enviar el pliego antes del 15/09.');
  assert.equal(r.compromisos.length, 1);
  assert.match(r.compromisos[0].descripcion, /pliego/i);
  assert.equal(r.compromisos[0].responsable, 'Pérez');
  assert.ok(r.compromisos[0].fecha_limite);
});

test('clasifica una traba como problema', () => {
  const r = separarMinuta('Falta la conformidad de Ambiente y está trabado desde junio.');
  assert.equal(r.problemas.length, 1);
  assert.equal(r.compromisos.length, 0);
});

test('clasifica un hecho consumado como avance', () => {
  const r = separarMinuta('Ya se terminó el movimiento de suelos del sector norte.');
  assert.equal(r.avances.length, 1);
  assert.equal(r.compromisos.length, 0);
});

test('separa los tres bloques de una minuta mixta', () => {
  const r = separarMinuta([
    'Se ejecutaron 200 metros de cordón cuneta.',
    'Falta la aprobación del expediente en Legales.',
    'González va a presentar el informe el 20/09.',
  ].join(' '));
  assert.equal(r.avances.length, 1);
  assert.equal(r.problemas.length, 1);
  assert.equal(r.compromisos.length, 1);
});

test('un texto vacío devuelve los tres bloques vacíos, sin romper', () => {
  const r = separarMinuta('');
  assert.deepEqual(r, { compromisos: [], avances: [], problemas: [] });
});

test('una oración sin señales claras no se pierde: cae en avances', () => {
  const r = separarMinuta('Se conversó sobre el estado general de la obra.');
  assert.equal(r.avances.length + r.problemas.length + r.compromisos.length, 1);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar las reglas**

- **Partición en oraciones** por `.`, `;` y saltos de línea, descartando las de menos de tres palabras.
- **Compromiso:** verbo de acción en futuro o perífrasis (`va a`, `van a`, `queda en`, `se compromete a`, `deberá`, `tiene que`) seguido de `enviar|presentar|coordinar|definir|relevar|contratar|entregar|convocar|elevar|remitir|firmar|licitar`.
- **Responsable:** primera palabra capitalizada que no inicia la oración ni figura en una lista de palabras comunes capitalizadas (meses, nombres de área); si la oración empieza con un nombre propio seguido de un verbo de acción, se toma ese.
- **Fecha límite:** `DD/MM`, `DD/MM/AAAA`, `DD de <mes>`, `el <día de semana>`, `antes de fin de mes`, `la semana que viene` → resueltas a ISO contra la fecha de hoy.
- **Problema:** marcadores `falta`, `no se pudo`, `está trabado`, `demora`, `pendiente de`, `no hay`, `sin respuesta`, `se atrasó`.
- **Avance:** marcadores `se terminó`, `se ejecutó`, `ya está`, `avanzamos`, `se completó`, `se entregó`, `quedó`, más cualquier oración con cantidad y unidad.
- **Orden de precedencia:** compromiso > problema > avance. El resto cae en avances: es preferible que el usuario reclasifique a mano una oración a que el sistema la pierda.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Conectar con la UI de carga**

En `CargarSeguimiento.jsx`, un botón «Separar automáticamente» bajo el textarea llama a `separarMinuta` y **precarga** los tres bloques, que ya son editables desde Task 11. Nada cambia en la persistencia: el usuario sigue confirmando antes de guardar. Cartel visible: «Separación automática — revisá y corregí antes de confirmar. Nada se guarda hasta que confirmes.»

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Pegar una minuta larga, separar, corregir un responsable, confirmar: los compromisos se persisten con los valores corregidos, no con los propuestos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: separación automática de minutas por reglas locales, aislada y reemplazable"
```

---

## Task 13: Módulo 3 — Monitoreo

**Files:**
- Create: `src/modulos/monitoreo/Monitoreo.jsx`, `UltimosMonitoreos.jsx`, `MonitoreosPorArea.jsx`, `CargarMonitoreo.jsx`, `PanelAlertas.jsx`

**Interfaces:**
- Consumes: `crearMonitoreo`, `agregarTema`, `finalizarMonitoreo` de Task 3; `calcularAlertas` de Task 9
- Produces: la ruta `/monitoreo`; `<PanelAlertas>` reutilizable, consumido también por reportes

- [ ] **Step 1: Últimos monitoreos y monitoreos por área**

Listado cronológico con fecha, área, cantidad de temas y criticidad máxima (`Semaforo`). Gráfico de barras de Recharts con la cantidad de monitoreos por área en el período seleccionado, y tabla equivalente. Las áreas con cero monitoreos **aparecen igual, en cero** — el propósito declarado es detectar áreas sin cobertura, y omitirlas las escondería justo cuando importan.

- [ ] **Step 2: Carga incremental de temas**

Comportamiento central del módulo:
1. Crear el monitoreo con fecha + área → se habilita el formulario de un tema.
2. Al confirmar el tema, queda fijado en pantalla como tarjeta y **se habilita automáticamente el formulario del tema siguiente**, con la misma estructura, sin límite.
3. Cierra con el botón explícito «Finalizar monitoreo», que falla con mensaje claro si no hay al menos un tema (§8.6).

Estructura idéntica en todos los temas: categoría (catálogo) · proyecto vinculado (opcional) · descripción · criticidad · ¿requiere acción? · si requiere acción, responsable + fecha límite.

Un tema con `requiere_accion` crea su compromiso vía `agregarTema`, con `origen_tipo: 'monitoreo'`. La tarjeta del tema lo indica con un chip «Genera compromiso».

- [ ] **Step 3: Panel de alertas**

Sección visualmente destacada, siempre visible en el módulo, alimentada **exclusivamente** por `calcularAlertas`. Agrupada por tipo, con contador por grupo. Cada alerta muestra área, proyecto, responsable y días de atraso, y linkea a `ruta_origen`.

- [ ] **Step 4: Verificar**

Run: `npm run verificar`
Expected: verde. Cargar un monitoreo con cinco temas encadenados sin recargar la página; un tema crítico con acción aparece en el panel de alertas y en la lista de compromisos del Módulo 2.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: módulo 3 — monitoreo con carga incremental de temas y panel de alertas"
```

---

## Task 14: Módulo 4 — Planificación

**Files:**
- Create: `src/modulos/planificacion/Planificacion.jsx`, `CargarPlanificacion.jsx`, `TableroEstadisticas.jsx`, `ComparativoPlanificado.jsx`, `ImportarPlanificacion.jsx`

**Interfaces:**
- Consumes: `guardarPlanificacion`, `importarPlanificacion` de Task 3; agregados de Task 4; `parsearCSV` de Task 5
- Produces: la ruta `/planificacion` con tres pestañas — Carga · Estadísticas · Comparativo

- [ ] **Step 1: Carga de planificación anual**

Por proyecto: meta anual, desagregación en cuatro trimestres (con aviso si la suma no coincide con la meta anual — aviso, no bloqueo), monto planificado e hitos con fecha. Los hitos alimentan los vencimientos del dashboard.

- [ ] **Step 2: Importación CSV**

Mismo flujo que Task 7: subir o pegar → mapeo → vista previa con validación → filas aceptadas y rechazadas. Encabezados esperados: `id_proyecto`, `anio`, `meta_anual`, `t1`…`t4`, `monto_planificado`.

- [ ] **Step 3: Tablero de estadísticas**

Seis visualizaciones de Recharts, todas con su tabla exportable a CSV:
1. Proyectos por área, eje, tipo y estado — barras, con conmutador de dimensión.
2. Avance agregado planificado vs. ejecutado por área y por eje — barras agrupadas.
3. Distribución del gasto planificado por área, eje y tipo — torta o barras apiladas.
4. Ejecución presupuestaria: ejecutado sobre planificado, con desvío en puntos porcentuales.
5. Evolución temporal del avance — líneas sobre los asientos de bitácora del campo `avance`.
6. Ranking de proyectos por desvío respecto de la meta trimestral — barras horizontales ordenadas.

Los colores salen de los tokens; ninguna serie lleva un hex hardcodeado.

- [ ] **Step 4: Comparativo planificado vs. real**

Tabla por proyecto con meta al trimestre en curso, avance real, desvío y `Semaforo`: **en regla** ≥ 95 % de la meta · **atención** 80–95 % · **próximo** 60–80 % · **vencido** < 60 %.

- [ ] **Step 5: Verificar**

Run: `npm run verificar`
Expected: verde. Con la demo cargada, los seis gráficos tienen datos y el comparativo muestra proyectos en los cuatro niveles del semáforo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: módulo 4 — planificación anual, tablero de estadísticas y comparativo"
```

---

## Task 15: Módulo 5 — Mesas de trabajo

**Files:**
- Create: `src/modulos/mesas/Mesas.jsx`, `FichaMesa.jsx`, `FormularioMesa.jsx`, `RegistrarReunion.jsx`

**Interfaces:**
- Consumes: `crearMesa`, `actualizarMesa`, `crearReunionMesa`, `crearCompromisos` de Task 3; `mesasSinReunion` de Task 4
- Produces: la ruta `/mesas`

- [ ] **Step 1: Separación visual por tipo**

**Tres pestañas** — Temáticas · Barriales · Otros proyectos — cada una con su color distintivo de token en el borde de las tarjetas y en el indicador de la pestaña. La separación es estructural, **no un filtro**: es criterio de aceptación explícito que se vean separadas sin aplicar filtros. El contador de cada pestaña muestra cuántas mesas contiene.

- [ ] **Step 2: Ficha de mesa**

Nombre, tipo, descripción, referente, periodicidad, estado y proyectos vinculados (`SelectorProyecto` múltiple). Historial de reuniones con fecha, asistentes y temas. Compromisos generados en la mesa, leídos de la lista general filtrando `origen_tipo: 'mesa'` — no una lista aparte. Próxima reunión agendada, que aparece en la capa correspondiente del calendario del dashboard.

- [ ] **Step 3: Registrar reunión**

Fecha, asistentes, temas tratados y compromisos generados, que se crean con `origen_tipo: 'mesa'` e `id_origen` de la mesa, integrados a la lista general.

- [ ] **Step 4: Indicador de mesas sin reunión**

`mesasSinReunion(bd, hoy)` compara la fecha de la última reunión contra la periodicidad declarada (semanal 7 · quincenal 15 · mensual 30 · bimestral 60 · trimestral 90 días). Las mesas vencidas llevan un chip de advertencia en su tarjeta y aparecen en las alertas como `MESA_SIN_REUNION`.

- [ ] **Step 5: Verificar**

Run: `npm run verificar`
Expected: verde. Con la demo, las tres pestañas tienen mesas; una mesa mensual sin reunión desde hace 70 días muestra el chip y figura en alertas.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: módulo 5 — mesas separadas por tipo, reuniones e indicador de periodicidad"
```

---

## Task 16: Módulo 6 — Eventos

**Files:**
- Create: `src/modulos/eventos/Eventos.jsx`, `FormularioEvento.jsx`, `RequerimientosEvento.jsx`, `ChecklistEvento.jsx`

**Interfaces:**
- Consumes: `crearEvento`, `crearRequerimiento`, `actualizarRequerimiento` de Task 3; `resumenRequerimientos` de Task 4; `calcularAlertas` de Task 9
- Produces: la ruta `/eventos`

- [ ] **Step 1: Calendario y lista de eventos**

Vista mensual y lista de próximos eventos, conmutables. Cada evento muestra su porcentaje de requerimientos confirmados.

- [ ] **Step 2: Cargar evento**

Nombre, fecha, hora, lugar, área organizadora, tipo, proyecto vinculado (opcional) y estado.

- [ ] **Step 3: Requerimientos**

Sección dentro de la carga del evento: agregar desde el catálogo cerrado y administrable (sonido, escenario, sillas, vallado, baños químicos, seguridad, limpieza, gacebos, energía, difusión — editable en Configuración). Por cada uno: cantidad, área responsable y estado (`solicitado` / `confirmado` / `entregado`), cambiable en línea desde la tabla.

- [ ] **Step 4: Checklist de evento**

Vista consolidada por evento con barra de porcentaje de requerimientos confirmados, desglose por estado y **alerta destacada si quedan ítems sin confirmar a menos de 5 días** — leída de `calcularAlertas`, no recalculada acá.

- [ ] **Step 5: Verificar**

Run: `npm run verificar`
Expected: verde. El evento de la demo a 3 días con dos requerimientos sin confirmar muestra la alerta en el checklist, en el panel de alertas del Módulo 3 y en el dashboard.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: módulo 6 — eventos, requerimientos estandarizados y checklist"
```

---

## Task 17: Módulo 7 — Reportes e impresión

**Files:**
- Create: `src/modulos/reportes/Reportes.jsx`, `PanelFiltros.jsx`, `VistaPrevia.jsx`, `SelectorBloques.jsx`, `ReportesGuardados.jsx`
- Create: `src/datos/reportes.js`
- Modify: `src/estilos/impresion.css`

**Interfaces:**
- Consumes: todos los selectores de Task 4; `calcularAlertas` de Task 9; `descargarCSV` de Task 5; `guardarReporte`, `borrarReporte` de Task 3
- Produces: la ruta `/reportes`; `armarReporte(bd, filtros, bloques, hoy): { bloques: Bloque[], resumenFiltros: string[] }`

- [ ] **Step 1: Panel de filtros**

Todos combinables entre sí: área · programa · proyecto · eje · tipo · estado · prioridad · responsable · rango temporal (semana / mes / trimestre / año / personalizado) · módulo de origen (proyectos, seguimientos, compromisos, monitoreos, mesas, eventos) · sólo con alertas activas · sólo obras · sólo prioritarios. Todo el estado vive en `searchParams`, así una configuración de reporte se comparte pegando la URL.

- [ ] **Step 2: Implementar `armarReporte`**

Aplica los filtros a cada colección, arma sólo los bloques seleccionados, y devuelve además `resumenFiltros`: la lista legible de filtros aplicados que se imprime al pie. **El contenido del reporte cambia según lo filtrado** — es criterio de aceptación explícito, y sale de que los bloques se construyan a partir del resultado filtrado y no de la BD entera.

- [ ] **Step 3: Selector de bloques y vista previa**

Casillas para incluir: tabla de proyectos · gráficos · listado de compromisos · minutas de seguimientos · temas de monitoreo · alertas activas. La vista previa se renderiza en pantalla antes de exportar, con el mismo marcado que se imprime.

- [ ] **Step 4: Exportación**

**PDF por impresión:** `window.print()` con `impresion.css`. Encabezado institucional del Municipio de Tres de Febrero y fecha de emisión con `.solo-impresion`; filtros aplicados explicitados al pie; `break-inside: avoid` en cada bloque; sidebar, filtros y botones ocultos con `.no-imprimir`.

**CSV:** un archivo por bloque tabular, con los datos crudos filtrados.

- [ ] **Step 5: Configuraciones guardadas**

Guardar la combinación de filtros con nombre (ej.: «Informe semanal Obras Públicas») en `reportes_guardados`, listarlas, aplicarlas con un click y darlas de baja lógicamente.

- [ ] **Step 6: Verificar**

Run: `npm run verificar`
Expected: verde. Dos combinaciones de filtros distintas producen reportes con contenido distinto; la vista previa de impresión muestra encabezado institucional y los filtros al pie; guardar y volver a aplicar una configuración restituye exactamente los mismos filtros.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: módulo 7 — constructor de reportes con filtros combinables, impresión y configuraciones guardadas"
```

---

## Task 18: Repaso final contra los criterios de aceptación

**Files:**
- Create: `README.md`
- Modify: lo que haga falta según los hallazgos

**Interfaces:**
- Consumes: todo lo anterior
- Produces: sistema completo verificado

- [ ] **Step 1: Recorrer los once criterios de aceptación**

Uno por uno, con la demo cargada, anotando el resultado real de cada uno. Los del §10 del spec. Los que fallen se arreglan antes de cerrar.

- [ ] **Step 2: Recorrer el sistema vacío**

Vaciar y visitar las nueve rutas: todas muestran `<Vacio>` con su atajo de carga. Ninguna pantalla en blanco, ningún error en consola.

- [ ] **Step 3: Revisar el acabado visual**

Sin placeholders, sin secciones sin estilar, sin textos de relleno. Legible en tablet (768 px). Los colores salen todos de tokens.

- [ ] **Step 4: Escribir el README**

Puesta en marcha, mapa de módulos, y una sección **«Cómo conectar un backend»** que explique el contrato: reemplazar los cuerpos de `repositorio.js` por llamadas HTTP y borrar `almacenamiento.js`; ningún componente cambia. Más una sección de lo diferido (§13 del spec).

- [ ] **Step 5: Verificación final**

Run: `npm run verificar`
Expected: verde — aislamiento, tests y build.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: README con puesta en marcha y contrato de migración a backend"
```

---

## Autorrevisión del plan

**Cobertura del spec:** §3 arquitectura → Tasks 1-4 · §4 modelo → Tasks 2-4 · §5.1-5.7 módulos → Tasks 10, 11, 13, 14, 15, 16, 17 · §6 alertas → Task 9 · §7 CSV → Tasks 5, 7, 14 · §8 reglas transversales → Tasks 6, 7 (filtros en URL), 9 (regla 4), 6 (regla 5), 7 y 13 (regla 6) · §9 demo → Task 8 · §10 criterios → Task 18 · §11 identidad visual → Task 1 · §13 diferidos → no implementados, documentados en Task 18.

**Nota de orden:** el spec §12 ubica el motor de alertas en la etapa 5 y el dashboard en la 3. El plan invierte ese par (Task 9 antes de Task 10) porque el dashboard consume lógica de vencimientos; construirlo antes obligaría a escribir una implementación descartable y a duplicar la lógica que la regla §8.4 prohíbe duplicar.

**Consistencia de nombres verificada:** `calcularAlertas(bd, hoy)` · `estadoCompromiso(c, hoy)` · `porcentajeAvance(p)` · `resumenRequerimientos(bd, idEvento)` · `ultimaActualizacion(bd, idProyecto)` · `separarMinuta(texto)` · `aCSV(filas, columnas)` · `parsearCSV(texto)` · `generarIdProyecto(bd, idArea, fecha)` · `crearAsiento({...})` · `diffCampos(antes, despues, ignorar)` — usados con la misma firma en todas las tareas que los consumen. `origen_tipo` / `id_origen` es el par de campos de compromiso en Tasks 3, 11, 13 y 15.
