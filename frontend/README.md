# ShareShield frontend — integrated React workspace

The original light-themed React dashboard has been connected to the privacy
review backend. File selection, finding review, manual masking, output
verification and downloads all work through the local API.

## Local development

From the repository root in Terminal 1:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Install system Tesseract to enable OCR on images and scanned PDFs.
On macOS: brew install tesseract.

Terminal 2:

~~~bash
cd frontend
npm ci
npm run dev
~~~

Open http://127.0.0.1:5173/. Vite proxies /analyze, /preview, /redact,
/verify and /health to the local backend.

## Build

~~~bash
npm ci
npm run lint
npm run build
~~~

FastAPI serves frontend/dist if it exists when the server starts. Alternatively,
run docker compose up --build from the repository root and open
http://127.0.0.1:8000/.

Demo controls:
- Load fictional demo file for synthetic identifiers.
- Preview and manual masks are for images/PDFs only.
- Review and redaction do not overwrite the original file.
- PASS_SCOPED does not guarantee complete sanitization.
- Do not upload real private documents to a publicly hosted prototype.
