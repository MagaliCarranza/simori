"""Pruebas de la ubicacion de escuelas por CCT (georreferencia_escuelas.csv)."""

from preparar_datos import aplicar_ubicacion_escuelas, leer_escuelas_manual

ENCABEZADO = "cct,lat,lng,fuente,url,nota\n"


def _escuela(cct, lat=20.3, lng=-102.9):
    return {
        "cct": cct,
        "nombre": "Escuela",
        "claveInegi": "140660002",
        "matricula": 100,
        "lat": lat,
        "lng": lng,
        "ubicacionAproximada": True,
    }


class TestLeerEscuelasManual:
    def test_lee_las_columnas_del_csv(self, tmp_path):
        ruta = tmp_path / "escuelas.csv"
        ruta.write_text(
            ENCABEZADO
            + '14DPR1710G,20.312389,-102.929000,"Datos de la SEP, escuelasmex.com",https://x,Mismo edificio\n',
            encoding="utf-8",
        )
        assert leer_escuelas_manual(ruta) == {"14DPR1710G": (20.312389, -102.929)}

    def test_ignora_filas_sin_cct_o_sin_numero(self, tmp_path):
        ruta = tmp_path / "escuelas.csv"
        ruta.write_text(ENCABEZADO + ",20.1,-102.1,f,u,\n14DPR0001A,,-102.1,f,u,\n", encoding="utf-8")
        assert leer_escuelas_manual(ruta) == {}

    def test_sin_archivo_devuelve_vacio(self, tmp_path):
        assert leer_escuelas_manual(tmp_path / "no-existe.csv") == {}


class TestAplicarUbicacionEscuelas:
    def test_solo_cambia_lat_lng_y_ubicacion_aproximada(self):
        antes = [_escuela("A"), _escuela("B")]
        despues = aplicar_ubicacion_escuelas(antes, {"A": (20.5, -102.5)})
        assert despues[0] == {**antes[0], "lat": 20.5, "lng": -102.5, "ubicacionAproximada": False}
        assert despues[1] == antes[1]

    def test_conserva_orden_numero_y_orden_de_campos(self):
        antes = [_escuela("A"), _escuela("B"), _escuela("C")]
        despues = aplicar_ubicacion_escuelas(antes, {"C": (1.0, 2.0), "A": (3.0, 4.0)})
        assert [e["cct"] for e in despues] == ["A", "B", "C"]
        assert all(list(d) == list(a) for d, a in zip(despues, antes))

    def test_no_modifica_la_lista_original(self):
        antes = [_escuela("A")]
        aplicar_ubicacion_escuelas(antes, {"A": (1.0, 2.0)})
        assert antes[0]["ubicacionAproximada"] is True
