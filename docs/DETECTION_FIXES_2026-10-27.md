# Detection and redaction regression fixes — 2026-10-27

Confirmed against the live API at commit 44e202a: apostrophes and Windows CRLF line endings caused labeled names to be missed; an empty Name label consumed the following public heading. The same cross-line whitespace issue affected Address labels in local reproduction.

The name rule now accepts Unicode letters, apostrophes and hyphens and supports CRLF. Name and Address labels no longer consume following lines. Local handwriting output now retains line membership so separate digit fragments cannot become a false payment-card detection and address findings stay on their source line. Review wording now explains that handwriting suggestions require explicit selection and distinguishes combined OCR/rule scores.

Validation: 155 backend tests passed, including 13 new regression cases. TXT API and native PDF exports remove the selected apostrophe-containing name while preserving the public heading. Frontend lint and production build passed. Before deployment, the live built-in handwriting-style sample completed selected-email redaction with the expected UNVERIFIED status and no browser console errors.

The handwriting regression uses mocked recognizer output to isolate line handling. These checks do not establish recognition accuracy on real handwriting, and the synthetic sample is not a substitute for consented real-document evaluation. Human review remains required.
