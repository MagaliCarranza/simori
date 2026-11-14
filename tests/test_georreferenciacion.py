"""Pruebas de normalizacion de nombres y union CLUES <-> DENUE."""

import pytest

from georreferenciar_unidades import (
    georreferenciar_unidades,
    institucion_de_clues,
    normalizar,
)


# ------------------------- Normalizacion de nombres -------------------------

class TestNormalizacion:
    def test_quita_acentos_y_mayuscula(self):
        assert normalizar("Módulo Poncitlán") == "MODULO PONCITLAN"

    def test_quita_etiqueta_centro_de_salud(self):
        assert normalizar("CENTRO DE SALUD MEZCALA") == "MEZCALA"

    def test_quita_dispersó_de(self):
        assert normalizar("CENTRO DE SALUD DISPERSO DE SAN PEDRO ITZICAN") == "SAN PEDRO ITZICAN"

    def test_mantiene_modulo_y_umf_para_distinguir(self):
        # Son distintivos entre unidades de la misma localidad.
        assert "MODULO" in normalizar("MODULO PONCITLAN")
        assert "UMF" in normalizar("UMF 95 PONCITLAN")

    def test_quita_cs_y_ssa(self):
        assert normalizar("CS SSA TUXPAN") == "TUXPAN"

    def test_colapsa_espacios_y_puntuacion(self):
        assert normalizar("  CENTRO  DE  SALUD,  MEZCALA.  ") == "MEZCALA"

    def test_vacio_y_none(self):
        assert normalizar(None) == ""
        assert normalizar("") == ""


class TestInstitucionDeCLUES:
    @pytest.mark.parametrize("clues,esperado", [
        ("JCSSA004213", "SSA"),
        ("JCIMS000680", "IMSS"),
        ("JCIST000593", "ISSSTE"),
        ("", "otra"),
        (None, "otra"),
    ])
    def test_distingue_institucion(self, clues, esperado):
        assert institucion_de_clues(clues) == esperado


# ------------------------- Union CLUES <-> DENUE -------------------------

ENT = 14
MUN = 66
COORDS_LOC = {
    "0031": (20.315556, -102.951944),
    "0025": (20.397502, -103.057543),
    "0019": (20.336190, -103.018342),
}


def clues(c, loc="0031", desc="CENTRO DE SALUD SAN PEDRO ITZICAN", tipol="A"):
    return {
        "clues": c, "cedocve": "14", "cmpocve": "066", "cloccve": loc,
        "tipo_unidad": "CE", "tipologia": tipol, "desc_unidad": desc,
    }


def denue(d, loc=31, nom="CENTRO DE SALUD SAN PEDRO ITZICAN",
          cod="621116", nombre_act="Clinicas de consultorios medicos del sector publico",
          lat=20.316939, lng=-102.954327, id_=1):
    return {
        "id": id_, "clee": f"C{id_:05d}",
        "nom_estab": nom, "codigo_act": cod, "nombre_act": nombre_act,
        "cve_ent": ENT, "cve_mun": MUN, "cve_loc": loc,
        "latitud": lat, "longitud": lng,
    }


class TestUnion:
    def test_une_por_nombre_similar_con_confianza_alta(self):
        """Caso que se une: CLUES y DENUE comparten nombre (ratio alto)."""
        c = clues("JCSSA004213")
        d = denue(1, nom="CENTRO DE SALUD DISPERSO DE SAN PEDRO ITZICAN")
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c], [d], COORDS_LOC)
        assert uniones[0]["metodo"] == "denue"
        assert uniones[0]["confianza"] in ("alta", "media")
        assert uniones[0]["puntaje"] >= 0.75
        assert centros[0]["lat"] == d["latitud"]
        assert centros[0]["verificadaDENUE"] is True

    def test_une_por_unica_en_localidad_con_confianza_media(self):
        """Caso con nombre muy distinto pero unico en localidad (SSA A/B/C + 621116)."""
        c = clues("JCSSA004172", loc="0019", desc="CENTRO DE SALUD MEZCALA")
        # DENUE lo llama solo "CENTRO DE SALUD", ratio bajo.
        d = denue(2, loc=19, nom="CENTRO DE SALUD", lat=20.3362, lng=-103.0183)
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c], [d], COORDS_LOC)
        assert uniones[0]["metodo"] == "unica_loc"
        assert uniones[0]["confianza"] == "media"
        assert centros[0]["verificadaDENUE"] is True
        assert centros[0]["lat"] == d["latitud"]

    def test_no_se_une_cae_a_localidad(self):
        """Caso que no se une: no hay DENUE 621116 en esa localidad."""
        c = clues("JCSSA004184", loc="0025", desc="CENTRO DE SALUD SAN JACINTO")
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c], [], COORDS_LOC)
        assert uniones[0]["metodo"] == "localidad"
        assert uniones[0]["confianza"] == "baja"
        assert centros[0]["ubicacionAproximada"] is True
        assert centros[0]["verificadaDENUE"] is False
        # Coordenadas vienen del ITER.
        assert (centros[0]["lat"], centros[0]["lng"]) == COORDS_LOC["0025"]

    def test_override_manual_tiene_prioridad(self):
        """El CSV manual gana aunque haya DENUE con fuzzy alto."""
        c = clues("JCSSA004213")
        d = denue(1, nom="CENTRO DE SALUD SAN PEDRO ITZICAN", lat=99.9, lng=99.9)
        manual = [{
            "clues": "JCSSA004213",
            "lat": "20.1234",
            "lng": "-102.5678",
            "fuente": "GPS en campo",
            "fecha": "2026-11-13",
        }]
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c], [d], COORDS_LOC, manual)
        assert uniones[0]["metodo"] == "manual"
        assert uniones[0]["confianza"] == "manual"
        assert centros[0]["lat"] == 20.1234
        assert centros[0]["lng"] == -102.5678
        # ubicacionAproximada=False, pero verificadaDENUE tambien False
        # (manual no es DENUE).
        assert centros[0]["ubicacionAproximada"] is False
        assert centros[0]["verificadaDENUE"] is False

    def test_imss_y_issste_no_se_unen_por_nombre(self):
        """IMSS/ISSSTE siempre caen al fallback de localidad."""
        c_imss = clues("JCIMS000680", loc="0001", desc="UMF 95 PONCITLAN")
        c_ist = clues("JCIST000593", loc="0001", desc="PONCITLAN")
        d = denue(1, loc=1, nom="UNIDAD D MEDICINA FAMILIAR PONCITLAN")
        coords = {"0001": (20.38, -102.93)}
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c_imss, c_ist], [d], coords)
        metodos = {u["clues"]: u["metodo"] for u in uniones}
        assert metodos["JCIMS000680"] == "localidad"
        assert metodos["JCIST000593"] == "localidad"

    def test_greedy_un_denue_por_clues(self):
        """Si 2 CLUES SSA compiten por 1 DENUE, solo el de mayor ratio gana."""
        c_centro = clues("JCSSA004143", loc="0001", desc="CENTRO DE SALUD PONCITLAN", tipol="C")
        c_modulo = clues("JCSSA004155", loc="0001", desc="MODULO PONCITLAN", tipol="P")
        d = denue(1, loc=1, nom="CENTRO DE SALUD PONCITLAN")
        coords = {"0001": (20.38, -102.93)}
        centros, uniones = georreferenciar_unidades(ENT, MUN, [c_centro, c_modulo], [d], coords)
        metodos = {u["clues"]: u["metodo"] for u in uniones}
        # El centro (ratio 1.0) gana el DENUE.
        assert metodos["JCSSA004143"] == "denue"
        # El modulo (ratio < 1.0 por "MODULO") cae a localidad.
        assert metodos["JCSSA004155"] == "localidad"
