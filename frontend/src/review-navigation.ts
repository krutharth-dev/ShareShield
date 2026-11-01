type LocatedFinding = {id:string;boxes:readonly unknown[]};

// Keep the cursor in the complete finding order so covering the current
// finding advances to its successor instead of restarting at the first one.
export function nextUnresolvedFinding<T extends LocatedFinding>(ordered:readonly T[],unresolved:readonly T[],previousId?:string):T|undefined{
 const remaining=new Set(unresolved.filter(f=>f.boxes.length>0).map(f=>f.id));
 const previous=ordered.findIndex(f=>f.id===previousId);
 for(let offset=1;offset<=ordered.length;offset++){
  const candidate=ordered[(previous+offset)%ordered.length];
  if(remaining.has(candidate.id))return candidate;
 }
 return undefined;
}
