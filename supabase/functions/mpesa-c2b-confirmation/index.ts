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
    console.log("C2B Confirmation received:", JSON.stringify(body));

    const {
      TransID,
      TransAmount,
      MSISDN,
      BillRefNumber,
      TransTime,
      FirstName,
      MiddleName,
      LastName,
    } = body;

    if (!TransID || !TransAmount || !BillRefNumber) {
      console.error("Missing required fields in confirmation");
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amount = parseFloat(TransAmount);
    const payerName = [FirstName, MiddleName, LastName].filter(Boolean).join(" ");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find client by BillRefNumber (id_number)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, id_number, organization_id")
      .eq("id_number", BillRefNumber)
      .maybeSingle();

    if (clientError || !client) {
      console.error(`Client not found for BillRefNumber: ${BillRefNumber}`, clientError);
      // Still accept to Safaricom, log for manual reconciliation
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Client matched: ${client.first_name} ${client.last_name} (${client.id})`);

    // 2. Find the client's active loan (prioritize 'active' or 'in arrears')
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select("id, balance, loan_number, organization_id")
      .eq("client", client.id)
      .in("status", ["active", "in arrears"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loanError || !loan) {
      console.error(`No active loan found for client ${client.id}`, loanError);
      // Store as client account deposit instead
      await handleClientAccountDeposit(supabase, client, amount, TransID, MSISDN, TransTime);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Loan matched: ${loan.loan_number} (Balance: ${loan.balance})`);

    // 3. Record loan transaction (repayment)
    const { data: transaction, error: txError } = await supabase
      .from("loan_transactions")
      .insert({
        loan_id: loan.id,
        amount: amount,
        transaction_type: "repayment",
        payment_method: "mpesa",
        receipt_number: TransID,
        notes: `M-Pesa C2B payment from ${MSISDN || "N/A"} (${payerName}). BillRef: ${BillRefNumber}`,
        organization_id: loan.organization_id,
        transaction_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Failed to record loan transaction:", txError);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transaction recorded: ${transaction.id}`);

    // 4. Apply payment to loan schedule (oldest unpaid first)
    let remainingAmount = amount;
    
    const { data: schedules, error: schedError } = await supabase
      .from("loan_schedule")
      .select("id, total_due, amount_paid, status")
      .eq("loan_id", loan.id)
      .neq("status", "paid")
      .order("due_date", { ascending: true });

    if (!schedError && schedules) {
      for (const schedule of schedules) {
        if (remainingAmount <= 0) break;

        const currentPaid = schedule.amount_paid || 0;
        const outstanding = schedule.total_due - currentPaid;

        if (outstanding <= 0) continue;

        const payment = Math.min(remainingAmount, outstanding);
        const newPaid = currentPaid + payment;
        const newStatus = newPaid >= schedule.total_due ? "paid" : "partial";

        const { error: updateError } = await supabase
          .from("loan_schedule")
          .update({
            amount_paid: newPaid,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        if (updateError) {
          console.error(`Failed to update schedule ${schedule.id}:`, updateError);
        } else {
          console.log(`Schedule ${schedule.id}: paid ${payment}, status: ${newStatus}`);
        }

        remainingAmount -= payment;
      }
    }

    // If there's overpayment, deposit into client account
    if (remainingAmount > 0) {
      console.log(`Overpayment of ${remainingAmount}, depositing to client account`);
      await handleClientAccountDeposit(
        supabase, client, remainingAmount, TransID, MSISDN, TransTime, loan.id, transaction.id
      );
    }

    console.log(`C2B Payment processed successfully - TransID: ${TransID}, Amount: ${amount}, Client: ${client.first_name} ${client.last_name}, Loan: ${loan.loan_number}`);

    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Confirmation processing error:", error);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleClientAccountDeposit(
  supabase: any,
  client: { id: string; organization_id: string },
  amount: number,
  transId: string,
  phone: string,
  transTime: string,
  relatedLoanId?: string,
  relatedTransactionId?: string
) {
  try {
    // Get or create client account
    let { data: account } = await supabase
      .from("client_accounts")
      .select("id, balance")
      .eq("client_id", client.id)
      .maybeSingle();

    if (!account) {
      const { data: newAccount, error: createErr } = await supabase
        .from("client_accounts")
        .insert({ client_id: client.id, balance: 0, organization_id: client.organization_id })
        .select("id, balance")
        .single();

      if (createErr) {
        console.error("Failed to create client account:", createErr);
        return;
      }
      account = newAccount;
    }

    const previousBalance = account.balance;
    const newBalance = previousBalance + amount;

    const { error: txErr } = await supabase
      .from("client_account_transactions")
      .insert({
        client_account_id: account.id,
        amount: amount,
        transaction_type: "deposit",
        notes: `M-Pesa C2B deposit - TransID: ${transId}, Phone: ${phone || "N/A"}`,
        previous_balance: previousBalance,
        new_balance: newBalance,
        organization_id: client.organization_id,
        related_loan_id: relatedLoanId || null,
        related_transaction_id: relatedTransactionId || null,
      });

    if (txErr) {
      console.error("Failed to record client account deposit:", txErr);
    } else {
      console.log(`Client account deposit: ${amount} for client ${client.id}`);
    }
  } catch (err) {
    console.error("Client account deposit error:", err);
  }
}
