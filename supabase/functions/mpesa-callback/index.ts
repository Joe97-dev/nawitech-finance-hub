import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa Callback received:", JSON.stringify(body));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      console.error("Invalid callback payload");
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    console.log(`STK Callback - ResultCode: ${ResultCode}, ResultDesc: ${ResultDesc}`);
    console.log(`MerchantRequestID: ${MerchantRequestID}, CheckoutRequestID: ${CheckoutRequestID}`);

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const metadata: Record<string, any> = {};
      for (const item of CallbackMetadata.Item) {
        metadata[item.Name] = item.Value;
      }

      console.log("Payment successful:", JSON.stringify(metadata));
      // metadata contains: Amount, MpesaReceiptNumber, TransactionDate, PhoneNumber
      
      // You can store this in a payments table for reconciliation
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Log the callback for audit trail
      console.log(`M-Pesa Payment Confirmed - Receipt: ${metadata.MpesaReceiptNumber}, Amount: ${metadata.Amount}, Phone: ${metadata.PhoneNumber}`);
    } else {
      console.log(`Payment failed or cancelled - ResultCode: ${ResultCode}, ResultDesc: ${ResultDesc}`);
    }

    // Always respond with success to Safaricom
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Callback processing error:", error);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
