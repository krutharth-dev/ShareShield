import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const origin = "https://shareshield-hackathon.example";
test("Worker serves React static assets through ASSETS", async () => {
  const request = new Request(origin + "/");
  let calls = 0;
  const response = await worker.fetch(request, {
    ASSETS: { fetch: async (req) => { calls++; assert.equal(req, request); return new Response("<h1>ShareShield</h1>"); } },
  }, {});
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ShareShield/);
});
test("Worker sends API calls to gateway rather than SPA assets", async () => {
  let assetsCalled = false;
  const response = await worker.fetch(new Request(origin + "/api/v1/analyze"), {
    ASSETS: { fetch: async () => { assetsCalled = true; return new Response("SPA"); } },
  }, {});
  assert.equal(response.status, 404);
  assert.equal(assetsCalled, false);
});
test("Worker fails closed when build output is missing", async () => {
  const response = await worker.fetch(new Request(origin + "/"), {}, {});
  assert.equal(response.status, 503);
});
test("Worker declares local mode without claiming server processing", async () => {
  const response = await worker.fetch(new Request(origin + "/api/health"), {}, {});
  assert.equal(response.status, 200);
  const data=await response.json();
  assert.equal(data.mode,"browser-local");
  assert.equal(data.server_processing,false);
});

