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

function jsonResponse(status: number, body: Record<string, unknown>, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." }, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !publicKey || !serviceKey) {
    console.error("Username login is missing required Supabase environment variables.");
    return jsonResponse(500, { error: "Sign-in is temporarily unavailable." }, cors);
  }

  let body: { action?: unknown; username?: unknown; password?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid request." }, cors);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(400, { error: "Invalid request." }, cors);
  }

  const action = body.action === "activate" ? "activate" : body.action === "login" ? "login" : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!action || !/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
    return jsonResponse(400, { error: "Enter a valid username and a password of at least 8 characters." }, cors);
  }

  const usernameKey = username.toLowerCase();
  const syntheticEmail = `${usernameKey}@accounts.orbit.invalid`;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const auth = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "activate") {
    // Claim the invitation first so two requests cannot activate the same username.
    const { data: invite, error: inviteError } = await admin
      .from("account_invites")
      .delete()
      .eq("username_key", usernameKey)
      .select("username, username_key")
      .maybeSingle();

    if (inviteError) {
      console.error("Could not check the Orbit invite:", inviteError.message);
      return jsonResponse(503, { error: "Account activation is temporarily unavailable." }, cors);
    }
    if (!invite) {
      return jsonResponse(403, { error: "This username hasn't been authorized. Check the username you were given." }, cors);
    }

    const restoreInvite = async () => {
      await admin.from("account_invites").upsert({
        username: invite.username,
        username_key: invite.username_key,
      }, { onConflict: "username_key" });
    };

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { username: invite.username },
    });

    if (createError || !created.user) {
      await restoreInvite();
      console.error("Could not create the Orbit user:", createError?.message ?? "No user returned");
      return jsonResponse(409, { error: "That account could not be created. Contact Orbit support." }, cors);
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      username: invite.username,
      username_key: usernameKey,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      await restoreInvite();
      console.error("Could not create the Orbit profile:", profileError.message);
      return jsonResponse(500, { error: "Account setup failed. Please try again." }, cors);
    }
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username_key", usernameKey)
    .maybeSingle();

  if (profileError) {
    console.error("Could not look up the username for sign-in:", profileError.message);
    return jsonResponse(503, { error: "Sign-in is temporarily unavailable." }, cors);
  }
  if (!profile) return jsonResponse(401, { error: "Incorrect username or password." }, cors);

  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });
  if (signInError || !signIn.session) {
    return jsonResponse(401, { error: "Incorrect username or password." }, cors);
  }

  return jsonResponse(200, { session: signIn.session }, cors);
});
