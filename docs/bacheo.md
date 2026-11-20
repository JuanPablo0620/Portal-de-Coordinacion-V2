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
5. **Todos los usuarios ven** la programación: mapa coloreado por tipo de trabajo y
   panel por **localidad** (no por cuadrilla, a pedido de JP), con filtro por día y
   por tipo.
6. **Semana, mes o trimestre** (19/11): un mini calendario elige el período. En un
   mes o un trimestre se juntan las semanas que lo tocan, recortadas a sus días
   (la semana del 27/04 aporta cuatro días a abril y uno a mayo), y cada lugar
   aparece una vez por tipo de trabajo: el «Cuadrante 9» de Caseros está once
   semanas en la planilla y no tiene sentido dibujarlo once veces. Al consolidar,
   la ubicación es la más revisada que tuvo el lugar y los m² de hormigón no se
   suman entre semanas (una obra que sigue repite el mismo total en la planilla):
   se toma el mayor. Las semanas sin PDF cargado dentro del período se avisan.
   El período va en la URL (`?semana=2026-11-16`, `?mes=2026-10`,
   `?trimestre=2026-T3`).

7. **Reclamos** (20/11, segunda etapa): los puntos del My Maps de bacheo del área
   se leen en vivo y se cruzan con los trabajos del período, con la misma regla
   del mapa de afuera del portal: **con trabajo** si caen dentro del cuadrante,
   a 15 m o menos del tramo o a 25 m o menos de la esquina; **cerca, a
   verificar** hasta 50 m más allá. En el mapa el estado se lee por la forma
   (relleno, anillo, punto gris chico), no solo por el color. Clic en un reclamo
   elige el trabajo que lo atiende. El My Maps cubre solo Caseros y Ciudadela, y
   el resumen lo dice. Fuente y por qué en vivo:
   `docs/decisiones/2026-11-20-reclamos-bacheo-my-maps.md`.

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
| `src/datos/bacheo/periodo.js` | Semana, mes y trimestre: rangos, calendario, consolidación por lugar |
| `src/datos/bacheo/reclamos.js` | KML del My Maps → reclamos; cruce con los trabajos (metros) |
| `src/datos/reclamosBacheo.js` | Pedido del KML (id en `VITE_MYMAPS_RECLAMOS_BACHEO`) |
| `src/datos/supabaseBacheo.js` | Lectura y publicación contra Supabase |
| `src/modulos/bacheo/` | Pantallas: `Bacheo.jsx` (vista), `SelectorPeriodo.jsx` (calendario) y `CargaSemana.jsx` (carga y revisión) |
| `supabase/migrations/0038_bacheo.sql` | Tablas, función `publicar_semana_bacheo` y permisos |
| `supabase/datos/carga-inicial/06-bacheo-lugares.sql` | Memoria inicial: los 20 lugares de la maqueta del 02/11 |

## Lo que se aprendió de los PDF reales

Se validó contra los 38 PDF de junio a noviembre de 2026 (19 semanas de asfalto,
16 de hormigón y 3 reprogramaciones). No están en el repo (es público); los tiene JP en
`Trabajo/analisis/mapas-seguridad-bacheo/fuentes/`.

- **El formato es estable desde junio**: mismas columnas, mismos textos de celda.
  Si cambia, `node scripts/verificar-programacion-bacheo.mjs <carpeta>` lo muestra.
- **pdfplumber se pierde celdas**: en varias semanas falta el borde derecho de la
  tabla y descarta lo del viernes (el sellado del Cuadrante 7 del 02/11, la
  reconstrucción de Sgto. Palma del 20/07). Leer por posición no tiene ese
  problema: por eso el lector no usa los bordes.
- **El encabezado puede venir en dos renglones** («APROX» arriba y «m2» abajo, hormigón
  del 25/05): el lector toma una franja de ±5 puntos alrededor de DIRECCION.
- **Calles con el mismo apellido** («Zanella» = Juan o Santiago Zanella en Caseros): se
  prueban todas las que empatan, como alternativas.
- **El «M2 TOTALES» de hormigón no es confiable**: el del 16/11 dice 421 y las
  filas suman 907. El total se calcula.
- **Reprogramaciones**: en octubre el hormigón tuvo dos versiones en tres semanas
  (mismas obras, días cambiados). Por eso republicar reemplaza.
- **Nombres que la planilla escribe distinto del callejero** (alias en
  `nombresCalle.js`): «Ruta 8» es la Av. Eva Perón (RP8); «Ruta 4», Márquez;
  «Ventivenga», Mons. Antonio Bentivenga (ex Juan B. Justo, paralela a Gaona);
  «Lutcher», Luchter. «M. S. de Thompson» en Loma Hermosa figura «Thomson»: eso lo
  resuelve el emparejamiento aproximado, no hace falta alias.
- **Más escrituras distintas** (resueltas sin alias): números con letras o romanos
  («Tres de Febrero» = «3 de febrero», «Rio IV» = «Río Cuarto»), palabras pegadas
  («de Vicenzi» = «Devicenzi»), abreviaturas («Avdor.», «Almte.», «Ant.»), calles
  con dos nombres («Triunvirato / Gral. Lavalle») y cuadrantes sin número o con
  «;». Si sobra un nombre de pila («Martin de Álzaga» = «Álzaga») o la
  coincidencia es dudosa («Sta. Marina» → «Santa María de Oro»), se ubica pero
  queda **aproximada** con la nota «se tomó X como Y»: un error que no se ve es
  peor que un «no se pudo».
- **El Geoportal decodifica dos veces la consulta**: un `%` seguido de dos
  caracteres hexadecimales se vuelve otro carácter. `ILIKE '%1852%'` o
  `'%Castelli%'` daban cero resultados (también en el autocompletado de cortes).
  `fragmentoSeguro()` en `geoportal.js` lo evita.

## Carga histórica

Las 36 semanas de enero a noviembre (19 de los PDF de JP, 17 más del Drive de Seguimiento) se cargaron con un SQL generado por
`Trabajo/analisis/mapas-seguridad-bacheo/generar_carga_historica.mjs`, que usa
este mismo código. Ese script también arma el informe de lugares que no se
pueden ubicar tal como están escritos, para el área.

## Cómo probarlo

```bash
node --test pruebas/bacheo.test.mjs pruebas/bacheo-reclamos.test.mjs   # lógica, sin red
node scripts/verificar-programacion-bacheo.mjs <carpeta de PDF>   # lector contra PDF reales
node scripts/verificar-bacheo.mjs <carpeta con los 2 PDF de una semana>
```

El último recorre la pantalla en Chrome (carga, revisión, marca a mano, error al
publicar, publicación y republicación) con Supabase simulado y el Geoportal real. Por defecto corta el pedido al My Maps
(prueba que sin reclamos la programación se ve igual); con `BACHEO_RECLAMOS=1`
lee el My Maps real y revisa la capa.

## Para ponerlo en producción

1. Correr `supabase/migrations/0038_bacheo.sql` en el editor SQL de Supabase.
2. Correr `supabase/datos/carga-inicial/06-bacheo-lugares.sql`.
3. Mergear la rama: el menú suma «Bacheo» en Herramientas.
