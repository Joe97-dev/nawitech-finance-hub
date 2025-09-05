import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown } from "lucide-react";

interface DrawDownPaymentProps {
  loanId: string;
  drawDownBalance: number;
  onPaymentMade?: () => void;
}

export const DrawDownPayment: React.FC<DrawDownPaymentProps> = ({
  loanId,
  drawDownBalance,
  onPaymentMade
}) => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDrawDownPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an amount"
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

    if (paymentAmount > drawDownBalance) {
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

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: loanId,
          amount: paymentAmount,
          transaction_type: 'draw_down_payment',
          payment_method: 'draw_down',
          receipt_number: `DD-${Date.now()}`,
          notes: notes || `Draw down payment of ${formatCurrency(paymentAmount)}`,
          created_by: user.id
        });

      if (transactionError) throw transactionError;

      // Reduce draw down balance
      const newDrawDownBalance = drawDownBalance - paymentAmount;
      const { error: updateLoanError } = await supabase
        .from('loans')
        .update({ draw_down_balance: newDrawDownBalance })
        .eq('id', loanId);

      if (updateLoanError) throw updateLoanError;

      // Allocate payment to schedule (this will be handled by the same logic in LoanTransactions)
      await allocatePaymentToSchedule(loanId, paymentAmount);

      // Reset form
      setAmount("");
      setNotes("");

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
      // Get unpaid/partially paid schedule items ordered by due date
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
        
        // Determine new status
        let newStatus = 'pending';
        if (newAmountPaid >= item.total_due) {
          newStatus = 'paid';
        } else if (newAmountPaid > 0) {
          newStatus = 'partial';
        }
        
        // Update schedule item
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

  if (drawDownBalance <= 0) {
    return null; // Don't show component if no funds available
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-green-600" />
          Use Draw Down Funds
        </CardTitle>
        <CardDescription>
          Use excess payment funds to make loan payments. Available: {formatCurrency(drawDownBalance)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDrawDownPayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="draw-amount">Amount</Label>
              <Input
                id="draw-amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={drawDownBalance}
                required
              />
            </div>
            
            <div className="space-y-2">
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
            disabled={isProcessing || drawDownBalance <= 0}
            className="w-full md:w-auto"
          >
            {isProcessing ? "Processing..." : "Make Draw Down Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};