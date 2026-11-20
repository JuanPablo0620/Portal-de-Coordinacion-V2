# Reclamos de Bacheo: en vivo desde el My Maps del área

**Fecha:** 20/11/2026 · **Pidió:** JP (cargar los reclamos del My Maps) · **Cómo leerlos lo propuso:** Claude · **Contexto:** segunda etapa de `/bacheo`

## Qué se decidió

La capa de reclamos del módulo de Bacheo lee el My Maps «Obras Públicas - Caseros y
Ciudadela - solo baches» directamente desde el navegador, en cada carga de la
página. No se copia a Supabase.

## Por qué

- **El área lo sigue editando a mano.** Una copia en la base queda vieja sin que
  nadie se entere; leerlo en vivo hace que el portal muestre lo mismo que el mapa
  que usa el área.
- **No hace falta servidor.** Google sirve el KML con
  `Access-Control-Allow-Origin: *` (comprobado el 20/11/2026 con encabezados de
  navegador), así que no hay proxy ni función en Vercel que mantener.
- **El cruce es barato.** 157 puntos contra unas decenas de trabajos se calculan
  en el navegador sin que se note.

## Qué cuidar

- **El id del My Maps no va en el código** (el repositorio es público y el
  historial no se borra): va en `VITE_MYMAPS_RECLAMOS_BACHEO`. Igual queda dentro
  del JavaScript publicado. No es un secreto: el My Maps está compartido «cualquiera
  con el enlace» y solo tiene calles y esquinas, no personas. Si algún día el
  mapa pasara a tener datos de vecinos, esta decisión se cae y hay que leerlo
  desde un servidor con sesión.
- **Si el My Maps deja de estar compartido con el enlace**, Google responde un
  error y la capa avisa que no se pudo leer. La programación se ve igual.
- **La regla de metros es la del mapa de afuera** (`actualizar_mapa_bacheo.py` en
  `Trabajo/analisis/mapas-seguridad-bacheo/`). Se validó el 20/11/2026 contra la
  semana del 16/11: mismo estado en los 157 puntos. Si se cambia en un lado, hay
  que cambiarla en el otro.

## Alternativa descartada

Una tabla `bacheo_reclamos` en Supabase cargada por SQL, como la programación.
Tiene sentido cuando los reclamos vengan de mi3f con fecha y estado propios: ahí
sí conviene guardarlos, porque se querrá saber cuándo se resolvió cada uno.
