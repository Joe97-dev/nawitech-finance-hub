import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from "date-fns";

interface CohortData {
  weekLabel: string;
  weekStart: Date;
  loanCount: number;
  totalDisbursed: number;
  totalDue: number;
  totalPaid: number;
  collectionRate: number;
}

const columns = [
  { key: "weekLabel", header: "Disbursal Week" },
  { key: "loanCount", header: "Loans" },
  { key: "totalDisbursed", header: "Disbursed (KES)" },
  { key: "totalDue", header: "Total Due (KES)" },
  { key: "totalPaid", header: "Total Paid (KES)" },
  { key: "collectionRate", header: "Collection Rate (%)" },
];

const CollectionByDisbursalReport = () => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(currentYear, 0, 1),
    to: new Date(),
  });
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("chart");
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  useEffect(() => {
    fetchData();
  }, [date, selectedOfficer]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = date?.from || new Date(currentYear, 0, 1);
      const endDate = date?.to || new Date();

      const formatLocal = (d: Date) => format(d, "yyyy-MM-dd");
      const fromStr = formatLocal(startDate);
      const toStr = formatLocal(endDate);

      // Fetch loans disbursed in the selected period + profiles for officer names
      const [loansResult, profilesResult] = await Promise.all([
        supabase
          .from("loans")
          .select("id, amount, date, loan_officer_id")
          .gte("date", fromStr)
          .lte("date", toStr)
          .in("status", ["active", "closed", "in arrears", "disbursed", "approved"]),
        supabase.from("profiles").select("id, first_name, last_name"),
      ]);

      if (loansResult.error) throw loansResult.error;

      const loans = loansResult.data || [];
      const profiles = profilesResult.data || [];
      const profileMap = new Map(
        profiles.map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])
      );

      // Build officer list
      const officerSet = new Map<string, string>();
      loans.forEach((l) => {
        if (l.loan_officer_id && !officerSet.has(l.loan_officer_id)) {
          officerSet.set(l.loan_officer_id, profileMap.get(l.loan_officer_id) || "Unknown");
        }
      });
      setOfficers(
        Array.from(officerSet.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Filter by officer
      const filteredLoans =
        selectedOfficer === "all"
          ? loans
          : loans.filter((l) => l.loan_officer_id === selectedOfficer);

      if (filteredLoans.length === 0) {
        setCohorts([]);
        setLoading(false);
        return;
      }

      // Fetch all schedules for these loans
      const loanIds = filteredLoans.map((l) => l.id);
      // Batch fetch in chunks of 50
      const allSchedules: { loan_id: string; total_due: number; amount_paid: number }[] = [];
      for (let i = 0; i < loanIds.length; i += 50) {
        const chunk = loanIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from("loan_schedule")
          .select("loan_id, total_due, amount_paid")
          .in("loan_id", chunk);
        if (error) throw error;
        allSchedules.push(...(data || []));
      }

      // Group schedules by loan_id
      const schedulesByLoan = new Map<string, { totalDue: number; totalPaid: number }>();
      for (const s of allSchedules) {
        const existing = schedulesByLoan.get(s.loan_id) || { totalDue: 0, totalPaid: 0 };
        existing.totalDue += Number(s.total_due);
        existing.totalPaid += Number(s.amount_paid || 0);
        schedulesByLoan.set(s.loan_id, existing);
      }

      // Generate weekly cohorts
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });

      const cohortData: CohortData[] = weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekLabel = `${format(weekStart, "dd MMM")} – ${format(weekEnd, "dd MMM yyyy")}`;

        // Find loans disbursed in this week
        const weekLoans = filteredLoans.filter((l) => {
          const loanDate = new Date(l.date);
          return isWithinInterval(loanDate, { start: weekStart, end: weekEnd });
        });

        let totalDisbursed = 0;
        let totalDue = 0;
        let totalPaid = 0;

        for (const loan of weekLoans) {
          totalDisbursed += Number(loan.amount);
          const schedule = schedulesByLoan.get(loan.id);
          if (schedule) {
            totalDue += schedule.totalDue;
            totalPaid += schedule.totalPaid;
          }
        }

        const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 10000) / 100 : 0;

        return {
          weekLabel,
          weekStart,
          loanCount: weekLoans.length,
          totalDisbursed,
          totalDue,
          totalPaid,
          collectionRate,
        };
      });

      // Filter out empty weeks
      setCohorts(cohortData.filter((c) => c.loanCount > 0));
    } catch (error: any) {
      console.error("Error fetching cohort data:", error);
      toast({
        variant: "destructive",
        title: "Data fetch error",
        description: error.message || "Failed to load collection data.",
      });
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  };

  const totalDisbursed = cohorts.reduce((s, c) => s + c.totalDisbursed, 0);
  const totalDue = cohorts.reduce((s, c) => s + c.totalDue, 0);
  const totalPaid = cohorts.reduce((s, c) => s + c.totalPaid, 0);
  const overallRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
  const totalLoans = cohorts.reduce((s, c) => s + c.loanCount, 0);

  const hasActiveFilters = selectedOfficer !== "all" || date !== undefined;

  const handleReset = () => {
    setSelectedOfficer("all");
    setDate({
      from: new Date(currentYear, 0, 1),
      to: new Date(),
    });
  };

  const exportData = cohorts.map((c) => ({
    weekLabel: c.weekLabel,
    loanCount: c.loanCount,
    totalDisbursed: c.totalDisbursed.toLocaleString(),
    totalDue: c.totalDue.toLocaleString(),
    totalPaid: c.totalPaid.toLocaleString(),
    collectionRate: c.collectionRate,
  }));

  const chartData = cohorts.map((c) => ({
    week: format(c.weekStart, "dd MMM"),
    "Total Due": c.totalDue,
    "Total Paid": c.totalPaid,
  }));

  const filters = (
    <ReportFilters
      title="Disbursal Cohort Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker dateRange={date} onDateRangeChange={setDate} className="w-full sm:w-auto" />
      {officers.length > 0 && (
        <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Loan Officer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {officers.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Collection by Disbursal Period"
      description="Collection rate grouped by the week loans were disbursed. Tracks lifetime repayment for each cohort."
      actions={<ExportButton data={exportData} filename="collection-by-disbursal" columns={columns} />}
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Loading cohort data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat label="Total Loans" value={totalLoans.toLocaleString()} />
            <ReportStat label="Total Disbursed" value={`KES ${totalDisbursed.toLocaleString()}`} />
            <ReportStat
              label="Overall Collection Rate"
              value={`${overallRate}%`}
              subValue={
                <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                  <div
                    className={`h-2.5 rounded-full ${
                      overallRate >= 95 ? "bg-green-600" : overallRate >= 80 ? "bg-yellow-400" : "bg-destructive"
                    }`}
                    style={{ width: `${Math.min(overallRate, 100)}%` }}
                  />
                </div>
              }
            />
          </ReportStats>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <Tabs defaultValue="chart" value={activeView} onValueChange={setActiveView} className="mb-4">
                <TabsList>
                  <TabsTrigger value="chart">Chart View</TabsTrigger>
                  <TabsTrigger value="table">Table View</TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="pt-4">
                  {cohorts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No disbursals found for the selected period
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                          <Legend />
                          <Bar dataKey="Total Due" fill="#8884d8" />
                          <Bar dataKey="Total Paid" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="table" className="pt-4">
                  {cohorts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No disbursals found for the selected period
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Disbursal Week</TableHead>
                            <TableHead className="text-right">Loans</TableHead>
                            <TableHead className="text-right">Disbursed</TableHead>
                            <TableHead className="text-right">Total Due</TableHead>
                            <TableHead className="text-right">Total Paid</TableHead>
                            <TableHead className="text-right">Collection Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cohorts.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{c.weekLabel}</TableCell>
                              <TableCell className="text-right">{c.loanCount}</TableCell>
                              <TableCell className="text-right">KES {c.totalDisbursed.toLocaleString()}</TableCell>
                              <TableCell className="text-right">KES {c.totalDue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">KES {c.totalPaid.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{c.collectionRate}%</span>
                                  <div className="w-16 bg-muted rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        c.collectionRate >= 95
                                          ? "bg-green-600"
                                          : c.collectionRate >= 80
                                          ? "bg-yellow-400"
                                          : "bg-destructive"
                                      }`}
                                      style={{ width: `${Math.min(c.collectionRate, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default CollectionByDisbursalReport;
