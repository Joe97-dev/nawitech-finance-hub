import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/ui/export-button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface DayBucket {
  label: string;
  dayNumber: number;
  items: DueItem[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
}

interface DueItem {
  id: string;
  loanNumber: string;
  clientName: string;
  loanAmount: number;
  installmentDue: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string;
  dayNumber: number;
  status: string;
}

const DEFAULT_DAY_BUCKETS = [1, 4, 7, 14, 21, 30];

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

const columns = [
  { key: "clientName", header: "Client Name" },
  { key: "loanNumber", header: "Loan Number" },
  { key: "dayNumber", header: "Day" },
  { key: "installmentDue", header: "Installment Due" },
  { key: "amountPaid", header: "Amount Paid" },
  { key: "outstanding", header: "Outstanding" },
  { key: "dueDate", header: "Due Date" },
  { key: "status", header: "Status" },
];

const DuesByDayReport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<DueItem[]>([]);
  const [buckets, setBuckets] = useState<DayBucket[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [dayBuckets, setDayBuckets] = useState<number[]>(() => {
    const saved = localStorage.getItem("duesByDay_customDays");
    return saved ? JSON.parse(saved) : DEFAULT_DAY_BUCKETS;
  });
  const [newDay, setNewDay] = useState("");

  useEffect(() => {
    fetchData();
  }, [dayBuckets]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all active/in-arrears 30-day loans (term_months = 1 which is ~30 days)
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, date, term_months, status")
        .in("status", ["active", "in arrears", "pending"])
        .lte("term_months", 1);

      if (loansError) throw loansError;
      if (!loans || loans.length === 0) {
        setAllItems([]);
        setBuckets([]);
        setLoading(false);
        return;
      }

      const loanIds = loans.map(l => l.id);
      const loanMap = new Map(loans.map(l => [l.id, l]));

      // Fetch schedules in batches of 50
      let allSchedules: any[] = [];
      for (let i = 0; i < loanIds.length; i += 50) {
        const batch = loanIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from("loan_schedule")
          .select("id, loan_id, due_date, total_due, amount_paid, status")
          .in("loan_id", batch)
          .order("due_date", { ascending: true });
        if (error) throw error;
        if (data) allSchedules = allSchedules.concat(data);
      }

      // Calculate day number for each installment (days from loan disbursement)
      const items: DueItem[] = allSchedules.map(s => {
        const loan = loanMap.get(s.loan_id);
        if (!loan) return null;

        const disbursementDate = new Date(loan.date);
        const dueDate = new Date(s.due_date);
        const dayNumber = Math.round((dueDate.getTime() - disbursementDate.getTime()) / (1000 * 60 * 60 * 24));
        const outstanding = s.total_due - (s.amount_paid || 0);

        return {
          id: s.id,
          loanNumber: loan.loan_number || "N/A",
          clientName: loan.client,
          loanAmount: loan.amount,
          installmentDue: s.total_due,
          amountPaid: s.amount_paid || 0,
          outstanding,
          dueDate: s.due_date,
          dayNumber,
          status: outstanding <= 0 ? "paid" : s.status,
        } as DueItem;
      }).filter(Boolean) as DueItem[];

      setAllItems(items);

      // Build buckets
      const builtBuckets: DayBucket[] = dayBuckets.map(day => {
        const bucketItems = items.filter(item => item.dayNumber === day);
        return {
          label: `Day ${day}`,
          dayNumber: day,
          items: bucketItems,
          totalDue: bucketItems.reduce((s, i) => s + i.installmentDue, 0),
          totalPaid: bucketItems.reduce((s, i) => s + i.amountPaid, 0),
          totalOutstanding: bucketItems.reduce((s, i) => s + i.outstanding, 0),
        };
      });

      setBuckets(builtBuckets);
    } catch (error: any) {
      console.error("Error fetching dues by day:", error);
      toast({ variant: "destructive", description: "Failed to load report data." });
    } finally {
      setLoading(false);
    }
  };

  const displayItems = activeTab === "all"
    ? allItems
    : allItems.filter(i => i.dayNumber === parseInt(activeTab));

  const totalDue = displayItems.reduce((s, i) => s + i.installmentDue, 0);
  const totalPaid = displayItems.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = displayItems.reduce((s, i) => s + i.outstanding, 0);
  const collectionRate = totalDue > 0 ? ((totalPaid / totalDue) * 100).toFixed(1) : "0";

  const exportData = displayItems.map(item => ({
    clientName: item.clientName,
    loanNumber: item.loanNumber,
    dayNumber: item.dayNumber,
    installmentDue: item.installmentDue,
    amountPaid: item.amountPaid,
    outstanding: item.outstanding,
    dueDate: formatDate(item.dueDate),
    status: item.status,
  }));

  return (
    <ReportPage
      title="30-Day Loan Dues by Day"
      description="View amounts due for 30-day loans at specific day intervals"
      actions={
        <ExportButton
          data={exportData}
          filename={`dues-by-day-${new Date().toISOString().slice(0, 10)}`}
          columns={columns}
        />
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat label="Total Due" value={formatCurrency(totalDue)} subValue={`${displayItems.length} installments`} />
            <ReportStat label="Total Collected" value={formatCurrency(totalPaid)} subValue={`${collectionRate}% rate`} />
            <ReportStat label="Outstanding" value={formatCurrency(totalOutstanding)} subValue="Remaining balance" />
            <ReportStat label="Active Loans" value={String(new Set(allItems.map(i => i.loanNumber)).size)} subValue="30-day loans" />
          </ReportStats>

          {/* Summary cards for each day bucket */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {buckets.map(bucket => (
              <button
                key={bucket.dayNumber}
                onClick={() => setActiveTab(String(bucket.dayNumber))}
                className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                  activeTab === String(bucket.dayNumber) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="text-xs font-medium text-muted-foreground">{bucket.label}</div>
                <div className="text-sm font-bold mt-1">{formatCurrency(bucket.totalDue)}</div>
                <div className="text-xs text-muted-foreground">{bucket.items.length} loans</div>
                {bucket.totalOutstanding > 0 && (
                  <div className="text-xs text-destructive mt-0.5">
                    {formatCurrency(bucket.totalOutstanding)} due
                  </div>
                )}
              </button>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Days</TabsTrigger>
              {DAY_BUCKETS.map(day => (
                <TabsTrigger key={day} value={String(day)}>Day {day}</TabsTrigger>
              ))}
            </TabsList>

            <ReportCard title={activeTab === "all" ? "All Installments" : `Day ${activeTab} Installments`}>
              {displayItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No installments found for this selection
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Loan #</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Due Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.clientName}</TableCell>
                          <TableCell className="font-mono text-sm">{item.loanNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Day {item.dayNumber}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.installmentDue)}</TableCell>
                          <TableCell>{formatCurrency(item.amountPaid)}</TableCell>
                          <TableCell className={item.outstanding > 0 ? "text-destructive font-medium" : ""}>
                            {formatCurrency(item.outstanding)}
                          </TableCell>
                          <TableCell>{formatDate(item.dueDate)}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ReportCard>
          </Tabs>
        </div>
      )}
    </ReportPage>
  );
};

export default DuesByDayReport;
