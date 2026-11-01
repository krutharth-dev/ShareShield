/**
 * ShareShield Cloudflare Pages API gateway.
 * It only forwards documented routes to the configured FastAPI origin.
 * Set BACKEND_ORIGIN as a server-side Pages secret/configuration.
 *
 * Security boundary: the FastAPI service must authenticate users, authorize
 * file IDs and downloads, validate file content and enforce size limits.
 * This gateway does not create user identity or verify redactions.
 */
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const FILE_OPERATION = /^\/api\/v1\/files\/[A-Za-z0-9_-]{1,128}\/(redact|download)$/;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function fail(status, message) {
  return new Response(JSON.stringify({ detail: message }), { status, headers: JSON_HEADERS });
}
function allowed(pathname, method) {
  if(pathname === "/api/health" && method === "GET") return true;
  if(pathname === "/api/v1/analyze" && method === "POST") return true;
  if(FILE_OPERATION.test(pathname)) {
    return pathname.endsWith("/redact") ? method === "POST" : method === "GET";
  }
  return false;
}
export async function onRequest(context) {
  const {request, env} = context;
  const requestUrl = new URL(request.url);
  const {pathname} = requestUrl;
  const method = request.method.toUpperCase();
  if(!allowed(pathname, method)) return fail(404, "Unknown API operation.");
  if(method === "POST") {
    const origin = request.headers.get("Origin");
    if(origin && origin !== requestUrl.origin) return fail(403, "Cross-origin upload is not allowed.");
    const size = Number(request.headers.get("Content-Length") || 0);
    if(size > MAX_BATCH_BYTES) return fail(413, "Batch exceeds 50 MB.");
    const contentType = request.headers.get("Content-Type") || "";
    if(pathname === "/api/v1/analyze" && !contentType.startsWith("multipart/form-data;"))
      return fail(415, "Expected multipart upload.");
    if(pathname.endsWith("/redact") && !contentType.startsWith("application/json"))
      return fail(415, "Expected JSON.");
  }
  // Health reflects browser-local processing, not a hosted Python/Tesseract API.
  if(pathname === "/api/health" && !env?.BACKEND_ORIGIN)
    return new Response(JSON.stringify({status:"ok",mode:"browser-local",server_processing:false,demo_only:true}),{status:200,headers:JSON_HEADERS});
  if(!env?.BACKEND_ORIGIN) return fail(503, "Processing backend has not been configured.");
  let backend;
  try{
    backend = new URL(env.BACKEND_ORIGIN);
    if(backend.username || backend.password || backend.pathname !== "/" || backend.search ||
       !((backend.protocol === "https:") || (backend.protocol === "http:" && ["localhost","127.0.0.1"].includes(backend.hostname))))
      return fail(503, "Invalid backend configuration.");
  }catch{return fail(503, "Invalid backend configuration.");}
  const upstream = new URL(pathname === "/api/health" ? "/health" : pathname, backend.origin);
  const headers = new Headers();
  for(const key of ["accept","content-type","cookie","authorization","x-csrf-token"]){
    const value = request.headers.get(key);
    if(value) headers.set(key, value);
  }
  headers.set("X-Request-Id", crypto.randomUUID());
  let response;
  try {
    response = await fetch(upstream, {
      method,
      headers,
      body: method === "GET" ? undefined : request.body,
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    return fail(502, "Processing service unavailable or timed out.");
  }
  // Do not forward arbitrary upstream headers, especially CORS or redirects.
  if(response.status >= 300 && response.status < 400) return fail(502, "Unexpected backend redirect.");
  const outgoing = new Headers();
  for(const key of ["content-type","content-disposition","content-length","etag"]){
    const value = response.headers.get(key);
    if(value) outgoing.set(key, value);
  }
  outgoing.set("Cache-Control","no-store");
  outgoing.set("X-Content-Type-Options","nosniff");
  outgoing.set("Referrer-Policy","no-referrer");
  return new Response(response.body,{status:response.status,headers:outgoing});
}

