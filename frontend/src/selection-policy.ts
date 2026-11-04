/** Keep VID/BID distinct from 12-digit Aadhaar during internal recognition.
 * Virtual identifiers are not selectable redactions in this mini-project.
 */
export const isVirtualId=(finding:{category:string}):boolean=>
 ['VIRTUAL_ID','AADHAAR_VIRTUAL_ID'].includes(finding.category.trim().toUpperCase());
export const selectableFinding=(finding:{category:string}):boolean=>!isVirtualId(finding);
export const selectableFindingIds=<T extends {id:string;category:string}>(items:readonly T[]):string[]=>
 [...new Set(items.filter(selectableFinding).map(f=>f.id))];
