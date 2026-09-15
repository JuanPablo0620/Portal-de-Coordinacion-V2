// Carga los 21 ejes estratégicos reales (Ejes_de_Gestion_2026.pdf, Valentín
// Olavarría, relevado 08/09/2026) directo a Supabase, siguiendo el patrón que
// Tomás ya dejó armado el 14/09/2026: un programa "Proyectos estratégicos"
// por cada área (no uno solo en Coordinación) y el eje "Puntual estratégico".
//
// Usa la service_role (.secrets/supabase_service_role.txt) porque hay que
// escribir es_estrategico directo: el RPC marcar_estrategico pide un usuario
// autenticado con rol, y este script corre fuera del portal.
//
// Uso:
//   node scripts/cargar_ejes_estrategicos.mjs            # solo valida
//   node scripts/cargar_ejes_estrategicos.mjs --escribir  # valida y escribe

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');

const SERVICE_ROLE = readFileSync(
  path.join(RAIZ, '..', '.secrets', 'supabase_service_role.txt'),
  'utf-8',
).trim();
const ENV_LOCAL = readFileSync(path.join(RAIZ, '.env.local'), 'utf-8');
const URL = ENV_LOCAL.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();

const supabase = createClient(URL, SERVICE_ROLE);
const ESCRIBIR = process.argv.includes('--escribir');
const hoy = new Date().toISOString().slice(0, 10);

const { PROYECTOS_EJES_ESTRATEGICOS_REAL } = await import(
  pathToFileURL(path.join(RAIZ, 'src', 'datos', 'ejes-estrategicos-real.js')).href
);

// Mapea el `area` de ejes-estrategicos-real.js (nombre formal) al `nombre`
// corto que usa la tabla `areas` de Supabase.
const AREA_CORTA = {
  'Secretaría de Obras': 'Obras',
  'Secretaría de Salud': 'Salud',
  'Secretaría de Capital Humano': 'Capital Humano',
};

function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function fetchAll(tabla, select) {
  const { data, error } = await supabase.from(tabla).select(select);
  if (error) throw error;
  return data;
}

const [areas, programas, ejes, tipos, proyectosExistentes] = await Promise.all([
  fetchAll('areas', 'id, nombre, nombre_formal'),
  fetchAll('programas', 'id, nombre, area_id'),
  fetchAll('ejes', 'id, nombre'),
  fetchAll('tipos_proyecto', 'id, nombre'),
  fetchAll('proyectos', 'id, id_legible, nombre, programa_id, eje_id, es_estrategico, activo'),
]);

const areaIdPorNombreCorto = new Map(areas.map((a) => [a.nombre, a.id]));
const areaCoordinacion = areas.find((a) => a.nombre === 'Coordinación');
if (!areaCoordinacion) throw new Error('No se encontró el área Coordinación en la base.');

// Sin tilde en la base tal como lo cargó Tomás el 14/09/2026 — no es un typo
// del script, es el dato real ("Puntual estrategico", no "estratégico").
const ejeEstrategico = ejes.find((e) => e.nombre === 'Puntual estrategico');
if (!ejeEstrategico) throw new Error('No existe el eje "Puntual estrategico" — ¿lo renombró Tomás?');

const tipoGestionInterna = tipos.find((t) => t.nombre === 'Gestión interna');
if (!tipoGestionInterna) throw new Error('No existe el tipo "Gestión interna".');

function programaEstrategicoDe(areaId) {
  const p = programas.find((p) => p.area_id === areaId && p.nombre === 'Proyectos estratégicos');
  if (!p) throw new Error(`No existe el programa "Proyectos estratégicos" para el área ${areaId}.`);
  return p;
}

const existentePorNombre = new Map(proyectosExistentes.map((p) => [normalizar(p.nombre), p]));

console.log('='.repeat(70));
console.log('Validación');
console.log('='.repeat(70));

const aCrear = [];
const aCorregir = [];

for (const real of PROYECTOS_EJES_ESTRATEGICOS_REAL) {
  const nombreAreaCorta = real.area ? AREA_CORTA[real.area] : 'Coordinación';
  if (real.area && !nombreAreaCorta) throw new Error(`Área desconocida en ejes-estrategicos-real.js: «${real.area}»`);
  const areaId = real.area ? areaIdPorNombreCorto.get(nombreAreaCorta) : areaCoordinacion.id;
  if (!areaId) throw new Error(`No se encontró el área «${nombreAreaCorta}» en la base.`);
  const programa = programaEstrategicoDe(areaId);

  const existente = existentePorNombre.get(normalizar(real.nombre));
  if (existente) {
    const necesitaCorreccion = existente.programa_id !== programa.id || existente.eje_id !== ejeEstrategico.id || !existente.es_estrategico;
    if (necesitaCorreccion) {
      aCorregir.push({ existente, programa, real });
      console.log(`  CORREGIR  ${existente.id_legible} — ${real.nombre} → programa/eje del patrón nuevo`);
    } else {
      console.log(`  OK        ${existente.id_legible} — ${real.nombre} (ya está bien)`);
    }
    continue;
  }

  aCrear.push({ real, areaId, programa });
  console.log(`  CREAR     ${real.nombre} (${nombreAreaCorta})`);
}

console.log('\n' + '='.repeat(70));
console.log(`A crear: ${aCrear.length}  ·  A corregir: ${aCorregir.length}  ·  Total ejes: ${PROYECTOS_EJES_ESTRATEGICOS_REAL.length}`);
console.log('='.repeat(70));

if (!ESCRIBIR) {
  console.log('\n(corrida en modo validación — pasar --escribir para cargar de verdad)');
  process.exit(0);
}

console.log('\nESCRIBIENDO...');

for (const { existente, programa } of aCorregir) {
  const { error } = await supabase
    .from('proyectos')
    .update({
      programa_id: programa.id,
      eje_id: ejeEstrategico.id,
      es_estrategico: true,
      estrategico_marcado_en: existente.es_estrategico ? undefined : hoy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existente.id);
  if (error) throw error;
  console.log(`  corregido: ${existente.id_legible}`);
}

for (const { real, programa } of aCrear) {
  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      nombre: real.nombre,
      programa_id: programa.id,
      eje_id: ejeEstrategico.id,
      tipo_id: tipoGestionInterna.id,
      estado_general: 'vigente',
      prioridad: real.prioridad,
      observaciones: real.contexto,
      es_estrategico: true,
      descripcion_estrategica: real.contexto,
      estrategico_marcado_en: hoy,
      fecha_carga: hoy,
      activo: true,
    })
    .select('id_legible, nombre')
    .single();
  if (error) throw error;
  console.log(`  creado: ${data.id_legible} — ${data.nombre}`);
}

// El id_legible NO lo pone un trigger: 0007_id_legible.sql es un UPDATE manual,
// re-ejecutable, que numera lo que quedó con id_legible null. Postgres directo
// está bloqueado desde esta red (ver supabase_toolkit.py), así que se replica
// la misma lógica por REST en vez de correr el SQL tal cual.
console.log('\nAsignando id_legible a lo que quedó sin código...');

const { data: areasConPrefijo, error: errAreas } = await supabase.from('areas').select('id, prefijo');
if (errAreas) throw errAreas;
const prefijoPorAreaId = new Map(areasConPrefijo.map((a) => [a.id, a.prefijo]));

const { data: sinCodigo, error: errSinCodigo } = await supabase
  .from('proyectos')
  .select('id, programa_id, fecha_inicio, created_at')
  .is('id_legible', null);
if (errSinCodigo) throw errSinCodigo;

if (sinCodigo.length === 0) {
  console.log('  (nada pendiente)');
} else {
  const { data: todosLosProyectos, error: errTodos } = await supabase
    .from('proyectos')
    .select('id_legible')
    .not('id_legible', 'is', null);
  if (errTodos) throw errTodos;

  const topePorPrefijoAnio = new Map();
  for (const { id_legible } of todosLosProyectos) {
    const m = id_legible.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
    if (!m) continue;
    const clave = `${m[1]}-${m[2]}`;
    topePorPrefijoAnio.set(clave, Math.max(topePorPrefijoAnio.get(clave) ?? 0, Number(m[3])));
  }

  const programaAreaId = new Map(programas.map((p) => [p.id, p.area_id]));

  for (const p of sinCodigo) {
    const areaId = programaAreaId.get(p.programa_id);
    const prefijo = prefijoPorAreaId.get(areaId);
    if (!prefijo) {
      console.log(`  !! ${p.id}: su área no tiene prefijo, queda sin id_legible`);
      continue;
    }
    const anio = new Date(p.fecha_inicio ?? p.created_at).getFullYear();
    const clave = `${prefijo}-${anio}`;
    const siguiente = (topePorPrefijoAnio.get(clave) ?? 0) + 1;
    topePorPrefijoAnio.set(clave, siguiente);
    const idLegible = `${prefijo}-${anio}-${String(siguiente).padStart(3, '0')}`;

    const { error } = await supabase.from('proyectos').update({ id_legible: idLegible }).eq('id', p.id);
    if (error) throw error;
    console.log(`  ${idLegible}`);
  }
}

console.log('\nLISTO.');
