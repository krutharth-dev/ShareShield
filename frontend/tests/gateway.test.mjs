import test from "node:test";
import assert from "node:assert/strict";
import {onRequest} from "../functions/api/[[path]].js";

const site = "https://shield.example";
const req = (path, options={}) => new Request(site+path,options);
const ctx = (request, origin) => ({request,env:origin?{BACKEND_ORIGIN:origin}:{}});
test("rejects undocumented API routes without contacting backend", async()=>{
  const response=await onRequest(ctx(req("/api/admin/secrets"),"https://api.example"));
  assert.equal(response.status,404);
});
test("rejects unauthorized methods on file routes", async()=>{
  const response=await onRequest(ctx(req("/api/v1/files/abc/redact"),"https://api.example"));
  assert.equal(response.status,404);
});
test("blocks cross-origin POST requests", async()=>{
  const response=await onRequest(ctx(req("/api/v1/analyze",{
    method:"POST",headers:{"Origin":"https://malicious.example","Content-Type":"multipart/form-data; boundary=test"},body:"data"
  }),"https://api.example"));
  assert.equal(response.status,403);
});
test("enforces max declared upload body size", async()=>{
  const response=await onRequest(ctx(req("/api/v1/analyze",{
    method:"POST",headers:{"Content-Type":"multipart/form-data; boundary=test","Content-Length":"52428801"},body:"small"
  }),"https://api.example"));
  assert.equal(response.status,413);
});
test("fails closed when backend is not configured", async()=>{
  const response=await onRequest(ctx(req("/api/health")));
  assert.equal(response.status,503);
});
test("rejects unencrypted nonlocal origins", async()=>{
  const response=await onRequest(ctx(req("/api/health"),"http://backend.example"));
  assert.equal(response.status,503);
});
test("forwards an allowlisted health request without exposing backend origin", async(t)=>{
  let upstream;
  let forwardedHeaders;
  t.mock.method(globalThis,"fetch",async(url,options)=>{
    upstream=String(url); forwardedHeaders=options.headers;
    return new Response(JSON.stringify({status:"ok"}),{status:200,headers:{"Content-Type":"application/json"}});
  });
  const response=await onRequest(ctx(req("/api/health"),"https://backend.example"));
  assert.equal(response.status,200);
  assert.equal(upstream,"https://backend.example/health");
  assert.equal(forwardedHeaders.has("authorization"),false);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal((await response.json()).status,"ok");
});
test("does not follow backend redirects",async(t)=>{
  t.mock.method(globalThis,"fetch",async()=>new Response(null,{
    status:302,headers:{Location:"https://unexpected.example"}
  }));
  const response=await onRequest(ctx(req("/api/health"),"https://backend.example"));
  assert.equal(response.status,502);
  assert.equal(response.headers.get("location"),null);
});
test("sanitizes backend connection errors",async(t)=>{
  t.mock.method(globalThis,"fetch",async()=>{throw Error("private file content must not leak")});
  const response=await onRequest(ctx(req("/api/health"),"https://backend.example"));
  assert.equal(response.status,502);
  assert.doesNotMatch(await response.text(),/private file content/i);
});

