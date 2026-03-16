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
    console.log("M-Pesa C2B Confirmation Request:", JSON.stringify(body));

    const {
      TransactionType,
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
      MiddleName,
      LastName,
    } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to match client by national ID
    let matchedClientId: string | null = null;
    let matchedLoanId: string | null = null;
    let organizationId: string | null = null;

    if (BillRefNumber) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, organization_id")
        .eq("id_number", BillRefNumber.trim())
        .maybeSingle();

      if (client) {
        matchedClientId = client.id;
        organizationId = client.organization_id;

        // Find the client's active or in-arrears loan (oldest first)
        const { data: loan } = await supabase
          .from("loans")
          .select("id")
          .eq("client", matchedClientId)
          .in("status", ["active", "in arrears"])
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (loan) {
          matchedLoanId = loan.id;
        }
      }
    }

    // Store the transaction
    const { data: mpesaTx, error: insertError } = await supabase
      .from("mpesa_transactions")
      .insert({
        transaction_type: TransactionType || "C2B",
        trans_id: TransID,
        trans_time: TransTime,
        trans_amount: parseFloat(TransAmount) || 0,
        business_short_code: BusinessShortCode?.toString() || "",
        bill_ref_number: BillRefNumber || null,
        invoice_number: InvoiceNumber || null,
        org_account_balance: OrgAccountBalance ? parseFloat(OrgAccountBalance) : null,
        third_party_trans_id: ThirdPartyTransID || null,
        msisdn: MSISDN || "",
        first_name: FirstName || null,
        middle_name: MiddleName || null,
        last_name: LastName || null,
        matched_client_id: matchedClientId,
        matched_loan_id: matchedLoanId,
        organization_id: organizationId,
        status: matchedLoanId ? "matched" : "unmatched",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing M-Pesa transaction:", insertError);
      throw insertError;
    }

    // If we matched a loan, auto-apply the payment
    if (matchedLoanId && mpesaTx) {
      try {
        const amount = parseFloat(TransAmount) || 0;

        // Insert loan transaction
        const { data: loanTx, error: loanTxError } = await supabase
          .from("loan_transactions")
          .insert({
            loan_id: matchedLoanId,
            transaction_type: "payment",
            amount: amount,
            payment_method: "mobile_money",
            notes: `M-Pesa C2B Payment - ${TransID} from ${MSISDN}`,
            receipt_number: TransID,
            organization_id: organizationId,
          })
          .select()
          .single();

        if (loanTxError) throw loanTxError;

        // Apply payment to loan schedule (oldest unpaid first)
        let remainingAmount = amount;
        const { data: schedules } = await supabase
          .from("loan_schedule")
          .select("*")
          .eq("loan_id", matchedLoanId)
          .in("status", ["pending", "partially_paid"])
          .order("due_date", { ascending: true });

        if (schedules) {
          for (const schedule of schedules) {
            if (remainingAmount <= 0) break;

            const amountDue = schedule.total_due - (schedule.amount_paid || 0);
            const paymentForThis = Math.min(remainingAmount, amountDue);
            const newAmountPaid = (schedule.amount_paid || 0) + paymentForThis;
            const newStatus = newAmountPaid >= schedule.total_due ? "paid" : "partially_paid";

            await supabase
              .from("loan_schedule")
              .update({
                amount_paid: newAmountPaid,
                status: newStatus,
              })
              .eq("id", schedule.id);

            remainingAmount -= paymentForThis;
          }
        }

        // Update mpesa transaction as applied
        await supabase
          .from("mpesa_transactions")
          .update({
            payment_applied: true,
            loan_transaction_id: loanTx.id,
            status: "applied",
            updated_at: new Date().toISOString(),
          })
          .eq("id", mpesaTx.id);

        console.log(`Payment of ${amount} applied to loan ${matchedLoanId}`);
      } catch (applyError) {
        console.error("Error applying payment to loan:", applyError);
        await supabase
          .from("mpesa_transactions")
          .update({
            status: "error",
            error_message: `Failed to apply payment: ${applyError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mpesaTx.id);
      }
    }

    // Always respond with success to M-Pesa
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Confirmation error:", error);
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
