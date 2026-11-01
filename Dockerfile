FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin tesseract-ocr-kan poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY backend ./backend
RUN useradd -m -u 10001 processor
USER processor
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["uvicorn","backend.app.main:app","--host","0.0.0.0","--port","8080","--workers","1","--no-access-log","--limit-concurrency","8"]
