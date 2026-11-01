import type { Candidate, Risk } from './detection.ts';

/**
 * Conservative, context-labelled recognizers supplement the existing engine.
 * This is deterministic recognition, NOT trained multilingual AI or identity verification.
 * Preserve original UTF-16 offsets for OCR/PDF source localization.
 */
export function validLuhn(value: string): boolean {
  const digits = value.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let total = 0, alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    total += n;
    alternate = !alternate;
  }
  return total % 10 === 0;
}

export function validIbanChecksum(value: string): boolean {
  const iban = value.replace(/[ \t-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const expanded = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

type Rule = {
  category: string;
  pattern: RegExp;
  risk: Risk;
  confidence: number;
  reason: string;
};

/** Match the value capture only, not the label; never consume a neighbouring field. */
const labelledRules: Rule[] = [
  {
    category: 'PATIENT_ID',
    pattern: /(?:ರೋಗಿಯ?\s*(?:ಗುರುತಿನ\s*)?(?:ಸಂಖ್ಯೆ|ಐಡಿ)|patient\s*registration\s*(?:id|no\.?|number))\s*[:：#=\-]\s*([A-Z0-9೦-೯-]{3,30})/giu,
    risk: 'HIGH', confidence: .88, reason: 'Explicit patient identifier label; no issuer verification'
  },
  {
    category: 'MEDICAL_RECORD_NUMBER',
    pattern: /(?:ವೈದ್ಯಕೀಯ\s*(?:ದಾಖಲೆ|ರೆಕಾರ್ಡ್)\s*(?:ಸಂಖ್ಯೆ|ನಂಬರ್)|ಆಸ್ಪತ್ರೆ\s*(?:ನೋಂದಣಿ|ದಾಖಲೆ)\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9೦-೯-]{3,30})/giu,
    risk: 'HIGH', confidence: .9, reason: 'Explicit Kannada medical record or hospital registration label'
  },
  {
    category: 'PATIENT_NAME_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:patient\s*name|ರೋಗಿಯ\s*ಹೆಸರು)\s*[:：=\-]\s*([^\r\n]{3,90})/giu,
    risk: 'HIGH', confidence: .68, reason: 'Labelled patient identity; review names against source'
  },
  {
    category: 'MEDICAL_DIAGNOSIS_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:ರೋಗನಿರ್ಣಯ|diagnostic\s*impression)\s*[:：=\-]\s*([^\r\n]{2,180})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Labelled clinical diagnosis; clinical interpretation requires review'
  },
  {
    category: 'MEDICAL_TEST_RESULT_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:ಲ್ಯಾಬ್\s*ಫಲಿತಾಂಶ|ಪರೀಕ್ಷೆಯ\s*ಫಲಿತಾಂಶ|ರಕ್ತ\s*ಪರೀಕ್ಷೆ|pathology\s*result)\s*[:：=\-]\s*([^\r\n]{2,180})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Labelled laboratory or pathology result; interpretation requires review'
  },
  {
    category: 'CLINICAL_NOTE_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:clinical\s*notes?|ವೈದ್ಯಕೀಯ\s*ಟಿಪ್ಪಣಿ|ಚಿಕಿತ್ಸೆಯ\s*ವಿವರ)\s*[:：=\-]\s*([^\r\n]{3,180})/giu,
    risk: 'MEDIUM', confidence: .67, reason: 'Labelled clinical notes may contain several sensitive details'
  },
  {
    category: 'MEDICAL_PROCEDURE_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:procedure|surgery|operation|ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ)\s*[:：=\-]\s*([^\r\n]{3,180})/giu,
    risk: 'MEDIUM', confidence: .68, reason: 'Labelled treatment or surgery information'
  },
  {
    category: 'ACADEMIC_ADMISSION_ID',
    pattern: /(?:admission\s*(?:no\.?|number|id)|university\s*registration\s*(?:no\.?|number)|examination\s*seat\s*(?:no\.?|number)|ಪ್ರವೇಶ\s*ಸಂಖ್ಯೆ|ನೋಂದಣಿ\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9೦-೯/-]{4,30})/giu,
    risk: 'HIGH', confidence: .86, reason: 'Labelled admission, university or examination identifier'
  },
  {
    category: 'EMERGENCY_CONTACT_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:emergency\s*contact|ತುರ್ತು\s*ಸಂಪರ್ಕ)\s*[:：=\-]\s*([^\r\n]{4,100})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Emergency contact may identify another person; review the entire field'
  },
  {
    category: 'VEHICLE_REGISTRATION_REVIEW',
    pattern: /(?:vehicle\s*(?:registration|number|no\.?)|registration\s*plate|ವಾಹನ\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9 -]{6,24})/giu,
    risk: 'MEDIUM', confidence: .65, reason: 'Vehicle identifier may be personal depending on its owner and recipient'
  },
  {
    category: 'INSURANCE_POLICY_REVIEW',
    pattern: /(?:insurance\s*policy\s*(?:number|no\.?|id)|ವಿಮೆ\s*(?:ಪಾಲಿಸಿ\s*)?ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9/-]{5,32})/giu,
    risk: 'HIGH', confidence: .7, reason: 'Explicit insurance-policy identifier; type and validity not confirmed'
  },
  {
    category: 'INTERNATIONAL_PHONE_REVIEW',
    pattern: /(?:international\s*(?:mobile|phone)|overseas\s*phone|contact\s*number)\s*[:：=\-]\s*(\+[1-9][0-9 ()-]{7,21})/giu,
    risk: 'MEDIUM', confidence: .58, reason: 'International telephone-shaped value; country-specific metadata not yet validated'
  }
];

export function detectExtended(text: string, existing: readonly Candidate[] = []): Candidate[] {
  const added: Candidate[] = [];
  const add = (category: string, value: string, start: number, risk: Risk, confidence: number, reason: string) => {
    const end = start + value.length;
    if (start < 0 || end > text.length || text.slice(start, end) !== value) return;
    if (!value.trim() || /^\s*(?:\[REDACTED\]|••••)\s*$/i.test(value)) return;
    // Avoid duplicate source findings when the legacy rule already owns that span.
    if ([...existing, ...added].some(f => f.start === start && f.end === end)) return;
    added.push({ category, value, start, end, risk, detection_confidence: confidence, reason });
  };
  for (const rule of labelledRules) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[1];
      if (!value) continue;
      add(rule.category, value, match.index! + match[0].lastIndexOf(value),
        rule.risk, rule.confidence, rule.reason);
    }
  }

  // Labelled payment cards are never assumed issued/active. Even Luhn-pass is only structural.
  const cards = /(?:payment\s*card|card\s*(?:number|no\.?)|credit\s*card|debit\s*card)\s*[:：#=\-]\s*((?:\d[ \t-]?){12,18}\d)(?!\d)/giu;
  for (const m of text.matchAll(cards)) {
    const value = m[1], start = m.index! + m[0].lastIndexOf(value);
    add('PAYMENT_CARD_REVIEW', value, start, 'HIGH', validLuhn(value) ? .7 : .45,
      validLuhn(value) ? 'Card-number structure and Luhn checksum passed; issuance not established' : 'Labelled payment-card value did not pass checksum; inspect OCR');
  }

  // Require the explicit IBAN label. Country-specific lengths still need reference validation.
  const ibanLabels = /(?:^|\n)[ \t]*(?:IBAN|international\s*bank\s*account\s*number)\s*[:：#=\-]\s*([A-Z]{2}\d{2}[A-Z0-9 \t-]{11,45})/gim;
  for (const m of text.matchAll(ibanLabels)) {
    const value = m[1].trimEnd();
    if (!/^[A-Z]{2}\d{2}/i.test(value)) continue;
    const start = m.index! + m[0].lastIndexOf(value);
    add('IBAN_REVIEW', value, start, 'HIGH', validIbanChecksum(value) ? .7 : .42,
      validIbanChecksum(value) ? 'IBAN mod-97 passed; country length and account ownership not checked' : 'IBAN labelled but checksum or length is invalid; manual review');
  }

  // A bare university-seat-number-like code is review-only: layout and issuer rules vary.
  const unlabelledUsn = /\b[1-9][A-Z]{2,4}\d{2}[A-Z]{2,3}\d{2,4}\b/giu;
  for (const m of text.matchAll(unlabelledUsn)) {
    add('COLLEGE_USN_REVIEW', m[0], m.index!, 'HIGH', .58,
      'University-seat-number-shaped token; confirm student and institution context');
  }
  return added.sort((a, b) => a.start - b.start);
}
