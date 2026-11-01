// Provisional contract. Backend must enforce file ownership and perform actual verification.
export type Risk = "CRITICAL" | "HIGH" | "MEDIUM" | "CONTEXT_DEPENDENT";
export type VerificationStatus = "FLAG" | "UNVERIFIED" | "SCOPED_CLEAR";
export type Finding = { id:string; category:string; risk:Risk; confidence?:number; preview:string; location?:{page?:number;bbox?:[number,number,number,number]} };
export type Analysis = { file_id:string; filename:string; status:"ready"|"processing"|"unsupported"|"error"; findings:Finding[]; language?:string; message?:string };
export type Verification = { status:VerificationStatus; summary:string; checks?:{name:string;passed:boolean|null;detail?:string}[] };
export type RedactionResult = {file_id:string; download_url?:string; verification:Verification };

// Empty base = same-origin Cloudflare Pages Functions at /api/*.
// A full backend origin, e.g. http://localhost:8000, is useful for local development.
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const allowedRisks = new Set<Risk>(["CRITICAL","HIGH","MEDIUM","CONTEXT_DEPENDENT"]);
const allowedStatuses = new Set<VerificationStatus>(["FLAG","UNVERIFIED","SCOPED_CLEAR"]);

export class ApiError extends Error { constructor(message:string, public status:number){super(message)} }
function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v)}
function invalid():never { throw new ApiError("Unexpected response format from the processing service.",502) }

async function api(path:string,init?:RequestInit):Promise<unknown>{
  let response:Response;
  const headers:Record<string,string> = {};
  if (init?.body && !(init.body instanceof FormData)) headers["Content-Type"]="application/json";
  try {
    response=await fetch(BASE+path,{
      ...init,
      headers:{...headers,...init?.headers},
      credentials:BASE.startsWith("http")?"omit":"same-origin",
      cache:"no-store",
    });
  } catch { throw new ApiError("Could not connect to the processing service. Check the API configuration.",0) }
  if(!response.ok){
    let message="Processing service returned HTTP "+response.status+".";
    // Never display raw backend exception traces or document contents in error messages.
    if(response.status===413)message="Upload exceeds the server size limit.";
    if(response.status===401||response.status===403)message="Access denied. Your session may have expired.";
    if(response.status===429)message="Too many requests. Try again later.";
    if(response.status===503)message="Processing service is not configured or available.";
    throw new ApiError(message,response.status);
  }
  try {return await response.json()} catch {return invalid()}
}

export async function checkHealth():Promise<{status:string}>{
 const value=await api(BASE?"/health":"/api/health");
 if(!isRecord(value)||typeof value.status!=="string")return invalid();
 return {status:value.status};
}

export async function analyzeFiles(files:File[]):Promise<Analysis[]>{
 const form=new FormData(); files.forEach(f=>form.append("files",f,f.name));
 const value=await api("/api/v1/analyze",{method:"POST",body:form});
 if(!isRecord(value)||!Array.isArray(value.files)||value.files.length!==files.length)return invalid();
 return value.files.map((entry:unknown):Analysis=>{
   if(!isRecord(entry)||typeof entry.file_id!=="string"||!entry.file_id||
      typeof entry.filename!=="string"||!["ready","processing","unsupported","error"].includes(String(entry.status))||
      !Array.isArray(entry.findings))return invalid();
   const findings:Finding[]=entry.findings.map((f:unknown):Finding=>{
     if(!isRecord(f)||typeof f.id!=="string"||typeof f.category!=="string"||
        !allowedRisks.has(f.risk as Risk)||typeof f.preview!=="string")return invalid();
     return {id:f.id,category:f.category,risk:f.risk as Risk,preview:f.preview,
       ...(typeof f.confidence==="number"&&f.confidence>=0&&f.confidence<=1?{confidence:f.confidence}:{})};
   });
   return {file_id:entry.file_id,filename:entry.filename,status:entry.status as Analysis["status"],findings,
     ...(typeof entry.language==="string"?{language:entry.language}:{}),
     ...(typeof entry.message==="string"?{message:entry.message}:{})};
 });
}

export async function redactFile(fileId:string,findingIds:string[]):Promise<RedactionResult>{
 const value=await api("/api/v1/files/"+encodeURIComponent(fileId)+"/redact",{
   method:"POST",body:JSON.stringify({finding_ids:findingIds})
 });
 if(!isRecord(value)||value.file_id!==fileId||!isRecord(value.verification)||
    !allowedStatuses.has(value.verification.status as VerificationStatus)||
    typeof value.verification.summary!=="string")return invalid();
 const verification:Verification={
   status:value.verification.status as VerificationStatus,
   summary:value.verification.summary,
 };
 if(Array.isArray(value.verification.checks)){
   verification.checks=value.verification.checks.filter((c:unknown):c is {name:string;passed:boolean|null;detail?:string} =>
     isRecord(c)&&typeof c.name==="string"&&(typeof c.passed==="boolean"||c.passed===null)
   );
 }
 return {file_id:fileId,verification,
   ...(typeof value.download_url==="string"?{download_url:value.download_url}:{})};
}

export function downloadUrl(path:string):string {
  // Only same-origin, server-authorized download URLs are acceptable.
  // A backend may return /api/v1/files/<id>/download; reject arbitrary URLs.
  const trustedOrigin = window.location.origin;
  const baseUrl = BASE ? new URL(BASE, trustedOrigin) : new URL(trustedOrigin);
  const route = /^\/api\/v1\/files\/[A-Za-z0-9_-]{1,128}\/download$/;
  const url = new URL(path, baseUrl.origin);
  if (url.origin !== baseUrl.origin || url.username || url.password ||
      url.search || url.hash || !route.test(url.pathname)) {
    throw new Error("Backend returned an untrusted download URL.");
  }
  return url.href;
}

