/** VID/BID are intentionally outside the mini project's redaction list.
 * Retain internal parsing of those values only to prevent false 12-digit
 * Aadhaar substrings from longer identifier strings.
 */
export const isVirtualId=(finding:{category:string}):boolean=>
 ['VIRTUAL_ID','AADHAAR_VIRTUAL_ID'].includes(finding.category.trim().toUpperCase());
export const selectableFinding=(finding:{category:string}):boolean=>!isVirtualId(finding);
export const selectableFindingIds=<T extends {id:string;category:string}>(items:readonly T[]):string[]=>
 [...new Set(items.filter(selectableFinding).map(f=>f.id))];
