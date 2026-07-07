import { useState, useEffect, useMemo } from "react";
import { ReportPage } from "./Base";
import { DateRange } from "react-day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getOrganizationId } from "@/lib/get-organization-id";

interface LoanBookRow {
  id: string;
  client_name: string;
  loan_number: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  total_repayable: number;
  amount_paid: number;
  outstanding: number;
  status: string;
  disbursed_date: string;
  loan_officer: string;
  branch_name: string;
  branch_id: string | null;
}

interface Branch {
  id: string;
  name: string;
}

const columns = [
  { key: "loan_number", header: "Loan Number" },
  { key: "client_name", header: "Client Name" },
  { key: "disbursed_date", header: "Disbursed Date" },
  { key: "principal", header: "Principal (KES)" },
  { key: "interest_rate", header: "Interest Rate (%)" },
  { key: "term_months", header: "Term (Months)" },
  { key: "total_repayable", header: "Total Repayable (KES)" },
  { key: "amount_paid", header: "Amount Paid (KES)" },
  { key: "outstanding", header: "Outstanding (KES)" },
  { key: "status", header: "Status" },
  { key: "loan_officer", header: "Loan Officer" },
  { key: "branch_name", header: "Branch" },
];

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in arrears", label: "In Arrears" },
  { value: "closed", label: "Closed" },
  { value: "pending", label: "Pending" },
  { value: "disbursed", label: "Disbursed" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LoanBookReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<LoanBookRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orgId = await getOrganizationId();

        const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        // Paginated loan fetch (exclude fee accounts and abandoned loans)
        let allLoans: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabase
            .from("loans")
            .select("id, client, loan_number, amount, balance, date, term_months, interest_rate, interest_method, loan_officer_id, status")
            .neq("type", "client_fee_account")
            .neq("status", "abandoned")
            .order("date", { ascending: false })
            .range(from, from + pageSize - 1);

          if (date?.from) query = query.gte("date", formatLocal(date.from));
          if (date?.to) query = query.lte("date", formatLocal(date.to));

          const { data, error } = await query;
          if (error) throw error;
          allLoans = allLoans.concat(data || []);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }

        // Resolve clients, officers, branches
        const clientRefs = [...new Set(allLoans.map((l) => (l.client || "").trim()).filter(Boolean))];
        const clientUuids = clientRefs.filter((r) => UUID_RE.test(r));
        const officerIds = [...new Set(allLoans.map((l) => l.loan_officer_id).filter(Boolean))] as string[];

        const clientNameMap = new Map<string, string>();
        const clientBranchMap = new Map<string, string | null>();
        const batchSize = 50;
        for (let i = 0; i < clientUuids.length; i += batchSize) {
          const batch = clientUuids.slice(i, i + batchSize);
          const { data: clients } = await supabase
            .from("clients")
            .select("id, first_name, last_name, branch_id")
            .in("id", batch);
          (clients || []).forEach((c) => {
            clientNameMap.set(c.id, `${c.first_name} ${c.last_name}`);
            clientBranchMap.set(c.id, c.branch_id);
          });
        }

        const profileMap = new Map<string, string>();
        for (let i = 0; i < officerIds.length; i += batchSize) {
          const batch = officerIds.slice(i, i + batchSize);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", batch);
          (profiles || []).forEach((p) => {
            profileMap.set(p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—");
          });
        }

        const { data: branchesData } = await supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("name");
        const branchNameMap = new Map<string, string>();
        (branchesData || []).forEach((b) => branchNameMap.set(b.id, b.name));
        setBranches(branchesData || []);

        const resolveClient = (ref: string) => {
          const r = (ref || "").trim();
          if (!r) return "Unknown";
          return clientNameMap.get(r) || (UUID_RE.test(r) ? "Unknown" : r);
        };

        const transformed: LoanBookRow[] = allLoans.map((loan) => {
          const principal = Number(loan.amount) || 0;
          const rate = Number(loan.interest_rate) || 0;
          const term = loan.term_months || 12;
          const interest = principal * (rate / 100) * term;
          const totalRepayable = principal + interest;
          const outstanding = Number(loan.balance) || 0;
          const amountPaid = Math.max(0, totalRepayable - outstanding);
          const branchId = clientBranchMap.get((loan.client || "").trim()) || null;
          return {
            id: loan.id,
            client_name: resolveClient(loan.client),
            loan_number: loan.loan_number || "N/A",
            principal,
            interest_rate: rate,
            term_months: term,
            total_repayable: totalRepayable,
            amount_paid: amountPaid,
            outstanding,
            status: loan.status || "—",
            disbursed_date: loan.date,
            loan_officer: loan.loan_officer_id ? profileMap.get(loan.loan_officer_id) || "—" : "—",
            branch_name: branchId ? branchNameMap.get(branchId) || "—" : "—",
            branch_id: branchId,
          };
        });

        setRows(transformed);
      } catch (error: any) {
        console.error("Error fetching loan book data:", error);
        toast({ variant: "destructive", title: "Data fetch error", description: "Failed to load loan book data." });
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast, date]);

  const filteredRows = useMemo(
    () =>
      rows.filter((loan) => {
        const matchesSearch =
          searchQuery === "" ||
          loan.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = selectedBranch === "all" || loan.branch_id === selectedBranch;
        const matchesStatus = selectedStatus === "all" || loan.status === selectedStatus;
        return matchesSearch && matchesBranch && matchesStatus;
      }),
    [rows, searchQuery, selectedBranch, selectedStatus]
  );

  const totalPrincipal = filteredRows.reduce((acc, l) => acc + l.principal, 0);
  const totalOutstanding = filteredRows.reduce((acc, l) => acc + l.outstanding, 0);
  const totalPaid = filteredRows.reduce((acc, l) => acc + l.amount_paid, 0);

  const hasActiveFilters = searchQuery !== "" || selectedBranch !== "all" || selectedStatus !== "all" || date !== undefined;

  const handleReset = () => {
    setSearchQuery("");
    setSelectedBranch("all");
    setSelectedStatus("all");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters title="Loan Book Filters" hasActiveFilters={hasActiveFilters} onReset={handleReset}>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <DateRangePicker dateRange={date} onDateRangeChange={setDate} />

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
          <Input
            placeholder="Search by client name or loan number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-dashed"
          />
        </div>
      </div>

      <div className="bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="text-sm">
          <span className="font-medium">{filteredRows.length}</span> loans
        </div>
        <div className="text-sm font-medium">
          Outstanding: <span className="text-primary">KES {totalOutstanding.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Loan Book Report"
      description="Complete portfolio of all loans with principal, repayments, and outstanding balances"
      actions={
        <ExportButton
          data={filteredRows.map((loan) => ({
            loan_number: loan.loan_number,
            client_name: loan.client_name,
            disbursed_date: loan.disbursed_date ? new Date(loan.disbursed_date).toLocaleDateString() : "",
            principal: loan.principal,
            interest_rate: loan.interest_rate,
            term_months: loan.term_months,
            total_repayable: Math.round(loan.total_repayable),
            amount_paid: Math.round(loan.amount_paid),
            outstanding: Math.round(loan.outstanding),
            status: loan.status,
            loan_officer: loan.loan_officer,
            branch_name: loan.branch_name,
          }))}
          filename={`loan-book-${new Date().toISOString().slice(0, 10)}`}
          columns={columns}
        />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Total Principal</div>
              <div className="text-2xl font-bold mt-1">KES {totalPrincipal.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{filteredRows.length} loans</div>
            </div>
            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Total Collected</div>
              <div className="text-2xl font-bold mt-1">KES {Math.round(totalPaid).toLocaleString()}</div>
            </div>
            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Total Outstanding</div>
              <div className="text-2xl font-bold mt-1">KES {Math.round(totalOutstanding).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Loan Book</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Disbursed</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Term</TableHead>
                    <TableHead className="text-right">Total Repayable</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Loan Officer</TableHead>
                    <TableHead>Branch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-4 text-muted-foreground">
                        No loans found for the selected criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((loan) => (
                      <TableRow
                        key={loan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/loans/${loan.id}`)}
                      >
                        <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
                        <TableCell className="font-medium">{loan.client_name}</TableCell>
                        <TableCell>{loan.disbursed_date ? new Date(loan.disbursed_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">{loan.principal.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{loan.interest_rate}%</TableCell>
                        <TableCell className="text-right">{loan.term_months}m</TableCell>
                        <TableCell className="text-right">{Math.round(loan.total_repayable).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Math.round(loan.amount_paid).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Math.round(loan.outstanding).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={["active", "in arrears", "disbursed"].includes(loan.status) ? "default" : "secondary"}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{loan.loan_officer}</TableCell>
                        <TableCell>{loan.branch_name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

export default LoanBookReport;
