"""Agrupa las localidades del municipio con k-means.

Entrada:
    public/data/localidades_marco.json    Todas las localidades del municipio
                                          (salida de preparar_datos.py).
    data/procesado/union_clues_denue.csv  Confianza de la georreferencia de
                                          cada unidad CLUES.

Salida:
    public/data/grupos_localidades.json   Grupo de cada localidad con las
                                          variables completas, descripción de
                                          cada grupo y diagnóstico del modelo.

Variables (las mismas del índice de prioridad):
    im2020       Marginación CONAPO 2020 (más alto = MENOS marginación).
    distanciaKm  Línea recta a la unidad SSA más cercana.
    matricula    Matrícula pública de primaria y secundaria.
    pctHLI       % de población de 3 años o más que habla lengua indígena.

Se estandarizan (media 0, desviación 1) y se prueba k = 2..5. Se descarta
cualquier k que deje un grupo con menos de TAMANO_MINIMO localidades: con
pocas localidades atípicas (por ejemplo, la única con hablantes de lengua
indígena) la silueta puede salir alta sin que los grupos digan nada. Si con
las cuatro variables no queda ninguna k válida, se repite sin pctHLI.

Por omisión se elige la k válida de mayor silueta. Con --k se fija otra k
(debe ser válida) y con --motivo se explica por qué; ambos quedan en el JSON.

Uso:
    python scripts/agrupar_localidades.py --k 3 --motivo "k = 2 tuvo mayor silueta pero solo separaba localidades grandes de pequeñas"

Distancia: para las localidades del piloto, distanciaKm se mide a JCSSA004213
(centro operativo). Se verificó con las coordenadas de las localidades que
tienen centro SSA propio que JCSSA004213 también es la unidad más cercana a
Agua Caliente y Chalpicote, por lo que distanciaKm sirve tal cual para las
40 localidades.

Agrupa localidades, no personas, y no usa datos clínicos.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

RAIZ = Path(__file__).resolve().parent.parent
RUTA_MARCO = RAIZ / "public" / "data" / "localidades_marco.json"
RUTA_UNION = RAIZ / "data" / "procesado" / "union_clues_denue.csv"
RUTA_SALIDA = RAIZ / "public" / "data" / "grupos_localidades.json"

VARIABLES = ["im2020", "distanciaKm", "matricula", "pctHLI"]
VARIABLES_SIN_HLI = ["im2020", "distanciaKm", "matricula"]
KS = range(2, 6)
TAMANO_MINIMO = 3
SEMILLA = 42

# Un grupo se describe como "alto" o "bajo" en una variable si su promedio
# estandarizado se aleja al menos medio desvío del promedio del municipio.
UMBRAL_DESCRIPCION = 0.5

# "Con hablantes de lengua indígena" solo si el promedio del grupo llega al
# mismo mínimo que usa el índice de prioridad (src/domain/config.json). En
# Poncitlán casi todo es ~0 %, y un z alto no significa muchos hablantes.
RUTA_CONFIG = RAIZ / "src" / "domain" / "config.json"
HLI_MIN_DESCRIPCION = json.loads(RUTA_CONFIG.read_text(encoding="utf-8"))["PRIORIDAD"]["HLI_MIN_PARA_RAZON"]

NOTA_DISTANCIA = (
    "distanciaKm es línea recta (haversine) a la unidad SSA más cercana. "
    "Para Agua Caliente y Chalpicote se mide a JCSSA004213; se verificó de "
    "forma aproximada (coordenadas de las localidades con centro SSA propio) "
    "que es también su unidad más cercana."
)


# ------------------------------- Datos -------------------------------

def leer_marco(ruta=RUTA_MARCO):
    return json.loads(Path(ruta).read_text(encoding="utf-8"))


def leer_confianza(ruta=RUTA_UNION):
    """Devuelve {clues: confianza} del resumen de la unión CLUES/DENUE."""
    ruta = Path(ruta)
    if not ruta.exists():
        return {}
    with ruta.open(encoding="utf-8") as f:
        return {r["clues"]: r["confianza"] for r in csv.DictReader(f)}


def es_numero(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and np.isfinite(x)


def localidades_completas(marco, variables=VARIABLES):
    return [l for l in marco if all(es_numero(l.get(v)) for v in variables)]


# ------------------------------ Modelo ------------------------------

def probar_k(X, ks=KS, tamano_minimo=TAMANO_MINIMO, semilla=SEMILLA):
    """Ajusta k-means para cada k y devuelve el diagnóstico de cada una."""
    pruebas = []
    for k in ks:
        if k >= len(X):
            continue
        modelo = KMeans(n_clusters=k, n_init=10, random_state=semilla).fit(X)
        tamanos = np.bincount(modelo.labels_, minlength=k).tolist()
        pruebas.append({
            "k": k,
            "silueta": round(float(silhouette_score(X, modelo.labels_)), 4),
            "tamanos": sorted(tamanos, reverse=True),
            "valida": min(tamanos) >= tamano_minimo,
            "_modelo": modelo,
        })
    return pruebas


def elegir(pruebas, k_fija=None):
    """Mayor silueta entre las k válidas, o la k fija si es válida."""
    validas = [p for p in pruebas if p["valida"]]
    if k_fija is not None:
        return next((p for p in validas if p["k"] == k_fija), None)
    if not validas:
        return None
    return max(validas, key=lambda p: (p["silueta"], -p["k"]))


ORDEN_GRADOS = ["Muy alto", "Alto", "Medio", "Bajo", "Muy bajo"]


def conteo_grados(localidades):
    """Cuántas localidades hay de cada grado CONAPO, de Muy alto a Muy bajo."""
    conteo = {g: 0 for g in ORDEN_GRADOS + ["Sin dato"]}
    for l in localidades:
        g = l.get("gradoMarginacion")
        conteo[g if g in ORDEN_GRADOS else "Sin dato"] += 1
    return {g: n for g, n in conteo.items() if n > 0}


def describir(z_centro, centro, variables):
    """Texto corto del grupo a partir de su centroide (estandarizado y real).

    Solo nombra los rasgos en que el grupo se aleja del promedio del
    municipio; los intermedios se omiten. Si ninguno se aleja, devuelve "".
    """
    def nivel(z, alto, bajo):
        if z >= UMBRAL_DESCRIPCION:
            return alto
        if z <= -UMBRAL_DESCRIPCION:
            return bajo
        return None

    partes = []
    z = dict(zip(variables, z_centro))
    if "im2020" in z:
        # im2020 alto = menos marginación, por eso se invierte el signo.
        partes.append(nivel(-z["im2020"], "marginación más alta del municipio", "marginación más baja del municipio"))
    if "distanciaKm" in z:
        partes.append(nivel(z["distanciaKm"], "más lejos de la unidad de salud", "más cerca de la unidad de salud"))
    if "matricula" in z:
        partes.append(nivel(z["matricula"], "matrícula más alta", "matrícula más baja"))
    partes = [p for p in partes if p]
    real = dict(zip(variables, centro))
    if "pctHLI" in z and z["pctHLI"] >= UMBRAL_DESCRIPCION and real["pctHLI"] >= HLI_MIN_DESCRIPCION:
        partes.append("con hablantes de lengua indígena")
    return ", ".join(partes)


def agrupar(marco, confianza=None, k_fija=None, motivo=None):
    """Corre el agrupamiento completo y devuelve el dict que se guarda.

    k_fija: usa esa k en lugar de la de mayor silueta (debe ser válida).
    motivo: explicación de por qué se fijó la k; se antepone
            "elegida por interpretabilidad".
    """
    confianza = confianza or {}
    completas = localidades_completas(marco, VARIABLES)

    intentos = []
    elegida = None
    variables = VARIABLES
    for vars_intento in (VARIABLES, VARIABLES_SIN_HLI):
        X_crudo = np.array([[l[v] for v in vars_intento] for l in completas], dtype=float)
        escalador = StandardScaler().fit(X_crudo)
        X = escalador.transform(X_crudo)
        pruebas = probar_k(X)
        intentos.append({"variables": list(vars_intento), "pruebas": pruebas})
        elegida = elegir(pruebas, k_fija)
        if elegida is not None:
            variables = vars_intento
            break

    if elegida is None:
        que = f"k = {k_fija}" if k_fija is not None else f"Ninguna k de {list(KS)}"
        raise RuntimeError(
            f"{que} no deja grupos de al menos {TAMANO_MINIMO} localidades, "
            "ni con ni sin lengua indígena."
        )

    if k_fija is None:
        motivo_k = "mayor silueta"
    else:
        motivo_k = "elegida por interpretabilidad" + (f": {motivo}" if motivo else "")

    modelo = elegida["_modelo"]
    centros_z = modelo.cluster_centers_
    centros = escalador.inverse_transform(centros_z)

    # Numerar los grupos de forma estable: 1 = más marginado (im2020 más bajo).
    orden = np.argsort(centros[:, variables.index("im2020")])
    renumerar = {int(viejo): nuevo + 1 for nuevo, viejo in enumerate(orden)}
    etiquetas = [renumerar[int(e)] for e in modelo.labels_]

    grupos = []
    for viejo in orden:
        num = renumerar[int(viejo)]
        miembros = [l for l, g in zip(completas, etiquetas) if g == num]
        grupos.append({
            "grupo": num,
            "tamano": len(miembros),
            "descripcion": describir(centros_z[viejo], centros[viejo], variables),
            # Promedios reales de las 4 variables, aunque alguna no se haya usado.
            "promedios": {v: round(float(np.mean([l[v] for l in miembros])), 3) for v in VARIABLES},
            "gradosConapo": conteo_grados(miembros),
        })

    baja = sum(1 for l in completas if confianza.get(l.get("cluesOperativo")) == "baja")

    return {
        "metodo": "k-means (scikit-learn) sobre variables estandarizadas",
        "semilla": SEMILLA,
        "tamanoMinimoGrupo": TAMANO_MINIMO,
        "variablesCandidatas": VARIABLES,
        "variablesUsadas": list(variables),
        "seQuitoLenguaIndigena": "pctHLI" not in variables,
        "totalLocalidades": len(marco),
        "localidadesCompletas": len(completas),
        "localidadesConUnidadConfianzaBaja": baja,
        "notaDistancia": NOTA_DISTANCIA,
        "kElegida": elegida["k"],
        "motivoK": motivo_k,
        "silueta": elegida["silueta"],
        "siluetasProbadas": {str(p["k"]): p["silueta"] for p in intentos[-1]["pruebas"]},
        "notaDescripcion": (
            "Las descripciones comparan el promedio del grupo con el promedio de las "
            "localidades agrupadas del municipio; no equivalen al grado de CONAPO."
        ),
        "intentos": [
            {
                "variables": i["variables"],
                "pruebas": [{k: v for k, v in p.items() if k != "_modelo"} for p in i["pruebas"]],
            }
            for i in intentos
        ],
        "grupos": grupos,
        "localidades": [
            {"claveInegi": l["claveInegi"], "nombre": l["nombre"], "grupo": g, "enAlcance": bool(l.get("enAlcance"))}
            for l, g in zip(completas, etiquetas)
        ],
    }


# ------------------------------ Salida ------------------------------

def escribir_json(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")


def imprimir_resumen(r):
    print(f"Localidades: {r['totalLocalidades']} del municipio, {r['localidadesCompletas']} con las 4 variables")
    print(f"Con unidad más cercana de confianza baja: {r['localidadesConUnidadConfianzaBaja']}")
    for i in r["intentos"]:
        print(f"\nVariables: {', '.join(i['variables'])}")
        for p in i["pruebas"]:
            marca = "ok" if p["valida"] else f"descartada (grupo < {r['tamanoMinimoGrupo']})"
            print(f"  k={p['k']}  silueta={p['silueta']:.4f}  tamaños={p['tamanos']}  {marca}")
    print(f"\nk elegida: {r['kElegida']}  silueta: {r['silueta']:.4f}")
    print(f"Motivo: {r['motivoK']}")
    print(f"Variables usadas: {', '.join(r['variablesUsadas'])}")
    for g in r["grupos"]:
        p = g["promedios"]
        grados = ", ".join(f"{n} {grado}" for grado, n in g["gradosConapo"].items())
        print(f"  Grupo {g['grupo']} ({g['tamano']} localidades): {g['descripcion']}")
        print(f"    im2020={p['im2020']:.2f}  distancia={p['distanciaKm']:.2f} km  "
              f"matrícula={p['matricula']:.0f}  HLI={p['pctHLI']:.3f} %  | CONAPO: {grados}")
    print("\nLocalidades del piloto:")
    for l in r["localidades"]:
        if l["enAlcance"]:
            print(f"  {l['nombre']}: grupo {l['grupo']}")


def leer_argumentos(argv=None):
    parser = argparse.ArgumentParser(description="Agrupa las localidades del municipio con k-means.")
    parser.add_argument("--k", type=int, choices=list(KS),
                        help="Fija la k en lugar de elegir la de mayor silueta.")
    parser.add_argument("--motivo",
                        help='Por qué se fijó la k; se guarda como "elegida por interpretabilidad: <motivo>".')
    args = parser.parse_args(argv)
    if args.motivo and args.k is None:
        parser.error("--motivo solo tiene sentido junto con --k")
    return args


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = leer_argumentos(argv)
    resultado = agrupar(leer_marco(), leer_confianza(), k_fija=args.k, motivo=args.motivo)
    escribir_json(RUTA_SALIDA, resultado)
    imprimir_resumen(resultado)
    print(f"\nEscrito: {RUTA_SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
