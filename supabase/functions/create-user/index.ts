import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Authenticate caller and require admin role ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = callerData.user.id;

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Only admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Organization is always taken from the caller (never from the client payload)
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", callerId)
      .maybeSingle();

    const organization_id = callerProfile?.organization_id;
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "Your account has no organization assigned" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const password: string = body.password ?? "";
    const first_name: string = (body.first_name ?? "").trim();
    const last_name: string = (body.last_name ?? "").trim();
    const role: string = body.role ?? "data_entry";
    const branch_id: string | null = body.branch_id || null;

    if (!email || !password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Email and a password of at least 8 characters are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["admin", "loan_officer", "data_entry"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name },
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Update profile with organization / branch / names
    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      organization_id,
      branch_id,
      first_name,
      last_name,
    }).eq("id", userId);
    if (profileError) throw profileError;

    // Mark as approved (created by an admin, so no approval step needed)
    await supabaseAdmin.from("user_approvals").upsert(
      {
        user_id: userId,
        status: "approved",
        approved_by: callerId,
        approved_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Assign role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role, organization_id },
      { onConflict: "user_id,role" }
    );

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-user error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
