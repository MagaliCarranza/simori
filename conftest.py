"""Expone el directorio scripts/ a pytest sin convertirlo en paquete."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "scripts"))
