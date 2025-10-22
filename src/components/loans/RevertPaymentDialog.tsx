import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  is_reverted?: boolean;
}

interface RevertPaymentDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReverted: () => void;
  loanId: string;
  clientId: string;
}

export function RevertPaymentDialog({
  transaction,
  open,
  onOpenChange,
  onReverted,
  loanId,
  clientId,
}: RevertPaymentDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [isReverting, setIsReverting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleRevert = async () => {
    if (!transaction || !reason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a reason for reverting this payment"
      });
      return;
    }

    setIsReverting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Mark transaction as reverted
      const { error: revertError } = await supabase
        .from('loan_transactions')
        .update({
          is_reverted: true,
          reverted_at: new Date().toISOString(),
          reverted_by: user.id,
          reversal_reason: reason.trim()
        })
        .eq('id', transaction.id);

      if (revertError) throw revertError;

      // Reverse the payment allocation
      await reversePaymentAllocation(loanId, clientId, transaction.amount, transaction.transaction_type, transaction.payment_method);

      toast({
        title: "Payment Reverted",
        description: `Payment of ${formatCurrency(transaction.amount)} has been successfully reverted`
      });

      setReason("");
      onOpenChange(false);
      onReverted();

    } catch (error: any) {
      console.error('Error reverting payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to revert payment: ${error.message}`
      });
    } finally {
      setIsReverting(false);
    }
  };

  const reversePaymentAllocation = async (
    loanId: string, 
    clientId: string, 
    amount: number, 
    transactionType: string,
    paymentMethod: string | null
  ) => {
    try {
      // Get paid schedule items ordered by due date (newest first for reversal)
      const { data: paidScheduleItems, error: scheduleError } = await supabase
        .from('loan_schedule')
        .select('*')
        .eq('loan_id', loanId)
        .in('status', ['paid', 'partial'])
        .gt('amount_paid', 0)
        .order('due_date', { ascending: false });

      if (scheduleError) throw scheduleError;

      let amountToReverse = amount;
      
      // Reverse allocation from newest paid items first
      for (const item of paidScheduleItems || []) {
        if (amountToReverse <= 0) break;
        
        const currentPaidAmount = item.amount_paid || 0;
        const reverseAmount = Math.min(amountToReverse, currentPaidAmount);
        const newAmountPaid = currentPaidAmount - reverseAmount;
        
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
        
        amountToReverse -= reverseAmount;
      }
      
    } catch (error) {
      console.error('Error reversing payment allocation:', error);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Revert Payment</DialogTitle>
          <DialogDescription>
            You are about to revert a payment. This action will restore the loan balance and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        {transaction && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="font-medium">{formatCurrency(transaction.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Receipt #:</span>
                <span className="font-medium">{transaction.receipt_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Payment Method:</span>
                <span className="font-medium">{transaction.payment_method || "—"}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Reversal *</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for reverting this payment..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
                required
              />
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReverting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleRevert} 
            disabled={isReverting || !reason.trim()}
          >
            {isReverting ? "Reverting..." : "Revert Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}