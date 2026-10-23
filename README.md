<div align="center">

# 🛡️ ShareShield

### Detect · Review · Redact · Verify · Share

**A local-first privacy review prototype for everyday files.**

**Status:** Multi-format backend and browser interface implemented for development testing · **Mini-project demo: 28 October 2026**

</div>

---

## Overview

ShareShield helps users review potentially sensitive text before sharing a document or photo. Upload a supported file through a browser interface hosted **on your own laptop**, review possible email/phone-number detections, select which values to hide, and download a separate redacted copy.

**Try the new UI at http://127.0.0.1:8000/** after starting the server. This is a prototype, not a security-certified privacy or complete file-sanitization tool.

## Format support (prototype)

| Input | Detection | Output |
| --- | --- | --- |
| JPG, JPEG, PNG, HEIC, HEIF, WEBP, BMP, TIFF | OCR of visible text | Flattened redacted PNG |
| Searchable and scanned PDFs | Text extraction; OCR on image-only pages | Redacted PDF |
| Word DOCX | Editable paragraphs/tables/headers/footers | Modified DOCX |
| PowerPoint PPTX | Editable slide text/shapes/tables | Modified PPTX |
| UTF-8 TXT | Pattern matching | Redacted TXT |

Patterns currently target **email addresses and Indian mobile-number candidates**. Face detection, Aadhaar/PAN patterns, contextual NLP, handwriting, Office embedded media and some PDF hidden content remain future work. Legacy Word DOC, video, ZIP and arbitrary formats are **not** supported yet. See [backend limitations](backend/README.md).

## User workflow

~~~mermaid
flowchart TD
    A([Choose an image or document]) --> B{Supported and readable?}
    B -->|No| X[Explain unsupported format or OCR problem]
    B -->|Yes| C[Extract editable text or use OCR]
    C --> D[Find candidate email/mobile text]
    D --> E[User reviews and selects findings]
    E --> F[Create a NEW redacted copy]
    F --> G[Reopen output and recheck selected findings]
    G --> H{Selected content still detected?}
    H -->|Yes| J[FLAG: do not download as verified]
    H -->|No| K[Download with SCOPED verification warning]
    K --> L([User manually checks output before sharing])
~~~

**Scoped verification is not a guarantee:** the app does not check all places information might be hidden, nor can OCR guarantee perfect recognition.

## Local prototype architecture

~~~mermaid
flowchart LR
    subgraph Laptop[Your laptop — local processing]
        UI[Browser upload and review page] --> API[FastAPI local service]
        API --> R[Text and pattern recognition]
        API --> OCR[Tesseract OCR and Pillow / HEIC]
        API --> PDF[PyMuPDF PDF redaction]
        API --> DOC[python-docx and python-pptx]
        PDF --> V[Saved-output verification]
        DOC --> V
        OCR --> V
        V --> API
    end
~~~

No public-cloud upload is needed to use the development server on loopback. Do not expose the service to the internet.

## Install and start on macOS

Install the **Tesseract application** separately (requires Homebrew):

~~~bash
brew install tesseract
cd ~/Desktop/ShareShield
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Open **http://127.0.0.1:8000/** in Chrome or Safari. For API debugging only, open **http://127.0.0.1:8000/docs**.

To run tests:

~~~bash
python -m pip install pytest httpx
python -m pytest backend/tests -v
~~~

Python 3.10+ is recommended. HEIC decoding requires pillow-heif and platform-compatible libraries; compatibility with your exact older macOS installation must be checked.

## Project roadmap

| Milestone | Scope |
| --- | --- |
| Mini-project prototype — October 2026 | Local browser UI, selected text detection, PDF/image/Office support, scoped verification |
| Reliability work | More synthetic regression tests, unsupported-content warnings, accurate output inspection |
| Later major-project concept | Opt-in Android/iOS share-sheet integrations, expanded language, face and visual-PII detection |

Android and iOS generally do not allow unrestricted silent monitoring of uploads in other apps. Future integration must be explicitly permissioned and platform compliant.

## Project references

- [Backend setup, file formats and technical limits](backend/README.md)
- [Prerequisites](docs/PREREQUISITES.md)
- [Project scope](docs/PROJECT_SCOPE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [IP and licensing](docs/IP_AND_LICENSING.md)

This repository is public; **do not commit real IDs, private documents, exported files or secrets**. PyMuPDF's AGPL/commercial licensing obligations must be reviewed before release. No public project license has been selected, and ownership/redistribution terms must be confirmed before commercial use.

---

<div align="center">

**ShareShield · Malnad College of Engineering · Prototype under development**

*Detect. Redact. Verify. Then Share.*

</div>
