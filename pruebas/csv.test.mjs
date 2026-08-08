import test from 'node:test';
import assert from 'node:assert/strict';
import { aCSV, parsearCSV } from '../src/datos/csv.js';

const COLS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'monto', titulo: 'Monto' },
];

const sinBom = (s) => s.replace('﻿', '');

/* ── Generación ───────────────────────────────────────────────────── */

test('aCSV escribe encabezados y filas con BOM', () => {
  const salida = aCSV([{ nombre: 'Plaza', monto: 100 }], COLS);
  assert.ok(salida.startsWith('﻿'), 'el BOM hace que Excel abra bien los acentos');
  assert.equal(sinBom(salida), 'Nombre,Monto\r\nPlaza,100');
});

test('aCSV entrecomilla los valores con coma, comilla o salto de línea', () => {
  assert.equal(
    sinBom(aCSV([{ nombre: 'Plaza, Norte', monto: 'a"b' }], COLS)),
    'Nombre,Monto\r\n"Plaza, Norte","a""b"',
  );
  assert.equal(sinBom(aCSV([{ nombre: 'a\nb', monto: 1 }], COLS)), 'Nombre,Monto\r\n"a\nb",1');
});

test('aCSV escribe vacío donde el valor es null o undefined', () => {
  assert.equal(sinBom(aCSV([{ nombre: null }], COLS)), 'Nombre,Monto\r\n,');
});

test('aCSV aplica la función de formato de la columna si existe', () => {
  const cols = [{ clave: 'monto', titulo: 'Monto', formatoCSV: (v) => `$${v}` }];
  assert.equal(sinBom(aCSV([{ monto: 50 }], cols)), 'Monto\r\n$50');
});

test('aCSV omite las columnas marcadas como no exportables', () => {
  const cols = [...COLS, { clave: 'acciones', titulo: 'Acciones', sinExportar: true }];
  assert.equal(sinBom(aCSV([{ nombre: 'A', monto: 1 }], cols)), 'Nombre,Monto\r\nA,1');
});

test('aCSV sin filas escribe igual los encabezados', () => {
  assert.equal(sinBom(aCSV([], COLS)), 'Nombre,Monto');
});

test('aCSV serializa booleanos como Sí/No', () => {
  const cols = [{ clave: 'es_obra', titulo: 'Obra' }];
  assert.equal(sinBom(aCSV([{ es_obra: true }, { es_obra: false }], cols)), 'Obra\r\nSí\r\nNo');
});

/* ── Parseo ───────────────────────────────────────────────────────── */

test('parsearCSV separa encabezados y filas', () => {
  const r = parsearCSV('Nombre,Monto\r\nPlaza,100\r\nCalle,200');
  assert.deepEqual(r.encabezados, ['Nombre', 'Monto']);
  assert.deepEqual(r.filas, [
    ['Plaza', '100'],
    ['Calle', '200'],
  ]);
});

test('parsearCSV respeta comas y comillas escapadas dentro de campos', () => {
  const r = parsearCSV('Nombre,Monto\r\n"Plaza, Norte","a""b"');
  assert.deepEqual(r.filas, [['Plaza, Norte', 'a"b']]);
});

test('parsearCSV admite saltos de línea dentro de un campo entrecomillado', () => {
  const r = parsearCSV('Nombre\r\n"linea1\nlinea2"');
  assert.deepEqual(r.filas, [['linea1\nlinea2']]);
});

test('parsearCSV ignora el BOM y las líneas vacías del final', () => {
  const r = parsearCSV('﻿Nombre,Monto\r\nPlaza,100\r\n\r\n');
  assert.deepEqual(r.encabezados, ['Nombre', 'Monto']);
  assert.equal(r.filas.length, 1);
});

test('parsearCSV detecta el punto y coma como separador', () => {
  const r = parsearCSV('Nombre;Monto\r\nPlaza;100');
  assert.deepEqual(r.encabezados, ['Nombre', 'Monto']);
  assert.deepEqual(r.filas, [['Plaza', '100']]);
});

test('parsearCSV de un texto vacío no rompe', () => {
  assert.deepEqual(parsearCSV(''), { encabezados: [], filas: [] });
});

test('ida y vuelta: lo generado se vuelve a parsear igual', () => {
  const original = [{ nombre: 'Plaza, Norte', monto: '1"2' }];
  const r = parsearCSV(aCSV(original, COLS));
  assert.deepEqual(r.filas, [['Plaza, Norte', '1"2']]);
});
