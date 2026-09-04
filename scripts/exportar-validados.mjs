/**
 * Exporta a CSV los 51 proyectos validados TAL COMO QUEDAN EN EL PORTAL.
 *
 * No relee los sheets: corre el loader real (`cargarProyectosValidadosCualitativo`)
 * sobre una base vacía y exporta lo que quedó. Así el CSV no puede desviarse de
 * lo que el portal muestra — incluye el id generado, el estado ya traducido y
 * la nota con el estado original.
 */
import fs from 'node:fs';
import * as repo from '../src/datos/repositorio.js';
import { SECRETARIAS_VALIDADAS } from '../src/datos/proyectos-validados-cualitativo.js';

const SALIDA = process.argv[2];

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// El dato crudo, para poder poner al lado el estado original del sheet y las
// cargas que tuvo cada proyecto.
const crudo = new Map();
for (const s of SECRETARIAS_VALIDADAS) {
  for (const d of s.datos) crudo.set(`${s.area.nombre}||${d.programa}||${d.proyecto}`, d);
}

await repo.vaciarSistema();
await repo.cargarProyectosValidadosCualitativo();
const bd = await repo.obtenerBD();

const COLUMNAS = [
  // Identificación
  ['id_legible', (p) => p.id_proyecto],
  ['area', (p) => p.area],
  ['programa', (p) => p.programa],
  ['nombre', (p) => p.proyecto],
  ['eje', (p) => p.eje],
  ['tipo', (p) => p.tipo],
  ['es_obra', (p) => (p.es_obra ? 'true' : 'false')],
  // Estado
  ['estado_portal', (p) => p.estado],
  ['estado_general', (p) => (p.estado === 'finalizado' ? 'finalizado' : 'vigente')],
  ['estado_en_el_sheet', (p, d) => d?.estado ?? ''],
  ['prioridad', (p) => p.prioridad ?? ''],
  // Fechas
  ['fecha_ultima_carga', (p) => p.fecha_carga ?? ''],
  ['fecha_inicio', (p) => p.fecha_inicio ?? ''],
  ['fecha_fin_proyectada', (p) => p.fecha_fin_prevista ?? ''],
  // Métricas — vacías a propósito, ver la nota del README
  ['unidad', (p) => p.unidad ?? ''],
  ['objetivo', (p) => p.objetivo ?? ''],
  ['avance', (p) => p.avance ?? ''],
  // Contexto
  ['observaciones', (p) => (p.observaciones ?? '').replace(/\s+/g, ' ')],
  ['cargas_en_el_cualitativo', (p, d) => d?.cargas ?? ''],
];

const filas = bd.proyectos
  .slice()
  .sort((a, b) => a.area.localeCompare(b.area) || a.programa.localeCompare(b.programa) || a.proyecto.localeCompare(b.proyecto))
  .map((p) => {
    const d = crudo.get(`${p.area}||${p.programa}||${p.proyecto}`);
    return COLUMNAS.map(([, f]) => csv(f(p, d))).join(',');
  });

const texto = '﻿' + [COLUMNAS.map(([n]) => n).join(','), ...filas].join('\r\n') + '\r\n';
fs.writeFileSync(SALIDA, texto, 'utf8');

console.log(`${filas.length} proyectos exportados -> ${SALIDA}`);
const porArea = {};
for (const p of bd.proyectos) porArea[p.area] = (porArea[p.area] ?? 0) + 1;
for (const [a, n] of Object.entries(porArea)) console.log(`  ${a.padEnd(46)} ${n}`);

// Qué columnas quedaron vacías en TODAS las filas: es lo que hay que completar
// antes de que el portal muestre algo en esos campos.
const vacias = COLUMNAS.filter(([n, f]) => bd.proyectos.every((p) => !f(p, crudo.get(`${p.area}||${p.programa}||${p.proyecto}`))));
console.log('\nColumnas vacías en las 51 filas:', vacias.map(([n]) => n).join(', ') || 'ninguna');
