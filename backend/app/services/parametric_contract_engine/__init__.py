"""
Módulo de Contratos Paramétricos Data-Driven (Parametric Contract Engine).

Este módulo es 100% autónomo y desacoplado.
Si se desea desactivar, basta con poner ENABLE_PARAMETRIC_ENGINE = False
en la configuración o desconectar su importación en apu_input_validator.py.
"""

ENABLE_PARAMETRIC_ENGINE: bool = True

__all__ = ["ENABLE_PARAMETRIC_ENGINE"]
