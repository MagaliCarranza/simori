"""Pruebas del agrupamiento k-means de localidades.

Se corren sobre localidades_marco.json real (el mismo que usa el script) y
sobre un marco pequeño hecho a mano para los casos de borde.
"""
import json

import pytest

import agrupar_localidades as al

MOTIVO = "k = 2 tuvo mayor silueta pero solo separaba localidades grandes de pequeñas"


@pytest.fixture(scope="module")
def marco():
    return al.leer_marco()


@pytest.fixture(scope="module")
def resultado_k3(marco):
    return al.agrupar(marco, al.leer_confianza(), k_fija=3, motivo=MOTIVO)


def _localidad(clave, im2020, distancia, matricula, hli, grado="Medio"):
    return {
        "claveInegi": clave,
        "nombre": f"Localidad {clave}",
        "im2020": im2020,
        "distanciaKm": distancia,
        "matricula": matricula,
        "pctHLI": hli,
        "gradoMarginacion": grado,
        "cluesOperativo": None,
        "enAlcance": False,
    }


def _marco_sintetico():
    """Tres bloques de 4 localidades bien separados y 2 sin datos."""
    locs = []
    bloques = [(18.0, 6.0, 50, 0.0), (21.0, 3.0, 200, 0.0), (24.0, 0.5, 900, 0.0)]
    for b, (im, dist, mat, hli) in enumerate(bloques):
        for i in range(4):
            locs.append(_localidad(f"{b}{i}", im + i * 0.1, dist + i * 0.1, mat + i, hli))
    locs.append(_localidad("x1", None, 1.0, 10, 0.0))
    locs.append(_localidad("x2", 20.0, None, 10, 0.0))
    return locs


# ------------------------- Con los datos reales -------------------------

def test_todas_las_localidades_completas_tienen_grupo(marco, resultado_k3):
    completas = {l["claveInegi"] for l in al.localidades_completas(marco)}
    agrupadas = {l["claveInegi"] for l in resultado_k3["localidades"]}
    assert agrupadas == completas
    assert resultado_k3["localidadesCompletas"] == len(completas)
    assert resultado_k3["totalLocalidades"] == len(marco)


def test_ningun_grupo_tiene_menos_de_3_localidades(resultado_k3):
    tamanos = [g["tamano"] for g in resultado_k3["grupos"]]
    assert min(tamanos) >= al.TAMANO_MINIMO
    assert sum(tamanos) == resultado_k3["localidadesCompletas"]


def test_la_k_por_omision_tampoco_deja_grupos_chicos(marco):
    r = al.agrupar(marco, al.leer_confianza())
    assert r["motivoK"] == "mayor silueta"
    assert min(g["tamano"] for g in r["grupos"]) >= al.TAMANO_MINIMO


def test_las_k_descartadas_tienen_un_grupo_chico(resultado_k3):
    for intento in resultado_k3["intentos"]:
        for p in intento["pruebas"]:
            assert p["valida"] == (min(p["tamanos"]) >= al.TAMANO_MINIMO)


def test_con_k3_el_resultado_es_el_mismo_en_cada_corrida(marco):
    args = al.leer_argumentos(["--k", "3", "--motivo", MOTIVO])
    corridas = [
        al.agrupar(marco, al.leer_confianza(), k_fija=args.k, motivo=args.motivo)
        for _ in range(3)
    ]
    assert corridas[0] == corridas[1] == corridas[2]
    assert corridas[0]["kElegida"] == 3
    assert corridas[0]["motivoK"] == f"elegida por interpretabilidad: {MOTIVO}"


def test_guarda_la_silueta_de_todas_las_k_probadas(resultado_k3):
    assert set(resultado_k3["siluetasProbadas"]) == {str(k) for k in al.KS}


def test_el_json_publicado_esta_al_dia(resultado_k3):
    # Si falla, se cambió localidades_marco.json (o el script) sin volver a
    # correr agrupar_localidades.py con el comando del README.
    publicado = json.loads(al.RUTA_SALIDA.read_text(encoding="utf-8"))
    assert publicado == resultado_k3


# ------------------------ Con un marco sintético ------------------------

def test_las_localidades_sin_datos_quedan_fuera():
    r = al.agrupar(_marco_sintetico(), k_fija=3)
    claves = {l["claveInegi"] for l in r["localidades"]}
    assert "x1" not in claves and "x2" not in claves
    assert r["totalLocalidades"] == 14
    assert r["localidadesCompletas"] == 12


def test_grupo_1_es_el_mas_marginado():
    r = al.agrupar(_marco_sintetico(), k_fija=3)
    promedios = [g["promedios"]["im2020"] for g in r["grupos"]]
    assert promedios == sorted(promedios)
    assert r["grupos"][0]["descripcion"].startswith("marginación más alta del municipio")


def test_k_fija_que_deja_grupos_chicos_da_error():
    # 12 localidades en 5 grupos: forzosamente alguno queda con menos de 3.
    with pytest.raises(RuntimeError):
        al.agrupar(_marco_sintetico(), k_fija=5)


def test_lengua_indigena_baja_no_se_describe_como_hablantes():
    # Un grupo con HLI muy por encima del resto pero bajo en términos absolutos.
    locs = _marco_sintetico()
    for l in locs[:4]:
        l["pctHLI"] = 0.5
    r = al.agrupar(locs, k_fija=3)
    assert all("lengua indígena" not in g["descripcion"] for g in r["grupos"])


def test_motivo_sin_k_es_un_error():
    with pytest.raises(SystemExit):
        al.leer_argumentos(["--motivo", "algo"])


def test_la_descripcion_omite_los_rasgos_intermedios():
    variables = ["im2020", "distanciaKm", "matricula"]
    # Más marginado (im2020 bajo), distancia en el promedio, matrícula alta.
    texto = al.describir([-1.0, 0.1, 0.8], [18.0, 2.0, 900], variables)
    assert texto == "marginación más alta del municipio, matrícula más alta"
    assert "intermedia" not in texto


def test_sin_rasgos_fuera_del_promedio_la_descripcion_queda_vacia():
    assert al.describir([0.1, -0.2, 0.3], [22.0, 2.0, 100], ["im2020", "distanciaKm", "matricula"]) == ""


def test_ningun_grupo_real_queda_sin_rasgos(resultado_k3):
    assert all(g["descripcion"] for g in resultado_k3["grupos"])
