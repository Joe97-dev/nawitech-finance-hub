import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/context/RoleContext";
import { Wallet, ArrowDownToLine, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClientAccountProps {
  clientId: string;
}

interface AccountTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  notes: string | null;
  created_at: string;
  previous_balance: number;
  new_balance: number;
}

export function ClientAccount({ clientId }: ClientAccountProps) {
  const { toast } = useToast();
  const { isAdmin, isLoanOfficer } = useRole();
  const [balance, setBalance] = useState<number>(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    notes: ""
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAccountData();
  }, [clientId]);

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      
      // Get or create client account
      const { data: accountData, error: accountError } = await supabase
        .from('client_accounts')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (accountError) throw accountError;

      if (!accountData) {
        // Create account if it doesn't exist
        const { data: newAccount, error: createError } = await supabase
          .from('client_accounts')
          .insert({ client_id: clientId, balance: 0 })
          .select()
          .single();

        if (createError) throw createError;
        setAccountId(newAccount.id);
        setBalance(0);
      } else {
        setAccountId(accountData.id);
        setBalance(accountData.balance);
      }

      // Fetch transactions if account exists
      if (accountData?.id) {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('client_account_transactions')
          .select('*')
          .eq('client_account_id', accountData.id)
          .order('created_at', { ascending: false });

        if (transactionsError) throw transactionsError;
        setTransactions(transactionsData || []);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch account data: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountId) return;

    const amount = parseFloat(withdrawForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount"
      });
      return;
    }

    if (amount > balance) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Insufficient balance"
      });
      return;
    }

    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('client_account_transactions')
        .insert({
          client_account_id: accountId,
          amount: -amount,
          transaction_type: 'withdrawal',
          notes: withdrawForm.notes || null,
          created_by: user.id,
          previous_balance: balance,
          new_balance: balance - amount
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Withdrawal of ${formatCurrency(amount)} processed successfully`
      });

      setWithdrawForm({ amount: "", notes: "" });
      setWithdrawDialogOpen(false);
      fetchAccountData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to process withdrawal: ${error.message}`
      });
    } finally {
      setProcessing(false);
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

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Deposit</Badge>;
      case "withdrawal":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Withdrawal</Badge>;
      case "loan_payment":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Loan Payment</Badge>;
      case "fee_deduction":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Fee Deduction</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Client Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
            </div>
            {(isAdmin || isLoanOfficer) && balance > 0 && (
              <Button onClick={() => setWithdrawDialogOpen(true)} variant="outline">
                <Minus className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Previous Balance</TableHead>
                  <TableHead>New Balance</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No transactions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{getTransactionBadge(transaction.transaction_type)}</TableCell>
                      <TableCell className={transaction.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {transaction.amount >= 0 ? "+" : ""}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>{formatCurrency(transaction.previous_balance)}</TableCell>
                      <TableCell>{formatCurrency(transaction.new_balance)}</TableCell>
                      <TableCell>{transaction.notes || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw from Client Account</DialogTitle>
            <DialogDescription>
              Current balance: {formatCurrency(balance)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleWithdraw}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw_amount">Amount *</Label>
                <Input
                  id="withdraw_amount"
                  type="number"
                  step="0.01"
                  max={balance}
                  placeholder="Enter amount"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw_notes">Notes</Label>
                <Textarea
                  id="withdraw_notes"
                  placeholder="Reason for withdrawal"
                  value={withdrawForm.notes}
                  onChange={(e) => setWithdrawForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? "Processing..." : "Withdraw"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
