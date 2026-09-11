/**
 * El organigrama: subsecretarías y direcciones de cada secretaría.
 *
 * Es lo que deja decir a qué unidad de la secretaría pertenece un compromiso
 * —«Dirección de Luminaria y Arbolado» y no sólo «Ambiente»—. Los datos salen
 * del organigrama municipal y se siembran en `0027`.
 *
 * De SÓLO LECTURA a propósito: no hay pantalla que los edite. El organigrama
 * no es vocabulario que cada área ajuste sobre la marcha como los ejes o las
 * unidades —cambia por decreto, cada tanto—, así que corregirlo es correr una
 * migración, igual que la lista de secretarías.
 *
 * Las áreas van por NOMBRE y no por uuid, como en el resto de los traductores:
 * el portal trabaja con la denominación formal de la secretaría en todos los
 * desplegables, y devolver el uuid obligaría a cada pantalla a resolverlo.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

export function olvidarCatalogos() {}

const nombreArea = (area) => area?.nombre_formal ?? area?.nombre ?? '';

export async function cargar() {
  const [subsecretarias, direcciones] = await Promise.all([
    supabase
      .from('subsecretarias')
      .select('id, nombre, orden, activo, area:areas(nombre, nombre_formal)')
      .order('orden')
      .order('nombre'),
    supabase
      .from('direcciones')
      .select('id, nombre, orden, activo, subsecretaria_id, area:areas(nombre, nombre_formal)')
      .order('orden')
      .order('nombre'),
  ]);
  if (subsecretarias.error) throw subsecretarias.error;
  if (direcciones.error) throw direcciones.error;

  return {
    subsecretarias: subsecretarias.data.map((f) => ({
      id: f.id,
      area: nombreArea(f.area),
      nombre: f.nombre ?? '',
      orden: f.orden ?? 0,
      activo: f.activo,
    })),
    direcciones: direcciones.data.map((f) => ({
      id: f.id,
      area: nombreArea(f.area),
      id_subsecretaria: f.subsecretaria_id ?? null,
      nombre: f.nombre ?? '',
      orden: f.orden ?? 0,
      activo: f.activo,
    })),
  };
}
