/* ============================================================
   Shared CORS lockdown for DIVA JEWELS edge functions.
   ------------------------------------------------------------
   Allows production storefront origins, cloudflare pages preview
   origins, and local development origins while rejecting
   unauthorized origins.
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://divajewels.shop",
  "https://www.divajewels.shop",
  "http://localhost:8000",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
];

/** Returns the right Access-Control-Allow-Origin value for this request's
 *  Origin header, or null if the origin isn't on the allowlist. */
export function resolveOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow Cloudflare Pages deployments (*.pages.dev)
  if (/^https:\/\/[a-zA-Z0-9-]+\.pages\.dev$/.test(origin)) {
    return origin;
  }
  return null;
}

export function buildCorsHeaders(origin: string | null): HeadersInit {
  const allowed = resolveOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/** Call at the top of every handler. Returns a Response to send back
 *  immediately if this is a disallowed-origin or preflight request —
 *  the caller should `return` it directly. Returns null if the request
 *  should proceed to normal handling. */
export function handleCors(req: Request): Response | null {
  const origin = req.headers.get("origin");
  const headers = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!resolveOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  return null;
}
