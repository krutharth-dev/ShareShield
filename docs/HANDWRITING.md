# Optional handwriting recognition (experimental)

Standard scans are unchanged. The opt-in English handwriting workflow sends
page images to Azure Document Intelligence Read (`prebuilt-read`, API
`2024-11-30`). It is disabled unless all three environment variables are set:

- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`: exact HTTPS resource endpoint,
  for example `https://RESOURCE.cognitiveservices.azure.com` (no extra path).
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`: resource key, stored only as a server secret.
- `SHARESHIELD_HANDWRITING_ACCESS_CODE`: a random secret of at least 16 characters,
  shared only with intended testers. This is distinct from the Azure key.

Set these in the existing Render service's Environment settings and deploy.
Never put keys in frontend variables, Git, screenshots or chat. No Azure
resource has been provisioned or paid plan enabled by this change.

## Reviewer flow

Enable Handwritten document, select an image or at most two PDF pages, consent
to Azure processing, enter the tester access code, and analyze. Every returned
line is selectable, including text that was not classified as sensitive.
Supported identifiers and heuristic identity fields are separate candidates.
Nothing from cloud OCR is automatically selected. Review the recognized text,
select sensitive candidates, and use manual boxes to correct missed regions.
This release does not provide text-transcription editing or general name NER.
Faces, QR codes, signatures and unrecognized writing need manual review in
handwriting mode. Word confidence is combined conservatively with category
confidence; it is not a calibrated privacy guarantee.

The existing export flow applies permanent text blackouts and requires page
review plus acknowledgement. The review snapshot retains the cloud findings;
export and verification never call Azure again. All handwriting exports are
UNVERIFIED because local reinspection cannot independently validate handwriting.

## Limits and data handling

Images are decoded/oriented and normalized to PNG. PDFs are rasterized in their
displayed orientation. Maximum image side is 2000 pixels, and returned polygons
are mapped to original preview coordinates. Entire normalized pages are sent,
not only the eventual selected regions. Poor resolution can reduce accuracy.

At most 20 submitted pages per UTC day **per process**; failed attempts count.
The counter resets on process restart and is not a billing cap. Keep a single
worker, restrict distribution of the tester code, and configure provider-side
quotas/monitoring before enabling. It is not suitable for unrestricted paid
public access without durable per-user quotas and proper authentication.
Cloud requests use the existing single document worker, bounded polling and
request timeouts. No automatic retry of submitted provider jobs is performed.
Only an explicit server-busy response with Retry-After is retried by the UI.
Provider errors are sanitized. Redirects are disabled and operation URLs must
stay under the configured Azure resource and model before credentials are sent.
Result deletion is requested after polling; deletion failure is disclosed for
completed analyses. Provider retention still applies, including incomplete jobs.

## Validation and activation status

Mock-provider tests cover consent, access-code checks, disabled mode, zero cloud
calls for standard scans, geometry/confidence, malformed polygons, page/quota
limits, operation URL validation, provider failures, cleanup and end-to-end
export with UNVERIFIED status and no second cloud call. These tests validate
integration logic, **not handwriting recognition accuracy**.

A real Azure round trip and handwriting benchmark are still required after
credentials are configured. Use fictional handwritten samples only: neat and
messy English, names/addresses, spaced IDs, rotated pages and low-contrast photos.
Check every returned box and export; do not claim tested recognition accuracy
or support for other languages until that benchmark is complete.

References:
- https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0
- https://learn.microsoft.com/en-us/rest/api/aiservices/document-models/analyze-document-from-stream?view=rest-aiservices-v4.0%20(2024-11-30)
- https://learn.microsoft.com/en-us/rest/api/aiservices/document-models/delete-analyze-result?view=rest-aiservices-v4.0%20(2024-11-30)
