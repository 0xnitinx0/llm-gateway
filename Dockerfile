FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TOKENIZERS_PARALLELISM=false \
    FASTEMBED_CACHE_PATH=/models/fastembed

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download once at image-build time; the running demo is fully local.
RUN python -c "from fastembed import TextEmbedding; list(TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='/models/fastembed').embed(['warmup']))"

COPY . .

EXPOSE 8000
CMD ["python", "-m", "scripts.start"]
