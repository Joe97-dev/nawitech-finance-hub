const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortCode = Deno.env.get("MPESA_SHORTCODE");

    if (!consumerKey || !consumerSecret || !shortCode) {
      throw new Error("M-Pesa credentials not configured");
    }

    const body = await req.json();
    const { useSandbox = false } = body;

    const baseUrl = useSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    // Step 1: Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get OAuth token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Register C2B URLs (v2 for production, v1 for sandbox)
    const supabaseProjectId = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/(.+?)\.supabase/)?.[1];
    const functionsBaseUrl = `https://${supabaseProjectId}.supabase.co/functions/v1`;

    const registerPayload = {
      ShortCode: shortCode,
      ResponseType: "Completed",
      ConfirmationURL: `${functionsBaseUrl}/c2b-confirmation`,
      ValidationURL: `${functionsBaseUrl}/c2b-validation`,
    };

    const registerVersion = useSandbox ? "v1" : "v2";
    console.log(`Registering URLs (${registerVersion}, ${useSandbox ? 'sandbox' : 'production'}):`, JSON.stringify(registerPayload));

    const registerResponse = await fetch(
      `${baseUrl}/mpesa/c2b/${registerVersion}/registerurl`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerPayload),
      }
    );

    const registerData = await registerResponse.json();
    console.log("Register response:", JSON.stringify(registerData));

    return new Response(
      JSON.stringify({
        success: registerResponse.ok,
        data: registerData,
        registeredUrls: {
          validation: registerPayload.ValidationURL,
          confirmation: registerPayload.ConfirmationURL,
        },
      }),
      {
        status: registerResponse.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("URL registration error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
