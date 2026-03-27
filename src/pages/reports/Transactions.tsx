import { useState, useEffect, useMemo, useRef } from "react";
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
  processed_by: string;
  loan_officer: string;
  branch: string;
}

// Valid DB transaction types only
const transactionTypes = [
  { value: "all", label: "All Types" },
  { value: "repayment", label: "Repayments" },
  { value: "disbursement", label: "Disbursements" },
  { value: "fee", label: "Fees" },
  { value: "penalty", label: "Penalties" },
  { value: "interest", label: "Interest" },
  { value: "adjustment", label: "Adjustments" },
];

const paymentMethods = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "draw_down_account", label: "Draw Down Account" },
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
  { key: "notes", header: "Notes" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  // Ref-based lookup maps to avoid re-fetch dependency
  const profileMapRef = useRef(new Map<string, string>());
  const branchNameMapRef = useRef(new Map<string, string>());
  const clientNameMapRef = useRef(new Map<string, string>());
  const clientBranchMapRef = useRef(new Map<string, string | null>());

  // Fetch filter options once
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const [profilesRes, branchesRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, username"),
        supabase.from("branches").select("id, name"),
      ]);

      if (profilesRes.data) {
        const officers: { id: string; name: string }[] = [];
        profilesRes.data.forEach((p) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Unknown";
          profileMapRef.current.set(p.id, name);
          officers.push({ id: p.id, name });
        });
        setLoanOfficers(officers);
      }

      if (branchesRes.data) {
        branchesRes.data.forEach((b) => branchNameMapRef.current.set(b.id, b.name));
        setBranches(branchesRes.data.map((b) => ({ id: b.id, name: b.name })));
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch transactions — no dependency on branches
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);

        const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        const fromDate = dateRange?.from ? formatLocal(dateRange.from) : undefined;
        const toDate = dateRange?.to ? formatLocal(dateRange.to) : undefined;
        const toDateEndOfDay = toDate ? `${toDate}T23:59:59.999` : undefined;

        // Fetch all loans for lookup (exclude fee accounts)
        const { data: allLoans } = await supabase
          .from("loans")
          .select("id, client, loan_number, amount, date, created_at, loan_officer_id, status")
          .neq("type", "client_fee_account");

        const loanInfoMap = new Map<string, { client: string; loan_number: string; loan_officer_id: string | null; status: string }>();
        (allLoans || []).forEach((loan) => {
          loanInfoMap.set(loan.id, {
            client: loan.client,
            loan_number: loan.loan_number || "N/A",
            loan_officer_id: loan.loan_officer_id,
            status: loan.status,
          });
        });

        // Resolve client UUIDs to names (batched)
        const clientRefs = [...new Set((allLoans || []).map((l) => (l.client || "").trim()).filter(Boolean))];
        const clientUuids = clientRefs.filter((r) => UUID_RE.test(r));
        const batchSize = 50;

        for (let i = 0; i < clientUuids.length; i += batchSize) {
          const batch = clientUuids.slice(i, i + batchSize);
          const { data: clients } = await supabase
            .from("clients")
            .select("id, first_name, last_name, branch_id")
            .in("id", batch);
          (clients || []).forEach((c) => {
            clientNameMapRef.current.set(c.id, `${c.first_name} ${c.last_name}`);
            if (c.branch_id) clientBranchMapRef.current.set(c.id, c.branch_id);
          });
        }

        // Also map name-based clients to branch
        const nonUuidRefs = clientRefs.filter((r) => !UUID_RE.test(r));
        if (nonUuidRefs.length > 0) {
          // Try to find clients by matching first_name + last_name
          const { data: nameClients } = await supabase
            .from("clients")
            .select("id, first_name, last_name, branch_id");
          (nameClients || []).forEach((c) => {
            const fullName = `${c.first_name} ${c.last_name}`;
            if (c.branch_id) clientBranchMapRef.current.set(fullName.toLowerCase(), c.branch_id);
          });
        }

        // Ensure profile and branch maps are populated
        if (profileMapRef.current.size === 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, username");
          (profiles || []).forEach((p) => {
            profileMapRef.current.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Unknown");
          });
        }
        if (branchNameMapRef.current.size === 0) {
          const { data: branchData } = await supabase.from("branches").select("id, name");
          (branchData || []).forEach((b) => branchNameMapRef.current.set(b.id, b.name));
        }

        const resolveClientName = (ref: string) => {
          const r = (ref || "").trim();
          if (!r) return "Unknown";
          return clientNameMapRef.current.get(r) || (UUID_RE.test(r) ? "Unknown" : r);
        };

        const resolveOfficerAndBranch = (loanId: string) => {
          const loanInfo = loanInfoMap.get(loanId);
          const officerName = loanInfo?.loan_officer_id ? profileMapRef.current.get(loanInfo.loan_officer_id) || "—" : "—";
          const clientRef = (loanInfo?.client || "").trim();
          const branchId =
            clientBranchMapRef.current.get(clientRef) ||
            clientBranchMapRef.current.get(clientRef.toLowerCase());
          const branchName = branchId ? branchNameMapRef.current.get(branchId) || "—" : "—";
          return { officerName, branchName };
        };

        const allTransactions: TransactionData[] = [];

        // 1) Fetch loan_transactions with pagination
        const shouldFetchLoanTx = selectedType === "all" || selectedType !== "disbursement";
        if (shouldFetchLoanTx) {
          let from = 0;
          const pageSize = 1000;

          while (true) {
            let query = supabase
              .from("loan_transactions")
              .select("id, loan_id, amount, transaction_date, transaction_type, payment_method, receipt_number, notes, created_by")
              .eq("is_reverted", false)
              .order("transaction_date", { ascending: false })
              .range(from, from + pageSize - 1);

            if (fromDate) query = query.gte("transaction_date", fromDate);
            if (toDateEndOfDay) query = query.lte("transaction_date", toDateEndOfDay);
            if (selectedType !== "all" && selectedType !== "disbursement") {
              query = query.eq("transaction_type", selectedType);
            }
            if (selectedPaymentMethod !== "all") {
              query = query.eq("payment_method", selectedPaymentMethod);
            }

            const { data, error } = await query;
            if (error) throw error;

            (data || []).forEach((tx) => {
              const loanInfo = loanInfoMap.get(tx.loan_id);
              const { officerName, branchName } = resolveOfficerAndBranch(tx.loan_id);
              allTransactions.push({
                id: tx.id,
                loan_id: tx.loan_id,
                client_name: loanInfo ? resolveClientName(loanInfo.client) : "Unknown",
                loan_number: loanInfo?.loan_number || "N/A",
                amount: tx.amount,
                transaction_date: tx.transaction_date,
                transaction_type: tx.transaction_type,
                payment_method: tx.payment_method,
                receipt_number: tx.receipt_number,
                notes: tx.notes,
                processed_by: tx.created_by ? profileMapRef.current.get(tx.created_by) || "—" : "—",
                loan_officer: officerName,
                branch: branchName,
              });
            });

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
        }

        // 2) Fetch disbursements from loans (exclude rejected/pending/postponed/fee accounts)
        const shouldFetchDisbursements = selectedType === "all" || selectedType === "disbursement";
        if (shouldFetchDisbursements && selectedPaymentMethod === "all") {
          const validStatuses = ["approved", "disbursed", "active", "closed", "in arrears"]; // excludes abandoned
          const filteredLoans = (allLoans || []).filter((loan) => {
            if (!validStatuses.includes(loan.status)) return false;
            if (fromDate && loan.date < fromDate) return false;
            if (toDate && loan.date > toDate) return false;
            return true;
          });

          filteredLoans.forEach((loan) => {
            const { officerName, branchName } = resolveOfficerAndBranch(loan.id);
            allTransactions.push({
              id: `disb-${loan.id}`,
              loan_id: loan.id,
              loan_number: loan.loan_number || "N/A",
              client_name: resolveClientName(loan.client),
              amount: loan.amount,
              transaction_date: loan.created_at || loan.date,
              transaction_type: "disbursement",
              payment_method: null,
              receipt_number: null,
              notes: "Loan disbursement",
              processed_by: "—",
              loan_officer: officerName,
              branch: branchName,
            });
          });
        }

        allTransactions.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        setTransactions(allTransactions);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        toast({ variant: "destructive", title: "Data fetch error", description: "Failed to load transaction data." });
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [toast, dateRange, selectedType, selectedPaymentMethod]);

  // Client-side filters
  const filteredData = useMemo(
    () =>
      transactions.filter((t) => {
        if (selectedOfficer !== "all") {
          const officerName = loanOfficers.find((o) => o.id === selectedOfficer)?.name || "";
          if (t.loan_officer !== officerName) return false;
        }
        if (selectedBranch !== "all") {
          const branchName = branches.find((b) => b.id === selectedBranch)?.name || "";
          if (t.branch !== branchName) return false;
        }
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
          t.client_name?.toLowerCase().includes(s) ||
          t.loan_number?.toLowerCase().includes(s) ||
          t.receipt_number?.toLowerCase().includes(s) ||
          t.notes?.toLowerCase().includes(s)
        );
      }),
    [transactions, selectedOfficer, selectedBranch, searchTerm, loanOfficers, branches]
  );

  const totalAmount = filteredData.reduce((s, t) => s + t.amount, 0);
  const repaymentAmount = filteredData.filter((t) => t.transaction_type === "repayment").reduce((s, t) => s + t.amount, 0);
  const disbursementAmount = filteredData.filter((t) => t.transaction_type === "disbursement").reduce((s, t) => s + t.amount, 0);
  const feeAmount = filteredData.filter((t) => t.transaction_type === "fee").reduce((s, t) => s + t.amount, 0);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "repayment":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Repayment</Badge>;
      case "disbursement":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Disbursement</Badge>;
      case "fee":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Fee</Badge>;
      case "penalty":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Penalty</Badge>;
      case "interest":
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">Interest</Badge>;
      case "adjustment":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Adjustment</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const hasActiveFilters = selectedType !== "all" || selectedPaymentMethod !== "all" || selectedOfficer !== "all" || selectedBranch !== "all" || dateRange !== undefined || searchTerm !== "";

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
          data={filteredData.map((t) => ({
            date: new Date(t.transaction_date).toLocaleDateString("en-US"),
            client_name: t.client_name,
            loan_number: t.loan_number,
            transaction_type: t.transaction_type,
            amount: t.amount,
            payment_method: t.payment_method || "",
            receipt_number: t.receipt_number || "",
            loan_officer: t.loan_officer || "",
            branch: t.branch || "",
            processed_by: t.processed_by || "",
            notes: t.notes || "",
          }))}
          filename={`transactions-report-${new Date().toISOString().slice(0, 10)}`}
          columns={columns}
        />
      }
    >
      <ReportFilters hasActiveFilters={hasActiveFilters} onReset={handleReset}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} className="md:col-span-2" />

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Transaction Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="border-dashed"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {transactionTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payment Method</label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="border-dashed"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Loan Officer</label>
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger className="border-dashed"><SelectValue placeholder="All Officers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Officers</SelectItem>
                {loanOfficers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="border-dashed"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
            <Input placeholder="Client, Loan Number, Receipt..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-dashed" />
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
            <ReportStat label="Total Transaction Amount" value={formatCurrency(totalAmount)} subValue={`${filteredData.length} transactions`} />
            <ReportStat label="Total Repayments" value={formatCurrency(repaymentAmount)} subValue="Customer payments" />
            <ReportStat label="Total Disbursements" value={formatCurrency(disbursementAmount)} subValue="Loans disbursed" />
            <ReportStat label="Fees Collected" value={formatCurrency(feeAmount)} subValue="Processing & other fees" />
          </ReportStats>

          <ReportCard title="All Transactions">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No transactions found for the selected criteria</div>
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
                  {filteredData.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell>{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{t.client_name}</TableCell>
                      <TableCell className="font-mono text-sm">{t.loan_number}</TableCell>
                      <TableCell>{getTransactionBadge(t.transaction_type)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(t.amount)}</TableCell>
                      <TableCell>{t.payment_method ? <span className="capitalize">{t.payment_method.replace(/_/g, " ")}</span> : "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{t.receipt_number || "—"}</TableCell>
                      <TableCell className="text-sm">{t.loan_officer}</TableCell>
                      <TableCell className="text-sm">{t.branch}</TableCell>
                      <TableCell className="text-sm">{t.processed_by}</TableCell>
                      <TableCell className="max-w-32 truncate">{t.notes || "—"}</TableCell>
                      <TableCell>
                        <button className="text-xs text-primary hover:underline" onClick={() => navigate(`/loans/${t.loan_id}`)}>
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
