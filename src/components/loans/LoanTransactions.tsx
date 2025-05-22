
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

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
}

export function LoanTransactions({ loanId }: LoanTransactionsProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

    if (loanId) {
      fetchTransactions();
    }
  }, [loanId, toast]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Transactions</h3>
      
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
