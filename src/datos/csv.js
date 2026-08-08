/**
 * CSV: generación, descarga y parseo, sin dependencias.
 *
 * `columnas` es el mismo descriptor que usa el componente Tabla —
 * `[{ clave, titulo, formatoCSV?, sinExportar? }]`— así una tabla y su
 * exportación no pueden divergir.
 */

const BOM = '﻿';

function serializar(valor, columna) {
  if (columna?.formatoCSV) return String(columna.formatoCSV(valor) ?? '');
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.join(' | ');
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function escapar(texto) {
  return /[",\r\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Texto CSV con BOM UTF-8, para que Excel abra bien los acentos. */
export function aCSV(filas, columnas) {
  const cols = columnas.filter((c) => !c.sinExportar);
  const lineas = [cols.map((c) => escapar(c.titulo)).join(',')];
  for (const fila of filas) {
    lineas.push(cols.map((c) => escapar(serializar(fila[c.clave], c))).join(','));
  }
  return BOM + lineas.join('\r\n');
}

/** Dispara la descarga en el navegador. */
export function descargarCSV(nombreArchivo, filas, columnas) {
  const contenido = aCSV(filas, columnas);
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);
  enlace.href = url;
  enlace.download = `${nombreArchivo}-${fecha}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

/**
 * Parseo carácter a carácter. No es un `split(',')`: eso rompe con campos
 * entrecomillados que contienen comas o saltos de línea, que es exactamente lo
 * que traen las planillas reales.
 */
export function parsearCSV(texto) {
  const limpio = String(texto ?? '').replace(/^﻿/, '');
  if (!limpio.trim()) return { encabezados: [], filas: [] };

  // Detección de separador: se elige el que más aparece en la primera línea,
  // fuera de comillas. Las planillas exportadas en configuración regional
  // española usan punto y coma.
  const primeraLinea = limpio.split(/\r?\n/)[0];
  const separador = (primeraLinea.match(/;/g) ?? []).length > (primeraLinea.match(/,/g) ?? []).length ? ';' : ',';

  const registros = [];
  let campo = '';
  let fila = [];
  let dentroDeComillas = false;

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];

    if (dentroDeComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          dentroDeComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroDeComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\r') {
      // Se ignora: el salto lo marca el \n que sigue.
    } else if (c === '\n') {
      fila.push(campo);
      registros.push(fila);
      campo = '';
      fila = [];
    } else {
      campo += c;
    }
  }
  fila.push(campo);
  registros.push(fila);

  // Descarta las líneas vacías del final, típicas de los archivos exportados.
  const utiles = registros.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (!utiles.length) return { encabezados: [], filas: [] };

  const [encabezados, ...filas] = utiles;
  return { encabezados: encabezados.map((e) => e.trim()), filas };
}

/**
 * Convierte las filas crudas en objetos, según un mapeo
 * `{ campoDelModelo: indiceDeColumna }`.
 */
export function filasAObjetos(filas, mapeo) {
  return filas.map((fila) => {
    const objeto = {};
    for (const [campo, indice] of Object.entries(mapeo)) {
      if (indice === '' || indice === null || indice === undefined) continue;
      objeto[campo] = fila[Number(indice)]?.trim() ?? '';
    }
    return objeto;
  });
}
