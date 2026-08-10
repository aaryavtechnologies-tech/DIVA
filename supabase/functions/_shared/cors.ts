/* ============================================================
   Shared CORS lockdown for DIVA JEWELS edge functions.
   ------------------------------------------------------------
   Only the production storefront origin is allowed to call these
   functions from a browser. Everything else (curl, another site,
   a stolen script tag on a different domain) is rejected at the
   CORS layer before your handler logic even runs.

   To allow a second origin (e.g. a staging site), add it to
   ALLOWED_ORIGINS below — do NOT switch to reflecting the request's
   Origin header verbatim, since that defeats the allowlist.
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://divajewels.shop",
  "https://www.divajewels.shop",
  // TODO: remove before going live — local testing only.
  "http://localhost:8000",
];

/** Returns the right Access-Control-Allow-Origin value for this request's
 *  Origin header, or null if the origin isn't on the allowlist. */
export function resolveOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

export function buildCorsHeaders(origin: string | null): HeadersInit {
  const allowed = resolveOrigin(origin);
  return {
    // Falls back to the primary domain if the Origin header is missing/blocked,
    // so preflight requests still get a well-formed (if unusable) response
    // instead of throwing before we can return a clean 403.
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
