FROM node:22-bookworm-slim AS web-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund \
 && npm install --no-save --no-package-lock --no-audit --no-fund lightningcss-linux-x64-gnu@1.33.0
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TMPDIR=/tmp \
    OMP_THREAD_LIMIT=1 \
    OPENBLAS_NUM_THREADS=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend/requirements-handwriting.txt /app/backend/requirements-handwriting.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements-handwriting.txt \
    && python -m pip install --no-cache-dir --no-deps rapidocr==3.9.2
COPY backend/ /app/backend/
RUN python -m backend.prepare_handwriting && python -m backend.handwriting_smoke
# Fail the release before publication if core PDF/Office workflows regress.
RUN python -m backend.release_smoke && python -m backend.ocr_smoke
COPY --from=web-build /src/frontend/dist/ /app/frontend/dist/
# Fail the image build if the logo is missing from the shipped website.
RUN test -s /app/frontend/dist/shareshield-mark.webp
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser
EXPOSE 10000
# On Render, PORT=10000; local compose keeps PORT unset and uses port 8000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
 CMD ["python", "-c", "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/health',timeout=3).read()"]
CMD ["sh", "-c", "exec uvicorn backend.app:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 1"]
