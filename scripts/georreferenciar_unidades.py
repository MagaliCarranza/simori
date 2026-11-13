"""Georreferencia unidades CLUES uniendo con DENUE, override manual y
fallback a la coordenada de la localidad del ITER.

Metodos, en orden de prioridad:
    1. manual      -> data/manual/georreferencia_manual.csv
    2. denue       -> union fuzzy por (ent+mun+loc) + similitud de nombre.
                      Solo CLUES SSA (SSA opera los centros rurales); IMSS y
                      ISSSTE caen al fallback de localidad porque sus nombres
                      genericos no distinguen (UMF, PONCITLAN, etc.). Los
                      candidatos DENUE se limitan a SCIAN 621116 (Clinicas de
                      consultorios medicos del sector publico). Asignacion
                      greedy por localidad: un DENUE no se usa dos veces.
    3. unica_loc   -> en la misma localidad hay 1 CLUES SSA tipologia A/B/C
                      y 1 DENUE SCIAN 621116; se asumen la misma unidad con
                      confianza media. Se aplica solo si el fuzzy no acepto.
    4. localidad   -> coordenadas de la localidad en el ITER
                      (ubicacionAproximada=True).
    5. sin_coords  -> no hay coordenadas por ninguna via.

El resumen de todas las uniones se escribe a
data/procesado/union_clues_denue.csv.
"""

from __future__ import annotations

import difflib
import re
import unicodedata

UMBRAL_FUZZY_ALTO = 0.90
UMBRAL_FUZZY_ACEPTABLE = 0.75

# Tipologias de CLUES que corresponden a centros de salud de primer nivel
# SSA. Incluye modulos (P): se intenta unir y, si ya se asigno al centro,
# cae al fallback de localidad por greedy.
TIPOLOGIAS_SSA = {"A", "B", "C", "P"}

# SCIAN publico que corresponde a "Centros de salud" (equivalente a SSA).
SCIAN_CS_PUBLICO = "621116"

# Etiquetas universales de "centro de salud" que se quitan antes de comparar.
# Deliberadamente NO se quita MODULO/DISPERSO/UMF: distinguen unidades.
PALABRAS_RUIDO = ["CENTRO DE SALUD", "CS", "SSA", "DISPERSO DE"]


def quitar_diacriticos(texto):
    descompuesto = unicodedata.normalize("NFD", str(texto))
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def normalizar(nombre):
    """Normaliza un nombre de unidad para comparar.

    Quita diacriticos, pasa a mayusculas, elimina etiquetas universales de
    centro de salud SSA ("CENTRO DE SALUD", "CS", "SSA", "DISPERSO DE") y
    colapsa caracteres no alfanumericos. Mantiene palabras que distinguen
    unidades distintas en la misma localidad (MODULO, UMF, etc.).
    """
    if nombre is None:
        return ""
    t = quitar_diacriticos(nombre).upper()
    # Colapsa espacios primero para que "CENTRO  DE  SALUD" matchee.
    t = re.sub(r"\s+", " ", t)
    for p in PALABRAS_RUIDO:
        patron = r"\b" + r"\s+".join(p.split()) + r"\b"
        t = re.sub(patron, " ", t)
    t = re.sub(r"[^A-Z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def institucion_de_clues(clues):
    if not isinstance(clues, str) or len(clues) < 5:
        return "otra"
    sub = clues[2:5]
    if sub == "SSA":
        return "SSA"
    if sub == "IMS":
        return "IMSS"
    if sub == "IST":
        return "ISSSTE"
    return "otra"


def _ratio(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def _manual_por_clues(manual_rows):
    mapa = {}
    for r in manual_rows:
        clues = str(r.get("clues") or "").strip()
        if not clues:
            continue
        try:
            lat = float(r["lat"])
            lng = float(r["lng"])
        except (TypeError, ValueError):
            continue
        mapa[clues] = {
            "lat": lat,
            "lng": lng,
            "fuente": r.get("fuente") or "",
            "fecha": r.get("fecha") or "",
        }
    return mapa


def _candidatos_denue_por_loc(denue_rows, entidad, municipio):
    """Agrupa DENUE 621116 por localidad."""
    por_loc = {}
    for d in denue_rows:
        if int(d["cve_ent"]) != entidad or int(d["cve_mun"]) != municipio:
            continue
        if str(d.get("codigo_act", "")) != SCIAN_CS_PUBLICO:
            continue
        key = str(d["cve_loc"]).zfill(4)
        por_loc.setdefault(key, []).append(d)
    return por_loc


def _emparejar_por_localidad(clues_ssa_loc, denue_loc):
    """Asignacion greedy por localidad entre CLUES SSA y DENUE 621116.

    Calcula ratio para todos los pares; ordena por ratio desc; asigna
    greedy sin reutilizar CLUES ni DENUE. Devuelve dict clues -> (ratio, denue).
    """
    pares = []
    for c in clues_ssa_loc:
        n = normalizar(c.get("desc_unidad"))
        for d in denue_loc:
            r = _ratio(n, normalizar(d.get("nom_estab")))
            pares.append((r, c["clues"], d))
    pares.sort(key=lambda x: x[0], reverse=True)
    asignacion = {}
    usados_denue = set()
    for r, clues_id, d in pares:
        if clues_id in asignacion:
            continue
        clave_d = d.get("id") or d.get("clee") or id(d)
        if clave_d in usados_denue:
            continue
        asignacion[clues_id] = (r, d)
        usados_denue.add(clave_d)
    return asignacion


def georreferenciar_unidades(entidad, municipio, clues_rows, denue_rows,
                             coords_localidad, manual_rows=None):
    """Georreferencia cada CLUES del municipio.

    Parametros:
        entidad, municipio: claves INEGI (int).
        clues_rows, denue_rows: iterables de dicts (rows crudos).
        coords_localidad: dict loc_zfill_4 -> (lat, lng) del ITER.
        manual_rows: iterable de dicts del CSV manual (opcional).

    Devuelve (centros, uniones):
        centros: list de dicts listos para centros_salud.json
        uniones: list de dicts para data/procesado/union_clues_denue.csv
    """
    manual_rows = manual_rows or []
    manual = _manual_por_clues(manual_rows)

    # Filtra defensivamente las CLUES al municipio.
    clues_mun = [
        c for c in clues_rows
        if str(c["cedocve"]).zfill(2) == f"{entidad:02d}"
        and str(c["cmpocve"]).zfill(3) == f"{municipio:03d}"
    ]
    candidatos_por_loc = _candidatos_denue_por_loc(denue_rows, entidad, municipio)

    # Emparejamiento greedy por localidad (solo CLUES SSA).
    emparejamiento = {}
    por_loc_ssa = {}
    for c in clues_mun:
        if institucion_de_clues(c["clues"]) != "SSA":
            continue
        if str(c.get("tipologia", "")).upper() not in TIPOLOGIAS_SSA:
            continue
        loc = str(c["cloccve"]).zfill(4)
        por_loc_ssa.setdefault(loc, []).append(c)
    for loc, clues_loc in por_loc_ssa.items():
        cand = candidatos_por_loc.get(loc, [])
        if not cand:
            continue
        asig = _emparejar_por_localidad(clues_loc, cand)
        emparejamiento.update(asig)

    centros = []
    uniones = []

    for c in clues_mun:
        loc = str(c["cloccve"]).zfill(4)
        nombre_clues = c.get("desc_unidad") or ""
        inst = institucion_de_clues(c["clues"])
        tipologia = str(c.get("tipologia", "")).upper()

        metodo = None
        confianza = None
        puntaje = 0.0
        clave_denue = None
        lat = None
        lng = None

        # 1. Override manual.
        if c["clues"] in manual:
            m = manual[c["clues"]]
            lat, lng = m["lat"], m["lng"]
            metodo = "manual"
            confianza = "manual"
            puntaje = 1.0

        # 2. Fuzzy name (solo SSA).
        if metodo is None and c["clues"] in emparejamiento:
            r, d = emparejamiento[c["clues"]]
            if r >= UMBRAL_FUZZY_ACEPTABLE:
                lat, lng = float(d["latitud"]), float(d["longitud"])
                metodo = "denue"
                confianza = "alta" if r >= UMBRAL_FUZZY_ALTO else "media"
                puntaje = round(r, 3)
                clave_denue = d.get("id") or d.get("clee")

        # 3. Unica en localidad (CLUES SSA tipologia A/B/C sin match).
        if metodo is None and inst == "SSA" and tipologia in {"A", "B", "C"}:
            css_mismas = [
                o for o in clues_mun
                if str(o["cloccve"]).zfill(4) == loc
                and institucion_de_clues(o["clues"]) == "SSA"
                and str(o.get("tipologia", "")).upper() in {"A", "B", "C"}
            ]
            cand = candidatos_por_loc.get(loc, [])
            if len(css_mismas) == 1 and len(cand) == 1:
                d = cand[0]
                lat, lng = float(d["latitud"]), float(d["longitud"])
                metodo = "unica_loc"
                confianza = "media"
                puntaje = round(emparejamiento.get(c["clues"], (0.0, None))[0], 3)
                clave_denue = d.get("id") or d.get("clee")

        # 4. Fallback a coordenada de la localidad.
        if metodo is None:
            coords = coords_localidad.get(loc)
            if coords:
                lat, lng = coords
                metodo = "localidad"
                confianza = "baja"
                puntaje = 0.0

        # 5. Sin coordenadas.
        if metodo is None:
            metodo = "sin_coords"
            confianza = "ninguna"

        centros.append({
            "clues": c["clues"],
            "nombre": nombre_clues.strip(),
            "tipo": c.get("tipo_unidad") or None,
            "tipologia": c.get("tipologia") or None,
            "institucion": inst,
            "claveInegi": f"{entidad:02d}{municipio:03d}{loc}",
            "lat": lat,
            "lng": lng,
            "ubicacionAproximada": metodo == "localidad",
            "verificadaDENUE": metodo in ("denue", "unica_loc"),
        })
        uniones.append({
            "clues": c["clues"],
            "nombre": nombre_clues.strip(),
            "clave_denue": clave_denue,
            "puntaje": puntaje,
            "metodo": metodo,
            "confianza": confianza,
        })

    return centros, uniones
