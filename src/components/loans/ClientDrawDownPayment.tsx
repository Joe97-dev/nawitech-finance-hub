import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown } from "lucide-react";

interface ClientDrawDownPaymentProps {
  clientId: string;
  currentLoanId?: string;
  onPaymentMade?: () => void;
}

interface ClientLoan {
  id: string;
  loan_number: string;
  balance: number;
}

export const ClientDrawDownPayment: React.FC<ClientDrawDownPaymentProps> = ({
  clientId,
  currentLoanId,
  onPaymentMade
}) => {
  const [amount, setAmount] = useState("");
  const [targetLoanId, setTargetLoanId] = useState(currentLoanId || "");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientDrawDownBalance, setClientDrawDownBalance] = useState(0);
  const [clientLoans, setClientLoans] = useState<ClientLoan[]>([]);
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get client's draw down balance
        const { data: drawDownAccount, error: drawDownError } = await supabase
          .from('client_draw_down_accounts')
          .select('balance')
          .eq('client_id', clientId)
          .single();

        if (drawDownError && drawDownError.code !== 'PGRST116') {
          throw drawDownError;
        }

        const balance = drawDownAccount?.balance || 0;
        setClientDrawDownBalance(balance);

        // Get client's loans with outstanding balance
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select('id, loan_number, balance, client')
          .eq('client', clientId)
          .gt('balance', 0);

        if (loansError) throw loansError;

        const loansList: ClientLoan[] = (loans || []).map(loan => ({
          id: loan.id,
          loan_number: loan.loan_number,
          balance: loan.balance
        }));
        setClientLoans(loansList);

      } catch (error: any) {
        console.error('Error fetching client draw down data:', error);
      }
    };

    if (clientId) {
      fetchData();
    }
  }, [clientId]);

  const handleDrawDownPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !targetLoanId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an amount and select a target loan"
      });
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount"
      });
      return;
    }

    if (paymentAmount > clientDrawDownBalance) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Amount exceeds available draw down balance"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Deduct from client's draw down account
      const newDrawDownBalance = clientDrawDownBalance - paymentAmount;
      const { error: updateDrawDownError } = await supabase
        .from('client_draw_down_accounts')
        .upsert({
          client_id: clientId,
          balance: newDrawDownBalance
        }, {
          onConflict: 'client_id'
        });

      if (updateDrawDownError) throw updateDrawDownError;

      // Create transaction record for the target loan
      const { error: transactionError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: targetLoanId,
          amount: paymentAmount,
          transaction_type: 'draw_down_payment',
          payment_method: 'client_draw_down',
          receipt_number: `CDD-${Date.now()}`,
          notes: notes || `Client draw down payment of ${formatCurrency(paymentAmount)}`,
          created_by: user.id
        });

      if (transactionError) throw transactionError;

      // Allocate payment to target loan schedule
      await allocatePaymentToSchedule(targetLoanId, paymentAmount);

      // Reset form
      setAmount("");
      setNotes("");
      
      // Update local balance
      setClientDrawDownBalance(newDrawDownBalance);

      toast({
        title: "Success",
        description: `Client draw down payment of ${formatCurrency(paymentAmount)} processed successfully`
      });

      if (onPaymentMade) {
        onPaymentMade();
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to process draw down payment: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const allocatePaymentToSchedule = async (loanId: string, paymentAmount: number) => {
    try {
      const { data: scheduleItems, error: scheduleError } = await supabase
        .from('loan_schedule')
        .select('*')
        .eq('loan_id', loanId)
        .neq('status', 'paid')
        .order('due_date', { ascending: true });

      if (scheduleError) throw scheduleError;

      let remainingPayment = paymentAmount;
      
      for (const item of scheduleItems || []) {
        if (remainingPayment <= 0) break;
        
        const outstandingAmount = item.total_due - (item.amount_paid || 0);
        const allocationAmount = Math.min(remainingPayment, outstandingAmount);
        const newAmountPaid = (item.amount_paid || 0) + allocationAmount;
        
        let newStatus = 'pending';
        if (newAmountPaid >= item.total_due) {
          newStatus = 'paid';
        } else if (newAmountPaid > 0) {
          newStatus = 'partial';
        }
        
        const { error: updateScheduleError } = await supabase
          .from('loan_schedule')
          .update({ 
            amount_paid: newAmountPaid,
            status: newStatus
          })
          .eq('id', item.id);
        
        if (updateScheduleError) throw updateScheduleError;
        
        remainingPayment -= allocationAmount;
      }
      
    } catch (error) {
      console.error('Error allocating payment to schedule:', error);
      throw error;
    }
  };

  if (clientDrawDownBalance <= 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-green-600" />
          Use Client Draw Down Account
        </CardTitle>
        <CardDescription>
          Use client's excess payment funds to make loan payments. Available: {formatCurrency(clientDrawDownBalance)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDrawDownPayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-loan">Target Loan *</Label>
              <Select value={targetLoanId} onValueChange={setTargetLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select loan to pay" />
                </SelectTrigger>
                <SelectContent>
                  {clientLoans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.loan_number} (Balance: {formatCurrency(loan.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="draw-amount">Amount *</Label>
              <Input
                id="draw-amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={clientDrawDownBalance}
                required
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="draw-notes">Notes (Optional)</Label>
              <Textarea
                id="draw-notes"
                placeholder="Payment notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            disabled={isProcessing || clientDrawDownBalance <= 0}
            className="w-full md:w-auto"
          >
            {isProcessing ? "Processing..." : "Make Draw Down Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};