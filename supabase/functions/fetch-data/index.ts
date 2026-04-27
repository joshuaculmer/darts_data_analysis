import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const password = req.headers.get("x-fetch-password") ?? "";
  const expected = Deno.env.get("FETCH_PASSWORD") ?? "";

  if (!expected || password !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const [{ data: sessions, error: sessionsError }, { data: survey, error: surveyError }] =
    await Promise.all([
      supabase.from("game_sessions").select("*"),
      supabase.from("post_session_survey_responses").select("*"),
    ]);

  if (sessionsError ?? surveyError) {
    const msg = sessionsError?.message ?? surveyError?.message ?? "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sessions, survey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
