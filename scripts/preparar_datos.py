"""Prepara los datasets crudos en data/raw/ y genera JSON en public/data/.

Este script se completará en M5. Por ahora solo imprime una guía.
"""
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT = Path(__file__).resolve().parent.parent / "public" / "data"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Lee datasets desde: {RAW}")
    print(f"Escribe JSON a: {OUT}")


if __name__ == "__main__":
    main()
