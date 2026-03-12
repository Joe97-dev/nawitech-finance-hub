import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Access denied: Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "check") {
      // Check if credentials are configured (don't return actual values)
      const hasConsumerKey = !!Deno.env.get("MPESA_CONSUMER_KEY");
      const hasConsumerSecret = !!Deno.env.get("MPESA_CONSUMER_SECRET");
      const hasShortcode = !!Deno.env.get("MPESA_SHORTCODE");
      const hasPasskey = !!Deno.env.get("MPESA_PASSKEY");

      // Mask the values for display
      const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
      const shortcode = Deno.env.get("MPESA_SHORTCODE");

      return new Response(JSON.stringify({
        configured: {
          consumer_key: hasConsumerKey,
          consumer_secret: hasConsumerSecret,
          shortcode: hasShortcode,
          passkey: hasPasskey,
        },
        masked: {
          consumer_key: consumerKey ? `${consumerKey.substring(0, 4)}...${consumerKey.slice(-4)}` : null,
          shortcode: shortcode || null,
        },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "validate") {
      // Test credentials by attempting to get an OAuth token from Safaricom
      const consumerKey = body.consumer_key || Deno.env.get("MPESA_CONSUMER_KEY");
      const consumerSecret = body.consumer_secret || Deno.env.get("MPESA_CONSUMER_SECRET");

      if (!consumerKey || !consumerSecret) {
        return new Response(JSON.stringify({ valid: false, error: "Missing credentials" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseUrl = body.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const tokenResponse = await fetch(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        return new Response(JSON.stringify({
          valid: true,
          message: "Credentials are valid. OAuth token generated successfully.",
          expires_in: tokenData.expires_in,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({
          valid: false,
          error: tokenData.errorMessage || "Invalid credentials",
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("mpesa-manage-credentials error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
