/** ShareShield's offline, deliberately constrained helper knowledge base.
 * No documents, finding values or user questions leave the browser.
 * Answers explain the workflow; they are not proof of privacy or legal advice.
 */
export type HelpTopic = {
  id: string
  label: string
  triggers: string[]
  answer: string
}
export const helpTopics: HelpTopic[] = [
  { id: 'start', label: 'How do I start?', triggers: ['start','begin','first','new','how to use','steps','guide','tutorial','work'],
    answer: 'Pick a file or load the fictional sample, choose the privacy categories, and press Analyze document. Check every suggestion, then Generate & verify. Review the exported pages before downloading.' },
  { id: 'upload', label: 'What files can I use?', triggers: ['upload','file type','format','supported','pdf','word','excel','powerpoint','size','12 mib','heic'],
    answer: 'You can choose PDF, JPG/PNG and other supported images, DOCX, PPTX, XLSX, CSV, and TXT (up to 12 MiB). Image and PDF previews support manual masks. Word and spreadsheet files use text-based review; visual previews are not provided for those formats.' },
  { id: 'aadhaar', label: 'How do I hide an Aadhaar or ID?', triggers: ['aadhaar','aadhar','pan number','identity','national id','vid','id number','card number','upi','financial'],
    answer: 'Choose the Identity or Financial privacy category. After scanning, inspect each highlighted candidate, including repeated numbers. Use permanent blackout for identity details. If the scanner misses anything in an image or PDF, draw a manual mask.' },
  { id: 'faces', label: 'Can I hide a face?', triggers: ['face','photo','picture','portrait','person','blur face','pixelate face'],
    answer: 'For images and PDFs, enable the Face / photograph category, inspect suggested face regions, and draw manual masks for anything missed. Blur and pixelation visually obscure an area but may be reversible; use blackout for stronger privacy.' },
  { id: 'mask', label: 'How do I draw a mask?', triggers: ['draw','mask','missed','manual','rectangle','cover','hide a part','region','edit box'],
    answer: 'After analyzing an image or PDF, open Review workspace and enable Drawing masks. Drag over a private area on the ORIGINAL page. You can select a box, resize it, move it, undo it or delete it before generating the output.' },
  { id: 'blur', label: 'Blackout, blur or pixelate?', triggers: ['blackout','blur','pixel','effect','permanent','safe method','safest','method'],
    answer: 'Blackout is the recommended choice for names, IDs, phone numbers and other text. Blur/pixelation are primarily visual effects for faces or manually chosen regions and may not irreversibly erase information. Always review the exported copy.' },
  { id: 'detect', label: 'What does the scan find?', triggers: ['detect','scan','finding','candidate','high risk','high-risk','ocr','no findings','nothing found'],
    answer: 'Scanning proposes supported identity, contact, financial and some visual candidates using OCR and patterns. A finding is only a suggestion. Zero findings does NOT mean a document is safe; inspect pages, signatures, codes and text the scanner may have missed.' },
  { id: 'verify', label: 'What does verification mean?', triggers: ['verify','verification','pass_scoped','pass scoped','unverified','flag','failed','report','remaining','status'],
    answer: 'PASS_SCOPED means implemented checks found no supported leftovers in the scoped reinspection—not full sanitization. UNVERIFIED means extra visual review is needed. FLAG means detected risk remains and export is blocked. None of these states guarantees perfect privacy.' },
  { id: 'download', label: "Why can't I download?", triggers: ['download','save','export','disabled','blocked','button not working','greyed','grayed'],
    answer: 'First select or draw redactions, then Generate & verify. If verification FLAGs the output, fix the remaining findings and regenerate. Otherwise visually check every exported PDF/image page and tick the final acknowledgement checkbox before downloading.' },
  { id: 'private', label: 'Are my files private?', triggers: ['private','privacy','offline','on-device','on device','server','internet','cloud','data stored','data save','retain','history','security','whatsapp','gmail'],
    answer: 'In the bundled local demo, selected files are sent to your own 127.0.0.1 FastAPI server for processing; no automatic Gmail or WhatsApp monitoring occurs. The app has no document-history database, but downloaded files remain on your computer. Remote hosting changes where files go. See Privacy & safety for details.' },
]

export function answerHelpQuestion(raw: string): { title: string; response: string; id: string } {
  const query = raw.trim().slice(0, 180).toLowerCase()
  if (!query) return { title: 'Ask me anything about ShareShield', response: 'Try a quick question below, or ask how to upload, redact, review or download a file.', id: 'empty' }
  // Do not echo or retain accidental document identifiers or contact data.
  if (/(?:\b\d[\d\s-]{8,}\d\b)|(?:[\w.+-]+@[\w.-]+\.[a-z]{2,})|(?:\b[A-Z]{5}\d{4}[A-Z]\b)/i.test(raw)) {
    return { title: 'Keep private details out of chat', response: 'Please do not paste personal numbers, addresses or document text here. You can ask a general question such as “How do I hide an ID?” The helper does not need your private details.', id: 'private-input' }
  }
  // Prefer whole trigger phrases and longer matches to avoid false results.
  const matches = helpTopics.flatMap((topic) => topic.triggers
    .filter(trigger => query.includes(trigger))
    .map(trigger => ({ topic, score: trigger.length + (query === trigger ? 30 : 0) })))
    .sort((a,b) => b.score - a.score)
  if (matches.length) {
    const topic = matches[0].topic
    return { title: topic.label, response: topic.answer, id: topic.id }
  }
  return { title: 'I can help with ShareShield basics', response: 'I am a small offline guide, not an open-ended AI model. Try “How do I redact?”, “Why is export blocked?”, “How do I hide a face?” or choose a quick question below. No question is sent to an external service.', id: 'fallback' }
}
