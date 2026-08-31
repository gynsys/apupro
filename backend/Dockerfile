FROM ghcr.io/gynsys/arko360_platform/backend:latest

WORKDIR /app

# The base image already has torch and all requirements installed.
# We just need to copy our modified codebase over the existing one.
COPY . .

# Install openpyxl for Excel export and bleach for HTML sanitization
RUN pip install openpyxl==3.1.2 bleach==6.4.0

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
