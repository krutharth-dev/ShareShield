/** Stop waiting promptly; the owner still disposes its worker/PDF in finally. */
export function abortable<T>(work:Promise<T>,signal?:AbortSignal):Promise<T>{
 if(!signal)return work;
 return new Promise<T>((resolve,reject)=>{
  const abort=()=>reject(signal.reason??new DOMException('Operation cancelled','AbortError'));
  if(signal.aborted){work.catch(()=>{});abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  work.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
