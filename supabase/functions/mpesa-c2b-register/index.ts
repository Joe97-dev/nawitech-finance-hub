import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "174379";

    if (!consumerKey || !consumerSecret) {
      throw new Error("M-Pesa credentials not configured");
    }

    // 1. Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to get M-Pesa access token");
    }

    // 2. Register C2B URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const validationUrl = `${supabaseUrl}/functions/v1/payment-c2b-validation`;
    const confirmationUrl = `${supabaseUrl}/functions/v1/payment-c2b-confirmation`;

    console.log("Registering C2B URLs:");
    console.log("Validation URL:", validationUrl);
    console.log("Confirmation URL:", confirmationUrl);

    const registerResponse = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ShortCode: shortcode,
          ResponseType: "Completed",
          ConfirmationURL: confirmationUrl,
          ValidationURL: validationUrl,
        }),
      }
    );

    const registerData = await registerResponse.json();
    console.log("C2B Registration response:", JSON.stringify(registerData));

    return new Response(
      JSON.stringify({
        success: true,
        message: "C2B URLs registered successfully",
        data: registerData,
        urls: { validationUrl, confirmationUrl },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("C2B Registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
