import boto3
from botocore.client import Config
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize S3 Client
def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}" if not settings.MINIO_ENDPOINT.startswith("http") else settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1" # MinIO default
    )

def ensure_bucket_exists():
    """Ensure the media bucket exists and has public-read policy for chat media."""
    s3 = get_s3_client()
    bucket_name = settings.MINIO_BUCKET
    
    try:
        s3.head_bucket(Bucket=bucket_name)
        logger.info(f"Bucket '{bucket_name}' already exists.")
    except Exception:
        try:
            logger.info(f"Creating bucket '{bucket_name}'")
            s3.create_bucket(Bucket=bucket_name)
        except Exception as e:
            logger.error(f"Failed to create bucket: {e}")
            return
    
    # Set public-read policy for the bucket (allows direct browser access to uploaded media)
    # This is simpler than presigned GETs for chat media like images and voice notes.
    try:
        import json
        public_read_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "PublicReadGetObject",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]
        }
        s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(public_read_policy))
        logger.info(f"Public-read policy applied to bucket '{bucket_name}'.")
    except Exception as e:
        # MinIO may already have the policy or it's a duplicate - log warning, don't fail
        logger.warning(f"Could not apply bucket policy (may already exist): {e}")

def create_presigned_upload(object_name: str, content_type: str = None):
    """
    Generate a presigned URL to share with the client for file upload.
    Using 'put_object' style (PUT request) is often simpler for binary uploads than POST fields.
    """
    s3 = get_s3_client()
    
    # We need to sign with the INTERNAL endpoint but returning a URL that the CLIENT can use.
    # MinIO signing is tricky with localhost vs internal docker.
    # Usually you configure the client with the EXTERNAL endpoint for signing if you want the URL to match,
    # OR you replace the host in the generated URL.
    
    # Let's try generating with the logical client.
    try:
        # Generate the URL
        params = {'Bucket': settings.MINIO_BUCKET, 'Key': object_name}
        if content_type:
            params['ContentType'] = content_type
            
        url = s3.generate_presigned_url(
            'put_object',
            Params=params,
            ExpiresIn=3600
        )
        
        # Hack: If the generated URL uses the internal docker hostname (minio:9000), 
        # replace it with localhost:9000 or the Public Endpoint setting.
        if "minio:9000" in url and settings.MINIO_PUBLIC_ENDPOINT:
             url = url.replace("http://minio:9000", settings.MINIO_PUBLIC_ENDPOINT)
             url = url.replace("minio:9000", settings.MINIO_PUBLIC_ENDPOINT.replace("http://", ""))
             
        return url
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return None

def create_presigned_get(object_name: str):
    """
    Generate a presigned URL to read a file.
    """
    s3 = get_s3_client()
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.MINIO_BUCKET, 'Key': object_name},
            ExpiresIn=3600 * 24 # 24 hours
        )
        # Similar Hack for hostname replacement
        if "minio:9000" in url and settings.MINIO_PUBLIC_ENDPOINT:
             url = url.replace("http://minio:9000", settings.MINIO_PUBLIC_ENDPOINT)
             
        return url
    except Exception as e:
        logger.error(f"Error generating presigned GET URL: {e}")
        return None
