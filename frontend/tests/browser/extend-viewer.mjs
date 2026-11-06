import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url=process.env.EXTEND_TEST_URL??'http://127.0.0.1:4176/extend-preview.html';
const origin=new URL(url).origin;
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({serviceWorkers: "block"});
 const page=await context.newPage();
 const external=[];const errors=[];const responses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().endsWith('.wasm'))responses.push({url:r.url(),status:r.status()});});
 await context.route('**/*',route=>{
  const target=new URL(route.request().url());
  if(['http:','https:'].includes(target.protocol)&&target.origin!==origin){external.push(target.origin);return route.abort();}
  return route.continue();
 });
 await page.goto(url);
 await page.getByRole('status').filter({hasText:'Loaded 1 page'}).waitFor({timeout:60000});
 await page.waitForFunction(() => [...document.images].some(img => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 300 && img.getBoundingClientRect().width > 300), null, { timeout: 30000 });
 assert.equal(external.length,0,`External requests attempted: ${external}`);
 assert.deepEqual(errors,[]);
 assert.ok(responses.some(r=>r.status===200),'Local PDFium WASM must load');
 console.log(JSON.stringify({pass:true,browser:browser.version(),localWasm:responses,externalRequests:external.length}));
} finally {await browser.close();}
