/** Fail-cautious DOCX import/export: text-only rebuild, never copy source container parts. */
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const MAX_ENTRIES=512,MAX_EXPANDED=20*1024*1024,MAX_XML=6*1024*1024;
const xmlNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function u16(v:DataView,p:number){return v.getUint16(p,true)}
function u32(v:DataView,p:number){return v.getUint32(p,true)}
function crc32(b:Uint8Array){let c=0xffffffff;for(const byte of b){c^=byte;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1}return(c^0xffffffff)>>>0}
function concat(parts:Uint8Array[]){const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){b.set(p,i);i+=p.length}return b}
async function inflate(b:Uint8Array,method:number){
 if(method===0)return b;
 if(method!==8)throw Error('DOCX compression unsupported.');
 try{
  const stream=new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader=stream.getReader(),parts:Uint8Array[]=[];let total=0;
  try{
   for(;;){
    const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>MAX_XML){await reader.cancel();throw Error('Oversized DOCX document XML');}
    parts.push(value);
   }
  }finally{reader.releaseLock()}
  return concat(parts);
 }catch{throw Error('Cannot safely decompress DOCX in this browser. Try current Chrome or convert to PDF.')}
}
/** Strictly read selected part; encrypted/oversized ZIP archives are rejected. */
export async function readZipPart(bytes:Uint8Array,part:string){
 if(bytes.length<22||bytes.length>8*1024*1024)throw Error('DOCX must be under 8 MB.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(v,i)===0x06054b50){end=i;break}
 if(end<0||u16(v,end+4)!==0||u16(v,end+6)!==0)throw Error('Invalid or multi-volume DOCX ZIP.');
 const count=u16(v,end+10),start=u32(v,end+16),directorySize=u32(v,end+12);
 if(count===0||count>MAX_ENTRIES||start+directorySize>bytes.length)throw Error('Invalid DOCX central directory.');
 let p=start,expanded=0;
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||u32(v,p)!==0x02014b50)throw Error('Corrupt DOCX archive.');
  const flags=u16(v,p+8),method=u16(v,p+10),crc=u32(v,p+16),size=u32(v,p+20),raw=u32(v,p+24);
  const nameLen=u16(v,p+28),extra=u16(v,p+30),comment=u16(v,p+32),local=u32(v,p+42);
  if(p+46+nameLen+extra+comment>bytes.length)throw Error('Corrupt DOCX entry.');
  const name=dec.decode(bytes.subarray(p+46,p+46+nameLen));p+=46+nameLen+extra+comment;
  if(name.startsWith('/')||name.includes('..')||name.includes('\\')||name.includes('\0'))throw Error('Unsafe DOCX archive entry.');
  if(flags&1)throw Error('Encrypted DOCX not supported.');
  expanded+=raw;if(expanded>MAX_EXPANDED||size>8*1024*1024)throw Error('DOCX exceeds resource limits.');
  if(name!==part)continue;
  if(raw>MAX_XML||local+30>bytes.length||u32(v,local)!==0x04034b50)throw Error('Invalid DOCX document XML.');
  const dataOffset=local+30+u16(v,local+26)+u16(v,local+28);
  if(dataOffset+size>bytes.length)throw Error('DOCX entry extends beyond archive.');
  const data=await inflate(bytes.subarray(dataOffset,dataOffset+size),method);
  if(data.length!==raw||crc32(data)!==crc)throw Error('DOCX integrity check failed.');
  return dec.decode(data);
 }
 throw Error('DOCX is missing word/document.xml.');
}
function decodeEntities(s:string){return s.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g,v=>{
 const named:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
 if(named[v]!==undefined)return named[v];
 const hex=v.startsWith('&#x'),n=parseInt(v.slice(hex?3:2,-1),hex?16:10);
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
})}
function escapeXml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
/** Keep Unicode English/Hindi/Kannada text; flatten paragraphs, tables and inline runs. */
export function extractDocxText(xml:string){
 if(xml.length>MAX_XML||!xml.includes(xmlNS))throw Error('DOCX Word XML is unsupported.');
 const root=xml.match(/<([A-Za-z][\w.-]*):document\b[^>]*>/);
 if(!root)throw Error('DOCX root missing.');
 const prefix=root[1].replace(/\./g,'\\.');
 const para=new RegExp('<'+prefix+':p(?=[\\s>])[^>]*>([\\s\\S]*?)<\\/'+prefix+':p\\s*>','g');
 const inline=new RegExp('<'+prefix+':(t|tab|br|cr)(?=[\\s/>])[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/'+prefix+':\\1\\s*>)','g');
 const lines:string[]=[];
 for(const match of xml.matchAll(para)){
  let line='';for(const run of match[1].matchAll(inline))line+=run[1]==='t'?decodeEntities(run[2]??''):run[1]==='tab'?'\t':'\n';
  lines.push(line);
 }
 if(!lines.length)throw Error('No supported DOCX paragraphs; convert to PDF to review.');
 return lines.join('\n');
}
function put16(v:DataView,p:number,n:number){v.setUint16(p,n,true)}
function put32(v:DataView,p:number,n:number){v.setUint32(p,n>>>0,true)}
function zip(entries:{name:string;data:string}[]){
 const local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const e of entries){
  const name=enc.encode(e.name),body=enc.encode(e.data),crc=crc32(body),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
  put32(v,0,0x04034b50);put16(v,4,20);put16(v,6,0x800);put32(v,14,crc);put32(v,18,body.length);put32(v,22,body.length);put16(v,26,name.length);h.set(name,30);
  local.push(h,body);
  const c=new Uint8Array(46+name.length),dv=new DataView(c.buffer);
  put32(dv,0,0x02014b50);put16(dv,4,20);put16(dv,6,20);put16(dv,8,0x800);put32(dv,16,crc);put32(dv,20,body.length);put32(dv,24,body.length);put16(dv,28,name.length);put32(dv,42,offset);c.set(name,46);central.push(c);offset+=h.length+body.length;
 }
 const directory=concat(central),end=new Uint8Array(22),ev=new DataView(end.buffer);
 put32(ev,0,0x06054b50);put16(ev,8,entries.length);put16(ev,10,entries.length);put32(ev,12,directory.length);put32(ev,16,offset);
 return concat([...local,directory,end]);
}
/** Produce a brand-new DOCX with only visible extracted text; formatting/media are discarded. */
export function createTextOnlyDocx(text:string){
 if(text.length>500000)throw Error('DOCX text is too large.');
 const paragraphs=text.split(/\r?\n/).map(t=>'<w:p><w:r><w:t xml:space="preserve">'+escapeXml(t)+'</w:t></w:r></w:p>').join('');
 return zip([
  {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
  {name:'word/document.xml',data:'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'+xmlNS+'"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>'}
 ]);
}
export async function readDocx(bytes:Uint8Array){return extractDocxText(await readZipPart(bytes,'word/document.xml'))}
