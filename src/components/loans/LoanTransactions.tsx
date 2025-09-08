
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { DrawDownPayment } from "./DrawDownPayment";

interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
}

interface LoanTransactionsProps {
  loanId: string;
  drawDownBalance?: number;
  onBalanceUpdate?: () => void;
}

export function LoanTransactions({ loanId, drawDownBalance = 0, onBalanceUpdate }: LoanTransactionsProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [totalDrawDownBalance, setTotalDrawDownBalance] = useState(0);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    receipt_number: "",
    payment_method: "",
    notes: ""
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('loan_transactions')
          .select('*')
          .eq('loan_id', loanId)
          .order('transaction_date', { ascending: false });
        
        if (error) throw error;
        
        // Cast the data to the correct type
        const typedData = (data || []) as Transaction[];
        
        setTransactions(typedData);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to fetch transactions: ${error.message}`
        });
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchTotalDrawDownBalance = async () => {
      try {
        const { data: loans, error } = await supabase
          .from('loans')
          .select('draw_down_balance');
        
        if (error) throw error;
        
        const total = loans?.reduce((sum, loan) => sum + (loan.draw_down_balance || 0), 0) || 0;
        setTotalDrawDownBalance(total);
      } catch (error: any) {
        console.error('Error fetching total draw down balance:', error);
      }
    };

    if (loanId) {
      fetchTransactions();
      fetchTotalDrawDownBalance();
    }
  }, [loanId, toast]);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "repayment":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Repayment</Badge>;
      case "draw_down_payment":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Draw Down</Badge>;
      case "disbursement":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Disbursement</Badge>;
      case "fee":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Fee</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{type}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentForm.amount || !paymentForm.receipt_number || !paymentForm.payment_method) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    const paymentAmount = parseFloat(paymentForm.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid payment amount"
      });
      return;
    }

    // Check if using draw down and validate available balance
    if (paymentForm.payment_method === 'draw_down' && paymentAmount > totalDrawDownBalance) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Amount exceeds available draw down balance"
      });
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // If using draw down payment method, deduct from draw down balances first
      if (paymentForm.payment_method === 'draw_down') {
        await deductFromDrawDownBalance(paymentAmount);
      }

      // Insert the transaction
      const { error: transactionError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: loanId,
          amount: paymentAmount,
          transaction_type: paymentForm.payment_method === 'draw_down' ? 'draw_down_payment' : 'repayment',
          payment_method: paymentForm.payment_method,
          receipt_number: paymentForm.receipt_number,
          notes: paymentForm.notes || null,
          created_by: user.id
        });

      if (transactionError) throw transactionError;

      // Allocate payment to schedule items (oldest unpaid first)
      await allocatePaymentToSchedule(loanId, paymentAmount);
      
      // Note: The loan balance will be automatically updated by the database trigger
      // when we update the loan_schedule amount_paid values

      // Reset form
      setPaymentForm({
        amount: "",
        receipt_number: "",
        payment_method: "",
        notes: ""
      });

      // Refresh transactions
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      setTransactions((data || []) as Transaction[]);

      // Notify parent component to update balance
      if (onBalanceUpdate) {
        onBalanceUpdate();
      }

      toast({
        title: "Success",
        description: `Payment of ${formatCurrency(paymentAmount)} processed successfully`
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to process payment: ${error.message}`
      });
    } finally {
      setIsProcessingPayment(false);
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
      
      // If there's remaining payment after all schedule items are paid, add to draw down account
      if (remainingPayment > 0) {
        const { data: currentLoan, error: loanError } = await supabase
          .from('loans')
          .select('draw_down_balance')
          .eq('id', loanId)
          .single();
        
        if (loanError) throw loanError;
        
        const newDrawDownBalance = (currentLoan.draw_down_balance || 0) + remainingPayment;
        
        const { error: updateLoanError } = await supabase
          .from('loans')
          .update({ draw_down_balance: newDrawDownBalance })
          .eq('id', loanId);
        
        if (updateLoanError) throw updateLoanError;
      }
      
    } catch (error) {
      console.error('Error allocating payment to schedule:', error);
      throw error;
    }
  };

  const deductFromDrawDownBalance = async (paymentAmount: number) => {
    try {
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
      
      // Update total draw down balance
      setTotalDrawDownBalance(prev => prev - paymentAmount);
      
    } catch (error) {
      console.error('Error deducting from draw down balance:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Transactions</h3>
      </div>

      {/* Draw Down Payment Component */}
      <DrawDownPayment 
        loanId={loanId}
        drawDownBalance={drawDownBalance}
        onPaymentMade={onBalanceUpdate}
      />

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Make Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentForm.payment_method === 'draw_down' && (
                <div className="md:col-span-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Available Draw Down Balance:</strong> {formatCurrency(totalDrawDownBalance)}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  max={paymentForm.payment_method === 'draw_down' ? totalDrawDownBalance : undefined}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt_number">Reference/Receipt Number *</Label>
                <Input
                  id="receipt_number"
                  placeholder="Enter reference code"
                  value={paymentForm.receipt_number}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, receipt_number: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, payment_method: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="draw_down">Draw Down Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={isProcessingPayment} className="w-full md:w-auto">
              {isProcessingPayment ? "Processing..." : "Process Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  No transactions available
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {getTransactionBadge(transaction.transaction_type)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    {transaction.payment_method || "—"}
                  </TableCell>
                  <TableCell>
                    {transaction.receipt_number || "—"}
                  </TableCell>
                  <TableCell>
                    {transaction.notes || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
