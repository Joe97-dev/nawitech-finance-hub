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

interface GlobalDrawDownPaymentProps {
  currentLoanId?: string;
  onPaymentMade?: () => void;
}

interface Loan {
  id: string;
  loan_number: string;
  client: string;
  balance: number;
}

export const GlobalDrawDownPayment: React.FC<GlobalDrawDownPaymentProps> = ({
  currentLoanId,
  onPaymentMade
}) => {
  const [amount, setAmount] = useState("");
  const [targetLoanId, setTargetLoanId] = useState(currentLoanId || "");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalDrawDownBalance, setTotalDrawDownBalance] = useState(0);
  const [availableLoans, setAvailableLoans] = useState<Loan[]>([]);
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
        // Get total draw down balance across all loans
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select('id, loan_number, client, balance, draw_down_balance')
          .gt('balance', 0); // Only loans with outstanding balance

        if (loansError) throw loansError;

        const totalBalance = loans?.reduce((sum, loan) => sum + (loan.draw_down_balance || 0), 0) || 0;
        setTotalDrawDownBalance(totalBalance);

        // Set available loans for selection
        const loansList: Loan[] = (loans || []).map(loan => ({
          id: loan.id,
          loan_number: loan.loan_number,
          client: loan.client,
          balance: loan.balance
        }));
        setAvailableLoans(loansList);

      } catch (error: any) {
        console.error('Error fetching draw down data:', error);
      }
    };

    fetchData();
  }, []);

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

    if (paymentAmount > totalDrawDownBalance) {
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

      // Find loans with draw down balance to deduct from
      const { data: sourceLoans, error: sourceError } = await supabase
        .from('loans')
        .select('id, draw_down_balance')
        .gt('draw_down_balance', 0)
        .order('draw_down_balance', { ascending: false });

      if (sourceError) throw sourceError;

      let remainingAmount = paymentAmount;
      
      // Deduct from loans with draw down balance
      for (const sourceLoan of sourceLoans || []) {
        if (remainingAmount <= 0) break;
        
        const deductAmount = Math.min(remainingAmount, sourceLoan.draw_down_balance);
        const newDrawDownBalance = sourceLoan.draw_down_balance - deductAmount;
        
        const { error: updateError } = await supabase
          .from('loans')
          .update({ draw_down_balance: newDrawDownBalance })
          .eq('id', sourceLoan.id);
        
        if (updateError) throw updateError;
        
        remainingAmount -= deductAmount;
      }

      // Create transaction record for the target loan
      const { error: transactionError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: targetLoanId,
          amount: paymentAmount,
          transaction_type: 'draw_down_payment',
          payment_method: 'draw_down',
          receipt_number: `DD-${Date.now()}`,
          notes: notes || `Draw down payment of ${formatCurrency(paymentAmount)}`,
          created_by: user.id
        });

      if (transactionError) throw transactionError;

      // Allocate payment to target loan schedule
      await allocatePaymentToSchedule(targetLoanId, paymentAmount);

      // Reset form
      setAmount("");
      setNotes("");
      
      // Refresh data
      const { data: updatedLoans, error: refreshError } = await supabase
        .from('loans')
        .select('draw_down_balance');
      
      if (!refreshError) {
        const newTotal = updatedLoans?.reduce((sum, loan) => sum + (loan.draw_down_balance || 0), 0) || 0;
        setTotalDrawDownBalance(newTotal);
      }

      toast({
        title: "Success",
        description: `Draw down payment of ${formatCurrency(paymentAmount)} processed successfully`
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

  if (totalDrawDownBalance <= 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-green-600" />
          Use Draw Down Funds
        </CardTitle>
        <CardDescription>
          Use excess payment funds to make loan payments. Total Available: {formatCurrency(totalDrawDownBalance)}
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
                  {availableLoans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.loan_number} - {loan.client} (Balance: {formatCurrency(loan.balance)})
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
                max={totalDrawDownBalance}
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
            disabled={isProcessing || totalDrawDownBalance <= 0}
            className="w-full md:w-auto"
          >
            {isProcessing ? "Processing..." : "Make Draw Down Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};