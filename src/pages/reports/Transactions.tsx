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
  processed_by: string;
  loan_officer: string;
  branch: string;
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
  { key: "loan_officer", header: "Loan Officer" },
  { key: "branch", header: "Branch" },
  { key: "processed_by", header: "Processed By" },
  { key: "notes", header: "Notes" }
];

const TransactionsReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedType, setSelectedType] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [selectedOfficer, setSelectedOfficer] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loanOfficers, setLoanOfficers] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Fetch loan officers and branches for filters
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const [profilesRes, branchesRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, username'),
        supabase.from('branches').select('id, name'),
      ]);
      if (profilesRes.data) {
        setLoanOfficers(profilesRes.data.map(p => ({
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'Unknown'
        })));
      }
      if (branchesRes.data) {
        setBranches(branchesRes.data.map(b => ({ id: b.id, name: b.name })));
      }
    };
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);

        const allTransactions: TransactionData[] = [];
        
        const formatLocal = (date: Date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const fromDate = dateRange?.from ? formatLocal(dateRange.from) : undefined;
        const toDate = dateRange?.to ? formatLocal(dateRange.to) : undefined;
        const toDateEndOfDay = toDate ? `${toDate}T23:59:59.999` : undefined;

        // Fetch all loans to map loan_officer_id and client -> branch
        const { data: allLoans } = await supabase
          .from('loans')
          .select('id, client, loan_number, amount, date, created_at, loan_officer_id');

        // Fetch all clients to map client name -> branch_id
        const { data: allClients } = await supabase
          .from('clients')
          .select('first_name, last_name, branch_id');

        // Build client name -> branch_id map
        const clientBranchMap = new Map<string, string>();
        (allClients || []).forEach(c => {
          const name = `${c.first_name} ${c.last_name}`.toLowerCase();
          if (c.branch_id) clientBranchMap.set(name, c.branch_id);
        });

        // Build loan info map
        const loanInfoMap = new Map<string, { client: string; loan_number: string; loan_officer_id: string | null }>();
        (allLoans || []).forEach(loan => {
          loanInfoMap.set(loan.id, {
            client: loan.client,
            loan_number: loan.loan_number || 'N/A',
            loan_officer_id: loan.loan_officer_id
          });
        });

        // Fetch all profiles for officer name resolution
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username');
        
        const profileMap = new Map<string, string>();
        (allProfiles || []).forEach(p => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'Unknown';
          profileMap.set(p.id, name);
        });

        // Build branch id -> name map
        const branchNameMap = new Map<string, string>();
        branches.forEach(b => branchNameMap.set(b.id, b.name));
        // If branches not loaded yet, fetch directly
        if (branchNameMap.size === 0) {
          const { data: branchData } = await supabase.from('branches').select('id, name');
          (branchData || []).forEach(b => branchNameMap.set(b.id, b.name));
        }

        const resolveOfficerAndBranch = (loanId: string) => {
          const loanInfo = loanInfoMap.get(loanId);
          const officerName = loanInfo?.loan_officer_id ? profileMap.get(loanInfo.loan_officer_id) || '—' : '—';
          const clientName = loanInfo?.client || '';
          const branchId = clientBranchMap.get(clientName.toLowerCase());
          const branchName = branchId ? branchNameMap.get(branchId) || '—' : '—';
          return { officerName, branchName, branchId, officerId: loanInfo?.loan_officer_id || '' };
        };

        // Fetch loan_transactions
        const shouldFetchLoanTransactions = selectedType === "all" || selectedType !== "disbursement";
        
        if (shouldFetchLoanTransactions) {
          let transactionQuery = supabase
            .from('loan_transactions')
            .select('*')
            .eq('is_reverted', false)
            .order('transaction_date', { ascending: false });

          if (fromDate) transactionQuery = transactionQuery.gte('transaction_date', fromDate);
          if (toDateEndOfDay) transactionQuery = transactionQuery.lte('transaction_date', toDateEndOfDay);
          if (selectedType !== "all" && selectedType !== "disbursement") {
            transactionQuery = transactionQuery.eq('transaction_type', selectedType);
          }
          if (selectedPaymentMethod !== "all") {
            transactionQuery = transactionQuery.eq('payment_method', selectedPaymentMethod);
          }

          const { data: transactionData, error: transactionError } = await transactionQuery;
          if (transactionError) throw transactionError;

          (transactionData || []).forEach(transaction => {
            const loanInfo = loanInfoMap.get(transaction.loan_id);
            const { officerName, branchName } = resolveOfficerAndBranch(transaction.loan_id);
            allTransactions.push({
              ...transaction,
              client_name: loanInfo?.client || 'Unknown Client',
              loan_number: loanInfo?.loan_number || 'N/A',
              processed_by: profileMap.get(transaction.created_by) || '—',
              loan_officer: officerName,
              branch: branchName,
            });
          });
        }

        // Fetch disbursements
        const shouldFetchDisbursements = selectedType === "all" || selectedType === "disbursement";
        
        if (shouldFetchDisbursements && selectedPaymentMethod === "all") {
          const filteredLoans = (allLoans || []).filter(loan => {
            if (fromDate && loan.date < fromDate) return false;
            if (toDate && loan.date > toDate) return false;
            return true;
          });

          filteredLoans.forEach(loan => {
            const { officerName, branchName } = resolveOfficerAndBranch(loan.id);
            allTransactions.push({
              id: `disb-${loan.id}`,
              loan_id: loan.id,
              loan_number: loan.loan_number || 'N/A',
              client_name: loan.client || 'Unknown Client',
              amount: loan.amount,
              transaction_date: loan.created_at || loan.date,
              transaction_type: 'disbursement',
              payment_method: null,
              receipt_number: null,
              notes: 'Loan disbursement',
              created_by: '',
              created_at: loan.created_at || loan.date,
              processed_by: '—',
              loan_officer: officerName,
              branch: branchName,
            });
          });
        }

        allTransactions.sort((a, b) => 
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        );

        setTransactions(allTransactions);
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
  }, [toast, dateRange, selectedType, selectedPaymentMethod, branches]);

  // Filter data based on search term, officer, branch
  const filteredData = transactions.filter(transaction => {
    if (selectedOfficer !== "all") {
      const officerName = loanOfficers.find(o => o.id === selectedOfficer)?.name || '';
      if (transaction.loan_officer !== officerName) return false;
    }
    if (selectedBranch !== "all") {
      const branchName = branches.find(b => b.id === selectedBranch)?.name || '';
      if (transaction.branch !== branchName) return false;
    }
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.client_name?.toLowerCase().includes(searchLower) ||
      transaction.loan_number?.toLowerCase().includes(searchLower) ||
      transaction.receipt_number?.toLowerCase().includes(searchLower) ||
      transaction.notes?.toLowerCase().includes(searchLower)
    );
  });

  const totalAmount = filteredData.reduce((sum, t) => sum + t.amount, 0);
  const repaymentAmount = filteredData.filter(t => t.transaction_type === 'repayment').reduce((sum, t) => sum + t.amount, 0);
  const disbursementAmount = filteredData.filter(t => t.transaction_type === 'disbursement').reduce((sum, t) => sum + t.amount, 0);
  const feeAmount = filteredData.filter(t => t.transaction_type === 'fee' || t.transaction_type === 'client_fee').reduce((sum, t) => sum + t.amount, 0);

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

  const hasActiveFilters = selectedType !== "all" || selectedPaymentMethod !== "all" || selectedOfficer !== "all" || selectedBranch !== "all" || (dateRange !== undefined) || searchTerm !== "";

  const handleReset = () => {
    setSelectedType("all");
    setSelectedPaymentMethod("all");
    setSelectedOfficer("all");
    setSelectedBranch("all");
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
            loan_officer: transaction.loan_officer || '',
            branch: transaction.branch || '',
            processed_by: transaction.processed_by || '',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Loan Officer
            </label>
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="All Officers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Officers</SelectItem>
                {loanOfficers.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Branch
            </label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
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
                    <TableHead>Loan Officer</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Processed By</TableHead>
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
                      <TableCell className="text-sm">
                        {transaction.loan_officer || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.branch || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.processed_by || "—"}
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
