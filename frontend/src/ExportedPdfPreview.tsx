import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Reopen the bytes created by ShareShield, rather than reusing the source
// preview. Chrome's embedded PDF plugin cannot reliably display blob PDFs.
GlobalWorkerOptions.workerSrc=pdfWorker;
export function ExportedPdfPreview({url}:{url:string}){
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
 const [page,setPage]=useState(1);
 const [error,setError]=useState('');
 const [rendered,setRendered]=useState(false);
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let cancelled=false;
  setDocument(null);setPage(1);setRendered(false);setError('');
  const task=getDocument({url,useSystemFonts:true,stopAtErrors:true});
  task.promise.then(doc=>{
   if(cancelled)return;
   setDocument(doc);
  }).catch(err=>{if(!cancelled)setError('Could not reopen exported PDF: '+(err instanceof Error?err.message:'unsupported file'));});
  return()=>{cancelled=true;void task.destroy().catch(()=>{});};
 },[url]);
 useEffect(()=>{
  if(!document||!canvasRef.current)return;
  let cancelled=false;
  setRendered(false);
  let rendering:{cancel:()=>void;promise:Promise<void>}|undefined;
  (async()=>{
   const pdfPage=await document.getPage(page);
   if(cancelled)return;
   const base=pdfPage.getViewport({scale:1});
   const scale=Math.min(1.4,1000/base.width,Math.sqrt(1_400_000/(base.width*base.height)));
   if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid exported page size.');
   const viewport=pdfPage.getViewport({scale});
   const canvas=canvasRef.current!;
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas rendering unavailable.');
   rendering=pdfPage.render({canvas,canvasContext:ctx,viewport});
   await rendering.promise;
   if(!cancelled)setRendered(true);
  })().catch(err=>{if(!cancelled)setError('Could not render exported page: '+(err instanceof Error?err.message:'unknown error'));});
  return()=>{cancelled=true;rendering?.cancel();};
 },[document,page]);
 return <section className="exported-preview" aria-label="Exported PDF page preview">
  <div className="exported-preview-controls"><strong>Actual exported PDF · {document?.numPages??'…'} page(s)</strong>
   <div>
    <button type="button" aria-label="Previous exported page" disabled={!document||page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
    <span>Page {page} / {document?.numPages??'…'}</span>
    <button type="button" aria-label="Next exported page" disabled={!document||page>=document.numPages} onClick={()=>setPage(p=>Math.min(document?.numPages??1,p+1))}>Next</button>
   </div>
  </div>
  {error?<p role="alert" className="exported-preview-error">{error} Download the file and inspect it manually.</p>:null}
  {document?<canvas ref={canvasRef} role="img" aria-label="Rendered exported PDF page" data-rendered={rendered?'true':'false'}/>:<p className="exported-preview-loading">Reopening the exported PDF for inspection…</p>}
  <p>These are pixels rendered from the actual downloaded file, not selection highlights. Inspect each page before sharing.</p>
 </section>;
}
