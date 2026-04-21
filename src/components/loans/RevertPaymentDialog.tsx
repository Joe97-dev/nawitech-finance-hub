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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fees do not affect the loan schedule — only reverse draw-down effect (if any)
      if (transactionType === 'fee') {
        if (paymentMethod === 'draw_down_account') {
          await reverseClientAccountEffect(clientId, loanId, amount, paymentMethod, user.id);
        }
        return;
      }

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

      // Recalculate loan balance
      const { data: newBalance } = await supabase.rpc('calculate_outstanding_balance', { p_loan_id: loanId });
      
      // Update loan balance first
      const { error: balanceUpdateError } = await supabase
        .from('loans')
        .update({ balance: newBalance || amount })
        .eq('id', loanId);
      
      if (balanceUpdateError) throw balanceUpdateError;

      // Run update_loan_status to properly determine status (active vs in arrears)
      await supabase.rpc('update_loan_status', { p_loan_id: loanId });

      // Reverse client account (draw down) balance if payment was from draw down or had excess deposited
      await reverseClientAccountEffect(clientId, loanId, amount, paymentMethod, user.id);
      
    } catch (error) {
      console.error('Error reversing payment allocation:', error);
      throw error;
    }
  };

  const reverseClientAccountEffect = async (
    clientId: string,
    loanId: string,
    amount: number,
    paymentMethod: string | null,
    userId: string
  ) => {
    try {
      // Get client account
      const { data: account, error: accountError } = await supabase
        .from('client_accounts')
        .select('id, balance')
        .eq('client_id', clientId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) return; // No client account, nothing to reverse

      const { data: orgData } = await supabase.rpc('get_user_organization_id', { _user_id: userId });
      const organizationId = orgData as string;

      if (paymentMethod === 'draw_down_account') {
        // Payment was FROM draw down — reverse means ADD back to draw down
        const { error } = await supabase
          .from('client_account_transactions')
          .insert({
            client_account_id: account.id,
            amount: amount,
            transaction_type: 'deposit',
            related_loan_id: loanId,
            notes: 'Reversed: payment from Draw Down Account was reverted',
            created_by: userId,
            previous_balance: account.balance,
            new_balance: account.balance + amount,
            organization_id: organizationId
          });
        if (error) throw error;
      } else {
        // Check if excess was deposited to client account for this loan transaction
        const { data: depositTxns, error: depositError } = await supabase
          .from('client_account_transactions')
          .select('*')
          .eq('client_account_id', account.id)
          .eq('related_loan_id', loanId)
          .eq('transaction_type', 'deposit')
          .order('created_at', { ascending: false })
          .limit(1);

        if (depositError) throw depositError;

        if (depositTxns && depositTxns.length > 0) {
          const depositTxn = depositTxns[0];
          const deductAmount = Math.min(depositTxn.amount, account.balance);
          if (deductAmount > 0) {
            const { error } = await supabase
              .from('client_account_transactions')
              .insert({
                client_account_id: account.id,
                amount: -deductAmount,
                transaction_type: 'withdrawal',
                related_loan_id: loanId,
                notes: 'Reversed: excess deposit was reverted',
                created_by: userId,
                previous_balance: account.balance,
                new_balance: account.balance - deductAmount,
                organization_id: organizationId
              });
            if (error) throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error reversing client account effect:', error);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Revert {transaction?.transaction_type === 'fee' ? 'Fee' : 'Payment'}</DialogTitle>
          <DialogDescription>
            {transaction?.transaction_type === 'fee'
              ? 'You are about to revert a fee. If it was paid from the Draw Down Account, the amount will be refunded back. This action cannot be undone.'
              : 'You are about to revert a payment. This action will restore the loan balance and cannot be undone.'}
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
            {isReverting ? "Reverting..." : `Revert ${transaction?.transaction_type === 'fee' ? 'Fee' : 'Payment'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}