"""
Acceso a la base real de Supabase por API REST (PostgREST), no por conexion
Postgres directa.

Por que: la red del municipio bloquea saliente los puertos de Postgres
(5432 y 6543, tanto conexion directa como los dos poolers) — confirmado el
04/09/2026 con timeouts en los tres. El 443 (HTTPS) sale libre, y la API REST
autogenerada de Supabase corre ahi, asi que es el unico camino posible desde
esta red.

Consecuencia de fondo: no se puede correr el SQL de
`supabase/datos/carga-inicial/00-README.md` tal cual (`INSERT ... SELECT ...
JOIN`) porque PostgREST no ejecuta SQL arbitrario. Este modulo resuelve las
relaciones (area -> programa -> proyecto) en Python: pide los catalogos por
API, arma un diccionario nombre->id, y inserta fila por fila con el id ya
resuelto.

La clave usada es `service_role` (`.secrets/supabase_service_role.txt`), que
salta RLS por completo — no depende de que existan politicas.

Uso:
    from supabase_toolkit import tabla, insertar, upsert

    areas = tabla("areas")
    insertar("programas", [{"area_id": "...", "nombre": "..."}])
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

SECRETS = Path(__file__).resolve().parents[2] / ".secrets"
REF = "bqwrnzjvkwtzlcnguwnz"
BASE = f"https://{REF}.supabase.co/rest/v1"

_KEY = (SECRETS / "supabase_service_role.txt").read_text(encoding="utf-8").strip()
_HEADERS = {
    "apikey": _KEY,
    "Authorization": f"Bearer {_KEY}",
    "Content-Type": "application/json",
}


def _pedido(metodo: str, ruta: str, cuerpo=None, extra_headers=None) -> tuple[int, object]:
    headers = {**_HEADERS, **(extra_headers or {})}
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(f"{BASE}/{ruta}", data=datos, headers=headers, method=metodo)
    try:
        r = urllib.request.urlopen(req, timeout=20)
        cuerpo_resp = r.read()
        return r.status, (json.loads(cuerpo_resp) if cuerpo_resp else None)
    except urllib.error.HTTPError as e:
        cuerpo_resp = e.read()
        try:
            return e.code, json.loads(cuerpo_resp)
        except Exception:
            return e.code, cuerpo_resp.decode("utf-8", "replace")


def tabla(nombre: str, select: str = "*", filtro: str = "", limite: int = 1000) -> list[dict]:
    """Lee filas de una tabla. `filtro` va tal cual, ej. 'nombre=eq.POA'."""
    todas = []
    offset = 0
    while True:
        q = f"select={select}&limit={limite}&offset={offset}"
        if filtro:
            q += f"&{filtro}"
        codigo, datos = _pedido("GET", f"{nombre}?{q}")
        if codigo >= 300:
            raise RuntimeError(f"GET {nombre}: {codigo} {datos}")
        todas.extend(datos)
        if len(datos) < limite:
            break
        offset += limite
    return todas


def contar(nombre: str) -> int:
    return len(tabla(nombre, select="id"))


def insertar(nombre: str, filas: list[dict]) -> list[dict]:
    """Inserta filas nuevas. Devuelve las filas creadas (con su id)."""
    if not filas:
        return []
    codigo, datos = _pedido("POST", nombre, filas, {"Prefer": "return=representation"})
    if codigo >= 300:
        raise RuntimeError(f"POST {nombre}: {codigo} {datos}")
    return datos


def upsert(nombre: str, filas: list[dict], on_conflict: str) -> list[dict]:
    """Inserta o actualiza segun `on_conflict` (columnas separadas por coma)."""
    if not filas:
        return []
    codigo, datos = _pedido(
        "POST", f"{nombre}?on_conflict={on_conflict}", filas,
        {"Prefer": "return=representation,resolution=merge-duplicates"},
    )
    if codigo >= 300:
        raise RuntimeError(f"UPSERT {nombre}: {codigo} {datos}")
    return datos


if __name__ == "__main__":
    for t in ["areas", "programas", "ejes", "estados", "tipos_proyecto", "proyectos",
              "puntuales", "mesas", "compromisos", "reuniones_mesa", "seguimientos"]:
        try:
            n = contar(t)
            print(f"  {t:20} {n:>5} filas")
        except RuntimeError as e:
            print(f"  {t:20} ERROR — {str(e)[:150]}")
