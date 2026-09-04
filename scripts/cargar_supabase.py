"""
Carga el paquete de supabase/datos/carga-inicial/ a la base real, via API REST
(ver supabase_toolkit.py — no se puede conectar por Postgres directo desde
esta red).

Corre en dos pasadas: primero VALIDA (resuelve area/programa/eje/tipo contra
los catalogos reales y avisa si algo no matchea, sin escribir nada) y recien
si todo resuelve, ESCRIBE. Se para ante el primer nombre que no encuentra —
mejor frenar que adivinar o insertar con una FK rota.

Uso:
    python cargar_supabase.py            # solo valida
    python cargar_supabase.py --escribir # valida y, si esta OK, escribe
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from supabase_toolkit import tabla, insertar  # noqa: E402

D = Path(__file__).resolve().parents[0].parent / "supabase" / "datos" / "carga-inicial"


def leer(nombre):
    with open(D / nombre, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def booleano(s):
    return str(s).strip().lower() == "true"


def fecha_o_none(s):
    s = str(s or "").strip()
    return s if s else None


ESCRIBIR = "--escribir" in sys.argv

print("=" * 70)
print("1. Catálogos reales")
print("=" * 70)
areas = {a["nombre"]: a["id"] for a in tabla("areas")}
ejes = {e["nombre"]: e["id"] for e in tabla("ejes")}
tipos = {t["nombre"]: t["id"] for t in tabla("tipos_proyecto")}
print(f"  areas: {list(areas)}")
print(f"  ejes: {list(ejes)}")
print(f"  tipos: {list(tipos)}")

errores = []

# ── 1. Programas ────────────────────────────────────────────────────────
programas_csv = leer("01-programas.csv")
programas_payload = []
for r in programas_csv:
    aid = areas.get(r["area"])
    if not aid:
        errores.append(f"programas: área «{r['area']}» no existe en el catálogo (fila «{r['nombre']}»)")
        continue
    programas_payload.append({"area_id": aid, "nombre": r["nombre"], "activo": True})
print(f"\n2. Programas: {len(programas_csv)} en el CSV, {len(programas_payload)} resuelven OK")

# ── 2. Proyectos (necesita los programas ya insertados, para tener su id) ──
proyectos_csv = leer("02-proyectos.csv")
proyectos_sin_programa = [r for r in proyectos_csv if not r["programa"].strip()]
proyectos_con_programa = [r for r in proyectos_csv if r["programa"].strip()]
for r in proyectos_con_programa:
    if r["area"] not in areas:
        errores.append(f"proyectos: área «{r['area']}» no existe (fila «{r['nombre']}»)")
    if r["eje"] not in ejes:
        errores.append(f"proyectos: eje «{r['eje']}» no existe (fila «{r['nombre']}»)")
    if r["tipo"] and r["tipo"] not in tipos:
        errores.append(f"proyectos: tipo «{r['tipo']}» no existe (fila «{r['nombre']}»)")
print(f"3. Proyectos: {len(proyectos_csv)} en el CSV "
      f"({len(proyectos_con_programa)} con programa, {len(proyectos_sin_programa)} sin programa — quedan afuera)")

# ── 3. Mesas ─────────────────────────────────────────────────────────────
TIPO_MESA = {"barrial": "barrial", "tematica": "tematica", "otros proyectos": "otros_proyectos"}
mesas_csv = leer("04-mesas.csv")
mesas_payload = []
for r in mesas_csv:
    t = TIPO_MESA.get(r["tipo"].strip().lower())
    if not t:
        errores.append(f"mesas: tipo «{r['tipo']}» no mapea a un valor del enum tipo_mesa (fila «{r['nombre']}»)")
        continue
    mesas_payload.append({"nombre": r["nombre"], "tipo": t, "estado": r["estado"], "activo": True})
print(f"4. Mesas: {len(mesas_csv)} en el CSV, {len(mesas_payload)} resuelven OK")

# ── 4. Compromisos (necesita las mesas ya insertadas si origen='mesa') ────
compromisos_csv = leer("05-compromisos.csv")
for r in compromisos_csv:
    if r["area"] not in areas:
        errores.append(f"compromisos: área «{r['area']}» no existe (fila «{r['titulo']}»)")
print(f"5. Compromisos: {len(compromisos_csv)} en el CSV")

print("\n" + "=" * 70)
if errores:
    print(f"VALIDACIÓN: {len(errores)} error(es) — NO se escribe nada")
    print("=" * 70)
    for e in errores:
        print("  -", e)
    sys.exit(1)

print("VALIDACIÓN OK — todo resuelve contra los catálogos reales")
print("=" * 70)

if not ESCRIBIR:
    print("\n(corrida en modo validación solamente — pasar --escribir para cargar de verdad)")
    sys.exit(0)

# ── Escritura, en el orden que respeta las FK ─────────────────────────────
print("\nESCRIBIENDO...")

nuevos_prog = insertar("programas", programas_payload)
prog_id = {(p["area_id"], p["nombre"]): p["id"] for p in nuevos_prog}
# también indexado por (nombre_area, nombre_programa) para el paso siguiente
areas_inv = {v: k for k, v in areas.items()}
prog_por_nombre = {(areas_inv[aid], nombre): pid for (aid, nombre), pid in prog_id.items()}
print(f"  programas: {len(nuevos_prog)} creados")

proyectos_payload = []
for r in proyectos_con_programa:
    pid = prog_por_nombre.get((r["area"], r["programa"]))
    if not pid:
        print(f"  !! salteado (no se encontró el programa recién creado): {r['nombre']}")
        continue
    proyectos_payload.append({
        "programa_id": pid,
        "nombre": r["nombre"],
        "eje_id": ejes[r["eje"]],
        "tipo_id": tipos.get(r["tipo"]),
        "estado_general": r["estado_general"] or "vigente",
        "es_obra": booleano(r["es_obra"]),
        "observaciones": (r["observaciones"] or "")
        + (f" (última carga real del _db: {r['fecha_ultima_actualizacion']})" if r["fecha_ultima_actualizacion"] else ""),
    })
nuevos_proy = insertar("proyectos", proyectos_payload)
print(f"  proyectos: {len(nuevos_proy)} creados")

nuevas_mesas = insertar("mesas", mesas_payload)
mesa_id = {m["nombre"]: m["id"] for m in nuevas_mesas}
print(f"  mesas: {len(nuevas_mesas)} creadas")

compromisos_payload = []
for r in compromisos_csv:
    compromisos_payload.append({
        "area_id": areas[r["area"]],
        "descripcion": r["descripcion"] or r["titulo"],
        "estado": r["estado"] or "pendiente",
        "origen_tipo": r["origen_tipo"] or None,
        "fecha_limite": fecha_o_none(r["fecha_limite"]),
        "activo": True,
    })
nuevos_comp = insertar("compromisos", compromisos_payload)
print(f"  compromisos: {len(nuevos_comp)} creados")

print("\n" + "=" * 70)
print("LISTO. Conteo final en la base:")
print("=" * 70)
for t in ["programas", "proyectos", "mesas", "compromisos"]:
    print(f"  {t:14} {len(tabla(t, select='id')):>4}")
