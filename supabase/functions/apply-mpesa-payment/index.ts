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

    const { mpesaTransactionId, loanId, clientId, matchType = "repayment", feeType } = await req.json();

    if (!mpesaTransactionId || !clientId) {
      throw new Error("mpesaTransactionId and clientId are required");
    }
    if (matchType !== "client_fee" && !loanId) {
      throw new Error("loanId is required for repayment and loan fee matching");
    }

    // Get the M-Pesa transaction
    const { data: mpesaTx, error: mpesaErr } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("id", mpesaTransactionId)
      .single();

    if (mpesaErr || !mpesaTx) throw new Error("M-Pesa transaction not found");
    if (mpesaTx.payment_applied) throw new Error("Payment already applied");

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("organization_id, first_name, last_name")
      .eq("id", clientId)
      .single();

    if (!client) throw new Error("Client not found");

    const amount = mpesaTx.trans_amount;
    const organizationId = client.organization_id;
    const clientName = `${client.first_name} ${client.last_name}`;

    let effectiveLoanId = loanId;
    let loanTxId: string;

    if (matchType === "client_fee") {
      // Handle client fee — get or create client_fee_account
      effectiveLoanId = await getOrCreateClientFeeAccount(supabase, clientName, organizationId);

      const { data: loanTx, error: loanTxError } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: effectiveLoanId,
          transaction_type: "fee",
          amount,
          payment_method: "mobile_money",
          notes: `${feeType || "client_fee"}: M-Pesa Payment (Manual Match) - ${mpesaTx.trans_id} from ${mpesaTx.msisdn}`,
          receipt_number: mpesaTx.trans_id,
          organization_id: organizationId,
          created_by: userId,
        })
        .select("id")
        .single();

      if (loanTxError) throw loanTxError;
      loanTxId = loanTx.id;

      // Activate client if pending/dormant
      await supabase
        .from("clients")
        .update({ status: "active" })
        .eq("id", clientId)
        .in("status", ["pending", "dormant"]);

      // Also activate pending loans for this client
      await supabase
        .from("loans")
        .update({ status: "active" })
        .eq("client", clientName)
        .eq("status", "pending")
        .neq("type", "client_fee_account");

    } else if (matchType === "loan_fee") {
      // Handle loan fee
      const { data: loanTx, error: loanTxError } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: loanId,
          transaction_type: "fee",
          amount,
          payment_method: "mobile_money",
          notes: `${feeType || "fee"}: M-Pesa Payment (Manual Match) - ${mpesaTx.trans_id} from ${mpesaTx.msisdn}`,
          receipt_number: mpesaTx.trans_id,
          organization_id: organizationId,
          created_by: userId,
        })
        .select("id")
        .single();

      if (loanTxError) throw loanTxError;
      loanTxId = loanTx.id;

      // Activate the loan if pending
      await supabase
        .from("loans")
        .update({ status: "active" })
        .eq("id", loanId)
        .eq("status", "pending");

    } else {
      // Handle repayment (original logic)
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
        .select("id")
        .single();

      if (loanTxError) throw loanTxError;
      loanTxId = loanTx.id;

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

      // If there's excess amount, deposit to Draw Down Account
      if (remainingAmount > 0) {
        await depositExcess(supabase, clientId, remainingAmount, organizationId, loanId, loanTxId, mpesaTx.trans_id);
      }

      // Update loan balance and status
      const { data: balanceResult, error: balanceError } = await supabase
        .rpc("calculate_outstanding_balance", { p_loan_id: loanId });

      if (!balanceError && balanceResult !== null) {
        await supabase.from("loans").update({ balance: balanceResult }).eq("id", loanId);
        await supabase.rpc("update_loan_status", { p_loan_id: loanId });
      }
    }

    // Update M-Pesa transaction
    await supabase
      .from("mpesa_transactions")
      .update({
        matched_client_id: clientId,
        matched_loan_id: effectiveLoanId || loanId,
        payment_applied: true,
        loan_transaction_id: loanTxId,
        organization_id: organizationId,
        status: "applied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", mpesaTransactionId);

    console.log(`Manual match (${matchType}): ${amount} applied from mpesa tx ${mpesaTransactionId}`);

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

async function getOrCreateClientFeeAccount(supabase: any, clientName: string, organizationId: string): Promise<string> {
  const { data: existingLoan, error } = await supabase
    .from("loans")
    .select("id")
    .eq("client", clientName)
    .eq("type", "client_fee_account")
    .maybeSingle();

  if (existingLoan) return existingLoan.id;

  const { data: newLoan, error: createErr } = await supabase
    .from("loans")
    .insert({
      client: clientName,
      type: "client_fee_account",
      status: "fee_account",
      amount: 0,
      balance: 0,
      date: new Date().toISOString().split("T")[0],
      organization_id: organizationId,
    })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return newLoan.id;
}

async function depositExcess(supabase: any, clientId: string, remainingAmount: number, organizationId: string, loanId: string, loanTxId: string, transId: string) {
  let { data: clientAccount } = await supabase
    .from("client_accounts")
    .select("id, balance")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!clientAccount) {
    const { data: newAccount, error: createErr } = await supabase
      .from("client_accounts")
      .insert({ client_id: clientId, balance: 0, organization_id: organizationId })
      .select("id, balance")
      .single();
    if (createErr) throw createErr;
    clientAccount = newAccount;
  }

  const previousBalance = clientAccount.balance || 0;
  const newBalance = previousBalance + remainingAmount;

  await supabase.from("client_account_transactions").insert({
    client_account_id: clientAccount.id,
    transaction_type: "deposit",
    amount: remainingAmount,
    previous_balance: previousBalance,
    new_balance: newBalance,
    organization_id: organizationId,
    related_loan_id: loanId,
    related_transaction_id: loanTxId,
    notes: `Excess M-Pesa payment (Manual Match) - ${transId} (${remainingAmount} surplus)`,
  });

  console.log(`Excess ${remainingAmount} deposited to draw down account for client ${clientId}`);
}
