"""
Logo proxy endpoint to bypass CORS issues for social-generator
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pathlib import Path
import logging

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/logo/{filename}")
async def get_logo(filename: str):
    """
    Serve logo files with proper CORS headers for social-generator
    """
    try:
        # Validate filename to prevent directory traversal
        if ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Construct file path
        logo_path = Path(settings.UPLOAD_DIR) / "logos" / filename
        
        # Check if file exists
        if not logo_path.exists():
            raise HTTPException(status_code=404, detail="Logo not found")
        
        # Read file content
        with open(logo_path, "rb") as f:
            content = f.read()
        
        # Determine content type
        if filename.lower().endswith('.png'):
            content_type = "image/png"
        elif filename.lower().endswith(('.jpg', '.jpeg')):
            content_type = "image/jpeg"
        elif filename.lower().endswith('.webp'):
            content_type = "image/webp"
        else:
            content_type = "application/octet-stream"
        
        # Return response with CORS headers
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "https://gynsys.net",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Expose-Headers": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving logo {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
