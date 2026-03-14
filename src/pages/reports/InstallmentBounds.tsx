
import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useNavigate } from "react-router-dom";
import { CalendarRange, DollarSign, Clock } from "lucide-react";

interface InstallmentBoundsData {
  loanId: string;
  loanNumber: string;
  clientName: string;
  loanAmount: number;
  balance: number;
  status: string;
  firstInstallmentDate: string;
  firstInstallmentAmount: number;
  firstInstallmentStatus: string;
  lastInstallmentDate: string;
  lastInstallmentAmount: number;
  lastInstallmentStatus: string;
  totalInstallments: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) =>
  dateStr ? new Date(dateStr).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>;
    case "partial":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partial</Badge>;
    case "overdue":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Overdue</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Pending</Badge>;
  }
};

export default function InstallmentBoundsReport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<InstallmentBoundsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      // Fetch loans
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, balance, status")
        .eq("organization_id", orgId)
        .not("status", "eq", "rejected");

      if (loansError) throw loansError;
      if (!loans || loans.length === 0) { setData([]); return; }

      // Fetch all schedules for these loans
      const loanIds = loans.map(l => l.id);
      const { data: schedules, error: schedError } = await supabase
        .from("loan_schedule")
        .select("loan_id, due_date, total_due, amount_paid, status")
        .in("loan_id", loanIds)
        .order("due_date", { ascending: true });

      if (schedError) throw schedError;

      // Fetch client names
      const clientIds = [...new Set(loans.map(l => l.client))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", clientIds);

      const clientMap = new Map((clients || []).map(c => [c.id, `${c.first_name} ${c.last_name}`]));

      // Group schedules by loan
      const scheduleMap = new Map<string, typeof schedules>();
      (schedules || []).forEach(s => {
        if (!scheduleMap.has(s.loan_id)) scheduleMap.set(s.loan_id, []);
        scheduleMap.get(s.loan_id)!.push(s);
      });

      const result: InstallmentBoundsData[] = loans
        .filter(loan => scheduleMap.has(loan.id) && scheduleMap.get(loan.id)!.length > 0)
        .map(loan => {
          const items = scheduleMap.get(loan.id)!;
          const first = items[0];
          const last = items[items.length - 1];
          return {
            loanId: loan.id,
            loanNumber: loan.loan_number || "N/A",
            clientName: clientMap.get(loan.client) || "Unknown",
            loanAmount: loan.amount,
            balance: loan.balance,
            status: loan.status,
            firstInstallmentDate: first.due_date,
            firstInstallmentAmount: first.total_due,
            firstInstallmentStatus: first.status,
            lastInstallmentDate: last.due_date,
            lastInstallmentAmount: last.total_due,
            lastInstallmentStatus: last.status,
            totalInstallments: items.length,
          };
        });

      setData(result);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = statusFilter === "all" ? data : data.filter(d => d.status === statusFilter);

  const totalLoans = filtered.length;
  const fullyPaidFirst = filtered.filter(d => d.firstInstallmentStatus === "paid").length;
  const fullyPaidLast = filtered.filter(d => d.lastInstallmentStatus === "paid").length;

  const exportData = filtered.map(d => ({
    "Loan #": d.loanNumber,
    Client: d.clientName,
    "Loan Amount": d.loanAmount,
    Balance: d.balance,
    Status: d.status,
    "First Installment Date": formatDate(d.firstInstallmentDate),
    "First Installment Amount": d.firstInstallmentAmount,
    "First Installment Status": d.firstInstallmentStatus,
    "Last Installment Date": formatDate(d.lastInstallmentDate),
    "Last Installment Amount": d.lastInstallmentAmount,
    "Last Installment Status": d.lastInstallmentStatus,
    "Total Installments": d.totalInstallments,
  }));

  return (
    <ReportPage
      title="First & Last Installments"
      description="Overview of first and last repayment installments for each loan"
      actions={<ExportButton data={exportData} filename="installment-bounds-report" />}
      filters={
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Loan Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="in arrears">In Arrears</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <ReportStats>
        <ReportStat label="Total Loans" value={totalLoans} icon={<CalendarRange className="h-5 w-5" />} />
        <ReportStat label="First Installment Paid" value={`${fullyPaidFirst} / ${totalLoans}`} icon={<DollarSign className="h-5 w-5" />} subValue={totalLoans > 0 ? `${((fullyPaidFirst / totalLoans) * 100).toFixed(0)}%` : "0%"} />
        <ReportStat label="Last Installment Paid" value={`${fullyPaidLast} / ${totalLoans}`} icon={<Clock className="h-5 w-5" />} subValue={totalLoans > 0 ? `${((fullyPaidLast / totalLoans) * 100).toFixed(0)}%` : "0%"} />
      </ReportStats>

      <ReportCard title="Loan Installment Bounds">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Due Date</TableHead>
                  <TableHead>First Amount</TableHead>
                  <TableHead>First Status</TableHead>
                  <TableHead>Last Due Date</TableHead>
                  <TableHead>Last Amount</TableHead>
                  <TableHead>Last Status</TableHead>
                  <TableHead className="text-center">Installments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No loans with repayment schedules found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow
                      key={row.loanId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/loans/${row.loanId}`)}
                    >
                      <TableCell className="font-medium">{row.loanNumber}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{formatCurrency(row.loanAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          row.status === "active" ? "bg-green-50 text-green-700 border-green-200" :
                          row.status === "closed" ? "bg-gray-50 text-gray-700 border-gray-200" :
                          row.status === "in arrears" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(row.firstInstallmentDate)}</TableCell>
                      <TableCell>{formatCurrency(row.firstInstallmentAmount)}</TableCell>
                      <TableCell>{getStatusBadge(row.firstInstallmentStatus)}</TableCell>
                      <TableCell>{formatDate(row.lastInstallmentDate)}</TableCell>
                      <TableCell>{formatCurrency(row.lastInstallmentAmount)}</TableCell>
                      <TableCell>{getStatusBadge(row.lastInstallmentStatus)}</TableCell>
                      <TableCell className="text-center">{row.totalInstallments}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportCard>
    </ReportPage>
  );
}
