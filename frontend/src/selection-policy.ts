/** In the mini-project every located candidate, including labelled virtual IDs, is reviewable. */
export const isVirtualId=(finding:{category:string}):boolean=>
 ['VIRTUAL_ID','AADHAAR_VIRTUAL_ID'].includes(finding.category.trim().toUpperCase());
export const selectableFinding=(_finding:{category:string}):boolean=>true;
export const selectableFindingIds=<T extends {id:string;category:string}>(items:readonly T[]):string[]=>
 [...new Set(items.filter(selectableFinding).map(f=>f.id))];
