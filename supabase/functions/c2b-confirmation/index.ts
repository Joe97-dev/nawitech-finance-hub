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
        .select("id, first_name, last_name, organization_id")
        .eq("id_number", BillRefNumber.trim())
        .maybeSingle();

      if (client) {
        matchedClientId = client.id;
        organizationId = client.organization_id;
        const clientFullName = `${client.first_name} ${client.last_name}`;

        // Find the client's active or in-arrears loan (oldest first)
        const { data: loan } = await supabase
          .from("loans")
          .select("id")
          .eq("client", clientFullName)
          .in("status", ["active", "in arrears"])
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (loan) {
          matchedLoanId = loan.id;
        }
      }
    }

    // Log matching result for debugging
    if (BillRefNumber && !matchedClientId) {
      console.log(`No client found for BillRefNumber (ID): "${BillRefNumber.trim()}" — storing as unmatched`);
    } else if (matchedClientId && !matchedLoanId) {
      console.log(`Client found but no active loan for BillRefNumber: "${BillRefNumber}" — storing as unmatched`);
    }

    // Check for duplicate transaction ID
    const { data: existingTx } = await supabase
      .from("mpesa_transactions")
      .select("id")
      .eq("trans_id", TransID)
      .maybeSingle();

    if (existingTx) {
      console.log(`Duplicate trans_id ${TransID} — skipping insert`);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      // Handle unique constraint violation as duplicate
      if (insertError.code === "23505") {
        console.log(`Duplicate trans_id ${TransID} caught by constraint — skipping`);
        return new Response(
          JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
            transaction_type: "repayment",
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
              .update({
                amount_paid: newAmountPaid,
                status: newStatus,
              })
              .eq("id", schedule.id);

            remainingAmount -= paymentForThis;
          }
        }

        // If there's excess amount, deposit to Draw Down Account
        if (remainingAmount > 0 && matchedClientId) {
          // Find or create client account
          let { data: clientAccount } = await supabase
            .from("client_accounts")
            .select("id, balance")
            .eq("client_id", matchedClientId)
            .maybeSingle();

          if (!clientAccount) {
            const { data: newAccount, error: createErr } = await supabase
              .from("client_accounts")
              .insert({ client_id: matchedClientId, balance: 0, organization_id: organizationId })
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
            related_loan_id: matchedLoanId,
            notes: `Excess M-Pesa payment - ${TransID} (${remainingAmount} surplus)`,
          });

          console.log(`Excess ${remainingAmount} deposited to draw down account for client ${matchedClientId}`);
          }
        }

        // Recalculate and update loan balance
        const { data: balanceResult } = await supabase
          .rpc("calculate_outstanding_balance", { p_loan_id: matchedLoanId });

        if (balanceResult !== null) {
          await supabase
            .from("loans")
            .update({ balance: balanceResult })
            .eq("id", matchedLoanId);

          // Update loan status based on new balance
          await supabase.rpc("update_loan_status", { p_loan_id: matchedLoanId });
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
