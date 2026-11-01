import {validatePhone} from './identifier-validation.ts';
import {labelledRules} from './category-registry.ts';
import type { Candidate, Risk } from './detection.ts';

/**
 * Conservative, context-labelled recognizers supplement the existing engine.
 * This is deterministic recognition, NOT trained multilingual AI or identity verification.
 * Preserve original UTF-16 offsets for OCR/PDF source localization.
 */
export function validLuhn(value: string): boolean {
  const digits = value.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(digits) || /^([0-9])\1+$/.test(digits)) return false;
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

export function detectExtended(text: string, existing: readonly Candidate[] = []): Candidate[] {
  const added: Candidate[] = [];
  const add = (category: string, value: string, start: number, risk: Risk, confidence: number, reason: string) => {
    const end = start + value.length;
    if (start < 0 || end > text.length || text.slice(start, end) !== value) return;
    if (/^(?:unknown|none|not available|n\/a|redacted)$/i.test(value.trim())) return;
    if (!value.trim() || /^\s*(?:\[REDACTED\]|••••)\s*$/i.test(value)) return;
    // Avoid duplicate source findings when the legacy rule already owns that span.
    if ([...existing, ...added].some(f => f.category!=='KANNADA_PERSONAL_DETAIL_REVIEW' && f.start === start && f.end === end)) return;
    added.push({ category, value, start, end, risk, detection_confidence: confidence, reason });
  };
  for (const rule of labelledRules) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[1] ?? match[0];
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

  const international = /(?<![A-Za-z0-9+])\+[1-9][0-9]*(?:[ \t-]?[0-9]+|[ \t]*\([0-9]+\)){1,7}(?![0-9])/g;
  for(const m of text.matchAll(international)) {
    if(m[0].replace(/\D/g,'').length>15||validatePhone(m[0]).status!=='passed')continue;
    add('INTERNATIONAL_PHONE_REVIEW',m[0],m.index!,'MEDIUM',.8,
      'Explicit international calling code; numbering-plan validation does not establish ownership');
  }

  // A bare university-seat-number-like code is review-only: layout and issuer rules vary.
  const unlabelledUsn = /\b[1-9][A-Z]{2,4}\d{2}[A-Z]{2,3}\d{2,4}\b/giu;
  for (const m of text.matchAll(unlabelledUsn)) {
    add('COLLEGE_USN_REVIEW', m[0], m.index!, 'HIGH', .58,
      'University-seat-number-shaped token; confirm student and institution context');
  }
  return added.sort((a, b) => a.start - b.start);
}
