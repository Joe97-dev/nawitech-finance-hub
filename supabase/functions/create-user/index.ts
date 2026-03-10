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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, first_name, last_name, organization_id, role } = await req.json();

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name },
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Update profile with organization
    await supabaseAdmin.from("profiles").update({
      organization_id,
      first_name,
      last_name,
    }).eq("id", userId);

    // Create approval record
    await supabaseAdmin.from("user_approvals").insert({
      user_id: userId,
      status: "approved",
      approved_at: new Date().toISOString(),
    });

    // Assign role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: role || "admin",
      organization_id,
    });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
