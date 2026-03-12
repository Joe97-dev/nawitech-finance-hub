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
    console.log("C2B Validation request received:", JSON.stringify(body));

    const { BillRefNumber, TransAmount } = body;

    // Validate the payment
    if (!BillRefNumber || !TransAmount) {
      console.log("Validation failed: Missing BillRefNumber or TransAmount");
      return new Response(
        JSON.stringify({ ResultCode: "C2B00012", ResultDesc: "Invalid Request - Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amount = parseFloat(TransAmount);
    if (isNaN(amount) || amount <= 0) {
      console.log("Validation failed: Invalid amount", TransAmount);
      return new Response(
        JSON.stringify({ ResultCode: "C2B00013", ResultDesc: "Invalid Amount" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if a client with this ID number exists
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, id_number")
      .eq("id_number", BillRefNumber)
      .maybeSingle();

    if (clientError) {
      console.error("Database error during validation:", clientError);
      return new Response(
        JSON.stringify({ ResultCode: "C2B00014", ResultDesc: "System error during validation" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      console.log(`Validation failed: No client found with ID number ${BillRefNumber}`);
      return new Response(
        JSON.stringify({ ResultCode: "C2B00011", ResultDesc: "Invalid Account Number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Validation passed for client: ${client.first_name} ${client.last_name} (${client.id_number})`);

    // Accept the payment
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Validation endpoint error:", error);
    return new Response(
      JSON.stringify({ ResultCode: "C2B00014", ResultDesc: "System error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
