FROM ghcr.io/gynsys/arko360_platform/backend:latest

WORKDIR /app

# The base image already has torch and all requirements installed.
# We just need to copy our modified codebase over the existing one.
COPY . .

# Install dependencies and remove heavy torch/sentence-transformers packages (Gemini API handles embeddings)
RUN pip install openpyxl==3.1.2 bleach==6.4.0 google-generativeai && \
    pip uninstall -y torch torchvision torchaudio sentence-transformers

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

