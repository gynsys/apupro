"""
Servicio de Integración con Google Drive y Google Sheets.
Permite subir automáticamente los Libros de Obra (.xlsx) y Fichas Técnicas (.pdf)
a la unidad de Google Drive del usuario mediante la Cuenta de Servicio.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import Resource, build
from googleapiclient.http import MediaFileUpload

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_PATH = BASE_DIR / "credentials.json"
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


def get_drive_service() -> Optional[Resource]:
    """Crea y retorna el cliente autenticado de Google Drive API."""
    if not CREDENTIALS_PATH.exists():
        logger.warning("Archivo de credenciales no encontrado en: %s", CREDENTIALS_PATH)
        return None
    try:
        creds = service_account.Credentials.from_service_account_file(
            str(CREDENTIALS_PATH), scopes=SCOPES
        )
        return build("drive", "v3", credentials=creds)
    except Exception as exc:
        logger.error("Error al autenticar con Google Drive API: %s", exc, exc_info=True)
        return None


def get_shared_folder_id(service: Resource) -> Optional[str]:
    """
    Busca una carpeta compartida con la cuenta de servicio (ej: 'Libros de Obra' o 'Inspecciones').
    Si no encuentra una con ese nombre, toma la primera carpeta compartida disponible.
    """
    try:
        # Primero buscar carpeta 'Libros de Obra'
        query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = 'Libros de Obra'"
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get("files", [])
        if files:
            return files[0]["id"]

        # Buscar cualquier carpeta compartida con la cuenta de servicio
        query_all = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results_all = service.files().list(q=query_all, fields="files(id, name)").execute()
        files_all = results_all.get("files", [])
        if files_all:
            return files_all[0]["id"]

        return None
    except Exception as exc:
        logger.error("Error al buscar carpetas compartidas en Drive: %s", exc, exc_info=True)
        return None


def upload_file_to_drive(
    local_path: Path,
    folder_id: Optional[str] = None,
    mime_type: Optional[str] = None,
    convert_to_sheets: bool = False,
) -> Optional[Dict[str, str]]:
    """
    Sube o actualiza un archivo en Google Drive.
    Si el archivo con el mismo nombre ya existe en la carpeta, lo actualiza en lugar de duplicarlo.
    Si convert_to_sheets=True, convierte el archivo Excel en una Hoja de Cálculo interactiva de Google Sheets.
    Retorna un diccionario con file_id, name y web_view_link.
    """
    if not local_path.exists():
        logger.error("El archivo local no existe para subir a Drive: %s", local_path)
        return None

    service = get_drive_service()
    if not service:
        return None

    try:
        target_folder = folder_id or get_shared_folder_id(service)
        filename = local_path.name

        # Determinar mime_type si no fue provisto
        if not mime_type:
            if local_path.suffix.lower() == ".xlsx":
                mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif local_path.suffix.lower() == ".pdf":
                mime_type = "application/pdf"
            else:
                mime_type = "application/octet-stream"

        # Verificar si el archivo ya existe en la carpeta destino
        existing_file_id: Optional[str] = None
        if target_folder:
            query = f"'{target_folder}' in parents and name = '{filename}' and trashed = false"
            res = service.files().list(q=query, fields="files(id, name)").execute()
            existing_files = res.get("files", [])
            if existing_files:
                existing_file_id = existing_files[0]["id"]

        media = MediaFileUpload(str(local_path), mimetype=mime_type, resumable=True)

        if existing_file_id:
            # Actualizar archivo existente
            updated_file = (
                service.files()
                .update(fileId=existing_file_id, media_body=media, fields="id, name, webViewLink")
                .execute()
            )
            logger.info("Archivo actualizado en Google Drive: %s (ID: %s)", filename, existing_file_id)
            return {
                "file_id": updated_file.get("id"),
                "name": updated_file.get("name"),
                "web_view_link": updated_file.get("webViewLink", ""),
            }
        else:
            # Crear nuevo archivo
            file_metadata: Dict[str, Any] = {"name": filename}
            if convert_to_sheets and local_path.suffix.lower() == ".xlsx":
                file_metadata["mimeType"] = "application/vnd.google-apps.spreadsheet"

            if target_folder:
                file_metadata["parents"] = [target_folder]

            created_file = (
                service.files()
                .create(body=file_metadata, media_body=media, fields="id, name, webViewLink")
                .execute()
            )
            file_id = created_file.get("id")
            logger.info("Archivo nuevo creado en Google Drive: %s (ID: %s)", filename, file_id)
            return {
                "file_id": file_id,
                "name": created_file.get("name"),
                "web_view_link": created_file.get("webViewLink", ""),
            }
    except Exception as exc:
        logger.error("Error al subir archivo a Google Drive: %s", exc, exc_info=True)
        return None
