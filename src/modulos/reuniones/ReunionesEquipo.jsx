import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Plus } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Semaforo, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoNumero, CampoSelect, CampoTexto } from '../../componentes/Campo.jsx';
import { EditorCompromiso } from '../../componentes/EditorCompromiso.jsx';
import { SelectorResponsable } from '../../componentes/ResponsableCompromiso.jsx';
import { acciones, useBD } from '../../estado/tienda.js';
import { usePerfil } from '../../estado/sesion.js';
import { compromisos as seleccionarCompromisos, hoyISO } from '../../datos/selectores.js';
import { nombreResponsable, puedeEditarEquipo, puedeGestionarCompromiso, puedePrepararReunion, temasDeReunionEquipo } from '../../datos/equipo.js';
import { fecha as fechaTexto } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';

const TIPOS = [{ valor: 'secretaria', titulo: 'Secretaría' }, { valor: 'direccion', titulo: 'Dirección' }];

export default function ReunionesEquipo() {
  const bd = useBD();
  const perfil = usePerfil();
  const [params, setParams] = useSearchParams();
  const pedida = bd?.reuniones_equipo?.find((r) => r.id === params.get('reunion'));
  const tipo = pedida?.tipo ?? (params.get('tipo') === 'direccion' ? 'direccion' : 'secretaria');
  const [fecha, setFecha] = useState(hoyISO());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const reuniones = (bd?.reuniones_equipo ?? []).filter((r) => r.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const reunion = reuniones.find((r) => r.id === params.get('reunion')) ?? reuniones[0];
  const organiza = puedePrepararReunion(bd, perfil, tipo);
  function elegir(id, nuevoTipo = tipo) { setParams({ tipo: nuevoTipo, ...(id ? { reunion: id } : {}) }); }
  async function crear(e) {
    e.preventDefault(); setGuardando(true); setError('');
    try { const r = await acciones.crearReunionEquipo({ tipo, fecha }); elegir(r.id); }
    catch (e) { setError(e.message ?? 'No se pudo crear la reunión.'); }
    finally { setGuardando(false); }
  }
  return <>
    <EncabezadoPagina titulo="Reuniones" descripcion="La agenda de Secretaría y la revisión completa de Dirección, sobre los mismos compromisos." />
    <Pagina className="flex flex-col gap-4">
      <Tarjeta>
        <div className="flex flex-wrap items-end gap-4">
          <CampoSelect etiqueta="Reunión de" opciones={TIPOS} value={tipo} placeholder={null} onChange={(e) => elegir(null, e.target.value)} />
          <CampoSelect etiqueta="Encuentro" value={reunion?.id ?? ''} placeholder="Elegí una reunión"
            opciones={reuniones.map((r) => ({ valor: r.id, titulo: `${fechaTexto(r.fecha)}${r.cerrada ? ' · Temario cerrado' : ''}` }))}
            onChange={(e) => elegir(e.target.value)} />
        </div>
        <p className="mt-3 text-sm text-gris">{tipo === 'secretaria'
          ? 'El organizador elige los compromisos y otros temas que se van a conversar.'
          : 'Todos los compromisos, incluidos los cumplidos y los que todavía no tienen responsable. Marcar como revisado no cambia su estado.'}</p>
        {organiza && <details className="mt-4 border-t border-borde pt-3">
          <summary className="cursor-pointer text-sm font-medium text-acento-fuerte">Agendar un encuentro</summary>
          <form onSubmit={crear} className="mt-3 flex flex-wrap items-end gap-3">
            <CampoFecha etiqueta="Fecha de reunión" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            <Boton type="submit" icono={Plus} variante="primario" disabled={guardando}>{guardando ? 'Creando…' : 'Crear reunión'}</Boton>
          </form>
        </details>}
        {error && <Aviso tono="error">{error}</Aviso>}
      </Tarjeta>
      {reunion ? <Encuentro key={reunion.id} reunion={reunion} organiza={organiza} /> : <Tarjeta>
        <Vacio icono={CalendarCheck} titulo="Sin reuniones registradas" descripcion={organiza ? 'Agendá el primer encuentro para comenzar.' : 'El organizador todavía no agendó un encuentro.'} />
      </Tarjeta>}
    </Pagina>
  </>;
}

function Encuentro({ reunion, organiza }) {
  const bd = useBD();
  const perfil = usePerfil();
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const puedeEscribir = puedeEditarEquipo(perfil);
  const compromisos = useMemo(() => seleccionarCompromisos(bd, {}, hoyISO()), [bd]);
  const porId = new Map(compromisos.map((c) => [c.id, c]));
  const temas = temasDeReunionEquipo(bd, reunion);
  const revisados = temas.filter((t) => t.revisado).length;
  const grupos = new Map();
  for (const tema of temas) {
    const c = porId.get(tema.compromiso_id);
    const clave = reunion.tipo === 'direccion' ? nombreResponsable(bd, c?.id_responsable) : 'Temario';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push({ tema, compromiso: c });
  }
  const nacidos = compromisos.filter((c) => c.origen_tipo === 'equipo' && c.id_origen === reunion.id);
  async function cerrar() {
    setCerrando(true); setError('');
    try { await acciones.cerrarReunionEquipo(reunion.id); }
    catch (e) { setError(e.message ?? 'No se pudo cerrar el temario.'); }
    finally { setCerrando(false); }
  }
  return <>
    <Tarjeta titulo={`${reunion.tipo === 'secretaria' ? 'Secretaría' : 'Dirección'} · ${fechaTexto(reunion.fecha)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gris">{temas.length} temas · {revisados} revisados · {temas.length - revisados} por revisar</p>
        {reunion.cerrada ? <Chip>Temario cerrado</Chip> : organiza && <Boton onClick={cerrar} disabled={cerrando}>
          {cerrando ? 'Cerrando…' : 'Cerrar temario'}
        </Boton>}
      </div>
      <p className="mt-2 text-xs text-gris">Cerrar conserva la lista de temas de este encuentro. Los compromisos se pueden seguir actualizando después.</p>
      {error && <Aviso tono="error">{error}</Aviso>}
    </Tarjeta>
    {organiza && !reunion.cerrada && <AgregarTema reunion={reunion} temas={temas} compromisos={compromisos} />}
    {!temas.length && <Tarjeta><Vacio titulo="El temario está vacío" descripcion="Los compromisos seleccionados y los temas nuevos aparecerán acá." /></Tarjeta>}
    {[...grupos].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([grupo, filas]) => <section key={grupo} aria-label={grupo}>
      <h2 className="mb-3 text-base font-semibold text-tinta">{grupo} <span className="text-sm font-normal text-gris">({filas.length})</span></h2>
      <div className="flex flex-col gap-3">{filas.map(({ tema, compromiso }) => <Tema key={tema.id ?? tema.compromiso_id}
        tema={tema} compromiso={compromiso} reunion={reunion} organiza={organiza} puedeEscribir={puedeEscribir} />)}</div>
    </section>)}
    {puedeEscribir && <NuevoCompromiso reunion={reunion} />}
    {nacidos.length > 0 && <Tarjeta titulo="Compromisos surgidos de esta reunión">
      <ul className="flex flex-col gap-3">{nacidos.map((c) => <li key={c.id} className="text-sm text-tinta">
        <Link className="font-medium text-acento-fuerte underline" to={`/seguimiento?tab=compromisos&compromiso=${c.id}`}>{c.descripcion}</Link>
        <p className="text-xs text-gris">{nombreResponsable(bd, c.id_responsable)} · {c.area} · {fechaTexto(c.fecha_limite)}</p>
      </li>)}</ul>
    </Tarjeta>}
  </>;
}

function AgregarTema({ reunion, temas, compromisos }) {
  const [id, setId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [nota, setNota] = useState('');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const disponibles = compromisos.filter((c) => !temas.some((t) => t.compromiso_id === c.id)
    && c.descripcion.toLocaleLowerCase().includes(texto.toLocaleLowerCase()));
  async function agregar(e) {
    e.preventDefault(); setGuardando(true); setError('');
    try {
      await acciones.guardarTemaReunionEquipo({ reunion_id: reunion.id, compromiso_id: id || null,
        titulo: id ? compromisos.find((c) => c.id === id)?.descripcion : titulo.trim(), nota,
        orden: Math.max(0, ...temas.map((t) => t.orden)) + 1 });
      setId(''); setTitulo(''); setNota(''); setTexto('');
    } catch (e) { setError(e.message ?? 'No se pudo agregar el tema.'); }
    finally { setGuardando(false); }
  }
  return <Tarjeta titulo="Preparar temario">
    <form onSubmit={agregar} className="grid gap-3 md:grid-cols-2">
      {reunion.tipo === 'secretaria' && <>
        <CampoTexto etiqueta="Buscar compromiso" value={texto} onChange={(e) => { setTexto(e.target.value); setId(''); }} />
        <CampoSelect etiqueta="Compromiso existente" placeholder="Tema nuevo, sin compromiso" value={id} onChange={(e) => setId(e.target.value)}
          opciones={disponibles.map((c) => ({ valor: c.id, titulo: `${c.area} · ${c.descripcion}` }))} />
      </>}
      {!id && <CampoTexto etiqueta="Tema nuevo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />}
      <CampoArea etiqueta="Información para la reunión" filas={2} value={nota} onChange={(e) => setNota(e.target.value)} />
      <div className="md:col-span-2"><Boton type="submit" variante="primario" icono={Plus} disabled={guardando || (!id && !titulo.trim())}>
        {guardando ? 'Agregando…' : 'Agregar al temario'}
      </Boton></div>
      {error && <Aviso tono="error">{error}</Aviso>}
    </form>
  </Tarjeta>;
}

function Tema({ tema, compromiso, reunion, organiza, puedeEscribir }) {
  const bd = useBD();
  const perfil = usePerfil();
  const puedeActualizar = compromiso && puedeGestionarCompromiso(perfil, compromiso);
  const [acuerdo, setAcuerdo] = useState(tema.acuerdo ?? '');
  const [revisado, setRevisado] = useState(tema.revisado ?? false);
  const [nota, setNota] = useState(tema.nota ?? '');
  const [orden, setOrden] = useState(tema.orden ?? 0);
  const [titulo, setTitulo] = useState(tema.titulo);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  async function ejecutar(fn) {
    setGuardando(true); setError(''); setGuardado(false);
    try { await fn(); setGuardado(true); }
    catch (e) { setError(e.message ?? 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }
  return <Tarjeta>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-tinta">{compromiso?.descripcion ?? tema.titulo}</h3>
        {compromiso && <p className="mt-1 text-xs text-gris">{compromiso.area} · {nombreResponsable(bd, compromiso.id_responsable)} · Vence: {fechaTexto(compromiso.fecha_limite)}</p>}
      </div>
      {compromiso && <Semaforo nivel={compromiso.estado_efectivo === 'alerta' ? 'vencido' : compromiso.estado === 'cumplido' ? 'enregla' : 'atencion'} texto={compromiso.estado_efectivo.replaceAll('_', ' ')} />}
      {tema.revisado && <Chip>Revisado</Chip>}
    </div>
    {tema.nota && <p className="mt-3 whitespace-pre-line text-sm text-gris">{tema.nota}</p>}
    {compromiso?.ultima_actualizacion?.texto && <p className="mt-3 rounded-chip bg-paper p-3 text-sm text-tinta">Última novedad: {compromiso.ultima_actualizacion.texto}</p>}
    {organiza && !reunion.cerrada && <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-acento-fuerte">Editar tema y orden</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {!compromiso && <CampoTexto etiqueta="Tema" value={titulo} onChange={(e) => setTitulo(e.target.value)} />}
        <CampoNumero etiqueta="Orden en el temario" value={orden} min="0" step="1" onChange={(e) => setOrden(Number(e.target.value))} />
        <CampoArea etiqueta="Información previa" filas={2} value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="flex flex-wrap items-end gap-2">
          <Boton disabled={guardando} onClick={() => ejecutar(() => acciones.guardarTemaReunionEquipo({ ...tema, nota, orden, titulo }))}>Guardar tema</Boton>
          {reunion.tipo === 'secretaria' && tema.id && <Boton disabled={guardando} onClick={() => ejecutar(() => acciones.quitarTemaReunionEquipo(tema.id))}>Quitar del temario</Boton>}
        </div>
      </div>
    </details>}
    {puedeEscribir ? <div className="mt-3 border-t border-borde pt-3">
      <CampoArea etiqueta="Acuerdos de la reunión" filas={2} value={acuerdo} onChange={(e) => { setAcuerdo(e.target.value); setGuardado(false); }} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CampoCheck etiqueta="Revisado en esta reunión" checked={revisado} onChange={(e) => { setRevisado(e.target.checked); setGuardado(false); }} />
        <Boton disabled={guardando} onClick={() => ejecutar(() => acciones.guardarTemaReunionEquipo({ ...tema, acuerdo, revisado }))}>Guardar acuerdos</Boton>
      </div>
    </div> : tema.acuerdo && <p className="mt-3 whitespace-pre-line text-sm text-tinta">Acuerdos: {tema.acuerdo}</p>}
    {puedeActualizar && <Boton className="mt-3" onClick={() => setEditando(!editando)}>Actualizar o derivar compromiso</Boton>}
    {editando && puedeActualizar && <EditorCompromiso compromiso={compromiso} borrador={borrador}
      alCambiarBorrador={(c) => setBorrador((b) => ({ ...b, ...c }))} guardando={guardando}
      alCancelar={() => setEditando(false)} alGuardar={() => ejecutar(async () => {
        await acciones.actualizarEstadoCompromiso(compromiso.id, borrador); setBorrador({}); setEditando(false);
      })} />}
    {error && <Aviso tono="error">{error}</Aviso>}
    {guardado && <p role="status" className="mt-2 text-xs text-gris">Guardado.</p>}
  </Tarjeta>;
}

function NuevoCompromiso({ reunion }) {
  const areas = useOpciones('areas');
  const [datos, setDatos] = useState({ descripcion: '', area: '', id_responsable: '', fecha_limite: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const cambiar = (clave, valor) => { setDatos((d) => ({ ...d, [clave]: valor })); setGuardado(false); };
  async function guardar(e) {
    e.preventDefault(); setGuardando(true); setError('');
    try {
      await acciones.crearCompromiso({ ...datos, descripcion: datos.descripcion.trim(), origen_tipo: 'equipo', id_origen: reunion.id });
      setDatos({ descripcion: '', area: '', id_responsable: '', fecha_limite: '' }); setGuardado(true);
    } catch (e) { setError(e.message ?? 'No se pudo crear el compromiso.'); }
    finally { setGuardando(false); }
  }
  return <Tarjeta titulo="Nuevo compromiso de esta reunión" descripcion="Podés cargarlo después del encuentro. Le aparecerá al responsable en Mi seguimiento.">
    <form onSubmit={guardar} className="grid gap-3 md:grid-cols-2">
      <CampoArea etiqueta="Qué hay que hacer" filas={2} required value={datos.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
      <CampoSelect etiqueta="Área" opciones={areas} value={datos.area} required onChange={(e) => cambiar('area', e.target.value)} />
      <SelectorResponsable valor={datos.id_responsable} alCambiar={(v) => cambiar('id_responsable', v)} disabled={guardando} />
      <CampoFecha etiqueta="Fecha límite" required value={datos.fecha_limite} onChange={(e) => cambiar('fecha_limite', e.target.value)} />
      <div className="md:col-span-2"><Boton type="submit" variante="primario" disabled={guardando || !datos.id_responsable || !datos.descripcion.trim()}>
        {guardando ? 'Creando…' : 'Crear y asignar compromiso'}
      </Boton></div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {guardado && <p role="status" className="text-sm text-gris">Compromiso creado y asignado.</p>}
    </form>
  </Tarjeta>;
}
