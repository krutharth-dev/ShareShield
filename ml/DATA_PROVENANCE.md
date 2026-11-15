# Data and model selection record — 2026-11-04

No external dataset was imported. All training/evaluation examples in this directory were authored fictionally for this project. Repository licensing applies to the new code and fixtures; this document makes no claim over third-party datasets.

| Candidate | Primary evidence | Suitability / decision |
|---|---|---|
| AI4Bharat Naamapadam | https://huggingface.co/datasets/ai4bharat/naamapadam and https://huggingface.co/datasets/ai4bharat/naamapadam/blob/main/naamapadam.py | Kannada general entity data; card says CC0, loader declares CC BY-NC 4.0. Conflicting terms need owner clarification. Not used. General name/location/organization tags do not supply MRN-vs-admission privacy labels. |
| Ai4Privacy pii-masking-200k | https://huggingface.co/datasets/ai4privacy/pii-masking-200k/blob/main/LICENSE | Custom individual/small-business conditions and derivative distribution restrictions; not a simple permissive licence. Not used. English PII is potentially useful, but does not establish Kannada coverage. |
| Multilingual MiniLM L12 H384 | https://huggingface.co/microsoft/Multilingual-MiniLM-L12-H384 and https://github.com/microsoft/unilm/tree/master/minilm | MIT model card; 12 layers/384 hidden architecture. Candidate for future fine-tuning, not a ready privacy tagger. No measured Kannada accuracy, CPU latency, download size or memory claim in this work; not downloaded or modified. |
| Local char-ngram multinomial logistic model | `train.py`, pinned scikit-learn/NumPy/SciPy | Selected: genuine CPU training and direct JS/Flutter-portable coefficients; compact measured checkpoint; weak semantic generalisation explicitly evaluated. No pretrained knowledge. |
| ONNX Runtime Web | https://onnxruntime.ai/docs/tutorials/web/ and https://onnxruntime.ai/docs/tutorials/web/deploy.html | WASM CPU inference is available and assets can be self-hosted. Not necessary for this linear model. No ONNX export or runtime benchmark claimed. |

Sources inspected through primary-source web search. Do not silently ingest an external dataset merely because a model/data card says “open”. All future external data additions need recorded version, licence, mapping, deduplication and split rules. Dataset review, model training and benchmark execution here did not use any user's uploaded documents.
