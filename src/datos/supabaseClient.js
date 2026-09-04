/**
 * Cliente de Supabase — PRIMERA conexión real del portal a la base, todavía
 * acotada: solo lectura, solo para la pantalla de compromisos y proyectos
 * (`src/modulos/vigentes-supabase/`). El resto del sistema sigue en
 * el almacenamiento del navegador (ver `datos/almacenamiento.js`) hasta que se migre entero,
 * que es un trabajo bastante más grande — cambiar cada función de
 * `repositorio.js` de síncrona a async, y revisar los ~40 consumidores que
 * asumen respuesta inmediata.
 *
 * Por qué solo lectura (04/09/2026): el portal no tiene login real todavía
 * (`config.usuario` es texto libre, ver el comentario en
 * `guardarAsignacionesMonitoreo` de repositorio.js). La clave `anon` viaja en
 * el bundle del frontend — es pública de hecho, la vea quien la vea. Escribir
 * con ella sin verificar identidad dejaría cualquier compromiso o proyecto
 * municipal editable por cualquiera con el link del portal. La política de
 * RLS del lado del servidor solo permite `SELECT` — ver
 * `supabase/datos/carga-inicial/00-README.md`. Cuando haya autenticación real
 * (Supabase Auth, roles por secretaría), esto se abre a escritura.
 *
 * Variables de entorno en `.env.local` (no versionado — ver `.env.example`).
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = supabaseConfigurado
  ? createClient(url, anonKey)
  : null;
