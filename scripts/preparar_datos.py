"""Prepara los catalogos reales para la app.

Lee los datasets de data/raw/ y escribe los JSON de catalogo que consume la PWA
en public/data/. Nunca inventa claves CCT, CLUES ni coordenadas; si no hay dato
real, deja el campo vacio con un marcador visible.

Uso:
    python scripts/preparar_datos.py

Salidas (public/data/):
    localidades.json       -- 3 localidades objetivo con lat/lng y GM 2020.
    escuelas.json          -- 8 CCT publicos primaria/secundaria con matricula.
    centros_salud.json     -- 3 centros PROVISIONALES (no hay dataset CLUES real).
    usuarios_demo.json     -- 7 usuarios demo (3 captura + 3 campo + 1 supervision).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"
OUT = RAIZ / "public" / "data"

ENTIDAD_JALISCO = 14
MUNICIPIO_PONCITLAN = 66
# Las tres localidades objetivo del estudio UdeG en Poncitlan.
LOCALIDADES_OBJETIVO = {
    2: {"clave_corta": "AC", "slug": "agua-caliente"},
    31: {"clave_corta": "SPI", "slug": "san-pedro-itzican"},
    43: {"clave_corta": "CHA", "slug": "chalpicote"},
}

RUTA_911 = RAW / "educacion_basica_2024_2025.csv"
RUTA_CONAPO = RAW / "IML_2020.xls"
RUTA_ITER = RAW / "iter_14_cpv2020" / "conjunto_de_datos" / "conjunto_de_datos_iter_14CSV20.csv"


def gms_a_decimal(valor):
    """Convierte coordenada GMS del ITER (p. ej. 20 grados 18' 45.244\" N) a decimal.

    El ITER trae el hemisferio al final (N/S para latitud, E/W para longitud).
    En Mexico latitud es N (+) y longitud es W (-).
    """
    if pd.isna(valor) or not isinstance(valor, str):
        return None
    patron = re.compile(
        r"\s*(\d+)[^\d]+"       # grados + separador (incluye el simbolo de grado aunque venga codificado raro)
        r"(\d+)['′\s]+"    # minutos
        r"([\d.]+)[\"″\s]*"  # segundos
        r"([NSEW])?\s*$"
    )
    m = patron.match(valor.strip())
    if not m:
        return None
    g, mi, se, hemi = m.groups()
    dec = int(g) + int(mi) / 60 + float(se) / 3600
    if hemi in ("S", "W"):
        dec = -dec
    return round(dec, 6)


def cve_loc(claveLocalidad):
    """Compone la clave INEGI de 9 digitos: ent(2) + mun(3) + loc(4)."""
    return f"{ENTIDAD_JALISCO:02d}{MUNICIPIO_PONCITLAN:03d}{claveLocalidad:04d}"


# ----------------------- Localidades -----------------------

def leer_iter():
    """Lee el ITER del Censo 2020 (Jalisco) y devuelve solo las 3 localidades."""
    cols = [
        "ENTIDAD", "MUN", "LOC", "NOM_LOC",
        "LATITUD", "LONGITUD",
        "POBTOT", "P_5YMAS", "P_15YMAS",
    ]
    df = pd.read_csv(RUTA_ITER, usecols=cols, low_memory=False, encoding="utf-8")
    mask = (
        (df["ENTIDAD"] == ENTIDAD_JALISCO)
        & (df["MUN"] == MUNICIPIO_PONCITLAN)
        & (df["LOC"].isin(LOCALIDADES_OBJETIVO.keys()))
    )
    return df[mask].copy()


def leer_conapo():
    """Lee el indice de marginacion CONAPO 2020 para las 3 localidades."""
    df = pd.read_excel(RUTA_CONAPO, sheet_name="IML_2020_AGS-MEX")
    mask = (
        (df["ENT"] == ENTIDAD_JALISCO)
        & (df["MUN"] == MUNICIPIO_PONCITLAN)
        & (df["LOC"].isin(LOCALIDADES_OBJETIVO.keys()))
    )
    return df[mask].copy()


def _a_int_seguro(valor):
    """Convierte a int tolerando '*' (confidencial) y vacios."""
    if pd.isna(valor):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def construir_localidades():
    iter_df = leer_iter()
    conapo = leer_conapo().set_index("LOC")
    salida = []
    for loc in LOCALIDADES_OBJETIVO:
        fila_iter = iter_df[iter_df["LOC"] == loc].iloc[0]
        p5 = _a_int_seguro(fila_iter["P_5YMAS"])
        p15 = _a_int_seguro(fila_iter["P_15YMAS"])
        pob_5_14 = (p5 - p15) if p5 is not None and p15 is not None else None
        salida.append({
            "claveInegi": cve_loc(loc),
            "nombre": fila_iter["NOM_LOC"],
            "poblacion5a14": pob_5_14,
            "gradoMarginacion": conapo.loc[loc, "GM_2020"] if loc in conapo.index else None,
            "lat": gms_a_decimal(fila_iter["LATITUD"]),
            "lng": gms_a_decimal(fila_iter["LONGITUD"]),
        })
    return salida


# ----------------------- Escuelas -----------------------

def construir_escuelas(localidades_por_loc):
    """Lee el 911 SEP y arma las escuelas publicas primaria/secundaria con matricula.

    El 911 esta en latin-1. Matutino y vespertino se tratan como escuelas
    distintas (asi lo registra la SEP: distinto CCT). Como el 911 no trae
    coordenadas, se usan las de la localidad con ubicacionAproximada=true.
    """
    cols = [
        "entidad", "municipio", "localidad", "n_localidad",
        "clave_cct", "n_cct", "nivel", "subnivel", "control", "turno", "insc_t",
    ]
    df = pd.read_csv(RUTA_911, usecols=cols, low_memory=False, encoding="latin-1")
    mask = (
        (df["entidad"] == ENTIDAD_JALISCO)
        & (df["municipio"] == MUNICIPIO_PONCITLAN)
        & (df["localidad"].isin(LOCALIDADES_OBJETIVO.keys()))
        & (df["nivel"].isin(["Primaria", "Secundaria"]))
        & df["control"].astype(str).str.contains("blico", na=False)  # "Publico"
        & (df["insc_t"] > 0)
    )
    f = df[mask].sort_values(["localidad", "nivel", "clave_cct"]).copy()
    turnos = {1: "matutino", 2: "vespertino", 3: "nocturno", 4: "discontinuo"}
    salida = []
    for _, r in f.iterrows():
        loc = int(r["localidad"])
        loc_data = localidades_por_loc[loc]
        salida.append({
            "cct": r["clave_cct"],
            "nombre": r["n_cct"].strip(),
            "nivel": r["nivel"],
            "subnivel": r["subnivel"],
            "turno": turnos.get(int(r["turno"]), str(r["turno"])),
            "claveInegi": loc_data["claveInegi"],
            "matricula": int(r["insc_t"]),
            "lat": loc_data["lat"],
            "lng": loc_data["lng"],
            "ubicacionAproximada": True,
        })
    return salida


# ----------------------- Centros de salud (provisionales) -----------------------

def construir_centros_salud(localidades_por_loc):
    """3 centros de salud de muestra, uno por localidad, hasta tener el dataset CLUES."""
    salida = []
    for loc, info in LOCALIDADES_OBJETIVO.items():
        loc_data = localidades_por_loc[loc]
        salida.append({
            "clues": f"PROV-{info['clave_corta']}-01",
            "nombre": f"Centro de Salud {loc_data['nombre']} (provisional)",
            "tipo": "primer_nivel",
            "claveInegi": loc_data["claveInegi"],
            "lat": loc_data["lat"],
            "lng": loc_data["lng"],
            "provisional": True,
        })
    return salida


# ----------------------- Usuarios demo -----------------------

def construir_usuarios_demo(centros):
    """7 usuarios: 3 captura (uno por centro) + 3 campo (uno por centro) + 1 supervision estatal."""
    salida = []
    for c in centros:
        corto = c["clues"].split("-")[1]  # SPI / AC / CHA
        salida.append({"id": f"USR-CAP-{corto}", "rol": "captura", "clues": c["clues"]})
    for c in centros:
        corto = c["clues"].split("-")[1]
        salida.append({"id": f"USR-CAM-{corto}", "rol": "campo", "clues": c["clues"]})
    # Supervision = Epidemiologia estatal, sin clues.
    salida.append({"id": "USR-SUP-JAL", "rol": "supervision", "clues": None})
    return salida


# ----------------------- Main -----------------------

def escribir_json(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    localidades = construir_localidades()
    localidades_por_loc = {
        int(l["claveInegi"][-4:]): l for l in localidades
    }
    escuelas = construir_escuelas(localidades_por_loc)
    centros_salud = construir_centros_salud(localidades_por_loc)
    usuarios_demo = construir_usuarios_demo(centros_salud)

    escribir_json(OUT / "localidades.json", localidades)
    escribir_json(OUT / "escuelas.json", escuelas)
    escribir_json(OUT / "centros_salud.json", centros_salud)
    escribir_json(OUT / "usuarios_demo.json", usuarios_demo)

    # Resumen.
    print(f"Escritos en {OUT.relative_to(RAIZ)}:")
    print(f"  localidades.json     -> {len(localidades)}  (Agua Caliente, San Pedro Itzican, Chalpicote)")
    print(f"  escuelas.json        -> {len(escuelas)}  CCT publicos primaria/secundaria con matricula")
    print(f"  centros_salud.json   -> {len(centros_salud)}  PROVISIONALES (sin dataset CLUES)")
    print(f"  usuarios_demo.json   -> {len(usuarios_demo)}  usuarios (3 captura, 3 campo, 1 supervision)")
    print()
    print("Localidades:")
    for l in localidades:
        print(f"  [{l['claveInegi']}] {l['nombre']:22s}  lat={l['lat']:.4f}  lng={l['lng']:.4f}  "
              f"pob5a14={l['poblacion5a14']}  GM={l['gradoMarginacion']}")
    print()
    print(f"Matricula total (universo de tamizaje): {sum(e['matricula'] for e in escuelas)} estudiantes")


if __name__ == "__main__":
    main()
