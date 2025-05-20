
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CalendarIcon, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface LoanTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  transaction_date: string;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
  created_at: string;
}

interface LoanTransactionsProps {
  loanId: string;
  readOnly?: boolean;
  onTransactionAdded?: () => void;
}

export function LoanTransactions({ loanId, readOnly = false, onTransactionAdded }: LoanTransactionsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    transactionType: "repayment",
    transactionDate: new Date(),
    paymentMethod: "cash",
    receiptNumber: "",
    notes: ""
  });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to add transactions."
      });
      return;
    }
    
    if (!newTransaction.amount || parseFloat(newTransaction.amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a valid amount."
      });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: loanId,
          amount: parseFloat(newTransaction.amount),
          transaction_type: newTransaction.transactionType,
          transaction_date: newTransaction.transactionDate.toISOString(),
          payment_method: newTransaction.paymentMethod,
          receipt_number: newTransaction.receiptNumber,
          notes: newTransaction.notes,
          created_by: user.id
        })
        .select();
        
      if (error) throw error;
      
      // Reset form and close dialog
      setNewTransaction({
        amount: "",
        transactionType: "repayment",
        transactionDate: new Date(),
        paymentMethod: "cash",
        receiptNumber: "",
        notes: ""
      });
      
      setIsDialogOpen(false);
      
      // Refresh transactions list
      fetchTransactions();
      
      // Notify parent component
      if (onTransactionAdded) {
        onTransactionAdded();
      }
      
      toast({
        title: "Success",
        description: "Transaction added successfully."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Transaction History</h3>
        {!readOnly && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <PlusCircle className="h-4 w-4" />
                <span>Add Transaction</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
                <DialogDescription>
                  Record a new transaction for this loan.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({
                        ...newTransaction,
                        amount: e.target.value
                      })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="transactionType">Transaction Type</Label>
                    <Select
                      value={newTransaction.transactionType}
                      onValueChange={(value) => setNewTransaction({
                        ...newTransaction,
                        transactionType: value
                      })}
                    >
                      <SelectTrigger id="transactionType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repayment">Repayment</SelectItem>
                        <SelectItem value="disbursement">Disbursement</SelectItem>
                        <SelectItem value="fee">Fee</SelectItem>
                        <SelectItem value="interest">Interest</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Transaction Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newTransaction.transactionDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTransaction.transactionDate ? (
                            format(newTransaction.transactionDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newTransaction.transactionDate}
                          onSelect={(date) => date && setNewTransaction({
                            ...newTransaction,
                            transactionDate: date
                          })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={newTransaction.paymentMethod}
                      onValueChange={(value) => setNewTransaction({
                        ...newTransaction,
                        paymentMethod: value
                      })}
                    >
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt Number</Label>
                  <Input
                    id="receiptNumber"
                    placeholder="Optional"
                    value={newTransaction.receiptNumber}
                    onChange={(e) => setNewTransaction({
                      ...newTransaction,
                      receiptNumber: e.target.value
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional"
                    value={newTransaction.notes}
                    onChange={(e) => setNewTransaction({
                      ...newTransaction,
                      notes: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTransaction}>
                  Save Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
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
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  {loading ? "Loading..." : "No transactions found"}
                </TableCell>
              </TableRow>
            )}
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="capitalize">
                  {transaction.transaction_type}
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(transaction.amount)}
                </TableCell>
                <TableCell className="capitalize">
                  {transaction.payment_method || '-'}
                </TableCell>
                <TableCell>
                  {transaction.receipt_number || '-'}
                </TableCell>
                <TableCell>
                  {transaction.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
