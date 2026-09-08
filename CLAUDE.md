# Portal de Coordinación — Municipalidad de Tres de Febrero

Herramienta interna del Área de Coordinación para hacerle seguimiento sistemático
a los proyectos de las secretarías. React + Vite + Tailwind 4, sin TypeScript.

**La arquitectura, los módulos y los comandos están en `README.md`.** Leelo antes
de tocar código; este archivo solo tiene lo que no se deduce leyendo el repo.

> **El `README.md` está desactualizado en un punto importante** (al 08/09/2026):
> dice "sin backend, sin base de datos real" y "hoy no hay login ni roles". Las dos
> cosas dejaron de ser ciertas entre el 04/09 y el 07/09. Para la arquitectura del
> front sigue siendo válido; para el estado de la persistencia, mandan la sección
> "Dónde está parada la persistencia hoy" de este archivo y `docs/traspaso-actual.md`.

**El estado del trabajo en curso está en `docs/traspaso-actual.md`.** Leelo al
empezar la sesión y actualizalo al cerrarla — ver la sección final.

---

## Antes de escribir una línea

1. `git pull fork main` — **sí, `fork`, no `origin`.** Ver la trampa de abajo.
2. Leer `docs/traspaso-actual.md`.
3. Si vas a tocar el modelo de datos, leer también `docs/der-esquema-datos.md`.

---

## Cuatro trampas que ya hicieron perder tiempo

### 1. Los remotos están nombrados al revés

En esta copia local el remoto **`fork` es el repositorio bueno** —el que despliega
Vercel en `portal-de-coordinacion-v2.vercel.app`— y **`origin` está abandonado**,
sesenta y pico de commits atrás desde el 19/08/2026.

| Remoto | Repositorio | Estado |
|---|---|---|
| `fork` | `JuanPablo0620/Portal-de-Coordinacion-V2` | **El vigente.** `main` lo trackea, Vercel lo despliega |
| `origin` | `Sr4312/Coordinacion3F2.0` | Abandonado. No pushear acá |

`git push origin main` es el reflejo automático y acá es el error. Usá `git push`
a secas (main ya trackea `fork/main`) o `git push fork main` explícito.

En la máquina de Tomás los nombres son otros: lo que acá es `fork`, allá es
`origin`. Cuando un traspaso diga "pusheé a origin", confirmá contra el hash, no
contra el nombre del remoto.

### 2. El repositorio es público en GitHub

Nunca commitear mails, nombres de usuarios con su rol, claves, ni datos de vecinos.
El historial de git no se borra aunque después se saque el archivo.

- El listado del equipo vive en `supabase/datos/usuarios-autorizados.local.sql`,
  excluido por el patrón `*.local.sql` del `.gitignore`. Si no lo tenés, no lo
  recrees: pedíselo a Tomás.
- Las claves van en `.env.local` (los nombres están en `.env.example`).
- Datos de reclamos y casos sociales: agregados a nivel barrio o dirección, nunca
  a nivel persona (Ley 25.326).

### 3. Desde la red del municipio, Postgres está bloqueado

El firewall corta saliente los puertos 5432 y 6543; el 443 sale libre. No sirven
`psql`, ni un ORM con conexión directa, ni ninguna herramienta que hable el
protocolo nativo. **Todo contra Supabase va por la API REST (PostgREST, HTTPS).**
Desde otra red anda, pero no armes nada que dependa de eso.

### 4. Agregar variables de entorno en Vercel no reconstruye nada

Las `VITE_*` se incrustan en el JavaScript al compilar. Después de tocarlas hay
que forzar un Redeploy **destildando "Use existing Build Cache"**, o el sitio
sigue sirviendo el build viejo. Para verificar de verdad, buscá la URL de Supabase
dentro del bundle publicado.

---

## Convenciones del código

**Todo en español**: nombres de archivos, carpetas, funciones, variables, campos y
comentarios. `repositorio.js`, `calcularAlertas()`, `bdVacia()`, `origen_tipo`.
No introduzcas identificadores en inglés; queda mezclado y no se puede grepear.

**Los comentarios explican el porqué, no el qué.** El estilo del repo es un bloque
JSDoc arriba del archivo contando qué decisión hay detrás y qué pasa si se
deshace. Seguilo: son los comentarios que evitan que alguien "arregle" algo que
está así a propósito.

**Colores y estilos solo por token.** `src/estilos/index.css` define el `@theme` y
es la fuente única. Nada de color, radio ni sombra hardcodeado en un componente.
Los valores del semáforo y de la identidad por secretaría están calculados para
cumplir contraste (4,5:1 en texto, 3:1 en objeto gráfico) y son CVD-safe: si
cambiás uno, revalidá, no lo elijas a ojo.

**Sin TypeScript.** Los tipos se documentan con JSDoc donde hace falta.

---

## Reglas de arquitectura que el verificador hace cumplir

`npm run verificar` falla si se rompen. No son sugerencias:

1. **Solo `src/datos/almacenamiento.js` puede mencionar `localStorage`.** Es lo que
   permite que migrar a un backend sea un cambio localizado.
2. **`src/datos/` no contiene JSX.** Es lógica pura y testeable.
3. **Sin importaciones circulares ni importaciones sin uso.**
4. Los componentes leen del store y escriben llamando al repositorio. Ninguno
   importa el almacenamiento ni muta la base directamente.

Además: `calcularAlertas(bd, hoy)` en `src/datos/alertas.js` es la **única** fuente
de alertas. Una alerta nueva se agrega ahí y aparece sola en inicio, monitoreo,
eventos y reportes. No escribas lógica de vencimiento en un componente.

---

## Dónde está parada la persistencia hoy

Es el punto que más confusión genera, porque hay dos cosas a la vez:

| Qué | Dónde vive |
|---|---|
| Identidad (login, perfiles, roles) | **Supabase Auth**, real y en producción |
| Los datos del sistema | **`localStorage`**, en el navegador de cada uno |
| Compromisos y proyectos vigentes | Supabase, **solo lectura**, solo en `/vigentes-supabase` |

No asumas que Supabase es la fuente de verdad del portal: todavía no lo es.
Migrar `repositorio.js` de síncrono a async y revisar sus ~40 consumidores es el
trabajo grande que falta.

**La sesión falla cerrada a propósito** (`src/estado/sesion.js`): sin variables de
Supabase, el portal no deja entrar a nadie. No lo "arregles" haciendo que caiga al
comportamiento viejo sin login — bastaría con que se borre una variable en Vercel
para que producción quedara abierta sin que nadie se entere.

---

## Léxico institucional

Estos deliverables los ven el intendente y los secretarios.

- **"presupuesto"**, nunca "gasto", al hablar de finanzas municipales.
- Los nombres de programas y secretarías son los oficiales y no se abrevian ni se
  inventan. Si un nombre no lo tenés confirmado, preguntá antes de escribirlo.
- Sin emojis en nada que salga del portal (pantallas, reportes, PDF).
- Nada de contenido político partidario.
- Sin cifras inventadas: si el dato no está, se pide.

---

## Detalles de entorno

- En la máquina de Tomás, Python es `py`, no `python`:
  `py scripts/cargar_supabase.py`.
- Puesta en marcha local: `npm install`, `.env.local` propio, `npm run dev`.
- **`npm run verificar` antes de cerrar cualquier tanda.** Corre aislamiento de
  datos, circulares, importaciones sin uso, tests, build, humo y accesibilidad.

---

## Al cerrar la sesión

El canal de sincronización entre JP y Tomás es **git, no el chat**. Antes de
terminar:

1. Actualizá `docs/traspaso-actual.md`: qué cambió, qué quedó a medias, qué hay
   que decidir. Es un traspaso, no un volcado de la conversación — si algo se
   entiende leyendo el diff, no lo repitas.
2. Si se tomó una decisión que no queremos volver a discutir, escribila en
   `docs/decisiones/AAAA-MM-DD-tema.md`.
3. Commiteá y pusheá (a `fork`). El otro hace `git pull` y su Claude lee todo solo.
