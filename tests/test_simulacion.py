"""Pruebas del simulador de casos.

Determinismo (RNF09): misma semilla, mismos parametros -> misma salida.
Tambien verificamos los 4 casos de CKiD U25 contra los valores del dominio en JS.
"""
import copy
from datetime import date
from types import SimpleNamespace

import pytest

from simular_casos import simular, tfge_ckid_u25


def _args_default():
    return SimpleNamespace(
        semilla=2026,
        hoy="2026-11-14",
        escenarios="11,30,50",
        participacion_tamizaje=0.697,
        tasa_positivos=0.45,
        tasa_confirmacion=0.50,
        tasa_tfge_baja=0.08,
    )


def _sin_metadata(salidas):
    """Quita campos no deterministas antes de comparar."""
    s = copy.deepcopy(salidas)
    for esc in s.values():
        esc.pop("generadoISO", None)
    return s


def test_misma_semilla_misma_salida():
    a = simular(_args_default())
    b = simular(_args_default())
    assert _sin_metadata(a) == _sin_metadata(b)


def test_semillas_distintas_producen_salidas_distintas():
    args_a = _args_default()
    args_b = _args_default()
    args_b.semilla = 42
    a = simular(args_a)
    b = simular(args_b)
    # Al menos un escenario tiene que diferir en algo.
    assert _sin_metadata(a) != _sin_metadata(b)


def test_monotonia_entre_escenarios():
    """Los perdidos al 11 % tambien lo estan al 30 % y 50 %. La poblacion es la misma."""
    s = simular(_args_default())
    # Mismos ninos en los 3.
    assert s[11]["ninos"] == s[30]["ninos"] == s[50]["ninos"]
    # Mismos codigos de caso.
    codigos = lambda d: {c["codigo"] for c in d["casos"]}
    assert codigos(s[11]) == codigos(s[30]) == codigos(s[50])
    # La etapa alcanzada en 11 >= 30 >= 50 para cada caso (monotonia).
    etapa = lambda d: {c["codigo"]: c["etapaActual"] for c in d["casos"]}
    e11, e30, e50 = etapa(s[11]), etapa(s[30]), etapa(s[50])
    for cod in e11:
        assert e11[cod] >= e30[cod] >= e50[cod], f"Monotonia rota en {cod}"


# Los mismos 4 casos verificados contra NIDDK / Pierce 2021 en ckid.test.js.
@pytest.mark.parametrize("sexo,edad,talla,creat,esperado", [
    ("M", 10, 140, 0.5, 107.47),
    ("F", 8, 130, 0.4, 113.64),
    ("M", 15, 165, 0.8, 91.79),
    ("M", 18, 170, 1.0, 86.36),
])
def test_ckid_u25_coincide_con_dominio_js(sexo, edad, talla, creat, esperado):
    tfge = tfge_ckid_u25(sexo, edad, talla, creat)
    assert tfge is not None
    assert abs(tfge - esperado) < 0.1


def test_ckid_u25_fuera_de_rango_devuelve_none():
    assert tfge_ckid_u25("M", 0.5, 70, 0.3) is None
    assert tfge_ckid_u25("M", 25, 175, 1.0) is None
    assert tfge_ckid_u25("F", 30, 165, 0.9) is None


@pytest.fixture(scope="module")
def salidas_default():
    return simular(_args_default())


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_ningun_evento_posterior_a_hoy(salidas_default, escenario):
    hoy = date.fromisoformat(_args_default().hoy)
    datos = salidas_default[escenario]
    futuros = [e for e in datos["eventos"] if date.fromisoformat(e["fecha"]) > hoy]
    assert futuros == [], (
        f"Escenario {escenario} %: {len(futuros)} eventos con fecha posterior a {hoy}"
    )


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_casos_esperando_siguiente_etapa_estan_en_seguimiento(salidas_default, escenario):
    """Los casos en etapas 1-3 con cita futura estan esperando, en_seguimiento.
    No se cuenta vigilancia porque esa cita (+6 meses) marca la siguiente
    revision de un caso ya clasificado, no una etapa pendiente."""
    hoy = date.fromisoformat(_args_default().hoy)
    datos = salidas_default[escenario]
    esperando = [
        c for c in datos["casos"]
        if c.get("fechaProximaCita")
        and date.fromisoformat(c["fechaProximaCita"]) > hoy
        and c["etapaActual"] < 4
    ]
    assert esperando, f"Escenario {escenario} %: ningun caso esperando cita futura"
    for c in esperando:
        assert c["estado"] == "en_seguimiento", (
            f"{c['codigo']} esperando cita futura pero estado {c['estado']!r}"
        )


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_grupos_al_hoy_suman_total(salidas_default, escenario):
    """Los cuatro grupos titular son disjuntos y cubren todos los casos."""
    datos = salidas_default[escenario]
    total = len(datos["casos"])
    g = datos["resumen"]["grupos_al_hoy"]
    suma = (
        g["completo_evaluacion"]["n"]
        + g["en_proceso_a_tiempo"]["n"]
        + g["retraso_moderado"]["n"]
        + g["perdido_o_retraso_alto"]["n"]
    )
    assert suma == total, (
        f"Escenario {escenario} %: suma de grupos {suma} != total {total}"
    )


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_por_etapa_actual_suma_total(salidas_default, escenario):
    """Cada caso tiene una etapaActual (1..4): el desglose cubre a todos."""
    datos = salidas_default[escenario]
    total = len(datos["casos"])
    p = datos["resumen"]["por_etapa_actual"]
    suma = p["etapa1"] + p["etapa2"] + p["etapa3"] + p["etapa4"]
    assert suma == total, (
        f"Escenario {escenario} %: suma por etapa {suma} != total {total}"
    )


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_estados_suman_total(salidas_default, escenario):
    """Los cinco estados son disjuntos y cubren a todos los casos."""
    datos = salidas_default[escenario]
    total = len(datos["casos"])
    e = datos["resumen"]["estados"]
    suma = e["en_seguimiento"] + e["vigilancia"] + e["alta"] + e["referido"] + e["sin_seguimiento"]
    assert suma == total, (
        f"Escenario {escenario} %: suma de estados {suma} != total {total}"
    )


@pytest.mark.parametrize("escenario", [11, 30, 50])
def test_semaforo_al_hoy_suma_total(salidas_default, escenario):
    """Cada caso cae en un color (verde/amarillo/rojo) o en sin_semaforo (cerrados)."""
    datos = salidas_default[escenario]
    total = len(datos["casos"])
    s = datos["resumen"]["semaforo_al_hoy"]
    suma = s["verde"] + s["amarillo"] + s["rojo"] + s["sin_semaforo"]
    assert suma == total, (
        f"Escenario {escenario} %: suma del semaforo {suma} != total {total}"
    )


def test_citas_futuras_no_aumentan_con_la_perdida(salidas_default):
    """Mas perdida -> menos (o igual) casos con cita futura; ninguno gana cita."""
    hoy = date.fromisoformat(_args_default().hoy)

    def cita_futura_por_codigo(datos):
        return {
            c["codigo"]: c["fechaProximaCita"]
            for c in datos["casos"]
            if c.get("fechaProximaCita") and date.fromisoformat(c["fechaProximaCita"]) > hoy
        }

    f11 = cita_futura_por_codigo(salidas_default[11])
    f30 = cita_futura_por_codigo(salidas_default[30])
    f50 = cita_futura_por_codigo(salidas_default[50])

    assert len(f11) >= len(f30) >= len(f50), (
        f"Total citas futuras no monotonico: 11={len(f11)} 30={len(f30)} 50={len(f50)}"
    )
    # Ningun caso puede "ganar" cita futura al subir la perdida: si un caso
    # tiene cita futura en el 30 %, debe tenerla tambien en el 11 % (misma
    # fecha, porque los uniformes son compartidos).
    for cod, fecha in f30.items():
        assert f11.get(cod) == fecha, f"{cod} gana/cambia cita futura al pasar de 11 a 30"
    for cod, fecha in f50.items():
        assert f11.get(cod) == fecha, f"{cod} gana/cambia cita futura al pasar de 11 a 50"
