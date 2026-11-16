"""Prepara los catalogos para la app leyendo los datasets reales.

Entradas (data/raw/):
    educacion_basica_2024_2025.csv    Formato 911, SEP.
    IML_2020.xls                      Indice de marginacion, CONAPO.
    iter_14_cpv2020/.../*.csv         ITER del Censo 2020, INEGI.
    catclues.csv                      Catalogo CLUES, Secretaria de Salud.
    denue_00_62_csv/.../*.csv         DENUE sector 62 (salud), INEGI 05/2026.

Alcance: scripts/alcance.json (entidad, municipio, enAlcance). Sin claves
escritas en el codigo.

Salidas (public/data/):
    localidades.json          Solo las localidades enAlcance (las unicas
                              que se muestran en la app).
    localidades_marco.json    Todas las localidades reales del municipio
                              (sin filas de totales del ITER). La app solo
                              las usa para normalizar el indice de
                              prioridad; no se muestran en ninguna pantalla.
    escuelas.json             Escuelas publicas primaria/secundaria con
                              matricula de las localidades enAlcance.
    centros_salud.json        Solo el CLUES visible (JCSSA004213) que
                              atiende a las 3 localidades. Las demas
                              unidades quedan en el preparado para calcular
                              distancias y no se muestran.
    usuarios_demo.json        1 captura y 1 campo del centro operativo +
                              1 supervision estatal.

Tambien escribe el resumen de la union CLUES/DENUE en
data/procesado/union_clues_denue.csv.
"""

from __future__ import annotations

import csv
import json
import math
import re
from pathlib import Path

import pandas as pd

from georreferenciar_unidades import georreferenciar_unidades, institucion_de_clues

RAIZ = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
RAW = RAIZ / "data" / "raw"
MANUAL = RAIZ / "data" / "manual"
PROCESADO = RAIZ / "data" / "procesado"
PUBLIC = RAIZ / "public" / "data"

RUTA_ALCANCE = SCRIPTS / "alcance.json"
RUTA_911 = RAW / "educacion_basica_2024_2025.csv"
RUTA_CONAPO = RAW / "IML_2020.xls"
RUTA_ITER = RAW / "iter_14_cpv2020" / "conjunto_de_datos" / "conjunto_de_datos_iter_14CSV20.csv"
RUTA_CLUES = RAW / "catclues.csv"
RUTA_DENUE = RAW / "denue_00_62_csv" / "conjunto_de_datos" / "denue_inegi_62_.csv"
RUTA_MANUAL = MANUAL / "georreferencia_manual.csv"
# Coordenadas de escuelas por CCT (datos publicos de la SEP, consultados en
# escuelasmex.com). Columnas: cct,lat,lng,fuente,url,nota.
RUTA_ESCUELAS_MANUAL = MANUAL / "georreferencia_escuelas.csv"
RUTA_UNION = PROCESADO / "union_clues_denue.csv"

# ITER agrega 3 filas de resumen por municipio que NO son localidades:
#   0000 "Total del Municipio"
#   9998 "Localidades de una vivienda"
#   9999 "Localidades de dos viviendas"
# Hay que excluirlas antes de calcular cualquier cosa: mezclan promedios
# ponderados con valores locales (ej: pctHLI del total municipal = 7.4 %)
# y ensucian el marco de normalizacion.
TOTALES_ITER = {0, 9998, 9999}

# Unico CLUES visible en el mapa: atiende a las 3 localidades enAlcance.
# Las demas unidades del municipio se quedan en el preparado para calcular
# distancias, pero no se publican a la app.
CLUES_VISIBLE = "JCSSA004213"


# ------------------------------- utilidades -------------------------------

def leer_alcance():
    alcance = json.loads(RUTA_ALCANCE.read_text(encoding="utf-8"))
    enAlcance = [str(x).zfill(4) for x in alcance["enAlcance"]]
    return {
        "entidad": int(alcance["entidad"]),
        "municipio": int(alcance["municipio"]),
        "enAlcance": enAlcance,
        "normalizarContra": alcance.get("normalizarContra", "municipio"),
    }


def gms_a_decimal(valor):
    """Convierte coordenada GMS del ITER a decimal (ej. 20 18' 45.244\" N)."""
    if pd.isna(valor) or not isinstance(valor, str):
        return None
    patron = re.compile(
        r"\s*(\d+)[^\d]+(\d+)['′\s]+([\d.]+)[\"″\s]*([NSEW])?\s*$"
    )
    m = patron.match(valor.strip())
    if not m:
        return None
    g, mi, se, hemi = m.groups()
    dec = int(g) + int(mi) / 60 + float(se) / 3600
    if hemi in ("S", "W"):
        dec = -dec
    return round(dec, 6)


def cve_loc(ent, mun, loc):
    return f"{int(ent):02d}{int(mun):03d}{int(loc):04d}"


def _a_int_seguro(valor):
    if pd.isna(valor):
        return None
    s = str(valor).strip()
    if s in ("", "*", "N/D"):
        return None
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def haversine_km(lat1, lng1, lat2, lng2):
    """Distancia en kilometros entre dos puntos (formula del haversine)."""
    r = 6371.0
    f1, f2 = math.radians(lat1), math.radians(lat2)
    df = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(df / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# --------------------------------- ITER ---------------------------------

def filtrar_totales_iter(df):
    """Excluye las filas agregadas del ITER (LOC 0000, 9998, 9999)."""
    return df[~df["LOC"].astype(int).isin(TOTALES_ITER)].copy()


def leer_iter(entidad, municipio):
    cols = [
        "ENTIDAD", "MUN", "LOC", "NOM_LOC",
        "LATITUD", "LONGITUD",
        "POBTOT", "P_5YMAS", "P_15YMAS",
        "P_3YMAS", "P3YM_HLI", "PHOG_IND",
    ]
    df = pd.read_csv(RUTA_ITER, usecols=cols, low_memory=False, encoding="utf-8")
    df = df[(df["ENTIDAD"] == entidad) & (df["MUN"] == municipio)]
    return filtrar_totales_iter(df)


# --------------------------------- CONAPO ---------------------------------

def leer_conapo(entidad, municipio):
    df = pd.read_excel(RUTA_CONAPO, sheet_name="IML_2020_AGS-MEX")
    return df[(df["ENT"] == entidad) & (df["MUN"] == municipio)].copy()


# --------------------------------- 911 SEP ---------------------------------

TURNOS = {1: "matutino", 2: "vespertino", 3: "nocturno", 4: "discontinuo"}


def leer_911(entidad, municipio):
    cols = [
        "entidad", "municipio", "localidad", "n_localidad",
        "clave_cct", "n_cct", "nivel", "subnivel", "control", "turno", "insc_t",
    ]
    df = pd.read_csv(RUTA_911, usecols=cols, low_memory=False, encoding="latin-1")
    mask = (
        (df["entidad"] == entidad)
        & (df["municipio"] == municipio)
        & df["nivel"].isin(["Primaria", "Secundaria"])
        & df["control"].astype(str).str.contains("blico", na=False)  # Publico
        & (df["insc_t"] > 0)
    )
    return df[mask].copy()


# --------------------------------- CLUES ---------------------------------

def leer_clues(entidad, municipio):
    df = pd.read_csv(RUTA_CLUES, encoding="utf-8-sig", low_memory=False)
    mask = (
        df["cedocve"].astype(str).str.zfill(2) == f"{entidad:02d}"
    ) & (
        df["cmpocve"].astype(str).str.zfill(3) == f"{municipio:03d}"
    )
    return df[mask].to_dict(orient="records")


# --------------------------------- DENUE ---------------------------------

def leer_denue(entidad, municipio):
    df = pd.read_csv(RUTA_DENUE, encoding="latin-1", low_memory=False)
    mask = (df["cve_ent"] == entidad) & (df["cve_mun"] == municipio)
    return df[mask].to_dict(orient="records")


# --------------------------------- Manual ---------------------------------

def leer_manual():
    if not RUTA_MANUAL.exists():
        return []
    with RUTA_MANUAL.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def leer_escuelas_manual(ruta=None):
    """Lee las coordenadas de escuelas por CCT.

    Devuelve dict cct -> (lat, lng). Ignora filas sin CCT o con lat/lng no
    numericos: esas escuelas se quedan con la coordenada de su localidad.
    """
    ruta = Path(ruta) if ruta else RUTA_ESCUELAS_MANUAL
    if not ruta.exists():
        return {}
    coords = {}
    with ruta.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            cct = str(r.get("cct") or "").strip()
            if not cct:
                continue
            try:
                lat = float(r["lat"])
                lng = float(r["lng"])
            except (KeyError, TypeError, ValueError):
                continue
            coords[cct] = (lat, lng)
    return coords


def aplicar_ubicacion_escuelas(escuelas, coords_por_cct):
    """Pone lat, lng y ubicacionAproximada=False a las escuelas con CCT en
    coords_por_cct. No cambia ningun otro campo, ni el orden ni el numero."""
    salida = []
    for e in escuelas:
        nueva = dict(e)
        if e["cct"] in coords_por_cct:
            nueva["lat"], nueva["lng"] = coords_por_cct[e["cct"]]
            nueva["ubicacionAproximada"] = False
        salida.append(nueva)
    return salida


# --------------------------------- Pipeline ---------------------------------

def construir_centros_y_localidades(alcance, iter_df, conapo_df, sep_df,
                                    clues_rows, denue_rows, manual_rows):
    ent = alcance["entidad"]
    mun = alcance["municipio"]
    enAlcance = set(alcance["enAlcance"])

    # Coordenadas por localidad (para fallback y para haversine).
    coords_por_loc = {}
    pobtot_por_loc = {}
    for _, r in iter_df.iterrows():
        loc = str(int(r["LOC"])).zfill(4)
        lat = gms_a_decimal(r["LATITUD"])
        lng = gms_a_decimal(r["LONGITUD"])
        if lat is not None and lng is not None:
            coords_por_loc[loc] = (lat, lng)
        pobtot_por_loc[loc] = _a_int_seguro(r["POBTOT"])

    # Georreferenciar CLUES.
    centros, uniones = georreferenciar_unidades(
        ent, mun, clues_rows, denue_rows, coords_por_loc, manual_rows,
    )

    # Unidades SSA con coordenadas para la distancia por localidad.
    ssa_con_coords = [
        c for c in centros
        if c["institucion"] == "SSA"
        and c["lat"] is not None
        and c["lng"] is not None
    ]

    def centro_ssa_mas_cercano(loc_clave, lat, lng):
        # Si la localidad tiene centro SSA propio, es el operativo (dist 0).
        propios = [c for c in ssa_con_coords if c["claveInegi"].endswith(loc_clave)]
        if propios:
            # Si hay varios SSA en la misma localidad, preferir tipologia A/B/C.
            propios.sort(key=lambda c: (c["tipologia"] not in ("A", "B", "C"), c["clues"]))
            return propios[0]["clues"], 0.0
        if lat is None or lng is None or not ssa_con_coords:
            return None, None
        mejor = min(ssa_con_coords, key=lambda c: haversine_km(lat, lng, c["lat"], c["lng"]))
        return mejor["clues"], round(haversine_km(lat, lng, mejor["lat"], mejor["lng"]), 3)

    # Matricula por localidad (suma de escuelas publicas primaria/secundaria).
    matricula_por_loc = (
        sep_df.groupby(sep_df["localidad"].astype(int))["insc_t"].sum().to_dict()
    )

    # Marginacion por localidad.
    gm_por_loc = {int(r["LOC"]): r["GM_2020"] for _, r in conapo_df.iterrows()}
    im_por_loc = {int(r["LOC"]): r["IM_2020"] for _, r in conapo_df.iterrows()}

    # Construir lista de localidades (todas las del municipio).
    localidades = []
    for _, r in iter_df.sort_values("LOC").iterrows():
        loc_int = int(r["LOC"])
        loc = str(loc_int).zfill(4)
        lat, lng = coords_por_loc.get(loc, (None, None))

        p3y = _a_int_seguro(r["P_3YMAS"])
        hli = _a_int_seguro(r["P3YM_HLI"])
        phog = _a_int_seguro(r["PHOG_IND"])
        pct_hli = round(hli / p3y * 100, 3) if p3y and p3y > 0 and hli is not None else None

        p5 = _a_int_seguro(r["P_5YMAS"])
        p15 = _a_int_seguro(r["P_15YMAS"])
        pob_5_14 = (p5 - p15) if p5 is not None and p15 is not None else None

        clues_op, dist = centro_ssa_mas_cercano(loc, lat, lng)

        localidades.append({
            "claveInegi": cve_loc(ent, mun, loc_int),
            "nombre": r["NOM_LOC"],
            "poblacion5a14": pob_5_14,
            "gradoMarginacion": gm_por_loc.get(loc_int),
            "im2020": float(im_por_loc[loc_int]) if loc_int in im_por_loc else None,
            "pctHLI": pct_hli,
            "phogInd": phog,
            "matricula": int(matricula_por_loc.get(loc_int, 0)),
            "distanciaKm": dist,
            "cluesOperativo": clues_op,
            "lat": lat,
            "lng": lng,
            "enAlcance": loc in enAlcance,
        })

    # Para las enAlcance, override: todas usan JCSSA004213 (SPI) como operativo.
    # (Es la decision operativa del equipo: SPI atiende las 3 localidades.)
    cluesOperativoEnAlcance = "JCSSA004213"
    for l in localidades:
        if l["enAlcance"]:
            # distanciaKm al operativo real (para el indice de prioridad).
            propio = next((c for c in ssa_con_coords if c["clues"] == cluesOperativoEnAlcance), None)
            if propio and l["lat"] is not None:
                if l["claveInegi"].endswith(f"{int(cluesOperativoEnAlcance_loc(cluesOperativoEnAlcance, centros)):04d}"):
                    l["distanciaKm"] = 0.0
                else:
                    l["distanciaKm"] = round(haversine_km(l["lat"], l["lng"], propio["lat"], propio["lng"]), 3)
            l["cluesOperativo"] = cluesOperativoEnAlcance

    return localidades, centros, uniones


def cluesOperativoEnAlcance_loc(clues_op, centros):
    """Dado un CLUES, devuelve el int de su localidad."""
    for c in centros:
        if c["clues"] == clues_op:
            return int(c["claveInegi"][-4:])
    return -1


def construir_escuelas(sep_df, enAlcance, localidades_por_clave, coords_por_cct=None):
    f = sep_df[sep_df["localidad"].astype(int).apply(lambda x: f"{x:04d}" in enAlcance)].copy()
    f = f.sort_values(["localidad", "nivel", "clave_cct"])
    salida = []
    for _, r in f.iterrows():
        loc_int = int(r["localidad"])
        loc_clave = f"14066{loc_int:04d}"  # defensive
        info = localidades_por_clave.get(loc_clave)
        salida.append({
            "cct": r["clave_cct"],
            "nombre": r["n_cct"].strip(),
            "nivel": r["nivel"],
            "subnivel": r["subnivel"],
            "turno": TURNOS.get(int(r["turno"]), str(r["turno"])),
            "claveInegi": loc_clave,
            "matricula": int(r["insc_t"]),
            "lat": info["lat"] if info else None,
            "lng": info["lng"] if info else None,
            "ubicacionAproximada": True,
        })
    return aplicar_ubicacion_escuelas(salida, coords_por_cct or {})


def construir_usuarios_demo(clues_operativo):
    """3 usuarios: 1 captura, 1 campo (ambos del clues operativo), 1 supervision."""
    return [
        {"id": "USR-CAP-01", "rol": "captura", "clues": clues_operativo},
        {"id": "USR-CAM-01", "rol": "campo", "clues": clues_operativo},
        {"id": "USR-SUP-01", "rol": "supervision", "clues": None},
    ]


# --------------------------------- I/O ---------------------------------

def escribir_json(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")


def escribir_uniones(uniones):
    PROCESADO.mkdir(parents=True, exist_ok=True)
    with RUTA_UNION.open("w", encoding="utf-8", newline="") as f:
        campos = ["clues", "nombre", "clave_denue", "puntaje", "metodo", "confianza"]
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        for row in uniones:
            w.writerow(row)


def main():
    alcance = leer_alcance()
    iter_df = leer_iter(alcance["entidad"], alcance["municipio"])
    conapo_df = leer_conapo(alcance["entidad"], alcance["municipio"])
    sep_df = leer_911(alcance["entidad"], alcance["municipio"])
    clues_rows = leer_clues(alcance["entidad"], alcance["municipio"])
    denue_rows = leer_denue(alcance["entidad"], alcance["municipio"])
    manual_rows = leer_manual()

    localidades, centros, uniones = construir_centros_y_localidades(
        alcance, iter_df, conapo_df, sep_df, clues_rows, denue_rows, manual_rows,
    )
    localidades_por_clave = {l["claveInegi"]: l for l in localidades}
    escuelas = construir_escuelas(
        sep_df, set(alcance["enAlcance"]), localidades_por_clave, leer_escuelas_manual(),
    )
    usuarios_demo = construir_usuarios_demo(clues_operativo="JCSSA004213")

    # localidades.json es lo que la app muestra: solo las que estan en alcance.
    # localidades_marco.json incluye todas las del municipio para que
    # calcularPrioridad tenga un marco de normalizacion amplio; no se muestra.
    localidades_alcance = [l for l in localidades if l["enAlcance"]]
    centros_visibles = [c for c in centros if c["clues"] == CLUES_VISIBLE]

    PUBLIC.mkdir(parents=True, exist_ok=True)
    escribir_json(PUBLIC / "localidades.json", localidades_alcance)
    escribir_json(PUBLIC / "localidades_marco.json", localidades)
    escribir_json(PUBLIC / "escuelas.json", escuelas)
    escribir_json(PUBLIC / "centros_salud.json", centros_visibles)
    escribir_json(PUBLIC / "usuarios_demo.json", usuarios_demo)
    escribir_uniones(uniones)

    # Resumen.
    print(f"Escritos en {PUBLIC.relative_to(RAIZ)}:")
    print(f"  localidades.json        -> {len(localidades_alcance)} en alcance (lo que muestra la app)")
    print(f"  localidades_marco.json  -> {len(localidades)} del municipio (marco para prioridad; no se muestra)")
    print(f"  escuelas.json           -> {len(escuelas)} CCT publicos primaria/secundaria en enAlcance")
    print(f"  centros_salud.json      -> {len(centros_visibles)} visible/s; preparadas internamente {len(centros)}")
    print(f"  usuarios_demo.json      -> {len(usuarios_demo)} usuarios (1 captura, 1 campo, 1 supervision)")
    print(f"  {RUTA_UNION.relative_to(RAIZ)} con {len(uniones)} uniones")
    print()
    print("Uniones por metodo:")
    por_metodo = {}
    for u in uniones:
        por_metodo[u["metodo"]] = por_metodo.get(u["metodo"], 0) + 1
    for m in ("manual", "denue", "unica_loc", "localidad", "sin_coords"):
        if m in por_metodo:
            print(f"  {m:12s} {por_metodo[m]}")
    print()
    print("Localidades enAlcance:")
    for l in localidades_alcance:
        print(
            f"  [{l['claveInegi']}] {l['nombre']:22s} "
            f"lat={l['lat']:.4f} lng={l['lng']:.4f} "
            f"pob5a14={l['poblacion5a14']} "
            f"IM={l['im2020']:.4f} GM={l['gradoMarginacion']} "
            f"%HLI={l['pctHLI']:.3f} PHOG_IND={l['phogInd']} "
            f"matric={l['matricula']} distKm={l['distanciaKm']} "
            f"cluesOp={l['cluesOperativo']}"
        )


def solo_ubicacion_escuelas():
    """Aplica georreferencia_escuelas.csv al escuelas.json ya generado, sin
    necesitar los datasets de data/raw. Solo cambia lat, lng y
    ubicacionAproximada de las escuelas que vienen en el CSV."""
    ruta = PUBLIC / "escuelas.json"
    escuelas = json.loads(ruta.read_text(encoding="utf-8"))
    coords = leer_escuelas_manual()
    escribir_json(ruta, aplicar_ubicacion_escuelas(escuelas, coords))
    cambiadas = sum(1 for e in escuelas if e["cct"] in coords)
    print(f"escuelas.json: {cambiadas} de {len(escuelas)} escuelas con ubicacion por CCT")


if __name__ == "__main__":
    import sys

    if "--solo-ubicacion-escuelas" in sys.argv:
        solo_ubicacion_escuelas()
    else:
        main()
