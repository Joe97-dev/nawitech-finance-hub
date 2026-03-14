
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { ReportPage } from "./Base";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButton } from "@/components/ui/export-button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useNavigate } from "react-router-dom";
import { CalendarRange, DollarSign, Clock, PlayCircle, CheckCircle2 } from "lucide-react";

interface LoanInstallmentData {
  loanId: string;
  loanNumber: string;
  clientName: string;
  loanAmount: number;
  balance: number;
  loanStatus: string;
  installmentDate: string;
  installmentAmount: number;
  installmentStatus: string;
  amountPaid: number;
  outstanding: number;
  totalInstallments: number;
  installmentNumber: number;
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
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
  }
};

const getLoanStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-gray-50 text-gray-700 border-gray-200",
    "in arrears": "bg-red-50 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={styles[status] || "bg-yellow-50 text-yellow-700 border-yellow-200"}>{status}</Badge>;
};

export default function InstallmentBoundsReport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [firstInstallments, setFirstInstallments] = useState<LoanInstallmentData[]>([]);
  const [lastInstallments, setLastInstallments] = useState<LoanInstallmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [activeTab, setActiveTab] = useState("first");

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      const fromDate = dateRange?.from ? dateRange.from.toISOString().split("T")[0] : undefined;
      const toDate = dateRange?.to ? dateRange.to.toISOString().split("T")[0] : undefined;

      // Fetch all loans (not rejected)
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, balance, status")
        .eq("organization_id", orgId)
        .not("status", "eq", "rejected");

      if (loansError) throw loansError;
      if (!loans || loans.length === 0) {
        setFirstInstallments([]);
        setLastInstallments([]);
        return;
      }

      const loanIds = loans.map(l => l.id);

      // Fetch all schedules
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
      const scheduleMap = new Map<string, any[]>();
      (schedules || []).forEach(s => {
        if (!scheduleMap.has(s.loan_id)) scheduleMap.set(s.loan_id, []);
        scheduleMap.get(s.loan_id)!.push(s);
      });

      const firstList: LoanInstallmentData[] = [];
      const lastList: LoanInstallmentData[] = [];

      loans.forEach(loan => {
        const items = scheduleMap.get(loan.id);
        if (!items || items.length === 0) return;

        const first = items[0];
        const last = items[items.length - 1];

        const matchesRange = (date: string) => {
          if (!fromDate && !toDate) return true;
          if (fromDate && date < fromDate) return false;
          if (toDate && date > toDate) return false;
          return true;
        };

        const buildRow = (item: any, idx: number): LoanInstallmentData => ({
          loanId: loan.id,
          loanNumber: loan.loan_number || "N/A",
          clientName: clientMap.get(loan.client) || "Unknown",
          loanAmount: loan.amount,
          balance: loan.balance,
          loanStatus: loan.status,
          installmentDate: item.due_date,
          installmentAmount: item.total_due,
          installmentStatus: item.status,
          amountPaid: item.amount_paid || 0,
          outstanding: item.total_due - (item.amount_paid || 0),
          totalInstallments: items.length,
          installmentNumber: idx + 1,
        });

        if (matchesRange(first.due_date)) {
          firstList.push(buildRow(first, 0));
        }
        if (matchesRange(last.due_date)) {
          lastList.push(buildRow(last, items.length - 1));
        }
      });

      setFirstInstallments(firstList);
      setLastInstallments(lastList);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const currentData = activeTab === "first" ? firstInstallments : lastInstallments;

  const totalFirstAmount = firstInstallments.reduce((s, d) => s + d.installmentAmount, 0);
  const totalLastAmount = lastInstallments.reduce((s, d) => s + d.installmentAmount, 0);
  const firstPaid = firstInstallments.filter(d => d.installmentStatus === "paid").length;
  const lastPaid = lastInstallments.filter(d => d.installmentStatus === "paid").length;

  const exportData = currentData.map(d => ({
    "Loan #": d.loanNumber,
    Client: d.clientName,
    "Loan Amount": d.loanAmount,
    Balance: d.balance,
    "Loan Status": d.loanStatus,
    "Due Date": formatDate(d.installmentDate),
    "Installment Amount": d.installmentAmount,
    "Amount Paid": d.amountPaid,
    Outstanding: d.outstanding,
    "Installment Status": d.installmentStatus,
    "Total Installments": d.totalInstallments,
  }));

  const renderTable = (rows: LoanInstallmentData[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loan #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Loan Amount</TableHead>
            <TableHead>Loan Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Installment</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No loans found for the selected date range
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.loanId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/loans/${row.loanId}`)}
              >
                <TableCell className="font-medium">{row.loanNumber}</TableCell>
                <TableCell>{row.clientName}</TableCell>
                <TableCell>{formatCurrency(row.loanAmount)}</TableCell>
                <TableCell>{getLoanStatusBadge(row.loanStatus)}</TableCell>
                <TableCell>{formatDate(row.installmentDate)}</TableCell>
                <TableCell>{formatCurrency(row.installmentAmount)}</TableCell>
                <TableCell>{formatCurrency(row.amountPaid)}</TableCell>
                <TableCell className={row.outstanding > 0 ? "text-red-600 font-medium" : ""}>
                  {formatCurrency(row.outstanding)}
                </TableCell>
                <TableCell>{getStatusBadge(row.installmentStatus)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <ReportPage
      title="First & Last Installments"
      description="Identify loans on their first or last repayment installment"
      actions={<ExportButton data={exportData} filename={`${activeTab}-installments-report`} />}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      }
    >
      <ReportStats className="grid-cols-1 md:grid-cols-4">
        <ReportStat label="First Installments" value={firstInstallments.length} icon={<PlayCircle className="h-5 w-5" />} subValue={`${firstPaid} paid`} />
        <ReportStat label="First Installment Total" value={formatCurrency(totalFirstAmount)} icon={<DollarSign className="h-5 w-5" />} />
        <ReportStat label="Last Installments" value={lastInstallments.length} icon={<CheckCircle2 className="h-5 w-5" />} subValue={`${lastPaid} paid`} />
        <ReportStat label="Last Installment Total" value={formatCurrency(totalLastAmount)} icon={<Clock className="h-5 w-5" />} />
      </ReportStats>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="first" className="gap-1">
            <PlayCircle className="h-4 w-4" /> First Installments ({firstInstallments.length})
          </TabsTrigger>
          <TabsTrigger value="last" className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Last Installments ({lastInstallments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="first">
          <ReportCard title="Loans on First Installment" description="Loans whose first repayment installment falls within the selected date range">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : renderTable(firstInstallments)}
          </ReportCard>
        </TabsContent>

        <TabsContent value="last">
          <ReportCard title="Loans on Last Installment" description="Loans whose final repayment installment falls within the selected date range">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : renderTable(lastInstallments)}
          </ReportCard>
        </TabsContent>
      </Tabs>
    </ReportPage>
  );
}
