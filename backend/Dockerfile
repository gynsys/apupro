FROM ghcr.io/gynsys/arko360_platform/backend:latest

WORKDIR /app

# Install dependencies and remove heavy torch/sentence-transformers packages BEFORE copying app code
# so this layer stays permanently cached across deploys and does not fill /root/.cache/pip
RUN pip install --no-cache-dir openpyxl==3.1.2 bleach==6.4.0 google-generativeai cloudscraper markitdown duckduckgo-search xlrd==2.0.1 && \
    pip uninstall -y torch torchvision torchaudio sentence-transformers && \
    rm -rf /root/.cache/pip

# Copy modified codebase over the existing one (fast cached final layer)
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--backlog", "2048", "--timeout-keep-alive", "15"]

