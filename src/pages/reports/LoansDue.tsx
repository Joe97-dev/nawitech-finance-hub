import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { DateRange } from "react-day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { CalendarClock, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DueInstallment {
  loanId: string;
  loanNumber: string;
  clientName: string;
  loanAmount: number;
  installmentAmount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string;
  installmentStatus: string;
  loanStatus: string;
  branchName: string;
  loanOfficer: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) =>
  dateStr ? new Date(dateStr).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

const getInstallmentStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>;
    case "partial":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partial</Badge>;
    case "overdue":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Overdue</Badge>;
    default:
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
  }
};

const LoansDueReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()),
  });
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<DueInstallment[]>([]);

  useEffect(() => {
    fetchData();
  }, [date]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const orgId = await getOrganizationId();
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      setBranches(data || []);
    } catch (e) {
      // silently fail
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      const fromDate = date?.from ? date.from.toISOString().split("T")[0] : undefined;
      const toDate = date?.to ? date.to.toISOString().split("T")[0] : undefined;

      // Fetch schedules within date range that are not fully paid
      let scheduleQuery = supabase
        .from("loan_schedule")
        .select("loan_id, due_date, total_due, amount_paid, status")
        .eq("organization_id", orgId)
        .neq("status", "paid")
        .order("due_date", { ascending: true });

      if (fromDate) scheduleQuery = scheduleQuery.gte("due_date", fromDate);
      if (toDate) scheduleQuery = scheduleQuery.lte("due_date", toDate);

      const { data: schedules, error: schedError } = await scheduleQuery;
      if (schedError) throw schedError;

      if (!schedules || schedules.length === 0) {
        setInstallments([]);
        return;
      }

      const loanIds = [...new Set(schedules.map((s) => s.loan_id))];

      // Fetch loans
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, status, loan_officer_id")
        .in("id", loanIds)
        .not("status", "eq", "rejected");
      if (loansError) throw loansError;

      const loanMap = new Map((loans || []).map((l) => [l.id, l]));

      // Resolve client names
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const clientRefs = [...new Set((loans || []).map((l) => (l.client || "").trim()).filter(Boolean))];
      const clientIds = clientRefs.filter((r) => uuidPattern.test(r));

      const clientNameMap = new Map<string, string>();
      const clientBranchMap = new Map<string, string | null>();
      const batchSize = 50;

      for (let i = 0; i < clientIds.length; i += batchSize) {
        const batch = clientIds.slice(i, i + batchSize);
        const { data: clients } = await supabase
          .from("clients")
          .select("id, first_name, last_name, branch_id")
          .in("id", batch);
        (clients || []).forEach((c) => {
          clientNameMap.set(c.id, `${c.first_name} ${c.last_name}`);
          clientBranchMap.set(c.id, c.branch_id);
        });
      }

      // Fetch branch names
      const branchIds = [...new Set([...clientBranchMap.values()].filter(Boolean))] as string[];
      const branchNameMap = new Map<string, string>();
      if (branchIds.length > 0) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds);
        (branchData || []).forEach((b) => branchNameMap.set(b.id, b.name));
      }

      const resolveClientName = (ref: string) => {
        const n = (ref || "").trim();
        if (!n) return "Unknown";
        return clientNameMap.get(n) || (uuidPattern.test(n) ? "Unknown" : n);
      };

      const resolveClientBranch = (ref: string) => {
        const n = (ref || "").trim();
        const branchId = clientBranchMap.get(n);
        return branchId ? branchNameMap.get(branchId) || "—" : "—";
      };

      const results: DueInstallment[] = [];

      schedules.forEach((s) => {
        const loan = loanMap.get(s.loan_id);
        if (!loan) return;

        results.push({
          loanId: loan.id,
          loanNumber: loan.loan_number || "N/A",
          clientName: resolveClientName(loan.client),
          loanAmount: loan.amount,
          installmentAmount: s.total_due,
          amountPaid: s.amount_paid || 0,
          outstanding: s.total_due - (s.amount_paid || 0),
          dueDate: s.due_date,
          installmentStatus: s.status,
          loanStatus: loan.status,
          branchName: resolveClientBranch(loan.client),
        });
      });

      setInstallments(results);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Filter
  const filteredInstallments = installments.filter((inst) => {
    const matchesSearch = searchQuery === "" || inst.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || inst.loanNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranch === "all" || inst.branchName === branches.find((b) => b.id === selectedBranch)?.name;
    return matchesSearch && matchesBranch;
  });

  const totalDue = filteredInstallments.reduce((s, i) => s + i.installmentAmount, 0);
  const totalOutstanding = filteredInstallments.reduce((s, i) => s + i.outstanding, 0);
  const totalPaid = filteredInstallments.reduce((s, i) => s + i.amountPaid, 0);
  const overdueCount = filteredInstallments.filter((i) => i.installmentStatus === "overdue").length;

  const hasActiveFilters = selectedBranch !== "all" || searchQuery !== "" || date !== undefined;

  const handleReset = () => {
    setSelectedBranch("all");
    setSearchQuery("");
    setDate({
      from: new Date(),
      to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()),
    });
  };

  const exportData = filteredInstallments.map((i) => ({
    "Loan #": i.loanNumber,
    Client: i.clientName,
    "Due Date": formatDate(i.dueDate),
    "Installment Amount": i.installmentAmount,
    "Amount Paid": i.amountPaid,
    Outstanding: i.outstanding,
    Status: i.installmentStatus,
    Branch: i.branchName,
  }));

  const filters = (
    <ReportFilters title="Loans Due Filters" hasActiveFilters={hasActiveFilters} onReset={handleReset}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <DateRangePicker dateRange={date} onDateRangeChange={setDate} className="col-span-2" />

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Branch" />
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
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
          <Input
            placeholder="Search client or loan #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-dashed"
          />
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Loans Due Report"
      description="View upcoming loan repayment installments by date range"
      actions={<ExportButton data={exportData} filename="loans-due-report" />}
      filters={filters}
    >
      <ReportStats className="grid-cols-1 md:grid-cols-4">
        <ReportStat label="Installments Due" value={filteredInstallments.length} icon={<CalendarClock className="h-5 w-5" />} />
        <ReportStat label="Total Due" value={formatCurrency(totalDue)} icon={<DollarSign className="h-5 w-5" />} />
        <ReportStat label="Total Collected" value={formatCurrency(totalPaid)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <ReportStat label="Overdue" value={overdueCount} icon={<AlertTriangle className="h-5 w-5" />} subValue={formatCurrency(totalOutstanding) + " outstanding"} />
      </ReportStats>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Branch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex justify-center items-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No installments due in the selected date range
                  </TableCell>
                </TableRow>
              ) : (
                filteredInstallments.map((inst, idx) => (
                  <TableRow
                    key={`${inst.loanId}-${inst.dueDate}-${idx}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/loans/${inst.loanId}`)}
                  >
                    <TableCell className="font-medium">{inst.loanNumber}</TableCell>
                    <TableCell>{inst.clientName}</TableCell>
                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(inst.installmentAmount)}</TableCell>
                    <TableCell>{formatCurrency(inst.amountPaid)}</TableCell>
                    <TableCell className={inst.outstanding > 0 ? "text-destructive font-medium" : ""}>
                      {formatCurrency(inst.outstanding)}
                    </TableCell>
                    <TableCell>{getInstallmentStatusBadge(inst.installmentStatus)}</TableCell>
                    <TableCell>{inst.branchName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ReportPage>
  );
};

export default LoansDueReport;
