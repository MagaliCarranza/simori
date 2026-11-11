"""Pruebas del simulador de casos.

Determinismo (RNF09): misma semilla, mismos parametros -> misma salida.
Tambien verificamos los 4 casos de CKiD U25 contra los valores del dominio en JS.
"""
import copy
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
