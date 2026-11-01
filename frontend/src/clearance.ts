import {classifyPriority,inferDocumentType,requiresManualReview,type SharingPurpose} from './priority.ts';
type Box={x:number;y:number;width:number;height:number};
type Finding={id:string;category:string;page:number;boxes:Box[];detection_confidence:number};
export function coverageCheck(findings:Finding[],selected:string[],manual:{page:number;box:Box}[],purpose:SharingPurpose,textOnly=false){
 const type=inferDocumentType(findings);const required=findings.filter(f=>classifyPriority(f.category,purpose,type).mandatory);
 const covered=(f:Finding)=>{
  if(textOnly)return selected.includes(f.id);
  if(!f.boxes.length)return false;
  const masks=[...findings.filter(g=>g.page===f.page&&selected.includes(g.id)).flatMap(g=>g.boxes),...manual.filter(m=>m.page===f.page).map(m=>m.box)];
  return f.boxes.every(b=>masks.some(m=>m.x<=b.x&&m.y<=b.y&&m.x+m.width>=b.x+b.width&&m.y+m.height>=b.y+b.height));
 };
 return {missingHigh:required.filter(f=>!requiresManualReview(f)&&!covered(f)),unresolvedReview:findings.filter(f=>requiresManualReview(f)&&!covered(f))};
}
