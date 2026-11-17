# Bacheo: programación semanal en el mapa

Módulo `/bacheo`. Pedido de la jefatura de Coordinación (noviembre de 2026): ver
en el portal la programación semanal de asfalto y hormigón que manda el área de
Bacheo, en vez de los PDF sueltos o el mapa que se armaba afuera. La base son las
maquetas de Tomás («mapa de bacheo» y «carga y revisión de bacheo», artifacts de
claude.ai del 02/11 y el 04/11).

## Qué hace

1. **Coordinación sube los dos PDF de la semana** (asfalto y hormigón) en
   «Cargar semana». Se leen en el navegador con pdf.js; no se suben a ningún lado.
2. **Cada trabajo se ubica solo** contra el callejero oficial del Geoportal:
   cuadrantes como área, tramos «X entre A y B» como línea, esquinas como punto.
   Si el lugar ya se revisó otra semana, se reusa esa ubicación.
3. **Revisión:** lo que no se pudo ubicar, o se ubicó de forma aproximada, se
   confirma o se marca a mano en el mapa. Lo confirmado o marcado se recuerda.
4. **Publicar** escribe la semana entera en una transacción. Volver a publicar la
   misma semana (reprogramación) reemplaza sus trabajos.
5. **Todos los usuarios ven** la semana: mapa coloreado por tipo de trabajo y
   panel por **localidad** (no por cuadrilla, a pedido de JP), con filtro por día y
   por tipo.

Fuera de esta etapa, por decisión de JP del 17/11/2026: **la capa de reclamos**.
Va en una segunda etapa, cuando se defina la fuente (el My Maps del área o una
tabla propia).

## Archivos

| Archivo | Qué tiene |
|---|---|
| `src/datos/bacheo/tablaProgramacion.js` | Textos con posición → tabla. Filas ancladas en DIRECCION, cuadrillas por reparto óptimo |
| `src/datos/bacheo/programacion.js` | Tabla → trabajos: tipos, fechas reales, hormigón, feriados, localidades oficiales |
| `src/datos/bacheo/leerPdf.js` | pdf.js (importado al usar, en un fragmento aparte) |
| `src/datos/bacheo/nombresCalle.js` | Nombre de la planilla → nombre oficial del callejero; alias |
| `src/datos/bacheo/ubicar.js` | Ubicación contra el Geoportal y la memoria de lugares |
| `src/datos/bacheo/geometria.js` | GeoJSON ↔ Leaflet, casco convexo, punto en polígono |
| `src/datos/bacheo/semana.js` | Agrupar, filtrar, resumir y armar la publicación |
| `src/datos/supabaseBacheo.js` | Lectura y publicación contra Supabase |
| `src/modulos/bacheo/` | Pantallas: `Bacheo.jsx` (vista) y `CargaSemana.jsx` (carga y revisión) |
| `supabase/migrations/0038_bacheo.sql` | Tablas, función `publicar_semana_bacheo` y permisos |
| `supabase/datos/carga-inicial/06-bacheo-lugares.sql` | Memoria inicial: los 20 lugares de la maqueta del 02/11 |

## Lo que se aprendió de los PDF reales

Se validó contra los 38 PDF de junio a noviembre de 2026 (21 semanas de asfalto,
17 de hormigón). No están en el repo (es público); los tiene JP en
`Trabajo/analisis/mapas-seguridad-bacheo/fuentes/`.

- **El formato es estable desde junio**: mismas columnas, mismos textos de celda.
  Si cambia, `node scripts/verificar-programacion-bacheo.mjs <carpeta>` lo muestra.
- **pdfplumber se pierde celdas**: en varias semanas falta el borde derecho de la
  tabla y descarta lo del viernes (el sellado del Cuadrante 7 del 02/11, la
  reconstrucción de Sgto. Palma del 20/07). Leer por posición no tiene ese
  problema: por eso el lector no usa los bordes.
- **El «M2 TOTALES» de hormigón no es confiable**: el del 16/11 dice 421 y las
  filas suman 907. El total se calcula.
- **Reprogramaciones**: en octubre el hormigón tuvo dos versiones en tres semanas
  (mismas obras, días cambiados). Por eso republicar reemplaza.
- **Nombres que la planilla escribe distinto del callejero** (alias en
  `nombresCalle.js`): «Ruta 8» es la Av. Eva Perón (RP8); «Ruta 4», Márquez;
  «Ventivenga», Mons. Antonio Bentivenga (ex Juan B. Justo, paralela a Gaona);
  «Lutcher», Luchter. «M. S. de Thompson» en Loma Hermosa figura «Thomson»: eso lo
  resuelve el emparejamiento aproximado, no hace falta alias.

## Cómo probarlo

```bash
node --test pruebas/bacheo.test.mjs                               # lógica, sin red
node scripts/verificar-programacion-bacheo.mjs <carpeta de PDF>   # lector contra PDF reales
node scripts/verificar-bacheo.mjs <carpeta con los 2 PDF de una semana>
```

El último recorre la pantalla en Chrome (carga, revisión, marca a mano, error al
publicar, publicación y republicación) con Supabase simulado y el Geoportal real.

## Para ponerlo en producción

1. Correr `supabase/migrations/0038_bacheo.sql` en el editor SQL de Supabase.
2. Correr `supabase/datos/carga-inicial/06-bacheo-lugares.sql`.
3. Mergear la rama: el menú suma «Bacheo» en Herramientas.
