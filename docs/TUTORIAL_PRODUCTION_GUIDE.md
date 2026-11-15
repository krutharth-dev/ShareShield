# ShareShield — Five tutorial video production scripts

**Status:** scripts and shot lists only, **not recorded or rendered MP4 files**. Record only features that have actually passed acceptance tests. Use synthetic, visibly marked DEMO content and never capture browser tabs with real information. English primary narration; manually review Kannada captions before publishing. Add on-screen reminder: "Review results before sharing. SCOPED_CLEAR is limited to configured checks."

## Video 1 — Introduction / getting started (target 90 seconds)
0:00–0:10: Title card with product logo, "ShareShield — Detect, prioritize, review, protect".
0:10–0:30: Browser recording, show publicly reachable mini-project homepage and local-processing description.
0:30–0:55: Explain supported upload types and open workspace.
0:55–1:15: Show any existing language switcher. Do **not** claim complete Kannada localization until parity checks pass.
1:15–1:30: Show privacy reminder and link to other tutorials.
Narration: "ShareShield helps you find potentially sensitive information before sharing a document. Detection is not a guarantee; inspect the entire original and exported file."

## Video 2 — Upload / detection (target 120 seconds)
0:00–0:15: Show fictional PDF and image fixture names.
0:15–0:45: Upload and select OCR language, then run analysis.
0:45–1:15: Explain pattern-based and OCR findings. Show labelled fictional Aadhaar, VID, PAN, IFSC and phone fields; differentiate 12-digit Aadhaar from 16-digit VID.
1:15–1:45: Inspect source highlights, uncertainties and failures. Do **not** describe rule-based logic as a trained model.
1:45–2:00: Emphasize manual inspection of unreadable areas and missed fields.

## Video 3 — Priorities / automatic redaction (target 120 seconds)
0:00–0:30: Show ranked High, Medium and Low panels; numbering restarts per tier.
0:30–0:55: Change sharing purpose with synthetic medical vs academic examples.
0:55–1:20: Explain why confidential credentials and MRNs can outrank generic categories in their context.
1:20–1:45: Preview auto-selected, localized high-risk findings; never imply the system will mask every secret.
1:45–2:00: Show mandatory review and manual override.

## Video 4 — Manual masks / exported verification (target 150 seconds)
0:00–0:35: Draw an additional mask over synthetic missed text.
0:35–1:05: Move and resize a rectangle, and toggle a finding. Regenerate only from the original.
1:05–1:35: Download output and reopen it to inspect raw bytes and rendered pages where possible.
1:35–2:10: Show what FLAG, UNVERIFIED and SCOPED_CLEAR mean. "SCOPED_CLEAR does not certify anonymity."
2:10–2:30: Close with a manual-review checklist.

## Video 5 — English and Kannada / practical use cases (target 150 seconds)
0:00–0:35: Show current English/Kannada interface elements honestly; record full UI toggle only when localization is actually complete.
0:35–1:10: Upload fictional Kannada and mixed-script document with two independent residential addresses.
1:10–1:40: Demonstrate detection of a fictional college USN, MRN, patient name and Blood Group: O+; contrast Grade: O+.
1:40–2:05: Explain sharing purpose, unreadable spans and why all findings require context.
2:05–2:30: Safe-sharing reminder and where to report a missed field.

## Capture and publishing checklist
Use actual browser recordings at readable resolution; captions in English and proofread Kannada; no real patient, student, or financial documents. Include transcript, corresponding generated sample fixture, shot timestamps, thumbnail, licensed visual assets and lightweight MP4 export. Capture after successful CI and UI acceptance; embed in Tutorials only once real files exist. Never substitute a mock animation for a claimed feature.
