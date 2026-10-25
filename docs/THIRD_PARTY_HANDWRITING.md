# Handwriting dependencies and assets

- PaddleOCR / PP-OCRv5: Apache-2.0. https://github.com/PaddlePaddle/PaddleOCR
- RapidOCR 3.9.2 and converted ONNX weights: Apache-2.0.
  https://github.com/RapidAI/RapidOCR/tree/v3.9.2
  Model URLs and SHA-256 digests are in backend/prepare_handwriting.py, sourced
  from that release's python/rapidocr/default_models.yaml.
- ONNX Runtime 1.23.2: MIT. https://github.com/microsoft/onnxruntime
- Caveat handwriting-style font: SIL Open Font License 1.1.
  https://github.com/google/fonts/tree/main/ofl/caveat
  Used only to render the fictional regression/demo note. Its output must not
  be represented as actual human handwriting.

Runtime dependencies retain their package licenses. The build includes upstream
OCR and font license files with the downloaded model assets. Model parameters
are pretrained; ShareShield does not claim authorship of those models.
