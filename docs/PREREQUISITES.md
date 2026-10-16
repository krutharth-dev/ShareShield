# Development prerequisites

## Before Monday, 19 October 2026

### Both developers
- A GitHub account with approved access to this private repository.
- Git and Apple Xcode Command Line Tools.
- A compatible Visual Studio Code release.
- Current browser (Chrome, Firefox or Safari).
- At least 15–20 GB free disk space.
- Check macOS version via **Apple menu → About This Mac** and `sw_vers`.
- Confirm no real personal documents, credentials or secrets will be committed.

### Backend workstation (2017 Intel i7 MacBook, 16 GB RAM, macOS Ventura 13.x)
- Python **3.11 or 3.12** compatible with its exact OS version.
- Python `pip` and built-in `venv`.
- Planned Python packages (to install **when coding begins**): FastAPI, Uvicorn, PyMuPDF, python-multipart, python-pptx, pytest.
- Keep optional OCR and heavyweight models out of the initial installation.

### Frontend workstation (2019 Intel i7 MacBook, 16 GB RAM)
- Confirm the **exact macOS version** first.
- Install a macOS-compatible Node.js release with npm that meets the selected Vite release's requirements.
- React, TypeScript and Vite are project dependencies **to initialize on development day**, not separate desktop installers.
- Browser devtools and optional VS Code ESLint extension.

### Shared preparation
- Private GitHub repository, two authorized developers and reviewed access.
- Commit via separate working branches; use pull requests to review before merging into `main`.
- Use **fictional IDs and email addresses only** in demonstrations.
- Keep original and exported test documents out of Git unless a carefully reviewed synthetic fixture policy is adopted.
- Agree on the API contract and local ports before frontend/backend integration.

## Official sources
- [Git](https://git-scm.com/downloads/mac)
- [VS Code](https://code.visualstudio.com/)
- [Python](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/en/download)
- [GitHub](https://github.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [PyMuPDF](https://pymupdf.readthedocs.io/)
- [python-pptx](https://python-pptx.readthedocs.io/)

**Compatibility note:** macOS Ventura 13.x does not guarantee support for every current Node, VS Code or Xcode version. Confirm exact OS point release and each tool's supported minimum before installing.

**Not needed for the mini-project setup:** Android Studio, Docker, full Xcode IDE, cloud database, paid hosting, and large AI models.
