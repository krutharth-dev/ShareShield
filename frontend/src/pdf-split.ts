import {PDFDocument} from 'pdf-lib';
import {PDF_SPLIT_BATCH_PAGES} from './document-limits.ts';
/**
 * Split a PDF locally into independent <=8-page documents.
 * Original is never uploaded; every segment must be reviewed separately.
 */
export async function splitPdfLocally(file:File):Promise<File[]>{
 if(!file.name.toLowerCase().endsWith('.pdf'))throw Error('Only PDF files can be split.');
 if(file.size===0||file.size>8*1024*1024)throw Error('PDF splitting accepts files up to 8 MB.');
 const original=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(original.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF file signature.');
 let source:PDFDocument;
 try{source=await PDFDocument.load(original,{ignoreEncryption:false});}
 catch{throw Error('Could not safely open this PDF. Password-protected or malformed documents are unsupported.')}
 const pages=source.getPageCount();
 if(pages<=PDF_SPLIT_BATCH_PAGES)throw Error(`This PDF already fits within the ${PDF_SPLIT_BATCH_PAGES}-page analysis limit.`);
 const files:File[]=[];
 const base=file.name.replace(/\.pdf$/i,'');
 for(let i=0;i<pages;i+=PDF_SPLIT_BATCH_PAGES){
  const part=await PDFDocument.create();
  const subset=await part.copyPages(source,Array.from({length:Math.min(PDF_SPLIT_BATCH_PAGES,pages-i)},(_,j)=>i+j));
  subset.forEach(p=>part.addPage(p));
  // Carry no document metadata into the segmentation output.
  part.setTitle('Review segment');part.setSubject('Local processing');
  const bytes=await part.save();
  if(bytes.length>8*1024*1024)throw Error('A segment exceeds the 8 MB limit; split this PDF offline.');
  files.push(new File([bytes as BlobPart],base+'-part-'+(Math.floor(i/PDF_SPLIT_BATCH_PAGES)+1)+'.pdf',{type:'application/pdf'}));
 }
 return files;
}
