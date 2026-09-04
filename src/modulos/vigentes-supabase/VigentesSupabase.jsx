/**
 * Compromisos y proyectos VIGENTES, leídos en vivo de Supabase.
 *
 * Primera pantalla del portal conectada a la base real — el resto sigue en
 * el almacenamiento del navegador (ver el porqué en `datos/supabaseClient.js`). Se agregó a
 * pedido de JP el 04/09/2026: el jefe necesitaba ver los compromisos vigentes
 * cargados en el portal, y conectar el sistema entero era demasiado para
 * hacerlo a las apuradas sin que Tomás lo revise.
 *
 * Solo lectura: no hay botón de carga ni de edición acá. Cargar compromisos
 * nuevos sigue por el script de `scripts/cargar_supabase.py` hasta que exista
 * autenticación real — ver la nota de RLS en `supabaseClient.js`.
 */
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Semaforo, Tarjeta } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { nivelPorDias } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { leerVigentesDeSupabase } from '../../datos/vigentesSupabase.js';

const COLUMNAS_COMPROMISO = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => <p className="min-w-40 leading-tight text-tinta">{f.descripcion}</p>,
  },
  { clave: 'area', titulo: 'Área', ancho: 190 },
  { clave: 'responsable', titulo: 'Responsable', ancho: 140 },
  {
    clave: 'fecha_limite',
    titulo: 'Vence',
    ancho: 100,
    render: (f) => <span className="tabular text-xs">{f.fecha_limite ? fFecha(f.fecha_limite) : '—'}</span>,
  },
  {
    clave: 'estado_efectivo',
    titulo: 'Estado',
    ancho: 140,
    render: (f) => (
      <Semaforo
        nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
        texto={f.estado_efectivo === 'alerta' ? `alerta · ${f.dias_atraso} d` : f.estado_efectivo}
      />
    ),
  },
];

const COLUMNAS_PROYECTO = [
  { clave: 'nombre', titulo: 'Proyecto' },
  { clave: 'area', titulo: 'Área', ancho: 220 },
  { clave: 'programa', titulo: 'Programa', ancho: 220 },
  { clave: 'eje', titulo: 'Eje', ancho: 120 },
];

export default function VigentesSupabase() {
  const [estado, setEstado] = useState('cargando'); // cargando | ok | error
  const [error, setError] = useState('');
  const [datos, setDatos] = useState({ proyectos: [], compromisos: [] });

  async function cargar() {
    setEstado('cargando');
    try {
      const r = await leerVigentesDeSupabase();
      setDatos(r);
      setEstado('ok');
    } catch (e) {
      setError(e.message ?? String(e));
      setEstado('error');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <EncabezadoPagina
        titulo="Compromisos y proyectos vigentes"
        descripcion="Leído en vivo de Supabase — es la base real, compartida con el equipo. Solo lectura por ahora."
        acciones={
          <Boton variante="fantasma" icono={RefreshCw} onClick={cargar} disabled={estado === 'cargando'}>
            Actualizar
          </Boton>
        }
      />
      <Pagina className="flex flex-col gap-4">
        {estado === 'error' && (
          <Aviso tono="error">
            No se pudo leer de Supabase: {error}
          </Aviso>
        )}
        {estado === 'cargando' && <p className="text-sm text-gris">Cargando desde Supabase…</p>}

        {estado === 'ok' && (
          <>
            <Tarjeta
              titulo="Compromisos vigentes"
              descripcion={`${datos.compromisos.length} compromiso(s) — activos, sin importar si están vinculados a un proyecto`}
            >
              <Tabla columnas={COLUMNAS_COMPROMISO} filas={datos.compromisos} nombreExport="compromisos-vigentes" />
            </Tarjeta>

            <Tarjeta titulo="Proyectos" descripcion={`${datos.proyectos.length} proyecto(s) vigente(s)`}>
              <Tabla columnas={COLUMNAS_PROYECTO} filas={datos.proyectos} nombreExport="proyectos-vigentes" />
            </Tarjeta>
          </>
        )}
      </Pagina>
    </>
  );
}
