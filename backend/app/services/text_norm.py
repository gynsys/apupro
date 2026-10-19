import unicodedata


def norm_text(s: str) -> str:
    """
    Mayúsculas, sin diacríticos ni tildes, espacios colapsados.
    Punto único y centralizado de normalización para comparaciones semánticas deterministas (VER-9).
    """
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(s))
    out = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(out.upper().split())
