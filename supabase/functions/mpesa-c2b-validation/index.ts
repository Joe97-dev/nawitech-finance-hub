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
    const body = await req.json();
    console.log("M-Pesa C2B Validation Request:", JSON.stringify(body));

    const { BillRefNumber } = body;

    // Create Supabase client with service role for lookups
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate: check if a client with this national ID exists
    if (BillRefNumber) {
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("id_number", BillRefNumber.trim())
        .maybeSingle();

      if (error) {
        console.error("Error looking up client:", error);
      }

      if (!client) {
        console.log(`No client found with ID number: ${BillRefNumber}`);
        // Reject the transaction
        return new Response(
          JSON.stringify({
            ResultCode: "C2B00012",
            ResultDesc: "Rejected. No client found with the provided ID number.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Client found: ${client.first_name} ${client.last_name}`);
    }

    // Accept the transaction
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    // Accept on error to avoid losing payments
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
