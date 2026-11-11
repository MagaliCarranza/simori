"""Genera casos simulados para los tres escenarios de perdida (11, 30, 50 %).

Todo el output es simulado y se marca con simulado=True. Lee los plazos y
umbrales del dominio desde src/domain/config.json y usa la misma formula
CKiD U25 que src/domain/ckid.js (verificada contra NIDDK / Pierce 2021).

Misma poblacion en los tres escenarios: ninos, resultados clinicos, u_confirm
y los tres uniformes de perdida (u_12, u_23, u_34) se generan UNA sola vez.
Para cada escenario con tasa p, un nino se pierde en un paso si su uniforme
de ese paso es menor que p. Asi, los perdidos al 11 % tambien estan perdidos
al 30 % y al 50 % (monotonia).

Uso:
    python scripts/simular_casos.py --semilla 2026 --hoy 2026-11-14

Salidas (public/data/):
    casos_11.json, casos_30.json, casos_50.json
"""

from __future__ import annotations

import argparse
import calendar
import json
import random
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOMINIO_CONFIG = RAIZ / "src" / "domain" / "config.json"
PUBLIC_DATA = RAIZ / "public" / "data"

# Fuentes de los defaults, documentadas en preguntas-abiertas.md y aqui.
DEFAULT_SEMILLA = 2026
DEFAULT_HOY = "2026-11-14"
# MIDE Jalisco 2103: 1039 de 1491 tamizados en 2026 (69.7 %).
DEFAULT_PARTICIPACION_TAMIZAJE = 0.697
# Agua Caliente: 180 de 394 persistentes positivos (Lozano-Kasten et al., 2017).
DEFAULT_TASA_POSITIVOS = 0.45
# Baquero 2023: proteinuria transitoria hasta en la mitad de los casos.
DEFAULT_TASA_CONFIRMACION = 0.50
# SSJ 2024: 2 de 26 diagnosticados cayeron en etapa G3 o mayor.
DEFAULT_TASA_TFGE_BAJA = 0.08
DEFAULT_ESCENARIOS = "11,30,50"

# Codigos cortos por localidad.
CLAVE_CORTA = {"140660002": "AC", "140660031": "SPI", "140660043": "CHA"}


# ----- CKiD U25 (portado de src/domain/ckid.js) -----

def coeficiente_k(sexo, edad_anios):
    if edad_anios >= 18:
        return 50.8 if sexo == "M" else 41.4
    base = 39.0 if sexo == "M" else 36.1
    if edad_anios >= 12:
        exp = 1.045 if sexo == "M" else 1.023
        return base * (exp ** (edad_anios - 12))
    return base * (1.008 ** (edad_anios - 12))


def tfge_ckid_u25(sexo, edad_anios, talla_cm, creatinina_mg_dl):
    if edad_anios < 1 or edad_anios >= 25:
        return None
    k = coeficiente_k(sexo, edad_anios)
    return k * (talla_cm / 100.0) / creatinina_mg_dl


def clasificar_tfg(tfge):
    if tfge is None:
        return None
    if tfge >= 90:
        return "G1"
    if tfge >= 60:
        return "G2"
    if tfge >= 45:
        return "G3a"
    if tfge >= 30:
        return "G3b"
    if tfge >= 15:
        return "G4"
    return "G5"


def categoria_a(cociente_mg_g):
    if cociente_mg_g < 30:
        return "A1"
    if cociente_mg_g <= 300:
        return "A2"
    return "A3"


# ----- Fechas -----

def edad_decimal(mes_nac, anio_nac, fecha_iso, dia_supuesto=15):
    nac = date(anio_nac, mes_nac, dia_supuesto)
    cuando = date.fromisoformat(fecha_iso)
    return (cuando - nac).days / 365.25


def sumar_dias_iso(fecha_iso, n):
    return (date.fromisoformat(fecha_iso) + timedelta(days=n)).isoformat()


def sumar_meses_iso(fecha_iso, n):
    """Suma n meses; si el dia no existe en el mes destino, clamp al ultimo dia."""
    d = date.fromisoformat(fecha_iso)
    total = d.year * 12 + (d.month - 1) + n
    y = total // 12
    m = total % 12 + 1
    dias_mes = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, dias_mes)).isoformat()


# ----- Catalogos -----

def cargar_entradas():
    escuelas = json.loads((PUBLIC_DATA / "escuelas.json").read_text(encoding="utf-8"))
    centros = json.loads((PUBLIC_DATA / "centros_salud.json").read_text(encoding="utf-8"))
    usuarios = json.loads((PUBLIC_DATA / "usuarios_demo.json").read_text(encoding="utf-8"))
    config = json.loads(DOMINIO_CONFIG.read_text(encoding="utf-8"))
    return escuelas, centros, usuarios, config


def centro_por_localidad(centros, clave_inegi):
    return next(c for c in centros if c["claveInegi"] == clave_inegi)


def usuarios_por_centro(usuarios, clues):
    return {
        "captura": next(u for u in usuarios if u["rol"] == "captura" and u["clues"] == clues),
        "campo": next(u for u in usuarios if u["rol"] == "campo" and u["clues"] == clues),
    }


# ----- Generacion base (comun a los tres escenarios) -----

def generar_poblacion(escuelas, centros, usuarios, rng, args):
    """Genera todos los casos positivos con sus datos clinicos y los uniformes de perdida.

    Devuelve (ninos, casos_base). `casos_base` incluye datos privados (_*) que
    se usan al expandir cada escenario.
    """
    fecha_min = date.fromisoformat("2026-02-01")
    fecha_max = date.fromisoformat("2026-10-31")
    dias_rango = (fecha_max - fecha_min).days
    tiras_positivas = [20, 50, 100]
    pesos_tiras = [0.60, 0.30, 0.10]

    ninos = []
    casos_base = []
    contador = {"SPI": 0, "AC": 0, "CHA": 0}

    for escuela in escuelas:
        matricula = escuela["matricula"]
        n_tamizados = round(matricula * args.participacion_tamizaje)
        n_positivos = round(n_tamizados * args.tasa_positivos)

        loc = CLAVE_CORTA[escuela["claveInegi"]]
        centro = centro_por_localidad(centros, escuela["claveInegi"])
        usrs = usuarios_por_centro(usuarios, centro["clues"])

        for _ in range(n_positivos):
            contador[loc] += 1
            n = contador[loc]
            codigo_nino = f"NIN-{loc}-{n:04d}"
            codigo_caso = f"PON-{loc}-{n:04d}"

            sexo = rng.choice(["M", "F"])
            anio_nac = rng.randint(2013, 2019)
            mes_nac = rng.randint(1, 12)

            fecha_tamizaje = (fecha_min + timedelta(days=rng.randint(0, dias_rango))).isoformat()
            tira_tamizaje = rng.choices(tiras_positivas, pesos_tiras, k=1)[0]

            # Uniformes fijos por nino (misma poblacion en los tres escenarios).
            u_12 = rng.random()
            u_23 = rng.random()
            u_34 = rng.random()
            u_confirm = rng.random()
            u_tfge_baja = rng.random()

            # Jitter clinico (fijo por nino, no por escenario).
            jitter_confirmacion = rng.randint(-5, 5)
            jitter_valoracion = rng.randint(15, 45)
            jitter_clasificacion = rng.randint(5, 20)
            dias_consentimiento = rng.randint(1, 15)

            edad_tamizaje = edad_decimal(mes_nac, anio_nac, fecha_tamizaje)
            talla_cm = round(100 + edad_tamizaje * 6 + rng.uniform(-5, 5), 1)
            peso_kg = round(15 + edad_tamizaje * 3 + rng.uniform(-3, 3), 1)
            cociente_alb = round(rng.uniform(30, 300), 1)  # A2 (persistente)

            # TFGe objetivo: 8 % cae en <60 (referido), resto en rango normal.
            if u_tfge_baja < args.tasa_tfge_baja:
                tfge_objetivo = rng.uniform(30, 59.9)
            else:
                tfge_objetivo = rng.uniform(65, 115)
            k = coeficiente_k(sexo, edad_tamizaje)
            # creatinina derivada para que TFGe ~ tfge_objetivo (dos decimales clinicos).
            creatinina = round(k * (talla_cm / 100.0) / tfge_objetivo, 2)

            ninos.append({
                "codigo": codigo_nino,
                "sexo": sexo,
                "mesNacimiento": mes_nac,
                "anioNacimiento": anio_nac,
            })

            casos_base.append({
                "codigo": codigo_caso,
                "codigoNino": codigo_nino,
                "cct": escuela["cct"],
                "clues": centro["clues"],
                "fechaTamizaje": fecha_tamizaje,
                "_sexo": sexo,
                "_mes_nac": mes_nac,
                "_anio_nac": anio_nac,
                "_talla_cm": talla_cm,
                "_peso_kg": peso_kg,
                "_creatinina": creatinina,
                "_cociente_alb": cociente_alb,
                "_tira_tamizaje": tira_tamizaje,
                "_u_12": u_12,
                "_u_23": u_23,
                "_u_34": u_34,
                "_u_confirm": u_confirm,
                "_u_tfge_baja": u_tfge_baja,
                "_jitter_confirmacion": jitter_confirmacion,
                "_jitter_valoracion": jitter_valoracion,
                "_jitter_clasificacion": jitter_clasificacion,
                "_dias_consentimiento": dias_consentimiento,
                "_usuarios": usrs,
            })

    return ninos, casos_base


# ----- Expansion por escenario -----

def _nuevo_caso(base):
    fecha_consent = sumar_dias_iso(base["fechaTamizaje"], -base["_dias_consentimiento"])
    return {
        "codigo": base["codigo"],
        "codigoNino": base["codigoNino"],
        "cct": base["cct"],
        "clues": base["clues"],
        "fechaTamizaje": base["fechaTamizaje"],
        "consentimientoTutor": True,
        "asentimientoNino": True,
        "fechaConsentimiento": fecha_consent,
        "fechaAsentimiento": fecha_consent,
        "simulado": True,
        "etapaActual": 1,
        "estado": "en_seguimiento",
        "fechaProximaCita": None,
    }


def expandir_escenario(escenario_pct, casos_base, args, rng_visitas):
    """Para un escenario (p%), filtra casos segun los uniformes y genera eventos."""
    p = escenario_pct / 100.0
    hoy = date.fromisoformat(args.hoy)
    casos_out = []
    eventos_out = []
    event_id = 1

    for base in casos_base:
        caso = _nuevo_caso(base)
        usr_cap = base["_usuarios"]["captura"]
        usr_cam = base["_usuarios"]["campo"]

        # Evento 1: tamizaje positivo (siempre).
        eventos_out.append({
            "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
            "etapa": 1, "fecha": caso["fechaTamizaje"], "tipo": "resultado",
            "tiraMgL": base["_tira_tamizaje"],
        })
        event_id += 1

        # Paso 1 -> 2: perdida.
        if base["_u_12"] < p:
            # Queda en etapa 1. Habia una cita de confirmacion agendada.
            caso["fechaProximaCita"] = sumar_dias_iso(caso["fechaTamizaje"], 84)
            casos_out.append(caso)
            continue

        # Etapa 2: confirmacion.
        fecha_confirm = sumar_dias_iso(caso["fechaTamizaje"], 84 + base["_jitter_confirmacion"])
        caso["etapaActual"] = 2
        if base["_u_confirm"] < args.tasa_confirmacion:
            tira_confirm = base["_tira_tamizaje"]  # persiste
        else:
            tira_confirm = 0  # no confirma

        eventos_out.append({
            "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
            "etapa": 2, "fecha": fecha_confirm, "tipo": "resultado",
            "tiraMgL": tira_confirm,
        })
        event_id += 1

        if tira_confirm == 0:
            eventos_out.append({
                "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
                "etapa": 2, "fecha": fecha_confirm, "tipo": "alta",
                "nota": "No confirmado",
            })
            event_id += 1
            caso["estado"] = "alta"
            casos_out.append(caso)
            continue

        # Paso 2 -> 3: perdida.
        if base["_u_23"] < p:
            casos_out.append(caso)
            continue

        # Etapa 3: valoracion.
        fecha_valor = sumar_dias_iso(fecha_confirm, base["_jitter_valoracion"])
        edad_val = edad_decimal(base["_mes_nac"], base["_anio_nac"], fecha_valor)
        tfge = tfge_ckid_u25(base["_sexo"], edad_val, base["_talla_cm"], base["_creatinina"])
        caso["etapaActual"] = 3

        eventos_out.append({
            "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
            "etapa": 3, "fecha": fecha_valor, "tipo": "resultado",
            "creatininaMgDl": base["_creatinina"],
            "tallaCm": base["_talla_cm"],
            "pesoKg": base["_peso_kg"],
            "tfge": round(tfge, 2) if tfge is not None else None,
        })
        event_id += 1

        # Paso 3 -> 4.
        if base["_u_34"] < p:
            casos_out.append(caso)
            continue

        # Etapa 4: clasificacion.
        fecha_clas = sumar_dias_iso(fecha_valor, base["_jitter_clasificacion"])
        cat_g = clasificar_tfg(tfge)
        cat_a = categoria_a(base["_cociente_alb"])
        caso["etapaActual"] = 4

        eventos_out.append({
            "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
            "etapa": 4, "fecha": fecha_clas, "tipo": "resultado",
            "creatininaMgDl": base["_creatinina"],
            "tallaCm": base["_talla_cm"],
            "pesoKg": base["_peso_kg"],
            "tfge": round(tfge, 2) if tfge is not None else None,
            "cocienteAlbCrea": base["_cociente_alb"],
            "categoriaG": cat_g,
            "categoriaA": cat_a,
        })
        event_id += 1

        # Salida: referencia si TFGe < 60; vigilancia en otro caso.
        if tfge is not None and tfge < 60:
            eventos_out.append({
                "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cap["id"],
                "etapa": 4, "fecha": fecha_clas, "tipo": "referencia",
            })
            event_id += 1
            caso["estado"] = "referido"
        else:
            caso["estado"] = "vigilancia"
            caso["fechaProximaCita"] = sumar_meses_iso(fecha_clas, 6)

        casos_out.append(caso)

    # Visitas de campo para algunos casos abiertos y con retraso.
    # Estrategia: si el ultimo resultado tiene >42 dias (rojo), con prob 30 %
    # agregamos 1 o 2 visitas no_localizada; 2 visitas pasan a sin_seguimiento.
    for caso in casos_out:
        if caso["estado"] != "en_seguimiento":
            continue
        resultados = [
            e for e in eventos_out
            if e["codigoCaso"] == caso["codigo"] and e["tipo"] == "resultado"
        ]
        if not resultados:
            continue
        ultima_res = max(e["fecha"] for e in resultados)
        dias_desde = (hoy - date.fromisoformat(ultima_res)).days

        # Usuario de campo del centro del caso.
        clues = caso["clues"]
        for base in casos_base:
            if base["clues"] == clues:
                usr_cam = base["_usuarios"]["campo"]
                break

        if dias_desde > 42 and rng_visitas.random() < 0.30:
            n_visitas = rng_visitas.randint(1, 2)
            for _ in range(n_visitas):
                dias_atras = rng_visitas.randint(1, min(30, dias_desde))
                fecha_v = (hoy - timedelta(days=dias_atras)).isoformat()
                eventos_out.append({
                    "id": event_id, "codigoCaso": caso["codigo"], "usuarioId": usr_cam["id"],
                    "etapa": caso["etapaActual"], "fecha": fecha_v, "tipo": "visita",
                    "visitaResultado": "no_localizada",
                })
                event_id += 1
            if n_visitas >= 2:
                caso["estado"] = "sin_seguimiento"
        elif dias_desde > 84:
            caso["estado"] = "sin_seguimiento"

    return casos_out, eventos_out


# ----- Resumen -----

def color_semaforo(caso, eventos_caso, hoy_iso):
    """Replica calcularSemaforo() del dominio JS. Devuelve 'verde'|'amarillo'|'rojo'|None."""
    if caso["estado"] in ("alta", "referido"):
        return None
    hoy = date.fromisoformat(hoy_iso)
    if caso.get("fechaProximaCita"):
        dias = (hoy - date.fromisoformat(caso["fechaProximaCita"])).days
        if dias <= 0:
            return "verde"
        if dias < 29:
            return "amarillo"
        return "rojo"
    resultados = [e for e in eventos_caso if e.get("tipo") == "resultado"]
    base = max((e["fecha"] for e in resultados), default=caso.get("fechaTamizaje"))
    if not base:
        return "verde"
    dias = (hoy - date.fromisoformat(base)).days
    if dias < 15:
        return "verde"
    if dias < 43:
        return "amarillo"
    return "rojo"


def resumen_escenario(casos, eventos, hoy_iso):
    por_etapa = {1: 0, 2: 0, 3: 0, 4: 0}
    estados = {"en_seguimiento": 0, "vigilancia": 0, "alta": 0, "referido": 0, "sin_seguimiento": 0}
    semaforo = {"verde": 0, "amarillo": 0, "rojo": 0, "sin_semaforo": 0}

    # Indexar eventos por caso una sola vez.
    eventos_por_caso = {}
    for e in eventos:
        eventos_por_caso.setdefault(e["codigoCaso"], []).append(e)

    for c in casos:
        por_etapa[c["etapaActual"]] = por_etapa.get(c["etapaActual"], 0) + 1
        estados[c["estado"]] = estados.get(c["estado"], 0) + 1
        color = color_semaforo(c, eventos_por_caso.get(c["codigo"], []), hoy_iso)
        if color is None:
            semaforo["sin_semaforo"] += 1
        else:
            semaforo[color] += 1

    completados = sum(1 for c in casos if c["etapaActual"] >= 4 or c["estado"] == "alta")
    pct_completado = (completados / len(casos) * 100) if casos else 0.0

    # Confirmados = casos que pasaron etapa 2 con tira positiva.
    # Son todos excepto los detenidos en etapa 1 y los que salieron por "alta" (no confirmado).
    confirmados = len(casos) - por_etapa[1] - estados["alta"]
    llegaron_clasif = por_etapa[4]
    pct_clasif = (llegaron_clasif / confirmados * 100) if confirmados else 0.0

    return {
        "casos": len(casos),
        "eventos": len(eventos),
        "por_etapa_actual": {
            "etapa1": por_etapa[1],
            "etapa2": por_etapa[2],
            "etapa3": por_etapa[3],
            "etapa4": por_etapa[4],
            "_nota": "Suma el total de casos (cada caso tiene una etapaActual, no solo los abiertos).",
        },
        "estados": estados,
        "semaforo_al_hoy": {
            **semaforo,
            "_nota": f"Semaforo evaluado a hoy={hoy_iso}. 'sin_semaforo' = casos cerrados (alta/referido).",
        },
        "confirmados": confirmados,
        "llegaron_a_clasificacion": llegaron_clasif,
        "porcentaje_confirmados_a_clasificacion": round(pct_clasif, 2),
        "porcentaje_completado_observado": round(pct_completado, 2),
    }


# ----- Entrada principal (expuesta para pytest) -----

def simular(args):
    escuelas, centros, usuarios, config = cargar_entradas()
    rng = random.Random(args.semilla)
    ninos, casos_base = generar_poblacion(escuelas, centros, usuarios, rng, args)

    escenarios = [int(x.strip()) for x in args.escenarios.split(",")]
    salidas = {}
    for e in escenarios:
        rng_vis = random.Random(args.semilla * 100 + e)
        casos, eventos = expandir_escenario(e, casos_base, args, rng_vis)
        # Teorico de referencia: (1 - p)^PASOS_ENTRE_ETAPAS * 100
        pct_teo = round((1 - e / 100) ** config["PASOS_ENTRE_ETAPAS"] * 100, 2)
        resumen = resumen_escenario(casos, eventos, args.hoy)
        resumen["porcentaje_completado_teorico"] = pct_teo
        salidas[e] = {
            "generadoISO": date.today().isoformat(),
            "hoy": args.hoy,
            "semilla": args.semilla,
            "escenario": e,
            "parametros": {
                "participacion_tamizaje": args.participacion_tamizaje,
                "tasa_positivos": args.tasa_positivos,
                "tasa_confirmacion": args.tasa_confirmacion,
                "tasa_tfge_baja": args.tasa_tfge_baja,
                "fuentes": {
                    "participacion_tamizaje": "MIDE Jalisco, indicador 2103 (2026): 1039 de 1491 (69.7 %)",
                    "tasa_positivos": "Lozano-Kasten et al. 2017, Agua Caliente: 180 de 394 (45.7 %)",
                    "tasa_confirmacion": "Baquero 2023: proteinuria transitoria en hasta la mitad",
                    "tasa_tfge_baja": "SSJ 2024: 2 de 26 diagnosticados cayeron en etapa 3 o mayor",
                },
            },
            "resumen": resumen,
            "ninos": ninos,
            "casos": casos,
            "eventos": eventos,
        }
    return salidas


def escribir_salidas(salidas):
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    rutas = []
    for e, datos in salidas.items():
        ruta = PUBLIC_DATA / f"casos_{e}.json"
        ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        rutas.append(ruta)
    return rutas


def imprimir_resumen(salidas):
    print()
    print("Por etapa actual (suma el total de casos):")
    print(f"  {'Escenario':<10}{'casos':>7}{'eventos':>9}{'etap1':>8}{'etap2':>8}{'etap3':>8}{'etap4':>8}")
    for e, datos in salidas.items():
        r = datos["resumen"]
        p = r["por_etapa_actual"]
        print(f"  {e:<10}{r['casos']:>7}{r['eventos']:>9}{p['etapa1']:>8}{p['etapa2']:>8}{p['etapa3']:>8}{p['etapa4']:>8}")

    print()
    print("Estados del caso:")
    print(f"  {'Escenario':<10}{'ref':>6}{'vig':>6}{'alta':>6}{'s/seg':>7}{'en_seg':>8}")
    for e, datos in salidas.items():
        s = datos["resumen"]["estados"]
        print(f"  {e:<10}{s['referido']:>6}{s['vigilancia']:>6}{s['alta']:>6}{s['sin_seguimiento']:>7}{s['en_seguimiento']:>8}")

    print()
    print(f"Semaforo al {next(iter(salidas.values()))['hoy']}:")
    print(f"  {'Escenario':<10}{'verde':>7}{'amarillo':>10}{'rojo':>7}{'sin sem.':>10}")
    for e, datos in salidas.items():
        s = datos["resumen"]["semaforo_al_hoy"]
        print(f"  {e:<10}{s['verde']:>7}{s['amarillo']:>10}{s['rojo']:>7}{s['sin_semaforo']:>10}")

    print()
    print("Progreso en la ruta:")
    print(f"  {'Escenario':<10}{'confirm':>9}{'a clasif':>10}{'% clasif':>10}{'% compl obs':>13}{'% compl teo':>13}")
    for e, datos in salidas.items():
        r = datos["resumen"]
        print(
            f"  {e:<10}{r['confirmados']:>9}{r['llegaron_a_clasificacion']:>10}"
            f"{r['porcentaje_confirmados_a_clasificacion']:>10.2f}"
            f"{r['porcentaje_completado_observado']:>13.2f}{r['porcentaje_completado_teorico']:>13.2f}"
        )


def main():
    parser = argparse.ArgumentParser(description="Simula casos para los tres escenarios de perdida.")
    parser.add_argument("--semilla", type=int, default=DEFAULT_SEMILLA)
    parser.add_argument("--hoy", type=str, default=DEFAULT_HOY)
    parser.add_argument("--escenarios", type=str, default=DEFAULT_ESCENARIOS)
    parser.add_argument("--participacion-tamizaje", type=float, default=DEFAULT_PARTICIPACION_TAMIZAJE, dest="participacion_tamizaje")
    parser.add_argument("--tasa-positivos", type=float, default=DEFAULT_TASA_POSITIVOS, dest="tasa_positivos")
    parser.add_argument("--tasa-confirmacion", type=float, default=DEFAULT_TASA_CONFIRMACION, dest="tasa_confirmacion")
    parser.add_argument("--tasa-tfge-baja", type=float, default=DEFAULT_TASA_TFGE_BAJA, dest="tasa_tfge_baja")
    args = parser.parse_args()

    salidas = simular(args)
    rutas = escribir_salidas(salidas)
    for r in rutas:
        print(f"Escrito {r.relative_to(RAIZ)}")
    imprimir_resumen(salidas)


if __name__ == "__main__":
    main()
