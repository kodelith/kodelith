import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://save-codes.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : "https://save-codes.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request.headers.get("Origin"));

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !publicKey || !serviceKey) {
    console.error("Username login is missing required Supabase environment variables.");
    return jsonResponse(500, { error: "Sign-in is temporarily unavailable." }, cors);
  }

  let credentials: { username?: unknown; password?: unknown } | null;
  try {
    credentials = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid request." }, cors);
  }

  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    return jsonResponse(400, { error: "Invalid request." }, cors);
  }
  const username = typeof credentials.username === "string" ? credentials.username.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
    return jsonResponse(400, { error: "Enter a valid username and password." }, cors);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const auth = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username_key", username.toLowerCase())
    .maybeSingle();

  if (profileError) {
    console.error("Could not look up the username for sign-in:", profileError.message);
    return jsonResponse(503, { error: "Sign-in is temporarily unavailable." }, cors);
  }
  if (!profile) {
    return jsonResponse(401, { error: "Incorrect username or password." }, cors);
  }

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userResult.user?.email) {
    console.error("Could not load the account for username sign-in:", userError?.message ?? "No email address");
    return jsonResponse(503, { error: "Sign-in is temporarily unavailable." }, cors);
  }

  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({
    email: userResult.user.email,
    password,
  });
  if (signInError || !signIn.session) {
    return jsonResponse(401, { error: "Incorrect username or password." }, cors);
  }

  return jsonResponse(200, { session: signIn.session }, cors);
});
