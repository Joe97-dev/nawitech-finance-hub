
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { RevertPaymentDialog } from "./RevertPaymentDialog";
import { useRole } from "@/context/RoleContext";

interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  is_reverted?: boolean;
  reverted_at?: string | null;
  reversal_reason?: string | null;
  created_by?: string | null;
}

interface LoanTransactionsProps {
  loanId: string;
  clientId: string;
  onBalanceUpdate?: () => void;
}

export function LoanTransactions({ loanId, clientId, onBalanceUpdate }: LoanTransactionsProps) {
  const { toast } = useToast();
  const { isAdmin, isLoanOfficer } = useRole();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [drawDownBalance, setDrawDownBalance] = useState<number>(0);
  const [drawDownAccountId, setDrawDownAccountId] = useState<string | null>(null);
  const [isPayingFromDrawDown, setIsPayingFromDrawDown] = useState(false);
  const [drawDownPaymentAmount, setDrawDownPaymentAmount] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    receipt_number: "",
    payment_method: "",
    notes: "",
    transaction_date: new Date().toISOString().split('T')[0],
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
        
        const typedData = (data || []) as Transaction[];
        setTransactions(typedData);
        
        const userIds = [...new Set(typedData.map(t => t.created_by).filter(Boolean) as string[])];
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds);
          const map = new Map<string, string>();
          profileData?.forEach(p => map.set(p.id, p.username || 'Unknown'));
          setUsernames(map);
        }
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

    if (loanId && clientId) {
      fetchTransactions();
      fetchDrawDownBalance();
    }
  }, [loanId, toast]);

  const fetchDrawDownBalance = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('client_accounts')
        .select('id, balance')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setDrawDownBalance(data.balance);
        setDrawDownAccountId(data.id);
      }
    } catch (error) {
      console.error('Error fetching draw down balance:', error);
    }
  };

  const handlePayFromDrawDown = async () => {
    const amount = parseFloat(drawDownPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Enter a valid amount" });
      return;
    }
    if (amount > drawDownBalance) {
      toast({ variant: "destructive", title: "Error", description: "Insufficient draw down balance" });
      return;
    }

    setIsPayingFromDrawDown(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const organizationId = await getOrganizationId();

      // Record loan transaction
      const { error: txError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: loanId,
          amount: amount,
          transaction_type: 'repayment',
          payment_method: 'draw_down_account',
          receipt_number: `DDA-${Date.now()}`,
          notes: 'Payment from Draw Down Account',
          created_by: user.id,
          organization_id: organizationId
        });
      if (txError) throw txError;

      // Allocate to schedule
      await allocatePaymentToSchedule(loanId, amount);

      // Deduct from draw down account
      if (drawDownAccountId) {
        const { error: ddError } = await supabase
          .from('client_account_transactions')
          .insert({
            client_account_id: drawDownAccountId,
            amount: -amount,
            transaction_type: 'loan_payment',
            related_loan_id: loanId,
            notes: `Loan repayment from Draw Down Account`,
            created_by: user.id,
            previous_balance: drawDownBalance,
            new_balance: drawDownBalance - amount,
            organization_id: organizationId
          });
        if (ddError) throw ddError;
      }

      setDrawDownPaymentAmount("");
      
      // Refresh
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('transaction_date', { ascending: false });
      if (!error) setTransactions((data || []) as Transaction[]);
      
      await fetchDrawDownBalance();
      onBalanceUpdate?.();

      toast({ title: "Success", description: `${formatCurrency(amount)} paid from Draw Down Account` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsPayingFromDrawDown(false);
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "repayment":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Repayment</Badge>;
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

    setIsProcessingPayment(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const organizationId = await getOrganizationId();

      // Insert the transaction
      const { error: transactionError } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: loanId,
          amount: paymentAmount,
          transaction_type: 'repayment',
          transaction_date: paymentForm.transaction_date,
          payment_method: paymentForm.payment_method,
          receipt_number: paymentForm.receipt_number,
          notes: paymentForm.notes || null,
          created_by: user.id,
          organization_id: organizationId
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
        notes: "",
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
      
      // If there's remaining payment after allocating to all schedule items, deposit to client account
      if (remainingPayment > 0) {
        await depositToClientAccount(clientId, remainingPayment, loanId);
      }
      
    } catch (error) {
      console.error('Error allocating payment to schedule:', error);
      throw error;
    }
  };

  const depositToClientAccount = async (clientId: string, amount: number, loanId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get or create client account
      let accountId: string;
      const { data: accountData, error: accountError } = await supabase
        .from('client_accounts')
        .select('id, balance')
        .eq('client_id', clientId)
        .maybeSingle();

      if (accountError) throw accountError;

      if (!accountData) {
        const orgId = await getOrganizationId();
        const { data: newAccount, error: createError } = await supabase
          .from('client_accounts')
          .insert({ client_id: clientId, balance: 0, organization_id: orgId })
          .select()
          .single();

        if (createError) throw createError;
        accountId = newAccount.id;
        
        // Create transaction
        const { error: transactionError } = await supabase
          .from('client_account_transactions')
          .insert({
            client_account_id: accountId,
            amount: amount,
            transaction_type: 'deposit',
            related_loan_id: loanId,
            notes: 'Excess payment deposited to client account',
            created_by: user.id,
            previous_balance: 0,
            new_balance: amount,
            organization_id: orgId
          });

        if (transactionError) throw transactionError;
      } else {
        accountId = accountData.id;
        const previousBalance = accountData.balance;
        
        // Create transaction
        const orgId2 = await getOrganizationId();
        const { error: transactionError } = await supabase
          .from('client_account_transactions')
          .insert({
            client_account_id: accountId,
            amount: amount,
            transaction_type: 'deposit',
            related_loan_id: loanId,
            notes: 'Excess payment deposited to client account',
            created_by: user.id,
            previous_balance: previousBalance,
            new_balance: previousBalance + amount,
            organization_id: orgId2
          });

        if (transactionError) throw transactionError;
      }

      toast({
        title: "Excess Payment",
        description: `${formatCurrency(amount)} deposited to client account`
      });
    } catch (error: any) {
      console.error('Error depositing to client account:', error);
      throw error;
    }
  };

  const handleRevertClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setRevertDialogOpen(true);
  };

  const handlePaymentReverted = () => {
    // Refresh transactions
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('loan_transactions')
          .select('*')
          .eq('loan_id', loanId)
          .order('transaction_date', { ascending: false });
        
        if (error) throw error;
        setTransactions((data || []) as Transaction[]);
      } catch (error: any) {
        console.error('Error fetching transactions:', error);
      }
    };

    fetchTransactions();
    
    // Notify parent component to update balance
    if (onBalanceUpdate) {
      onBalanceUpdate();
    }
  };

  const canRevertTransaction = (transaction: Transaction) => {
    return isAdmin && 
           !transaction.is_reverted && 
           transaction.transaction_type === 'repayment';
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

      {/* Draw Down Account Card */}
      {isAdmin && drawDownBalance > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Draw Down Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
            <p className="text-2xl font-bold mb-3">{formatCurrency(drawDownBalance)}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                max={drawDownBalance}
                placeholder="Amount to pay"
                value={drawDownPaymentAmount}
                onChange={(e) => setDrawDownPaymentAmount(e.target.value)}
                className="max-w-[200px]"
              />
              <Button
                onClick={handlePayFromDrawDown}
                disabled={isPayingFromDrawDown || !drawDownPaymentAmount}
                size="sm"
              >
                {isPayingFromDrawDown ? "Processing..." : "Pay from Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && (
      <Card>
        <CardHeader>
          <CardTitle>Make Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
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
                    <SelectItem value="draw_down_account">Draw Down Account</SelectItem>
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
      )}
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                  No transactions available
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id} className={transaction.is_reverted ? "bg-red-50" : ""}>
                  <TableCell>
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionBadge(transaction.transaction_type)}
                      {transaction.is_reverted && (
                        <Badge variant="destructive" className="text-xs">
                          Reverted
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={transaction.is_reverted ? "line-through text-muted-foreground" : ""}>
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {transaction.payment_method || "—"}
                  </TableCell>
                  <TableCell>
                    {transaction.receipt_number || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transaction.created_by ? (usernames.get(transaction.created_by) || '—') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{transaction.notes || "—"}</div>
                      {transaction.is_reverted && transaction.reversal_reason && (
                        <div className="text-xs text-red-600">
                          <strong>Reversal reason:</strong> {transaction.reversal_reason}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canRevertTransaction(transaction) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevertClick(transaction)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Revert
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RevertPaymentDialog
        transaction={selectedTransaction}
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        onReverted={handlePaymentReverted}
        loanId={loanId}
        clientId={clientId}
      />
    </div>
  );
}
