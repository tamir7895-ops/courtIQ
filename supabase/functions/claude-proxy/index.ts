// CourtIQ claude-proxy — LEGACY pass-through, now fenced in.
// ---------------------------------------------------------------
// What this used to be: `const body = await req.text()` forwarded verbatim
// to Anthropic on the project's API key. Any signed-in user could name any
// model, any max_tokens, any system prompt, as often as they liked, and the
// bill landed on us. Authentication was the ONLY gate, and authentication
// is not authorization — every registered account was a free LLM.
//
// New coach traffic goes to `coach-chat`, which pins the model server-side
// and rate-limits per user. Nothing in the shipped app calls this function
// any more (the remaining callers — js/ai-coach.js, js/dashboard.js,
// js/player-analysis.js, js/training-panel.js — are legacy files whose
// entry points app-v10 never reaches). It stays deployed only so an older
// build still in someone's hands doesn't hard-fail, and it now costs what
// that promise is worth and no more:
//
//   - model must be on ALLOWED_MODELS (what the legacy callers actually ask
//     for), otherwise 400
//   - max_tokens clamped to MAX_TOKENS
//   - body size capped, JSON required
//   - streaming refused (this function never supported it anyway)
//   - per-user daily cap through the same public.coach_touch() counter
//     coach-chat uses, so a single account cannot drain the key
//
// To retire it completely: delete the function in Supabase and drop this
// directory. That is a one-way door while old builds may still exist, so
// it is a human decision, not a cleanup step.

import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/* The models the legacy callers actually name. Anything else is a caller
   we do not know about, which is exactly the case worth refusing. */
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001",
]);

const MAX_TOKENS = 3000;      // legacy callers ask for 2400 and 2800
const MAX_BODY_BYTES = 60000; // their biggest prompt is a few KB
const DAILY_LIMIT = 40;       // per user, per UTC day

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: { message: "POST only" } });
  }

  // ── who is asking ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: { message: "Missing authorization" } });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) return json(401, { error: { message: "Unauthorized" } });

  // ── what they are asking for ───────────────────────────────────
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: { message: "Request too large" } });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: { message: "Body must be JSON" } });
  }

  const model = typeof body.model === "string" ? body.model : "";
  if (!ALLOWED_MODELS.has(model)) {
    /* Naming the allowed set back to the caller is deliberate: a legacy
       build that breaks here should be diagnosable from the response. */
    return json(400, {
      error: {
        type: "invalid_request_error",
        message: "model not allowed on this endpoint; allowed: " +
          Array.from(ALLOWED_MODELS).join(", "),
      },
    });
  }

  if (body.stream) {
    return json(400, { error: { message: "streaming is not supported here" } });
  }

  const asked = typeof body.max_tokens === "number" ? body.max_tokens : MAX_TOKENS;
  body.max_tokens = Math.min(Math.max(1, Math.floor(asked)), MAX_TOKENS);

  // ── how often ──────────────────────────────────────────────────
  // Same counter coach-chat uses, so the two endpoints cannot be played
  // against each other. A limiter that is down must not take the endpoint
  // down with it — but it must also not become a silent bypass, so the
  // failure is logged.
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: turns, error: rlError } = await admin.rpc("coach_touch", { uid: user.id });
    if (rlError) {
      console.warn("[claude-proxy] rate limiter unavailable:", rlError.message);
    } else if (typeof turns === "number" && turns > DAILY_LIMIT) {
      return json(429, {
        error: { type: "rate_limit_error", message: "Daily limit reached — back tomorrow." },
      });
    }
  } catch (e) {
    console.warn("[claude-proxy] rate limiter threw:", e);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { error: { message: "ANTHROPIC_API_KEY not set" } });

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await response.text();
  return new Response(data, {
    status: response.status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
