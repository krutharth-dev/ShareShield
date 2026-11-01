# Contextual recognition and validation

This change extends the browser-side TypeScript engine on PR #11's validated
commit `8f37c8c7147d178d6f38801c06b7c36730e0b80e`. It does not train or integrate
a new model. Detection is deterministic, using labels, patterns, structural
checks and country numbering-plan metadata.

## Extension points

`frontend/src/category-registry.ts` owns extensible labelled recognizers and
category metadata (family, existing base rank, validation method, health/high
policy, mandatory review). Existing legacy recognizers remain in detection.ts;
they are not rebuilt. Add a labelled rule and descriptor to the registry to
extend supported contextual fields. A new checksum algorithm belongs in the
validation module, not the UI. Legacy priority aliases continue to work.

`identifier-validation.ts` contains Aadhaar Verhoeff, PAN/IFSC positional
validation, script-digit normalization and libphonenumber-js/max integration.
The existing Luhn and IBAN mod-97 implementations remain in extended-detection.ts.
The phone dependency is pinned in package.json and package-lock.json.

## Supported field families

| Family | Recognized fields | Validation scope |
| --- | --- | --- |
| Government | Aadhaar, labelled 16-digit VID, enrolment, PAN, Indian passport-shaped values, voter EPIC, driving licence | Aadhaar allowed leading digit + Verhoeff; VID length separately; PAN holder-character positions; other government values remain labelled format/context candidates |
| Banking | Bank accounts, IFSC, UPI, payment cards, labelled IBAN, insurance policies | IFSC structure; Luhn and 13–19 card digits; IBAN syntax/mod-97; account/UPI/insurance ownership and issuer rules not checked |
| Medical | Patient IDs, MRNs, patient names, insurance IDs, diagnoses, blood groups/Rh, prescriptions, allergies, lab results, history, notes, procedures | Labels and document context; alphabetic-only patient IDs require review; no clinical semantic validation |
| Academic / institutional | College USNs, student/employee IDs, admissions, enrolment/registration, results, grades, certificates, labelled academic/disciplinary records | Institution-specific labels and conservative USN shapes; no university/student authentication |
| Identity / contact | Personal/guardian names, DOB, address lines/blocks, postal codes, email, Indian mobiles, international phones, emergency contacts, vehicle registration | Label/context rules; phone numbering plans via full metadata; no name/address/age/ownership authentication |
| Credentials | Passwords, API keys, access/client secrets, bearer/authentication/refresh tokens, private-key envelopes | Explicit labels/envelopes; no live key tests, token decoding, or access attempts |
| Legal / confidential | English/Kannada party identities, case/FIR/docket references, legal notes, privilege/settlement labels, confidentiality/trade-secret fields | Label/context review; no determination of legal privilege |
| Biometric indicators | Fingerprint, iris, biometric-ID/template text labels; existing face/photo/QR review behavior retained | Textual indicators only; no fingerprint/iris recognition or biometric authentication |

English and Kannada coverage is explicit, not universal translation: existing
Kannada identity/legal/medical/phone/bank/password labels remain, and Kannada
prescription, academic-record, confidentiality and fingerprint labels are added.
Original UTF-16 offsets are preserved. Repeated values at distinct source
locations remain distinct occurrences. A specific typed Kannada recognizer may
coexist with its broader Kannada personal-data review finding.

## Validation and explanations

Every `detect()` finding receives a validation result, method/detail,
source-line/family context and confidence meaning. Metadata travels through
`makeFindings()` into existing review cards. Neighbouring raw personal values
are not copied into explanatory metadata. Priority tier/rank and classification
reason are calculated by the existing purpose-aware grouping and shown on the
same card.

- `passed`: the specified format/checksum/numbering-plan check passed. This is
  **not** proof of issuance, activity, authenticity, assignment or ownership.
- `failed`: a labelled candidate failed its check; confidence is capped at .45
  and it remains in human review rather than being silently discarded.
- `context_only`: a label or shape was recognized; no issuer or semantic check.
- `not_checked`: reserved for callers that cannot run a check. Existing visual
  or unreadable OCR findings display a validation-unavailable explanation.

Confidence is a heuristic rule strength, not a calibrated probability, OCR
accuracy, authentication or clearance. Conflicting OCR readings invalidate any
stale checksum-pass explanation and remain mandatory review.

## Priority behavior

The 16 base labels and numeric ordering are unchanged. High/Medium/Low category
ranks each start at #1, independently, and identical categories group all their
occurrences. All seven sharing purposes remain available.

- Hospital context places MRNs/patient IDs first among High findings. Clinical
  information is High for public sharing and review-dependent for authorized
  medical sharing; patient-linking identifiers stay High.
- Credential findings infer cybersecurity context and take first position,
  including when government identifiers coexist. Callers can supply a document
  type to rankGroups() explicitly. This is a deterministic dominance policy,
  not a semantic document classifier.
- Separate `mandatoryReviewQueue()` includes failed checks, uncertain regions,
  review-labelled categories and low-confidence observations. It is accessible
  through the existing priorities dialog, independently of the category tiers.
  Unreadable OCR remains outside numerical ranking. Human review and High
  redaction requirements are separate concepts.
- Explicit medical, bank, student, order and invoice field labels prevent a
  coincidentally checksum-valid 12-digit value from becoming Aadhaar. OCR-like
  Aadhaar character substitutions require a local Aadhaar label.

## Regression coverage and limits

Synthetic tests cover checksum pass/fail, PAN positions, IFSC structure, separate
VID lengths, English/Kannada offsets, clinical/academic distinctions, labelled
alphabetic IDs, repeated values, five international numbering plans, invalid
calling codes, credential punctuation/envelopes, tier independence and OCR
conflicts. Existing browser acceptance also checks rendered explanations.

This change does not improve OCR itself, measure real-document recall, train a
multilingual model, or unify Python backend detection with the browser engine.
Free prose, unlabelled health data, unfamiliar institutions, handwritten data,
images and unfamiliar labels can be missed. Passport/licence patterns are not
worldwide jurisdiction validators. IBAN validation does not check country BBAN
rules or country-specific lengths. Phone metadata must be maintained as numbering
plans change; local non-Indian numbers need an explicit international prefix.
Unlabelled international phone candidates are retained only if metadata-valid;
invalid explicitly labelled international values remain review candidates.
Multiline prescriptions/addresses and OCR-damaged labels still need visual
inspection. A checksum-pass value may be fabricated. No universal detection or
guaranteed privacy is asserted.

No production deployment, merge or hackathon application change is part of this work.

## Validation evidence for this change

- Targeted detection/context/extension regression suites passed before full CI.
- Full frontend Node suite: 131 passed; TypeScript check and Vite build passed.
- Wrangler deployment **dry run only** passed. Vite retains a bundle-size warning.
- Backend/redaction suite: 33 passed after installing the repository's pinned
  dependencies in an isolated environment; one upstream TestClient deprecation.
- Existing Playwright acceptance passed, including the new explanation assertions,
  byte inspection, reopened PDF exports, manual regions and Aadhaar/VID restore.
  An optional external MediaPipe face runtime request failed in this environment;
  the smoke suite passed, but successful external face-runtime loading was not
  established by this run.
- GitHub Actions results for the committed branch are recorded in the draft PR.
