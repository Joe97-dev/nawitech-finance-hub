import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Format phone: ensure 12-digit 254XXXXXXXXX format
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^\+/, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (formattedPhone.length !== 12 || !formattedPhone.startsWith('254')) {
      throw new Error(`Invalid phone number format. Expected 254XXXXXXXXX (12 digits), got: ${formattedPhone}`);
    }
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
      Msisdn: formattedPhone,
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

    // Safaricom sandbox often doesn't trigger callbacks reliably.
    // As a fallback, directly call our confirmation endpoint to process the payment.
    if (simulateResponse.ok && simulateData.ResponseCode === "0") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const confirmationUrl = `${supabaseUrl}/functions/v1/c2b-confirmation`;
        const now = new Date();
        const transTime = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const transId = `SIM${Date.now()}`;

        const confirmationBody = {
          TransactionType: "Pay Bill",
          TransID: transId,
          TransTime: transTime,
          TransAmount: amount.toString(),
          BusinessShortCode: shortCode,
          BillRefNumber: billRefNumber,
          InvoiceNumber: "",
          OrgAccountBalance: "",
          ThirdPartyTransID: "",
          MSISDN: formattedPhone,
          FirstName: "Sandbox",
          MiddleName: "",
          LastName: "User",
        };

        console.log("Calling confirmation endpoint as fallback:", JSON.stringify(confirmationBody));

        const confirmRes = await fetch(confirmationUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(confirmationBody),
        });

        const confirmData = await confirmRes.json();
        console.log("Confirmation fallback response:", JSON.stringify(confirmData));
      } catch (fallbackErr) {
        console.error("Fallback confirmation call failed:", fallbackErr);
      }
    }

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
