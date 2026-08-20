# common/pdf/utils.py
# Funciones compartidas para la generación de PDFs
import os
import io
import json
import logging
from pathlib import Path
from reportlab.platypus import Image
from reportlab.lib.units import inch
import qrcode

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _resolve_path(path_str):
    if not path_str:
        return None
    path = Path(path_str)
    if not path.is_absolute():
        path = BASE_DIR / path
    return path


def format_simple_antecedente(value: str) -> str:
    """Traduce respuestas simples y capitaliza el resto."""
    if value is None or value.strip() == '':
        return "No contributorios."

    cleaned_value = value.strip()
    if cleaned_value.lower() == 'no':
        return "Niega."

    return cleaned_value.title()


def format_family_history(mother_history: str, father_history: str) -> str:
    """Unifica los antecedentes familiares, aplicando capitalización a los valores."""
    mother_val = mother_history.strip() if mother_history else None
    father_val = father_history.strip() if father_history else None

    is_mother_no = mother_val is not None and mother_val.lower() == 'no'
    is_father_no = father_val is not None and father_val.lower() == 'no'

    if is_mother_no and is_father_no:
        return "Niega antecedentes familiares de importancia."

    if mother_val is None and father_val is None:
        return "No contributorios."

    parts = []
    if not is_mother_no and mother_val:
        parts.append(f"Madre: {mother_val.title()}.")
    if not is_father_no and father_val:
        parts.append(f"Padre: {father_val.title()}.")

    return "<br/>".join(parts) if parts else "Niega antecedentes familiares de importancia."


from reportlab.lib.utils import ImageReader

def create_logo_image(logo_path, width=0.8*inch, height=0.8*inch, preserveAspectRatio=True):
    """Crea una imagen de logo manejando errores y manteniendo aspect ratio si se solicita"""
    resolved_path = _resolve_path(logo_path)
    if not resolved_path or not resolved_path.exists():
        logger.warning(f"❌ Logo path no existe o está vacío: {logo_path}")
        return ""

    try:
        logger.info(f"✅ Cargando logo: {resolved_path}")
        
        # Calculate Aspect Ratio
        if preserveAspectRatio:
            try:
                img_reader = ImageReader(str(resolved_path))
                iw, ih = img_reader.getSize()
                aspect = iw / float(ih)
                
                # Check if we are constrained by width or height
                # Try fitting to width first
                new_width = width
                new_height = width / aspect
                
                # If height is too big, fit to height instead
                if new_height > height:
                    new_height = height
                    new_width = height * aspect
                    
                width = new_width
                height = new_height
            except Exception as e:
                logger.error(f"⚠️ Error calculando aspect ratio para {logo_path}: {e}")
                # Fallback to provided dimensions if calculation fails

        img = Image(str(resolved_path), width=width, height=height)
        img.hAlign = 'CENTER'
        img.vAlign = 'MIDDLE'
        return img
    except Exception as e:
        logger.error(f"❌ Error cargando logo {logo_path}: {e}")
        return ""


def create_qr_image(payload: dict, width=1.2*inch, height=1.2*inch):
    """Genera una imagen QR a partir del payload recibido."""
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_Q,
            box_size=6,
            border=2,
        )
        qr.add_data(json.dumps(payload, ensure_ascii=False))
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        qr_image = Image(buffer, width=width, height=height)
        qr_image.hAlign = 'CENTER'
        return qr_image
    except Exception as e:
        logger.error(f"❌ Error generando QR para firma digital: {e}")
        return ""

