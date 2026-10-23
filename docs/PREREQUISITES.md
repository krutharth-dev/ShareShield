# ShareShield — Intel Mac requirements and downloads

This guide covers the complete frontend + backend application on the
integration/deployable-web-app Git branch. Actual compatibility depends on the
installed macOS version (check using sw_vers). No Android SDK, database, paid
cloud account or Docker is required for the local demo.

## Required tools

| Tool | Purpose | Official source |
| --- | --- | --- |
| Git and Apple Command Line Tools | Pull code and dependencies | https://git-scm.com/download/mac |
| Python 3.10+ (3.12 tested) | FastAPI, redaction, OCR interface | https://www.python.org/downloads/macos/ |
| Node.js 22+ compatible with macOS, including npm | React/TypeScript/Vite build | https://nodejs.org/en/download |
| Tesseract OCR executable | Automatically scan images and scanned PDFs | https://github.com/tesseract-ocr/tesseract |
| Homebrew (optional) | Convenient Tesseract installation | https://brew.sh |
| VS Code (optional) | IDE | https://code.visualstudio.com/download |
| Docker Desktop (optional) | Container-based local deployment | https://docs.docker.com/desktop/setup/install/mac-install/ |

The repository itself downloads FastAPI, PyMuPDF, Pillow, python-docx,
python-pptx, openpyxl, React, TypeScript and Vite. Do not install them as
separate desktop applications.

## Check versions on your Mac

~~~bash
sw_vers
uname -m
git --version
python3 --version
node --version
npm --version
tesseract --version
~~~

If Command Line Tools are missing:

~~~bash
xcode-select --install
~~~

If compatible Homebrew is present, install the separate OCR executable:

~~~bash
brew install tesseract
tesseract --version
~~~

Installing pytesseract with pip does NOT install the Tesseract binary. On
older Intel Macs, obtain a version of Node, Python, Homebrew or Docker that
actually supports your installed macOS. If Docker Desktop is unsupported,
use the local launcher instead.

## Download and initialize ShareShield

If ShareShield has already been cloned (Desktop/ShareShield):

~~~bash
cd ~/Desktop/ShareShield
git fetch origin
git switch integration/deployable-web-app
git pull --ff-only origin integration/deployable-web-app
bash scripts/setup-macos.sh
bash scripts/check-ready.sh
~~~

If not yet cloned, first run:

~~~bash
cd ~/Desktop
git clone https://github.com/krutharth-dev/ShareShield.git
cd ShareShield
git fetch origin
git switch --track origin/integration/deployable-web-app
bash scripts/setup-macos.sh
bash scripts/check-ready.sh
~~~

The setup script creates a Python virtual environment, installs
backend/requirements.txt, testing packages, and frontend packages via npm ci.
It does not require sudo or automatically install system packages.

## Start locally

~~~bash
bash scripts/start-demo.sh
~~~

Open http://127.0.0.1:8000/. Stop with Control+C in Terminal.

## Create fictional test files

~~~bash
.venv/bin/python scripts/generate-demo-files.py
open demo-output
~~~

The generated folder contains PNG/JPG, searchable/scanned PDFs, DOCX, PPTX,
XLSX, CSV and TXT files. This folder is ignored by Git.

## Run tests before demo

~~~bash
.venv/bin/python -m pytest backend/tests -v
cd frontend
npm run lint
npm run build
cd ..
~~~

## Optional Docker

When Docker is compatible with the Mac:

~~~bash
docker compose up --build -d
docker compose ps
docker compose down
~~~

Visit http://127.0.0.1:8000/ while it runs. Local Python/Node and Docker are
alternative execution paths, not both required.

## Troubleshooting

- Not a Git repository: change into ~/Desktop/ShareShield first.
- Missing node or Vite version error: install a compatible Node 22+ build.
- Missing Tesseract: install system OCR; without it text files and selectable
  PDF text can still work, but images/scanned PDFs are not automatically read.
- Port 8000 already in use: stop the previous Uvicorn server (Control+C)
  or run docker compose down.
- Old website after pulling: rebuild using scripts/start-demo.sh, then refresh.
- Docker unsupported: use scripts/start-demo.sh with the local virtual environment.

This GitHub repository is public. Do not commit real personal data, identity
documents, secrets, or redacted exports. This demo is not audited for public
internet hosting or guaranteed complete privacy.
