// Cloudflare Workers entrypoint for the React SPA and its secure API gateway.
// Reuse the existing allowlisted gateway to avoid divergent Pages/Workers behavior.
import { onRequest as handleApi } from "../functions/api/[[path]].js";

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if ((pathname === "/api/health" || pathname === "/health") && request.method === "GET" && !env?.BACKEND_ORIGIN) {
      return Response.json({status:"ok",mode:"browser-local",server_processing:false,formats:["pdf","png","jpeg","txt","csv"],demo_only:true}, {headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      // This is a gateway, not the heavy Python OCR/redaction service.
      return handleApi({ request, env, waitUntil: ctx?.waitUntil?.bind(ctx) });
    }
    if (!env?.ASSETS) {
      return new Response("Application assets are not configured.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};

