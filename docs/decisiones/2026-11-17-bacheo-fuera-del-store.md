# Bacheo vive fuera del store global y se lee en el navegador

**Fecha:** 17/11/2026 · **Decidió:** JP, con Claude

## Decisiones

1. **Bacheo no pasa por `repositorio.js` ni `tienda.js`.** Su módulo lee y
   escribe Supabase directo (`src/datos/supabaseBacheo.js`), como
   `/vigentes-supabase`.
   - Pesa: cada semana trae decenas de geometrías y el historial crece todas las
     semanas. Cargarlo en el store lo descargaría en cada pantalla del portal.
   - Nace en Supabase: no tiene versión en el navegador que sincronizar ni
     migrar, que es lo que justifica el repositorio para las demás colecciones.
   - Si algún día otra pantalla necesita los trabajos de bacheo (el inicio, un
     reporte), se suma una lectura acotada, no la colección entera.

2. **Los PDF se leen en el navegador (pdf.js), no en un servidor.** El portal no
   tiene backend propio y el PDF no necesita salir de la computadora de quien lo
   carga. pdf.js se importa recién al subir un archivo: el resto del portal no lo
   descarga.

3. **La tabla se reconstruye por la posición de los textos, no por los bordes.**
   pdfplumber (bordes) perdía celdas en las semanas con el borde derecho cortado.
   Ver `docs/bacheo.md`.

4. **Publicar es todo o nada** (función `publicar_semana_bacheo`). Sin
   borradores en la base: una semana a medio revisar no la tiene que ver nadie.

5. **Solo lo que una persona marcó o confirmó va a la memoria de lugares.** Lo
   automático se recalcula igual la semana siguiente; guardarlo como «revisado»
   sería mentir.

6. **El panel va por localidad, no por cuadrilla** (pedido de JP). La capa de
   reclamos, en una segunda etapa.
