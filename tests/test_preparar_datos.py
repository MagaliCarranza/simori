"""Pruebas para el pipeline de preparar_datos.py.

Hoy solo cubre el filtrado de filas de resumen del ITER, que eran la causa
de que "Total del Municipio" apareciera como una localidad en el mapa.
"""

import pandas as pd

from preparar_datos import TOTALES_ITER, filtrar_totales_iter


def _df(filas):
    """Construye un DataFrame con la forma minima que usa el filtro."""
    return pd.DataFrame(filas, columns=["LOC", "NOM_LOC"])


class TestFiltrarTotalesIter:
    def test_quita_las_tres_filas_agregadas(self):
        df = _df([
            (0, "Total del Municipio"),
            (2, "Agua Caliente"),
            (31, "San Pedro Itzican"),
            (43, "Chalpicote"),
            (9998, "Localidades de una vivienda"),
            (9999, "Localidades de dos viviendas"),
        ])
        r = filtrar_totales_iter(df)
        assert set(r["LOC"].astype(int)) == {2, 31, 43}

    def test_mantiene_las_demas_localidades(self):
        df = _df([(i, f"Loc {i}") for i in [1, 2, 25, 51]])
        r = filtrar_totales_iter(df)
        assert set(r["LOC"].astype(int)) == {1, 2, 25, 51}

    def test_devuelve_copia_no_vista(self):
        df = _df([(2, "A"), (0, "B")])
        r = filtrar_totales_iter(df)
        # Modificar el resultado no toca al original.
        r.loc[r.index[0], "NOM_LOC"] = "cambiado"
        assert df.loc[df["LOC"] == 2, "NOM_LOC"].iloc[0] == "A"

    def test_sin_coincidencias_mantiene_df_igual(self):
        df = _df([(2, "A"), (31, "B")])
        r = filtrar_totales_iter(df)
        assert len(r) == len(df)

    def test_constante_lista_las_tres_claves(self):
        # Blindaje: si alguien agrega un valor sin pensarlo, el test salta.
        assert TOTALES_ITER == {0, 9998, 9999}
