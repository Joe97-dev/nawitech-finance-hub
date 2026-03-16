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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Check admin role
    const { data: roleCheck } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mpesaTransactionId, loanId, clientId } = await req.json();

    if (!mpesaTransactionId || !loanId || !clientId) {
      throw new Error("mpesaTransactionId, loanId, and clientId are required");
    }

    // Get the M-Pesa transaction
    const { data: mpesaTx, error: mpesaErr } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("id", mpesaTransactionId)
      .single();

    if (mpesaErr || !mpesaTx) throw new Error("M-Pesa transaction not found");
    if (mpesaTx.payment_applied) throw new Error("Payment already applied");

    // Get client's organization
    const { data: client } = await supabase
      .from("clients")
      .select("organization_id")
      .eq("id", clientId)
      .single();

    if (!client) throw new Error("Client not found");

    const amount = mpesaTx.trans_amount;
    const organizationId = client.organization_id;

    // Insert loan transaction
    const { data: loanTx, error: loanTxError } = await supabase
      .from("loan_transactions")
      .insert({
        loan_id: loanId,
        transaction_type: "repayment",
        amount,
        payment_method: "mobile_money",
        notes: `M-Pesa Payment (Manual Match) - ${mpesaTx.trans_id} from ${mpesaTx.msisdn}`,
        receipt_number: mpesaTx.trans_id,
        organization_id: organizationId,
        created_by: userId,
      })
      .select()
      .single();

    if (loanTxError) throw loanTxError;

    // Apply payment to schedule (oldest unpaid first)
    let remainingAmount = amount;
    const { data: schedules } = await supabase
      .from("loan_schedule")
      .select("*")
      .eq("loan_id", loanId)
      .in("status", ["pending", "partial", "partially_paid"])
      .order("due_date", { ascending: true });

    if (schedules) {
      for (const schedule of schedules) {
        if (remainingAmount <= 0) break;
        const amountDue = schedule.total_due - (schedule.amount_paid || 0);
        if (amountDue <= 0) continue;

        const paymentForThis = Math.min(remainingAmount, amountDue);
        const newAmountPaid = (schedule.amount_paid || 0) + paymentForThis;
        const newStatus = newAmountPaid >= schedule.total_due ? "paid" : "partial";

        await supabase
          .from("loan_schedule")
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq("id", schedule.id);

        remainingAmount -= paymentForThis;
      }
    }

    const { data: balanceResult, error: balanceError } = await supabase
      .rpc("calculate_outstanding_balance", { p_loan_id: loanId });

    if (balanceError) throw balanceError;

    if (balanceResult !== null) {
      const { error: updateLoanError } = await supabase
        .from("loans")
        .update({ balance: balanceResult })
        .eq("id", loanId);

      if (updateLoanError) throw updateLoanError;

      const { error: statusError } = await supabase
        .rpc("update_loan_status", { p_loan_id: loanId });

      if (statusError) throw statusError;
    }

    // Update M-Pesa transaction
    await supabase
      .from("mpesa_transactions")
      .update({
        matched_client_id: clientId,
        matched_loan_id: loanId,
        payment_applied: true,
        loan_transaction_id: loanTx.id,
        organization_id: organizationId,
        status: "applied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", mpesaTransactionId);

    console.log(`Manual match: ${amount} applied to loan ${loanId} from mpesa tx ${mpesaTransactionId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Apply payment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
