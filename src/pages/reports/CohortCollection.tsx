import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ExportButton } from "@/components/ui/export-button";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface LoanOfficer {
  id: string;
  name: string;
}

interface CohortData {
  period: string;
  loansCount: number;
  totalDisbursed: number;
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
  fullyPaidCount: number;
  fullyPaidRate: number;
}

const columns = [
  { key: "period", header: "Disbursement Period" },
  { key: "loansCount", header: "Loans" },
  { key: "totalDisbursed", header: "Disbursed (KES)" },
  { key: "totalExpected", header: "Expected (KES)" },
  { key: "totalCollected", header: "Collected (KES)" },
  { key: "collectionRate", header: "Collection Rate (%)" },
  { key: "fullyPaidCount", header: "Fully Paid" },
  { key: "fullyPaidRate", header: "Fully Paid Rate (%)" },
];

const formatLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const CohortCollectionReport = () => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(currentYear, 0, 1),
    to: new Date(currentYear, 11, 31),
  });
  const [activeView, setActiveView] = useState("chart");
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  useEffect(() => {
    fetchLoanOfficers();
  }, []);

  useEffect(() => {
    fetchCohortData();
  }, [date, selectedOfficer]);

  const fetchLoanOfficers = async () => {
    try {
      const orgId = await getOrganizationId();
      // Get loan officers from user_roles + profiles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("organization_id", orgId)
        .in("role", ["loan_officer", "admin"]);

      if (!roles || roles.length === 0) return;

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      if (profiles) {
        setLoanOfficers(
          profiles.map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching loan officers:", error);
    }
  };

  const fetchCohortData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      const startDate = date?.from || new Date(currentYear, 0, 1);
      const endDate = date?.to || new Date(currentYear, 11, 31);

      // Fetch loans disbursed in the period
      let query = supabase
        .from("loans")
        .select("id, amount, date, status, balance, loan_officer_id")
        .eq("organization_id", orgId)
        .in("status", ["active", "closed", "in arrears", "disbursed", "approved"])
        .neq("type", "client_fee_account")
        .gte("date", formatLocal(startDate))
        .lte("date", formatLocal(endDate));

      if (selectedOfficer !== "all") {
        query = query.eq("loan_officer_id", selectedOfficer);
      }

      const { data: loans, error: loansError } = await query;

      if (loansError) throw loansError;

      if (!loans || loans.length === 0) {
        setCohortData([]);
        return;
      }

      // Fetch schedules for these loans in batches
      const loanIds = loans.map((l) => l.id);
      const batchSize = 50;
      const allSchedules: { loan_id: string; total_due: number; amount_paid: number }[] = [];

      for (let i = 0; i < loanIds.length; i += batchSize) {
        const batch = loanIds.slice(i, i + batchSize);
        const { data: schedules, error: schedError } = await supabase
          .from("loan_schedule")
          .select("loan_id, total_due, amount_paid")
          .eq("organization_id", orgId)
          .in("loan_id", batch);

        if (schedError) throw schedError;
        if (schedules) allSchedules.push(...schedules);
      }

      // Build schedule lookup by loan_id
      const scheduleLookup: Record<string, { totalExpected: number; totalCollected: number }> = {};
      allSchedules.forEach((s) => {
        if (!scheduleLookup[s.loan_id]) {
          scheduleLookup[s.loan_id] = { totalExpected: 0, totalCollected: 0 };
        }
        scheduleLookup[s.loan_id].totalExpected += Number(s.total_due);
        scheduleLookup[s.loan_id].totalCollected += Number(s.amount_paid || 0);
      });

      // Group loans by disbursement month
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const cohorts: Record<string, { loans: typeof loans; schedules: typeof scheduleLookup }> = {};

      loans.forEach((loan) => {
        const d = new Date(loan.date);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        if (!cohorts[key]) cohorts[key] = { loans: [], schedules: scheduleLookup };
        cohorts[key].loans.push(loan);
      });

      // Build cohort data sorted by date
      const sortedKeys = Object.keys(cohorts).sort((a, b) => {
        const parseKey = (k: string) => {
          const [mon, yr] = k.split(" ");
          return new Date(Number(yr), months.indexOf(mon));
        };
        return parseKey(a).getTime() - parseKey(b).getTime();
      });

      const result: CohortData[] = sortedKeys.map((period) => {
        const cohortLoans = cohorts[period].loans;
        const loansCount = cohortLoans.length;
        const totalDisbursed = cohortLoans.reduce((sum, l) => sum + Number(l.amount), 0);

        let totalExpected = 0;
        let totalCollected = 0;
        let fullyPaidCount = 0;

        cohortLoans.forEach((loan) => {
          const sched = scheduleLookup[loan.id];
          if (sched) {
            totalExpected += sched.totalExpected;
            totalCollected += sched.totalCollected;
            if (sched.totalExpected > 0 && sched.totalCollected >= sched.totalExpected) {
              fullyPaidCount++;
            }
          }
          // Also count closed loans as fully paid
          if (loan.status === "closed" && !scheduleLookup[loan.id]) {
            fullyPaidCount++;
          }
        });

        const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
        const fullyPaidRate = loansCount > 0 ? Math.round((fullyPaidCount / loansCount) * 100) : 0;

        return {
          period,
          loansCount,
          totalDisbursed,
          totalExpected,
          totalCollected,
          collectionRate,
          fullyPaidCount,
          fullyPaidRate,
        };
      });

      setCohortData(result);
    } catch (error: any) {
      console.error("Error fetching cohort data:", error);
      toast({
        variant: "destructive",
        title: "Data fetch error",
        description: "Failed to load cohort collection data.",
      });
      setCohortData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalDisbursed = cohortData.reduce((acc, c) => acc + c.totalDisbursed, 0);
  const totalExpected = cohortData.reduce((acc, c) => acc + c.totalExpected, 0);
  const totalCollected = cohortData.reduce((acc, c) => acc + c.totalCollected, 0);
  const overallRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const totalLoans = cohortData.reduce((acc, c) => acc + c.loansCount, 0);
  const totalFullyPaid = cohortData.reduce((acc, c) => acc + c.fullyPaidCount, 0);

  const hasActiveFilters = date !== undefined || selectedOfficer !== "all";

  const handleReset = () => {
    setDate({
      from: new Date(currentYear, 0, 1),
      to: new Date(currentYear, 11, 31),
    });
    setSelectedOfficer("all");
  };

  const getRateColor = (rate: number) => {
    if (rate >= 95) return "bg-green-600";
    if (rate >= 75) return "bg-yellow-500";
    if (rate >= 50) return "bg-orange-500";
    return "bg-red-600";
  };

  const getBarColor = (rate: number) => {
    if (rate >= 95) return "#16a34a";
    if (rate >= 75) return "#eab308";
    if (rate >= 50) return "#f97316";
    return "#dc2626";
  };

  const filters = (
    <ReportFilters
      title="Cohort Collection Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <DateRangePicker
          dateRange={date}
          onDateRangeChange={setDate}
          className="col-span-2"
        />
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
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Cohort Collection Report"
      description="Collection performance for loans grouped by disbursement period. Track whether loans disbursed in a specific month have been fully collected."
      actions={
        <ExportButton
          data={cohortData.map((item) => ({
            period: item.period,
            loansCount: item.loansCount,
            totalDisbursed: item.totalDisbursed,
            totalExpected: item.totalExpected,
            totalCollected: item.totalCollected,
            collectionRate: item.collectionRate,
            fullyPaidCount: item.fullyPaidCount,
            fullyPaidRate: item.fullyPaidRate,
          }))}
          filename="cohort-collection-report"
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
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Disbursed</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalDisbursed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalLoans} loans</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Expected</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalExpected.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Collected</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalCollected.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Overall Collection Rate</h3>
                <p className="mt-2 text-2xl font-semibold">{overallRate}%</p>
                <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                  <div
                    className={`h-2.5 rounded-full ${getRateColor(overallRate)}`}
                    style={{ width: `${Math.min(overallRate, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalFullyPaid} of {totalLoans} fully paid
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart / Table */}
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <Tabs defaultValue="chart" value={activeView} onValueChange={setActiveView} className="mb-4">
                <TabsList>
                  <TabsTrigger value="chart">Chart View</TabsTrigger>
                  <TabsTrigger value="table">Table View</TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="pt-4">
                  {cohortData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No loans found for the selected disbursement period
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cohortData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "Collection Rate" || name === "Fully Paid Rate") return `${value}%`;
                              return `KES ${value.toLocaleString()}`;
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="totalDisbursed" name="Disbursed" fill="hsl(var(--primary))" opacity={0.3} />
                          <Bar yAxisId="left" dataKey="totalCollected" name="Collected" fill="#22c55e" />
                          <Bar yAxisId="right" dataKey="collectionRate" name="Collection Rate">
                            {cohortData.map((entry, index) => (
                              <Cell key={index} fill={getBarColor(entry.collectionRate)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="table" className="pt-4">
                  {cohortData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No loans found for the selected disbursement period
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Loans</TableHead>
                          <TableHead className="text-right">Disbursed (KES)</TableHead>
                          <TableHead className="text-right">Expected (KES)</TableHead>
                          <TableHead className="text-right">Collected (KES)</TableHead>
                          <TableHead className="text-right">Collection Rate</TableHead>
                          <TableHead className="text-right">Fully Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohortData.map((item) => (
                          <TableRow key={item.period}>
                            <TableCell className="font-medium">{item.period}</TableCell>
                            <TableCell className="text-right">{item.loansCount}</TableCell>
                            <TableCell className="text-right">{item.totalDisbursed.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{item.totalExpected.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{item.totalCollected.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span>{item.collectionRate}%</span>
                                <div className="w-16 bg-muted rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${getRateColor(item.collectionRate)}`}
                                    style={{ width: `${Math.min(item.collectionRate, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.fullyPaidRate >= 90 ? "default" : "secondary"}>
                                {item.fullyPaidCount}/{item.loansCount} ({item.fullyPaidRate}%)
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals row */}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{totalLoans}</TableCell>
                          <TableCell className="text-right">{totalDisbursed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{totalExpected.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{totalCollected.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{overallRate}%</TableCell>
                          <TableCell className="text-right">
                            {totalFullyPaid}/{totalLoans}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
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

export default CohortCollectionReport;
