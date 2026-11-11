"""Genera casos simulados con semilla fija y los escribe a public/data/casos.json.

Uso:
    python scripts/simular_casos.py --semilla 2026

Este script se completará en M5/M10. Por ahora solo acepta la semilla y
escribe un JSON vacío para validar el pipeline.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data"


def main() -> None:
    parser = argparse.ArgumentParser(description="Simula casos con semilla fija.")
    parser.add_argument("--semilla", type=int, default=2026, help="Semilla del generador.")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    salida = OUT / "casos.json"
    salida.write_text(
        json.dumps({"semilla": args.semilla, "casos": []}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Escribí {salida} con semilla {args.semilla}.")


if __name__ == "__main__":
    main()
