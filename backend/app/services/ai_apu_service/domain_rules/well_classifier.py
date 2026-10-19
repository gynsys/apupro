import re


_SEWAGE_RE = re.compile(
    r"\b(aguas?\s+negras?|aguas?\s+servidas?|aguas?\s+residuales?|residuales?"
    r"|achique|fosa|cloaca|triturador\w*|drenaje\s+(?:pluvial|de\s+s[oó]tano|s[oó]tano)?"
    r"|drenaje|sumidero|cisterna|tanque\s+de\s+agua)\b",
    re.IGNORECASE,
)


def is_sewage_or_drainage(text: str) -> bool:
    """
    Predicado unificado para determinar si una bomba sumergible es de drenaje/achique/aguas residuales
    y NO una bomba de pozo profundo (VER-10).
    """
    return bool(_SEWAGE_RE.search(text or ""))
