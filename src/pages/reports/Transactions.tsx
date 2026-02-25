import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { ReportPage } from "./Base";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransactionData {
  id: string;
  loan_id: string;
  loan_number: string;
  client_name: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

const transactionTypes = [
  { value: "all", label: "All Types" },
  { value: "repayment", label: "Repayments" },
  { value: "disbursement", label: "Disbursements" },
  { value: "fee", label: "Loan Fees" },
  { value: "client_fee", label: "Client Fees" },
  { value: "draw_down_payment", label: "Draw Down Payments" },
  { value: "draw_down_deposit", label: "Draw Down Deposits" },
];

const paymentMethods = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "client_draw_down", label: "Client Draw Down" },
];

const columns = [
  { key: "date", header: "Date" },
  { key: "client_name", header: "Client" },
  { key: "loan_number", header: "Loan Number" },
  { key: "transaction_type", header: "Type" },
  { key: "amount", header: "Amount" },
  { key: "payment_method", header: "Payment Method" },
  { key: "receipt_number", header: "Receipt #" },
  { key: "notes", header: "Notes" }
];

const TransactionsReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedType, setSelectedType] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        
        // First, get transactions
        let transactionQuery = supabase
          .from('loan_transactions')
          .select('*')
          .order('transaction_date', { ascending: false });

        // Apply date range filter
        if (dateRange?.from) {
          transactionQuery = transactionQuery.gte('transaction_date', dateRange.from.toISOString().split('T')[0]);
        }
        if (dateRange?.to) {
          // Use end of day to include all transactions on the 'to' date
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          transactionQuery = transactionQuery.lte('transaction_date', endOfDay.toISOString());
        }

        // Apply transaction type filter
        if (selectedType !== "all") {
          transactionQuery = transactionQuery.eq('transaction_type', selectedType);
        }

        // Apply payment method filter
        if (selectedPaymentMethod !== "all") {
          transactionQuery = transactionQuery.eq('payment_method', selectedPaymentMethod);
        }

        const { data: transactionData, error: transactionError } = await transactionQuery;
        
        if (transactionError) throw transactionError;
        
        // Get unique loan IDs from transactions
        const loanIds = [...new Set(transactionData?.map(t => t.loan_id) || [])];
        
        // Fetch loan data for client names and loan numbers
        const { data: loanData, error: loanError } = await supabase
          .from('loans')
          .select('id, client, loan_number')
          .in('id', loanIds);
          
        if (loanError) throw loanError;
        
        // Create a map of loan_id to loan info
        const loanInfoMap = new Map();
        loanData?.forEach(loan => {
          loanInfoMap.set(loan.id, {
            client: loan.client,
            loan_number: loan.loan_number || 'N/A'
          });
        });
        
        // Transform data to include client name and loan number
        const transformedData: TransactionData[] = (transactionData || []).map(transaction => {
          const loanInfo = loanInfoMap.get(transaction.loan_id);
          return {
            ...transaction,
            client_name: loanInfo?.client || 'Unknown Client',
            loan_number: loanInfo?.loan_number || 'N/A'
          };
        });

        setTransactions(transformedData);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load transaction data."
        });
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [toast, dateRange, selectedType, selectedPaymentMethod]);

  // Filter data based on search term
  const filteredData = transactions.filter(transaction => {
    if (!searchTerm) return true;
    
      const searchLower = searchTerm.toLowerCase();
      return (
        transaction.client_name?.toLowerCase().includes(searchLower) ||
        transaction.loan_number?.toLowerCase().includes(searchLower) ||
        transaction.receipt_number?.toLowerCase().includes(searchLower) ||
        transaction.notes?.toLowerCase().includes(searchLower)
      );
  });

  // Calculate statistics
  const totalAmount = filteredData.reduce((sum, transaction) => sum + transaction.amount, 0);
  const repaymentAmount = filteredData
    .filter(t => t.transaction_type === 'repayment')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const disbursementAmount = filteredData
    .filter(t => t.transaction_type === 'disbursement')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const feeAmount = filteredData
    .filter(t => t.transaction_type === 'fee' || t.transaction_type === 'client_fee')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "repayment":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Repayment</Badge>;
      case "disbursement":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Disbursement</Badge>;
      case "fee":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Loan Fee</Badge>;
      case "client_fee":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Client Fee</Badge>;
      case "draw_down_payment":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Draw Down Payment</Badge>;
      case "draw_down_deposit":
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">Draw Down Deposit</Badge>;
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

  const hasActiveFilters = selectedType !== "all" || selectedPaymentMethod !== "all" || (dateRange !== undefined) || searchTerm !== "";

  const handleReset = () => {
    setSelectedType("all");
    setSelectedPaymentMethod("all");
    setDateRange(undefined);
    setSearchTerm("");
  };

  return (
    <ReportPage
      title="Transactions Report"
      description="Comprehensive view of all loan transactions including payments, disbursements, and fees"
      actions={
        <ExportButton 
          data={filteredData.map(transaction => ({
            date: new Date(transaction.transaction_date).toLocaleDateString('en-US'),
            client_name: transaction.client_name,
            loan_number: transaction.loan_number,
            transaction_type: transaction.transaction_type,
            amount: transaction.amount,
            payment_method: transaction.payment_method || '',
            receipt_number: transaction.receipt_number || '',
            notes: transaction.notes || ''
          }))} 
          filename={`transactions-report-${new Date().toISOString().slice(0, 10)}`} 
          columns={columns} 
        />
      }
    >
      <ReportFilters 
        hasActiveFilters={hasActiveFilters}
        onReset={handleReset}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            className="md:col-span-2"
          />
          
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Transaction Type
            </label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {transactionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Payment Method
            </label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Search
            </label>
            <Input
              placeholder="Client, Loan Number, Receipt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-dashed"
            />
          </div>
        </div>
      </ReportFilters>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat
              label="Total Transaction Amount"
              value={formatCurrency(totalAmount)}
              subValue={`${filteredData.length} transactions`}
              trend="up"
              trendValue="12.3%"
            />
            <ReportStat
              label="Total Repayments"
              value={formatCurrency(repaymentAmount)}
              subValue="Customer payments"
              trend="up"
              trendValue="8.7%"
            />
            <ReportStat
              label="Total Disbursements"
              value={formatCurrency(disbursementAmount)}
              subValue="Loans disbursed"
              trend="up"
              trendValue="15.2%"
            />
            <ReportStat
              label="Fees Collected"
              value={formatCurrency(feeAmount)}
              subValue="Processing & other fees"
              trend="up"
              trendValue="5.4%"
            />
          </ReportStats>

          <ReportCard title="All Transactions">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found for the selected criteria
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/50">
                      <TableCell>
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.client_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {transaction.loan_number}
                      </TableCell>
                      <TableCell>
                        {getTransactionBadge(transaction.transaction_type)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        {transaction.payment_method ? (
                          <span className="capitalize">{transaction.payment_method.replace('_', ' ')}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {transaction.receipt_number || "—"}
                      </TableCell>
                      <TableCell className="max-w-32 truncate">
                        {transaction.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <button 
                          className="text-xs text-primary hover:underline"
                          onClick={() => navigate(`/loans/${transaction.loan_id}`)}
                        >
                          View Loan
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ReportCard>
        </div>
      )}
    </ReportPage>
  );
};

export default TransactionsReport;