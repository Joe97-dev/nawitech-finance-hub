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
    const { amount, phoneNumber, billRefNumber } = body;

    if (!amount || !phoneNumber || !billRefNumber) {
      throw new Error("amount, phoneNumber, and billRefNumber are required");
    }

    // Sandbox only
    const baseUrl = "https://sandbox.safaricom.co.ke";

    // Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get OAuth token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    // Simulate C2B payment
    const simulatePayload = {
      ShortCode: shortCode,
      CommandID: "CustomerPayBillOnline",
      Amount: amount,
      Msisdn: phoneNumber,
      BillRefNumber: billRefNumber,
    };

    console.log("Simulating C2B:", JSON.stringify(simulatePayload));

    const simulateResponse = await fetch(
      `${baseUrl}/mpesa/c2b/v1/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(simulatePayload),
      }
    );

    const simulateData = await simulateResponse.json();
    console.log("Simulate response:", JSON.stringify(simulateData));

    return new Response(
      JSON.stringify({
        success: simulateResponse.ok,
        data: simulateData,
      }),
      {
        status: simulateResponse.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Simulation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
