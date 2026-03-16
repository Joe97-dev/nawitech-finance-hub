import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PARBucket {
  name: string;
  loanCount: number;
  totalBalance: number;
  percentage: number;
  color: string;
}

interface LoanPARDetail {
  loan_number: string;
  client_name: string;
  loan_officer: string;
  balance: number;
  days_overdue: number;
  par_bucket: string;
}

const PAR_COLORS = {
  current: "#22c55e",
  par_1_30: "#eab308",
  par_31_60: "#f97316",
  par_61_90: "#ef4444",
  par_90_plus: "#7f1d1d",
};

function classifyDaysOverdue(days: number): string {
  if (days <= 0) return "Current";
  if (days <= 30) return "PAR 1-30";
  if (days <= 60) return "PAR 31-60";
  if (days <= 90) return "PAR 61-90";
  return "PAR 90+";
}

function getBucketColor(bucket: string): string {
  switch (bucket) {
    case "Current": return PAR_COLORS.current;
    case "PAR 1-30": return PAR_COLORS.par_1_30;
    case "PAR 31-60": return PAR_COLORS.par_31_60;
    case "PAR 61-90": return PAR_COLORS.par_61_90;
    case "PAR 90+": return PAR_COLORS.par_90_plus;
    default: return "#999";
  }
}

const PARReport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<PARBucket[]>([]);
  const [loanDetails, setLoanDetails] = useState<LoanPARDetail[]>([]);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [parRatio, setParRatio] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState("all");
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  const columns = [
    { key: "loan_number", header: "Loan #" },
    { key: "client_name", header: "Client" },
    { key: "loan_officer", header: "Loan Officer" },
    { key: "balance", header: "Outstanding Balance" },
    { key: "days_overdue", header: "Days Overdue" },
    { key: "par_bucket", header: "PAR Bucket" },
  ];

  useEffect(() => {
    fetchPARData();
  }, []);

  const fetchPARData = async () => {
    setLoading(true);
    try {
      // Fetch active/in-arrears loans, their schedules, client names, and profiles in parallel
      const [loansResult, schedulesResult, clientsResult, profilesResult] = await Promise.all([
        supabase
          .from("loans")
          .select("id, loan_number, client, balance, loan_officer_id, status")
          .in("status", ["active", "in arrears", "disbursed"]),
        supabase
          .from("loan_schedule")
          .select("loan_id, due_date, total_due, amount_paid, status"),
        supabase.from("clients").select("id, first_name, last_name"),
        supabase.from("profiles").select("id, first_name, last_name"),
      ]);

      if (loansResult.error) throw loansResult.error;
      if (schedulesResult.error) throw schedulesResult.error;

      const loans = loansResult.data || [];
      const schedules = schedulesResult.data || [];
      const clients = clientsResult.data || [];
      const profiles = profilesResult.data || [];

      // Build lookup maps
      const clientMap = new Map(clients.map(c => [c.id, `${c.first_name} ${c.last_name}`]));
      const profileMap = new Map(profiles.map(p => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()]));

      // Group schedules by loan_id
      const schedulesByLoan = new Map<string, typeof schedules>();
      for (const s of schedules) {
        if (!schedulesByLoan.has(s.loan_id)) schedulesByLoan.set(s.loan_id, []);
        schedulesByLoan.get(s.loan_id)!.push(s);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const details: LoanPARDetail[] = [];
      const bucketMap: Record<string, { count: number; balance: number }> = {
        "Current": { count: 0, balance: 0 },
        "PAR 1-30": { count: 0, balance: 0 },
        "PAR 31-60": { count: 0, balance: 0 },
        "PAR 61-90": { count: 0, balance: 0 },
        "PAR 90+": { count: 0, balance: 0 },
      };

      let portfolioTotal = 0;
      const officerSet = new Map<string, string>();

      for (const loan of loans) {
        const balance = Number(loan.balance);
        if (balance <= 0) continue;

        portfolioTotal += balance;

        // Find the earliest overdue installment for this loan
        const loanSchedules = schedulesByLoan.get(loan.id) || [];
        let earliestOverdueDays = 0;

        for (const s of loanSchedules) {
          const paid = Number(s.amount_paid || 0);
          const due = Number(s.total_due);
          if (paid >= due) continue; // fully paid installment

          const dueDate = new Date(s.due_date);
          dueDate.setHours(0, 0, 0, 0);
          const diffMs = today.getTime() - dueDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays > 0 && (earliestOverdueDays === 0 || diffDays > earliestOverdueDays)) {
            earliestOverdueDays = diffDays;
          }
        }

        const bucket = classifyDaysOverdue(earliestOverdueDays);
        bucketMap[bucket].count += 1;
        bucketMap[bucket].balance += balance;

        // Resolve client name (could be UUID or legacy string)
        const clientName = clientMap.get(loan.client) || loan.client;
        const officerName = loan.loan_officer_id ? (profileMap.get(loan.loan_officer_id) || "Unknown") : "Unassigned";

        if (loan.loan_officer_id && !officerSet.has(loan.loan_officer_id)) {
          officerSet.set(loan.loan_officer_id, officerName);
        }

        details.push({
          loan_number: loan.loan_number || loan.id.slice(0, 8),
          client_name: clientName,
          loan_officer: officerName,
          balance,
          days_overdue: earliestOverdueDays,
          par_bucket: bucket,
        });
      }

      // Sort by days overdue descending (worst first)
      details.sort((a, b) => b.days_overdue - a.days_overdue);

      const processedBuckets: PARBucket[] = Object.entries(bucketMap).map(([name, data]) => ({
        name,
        loanCount: data.count,
        totalBalance: data.balance,
        percentage: portfolioTotal > 0 ? Math.round((data.balance / portfolioTotal) * 10000) / 100 : 0,
        color: getBucketColor(name),
      }));

      const atRisk = portfolioTotal - bucketMap["Current"].balance;
      const ratio = portfolioTotal > 0 ? Math.round((atRisk / portfolioTotal) * 100) : 0;

      setBuckets(processedBuckets);
      setLoanDetails(details);
      setTotalPortfolio(portfolioTotal);
      setTotalAtRisk(atRisk);
      setParRatio(ratio);
      setOfficers(Array.from(officerSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      console.error("Error fetching PAR data:", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch PAR data",
        description: error.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDetails = loanDetails.filter((d) => {
    const matchesBucket = selectedBucket === "all" || d.par_bucket === selectedBucket;
    const matchesOfficer = selectedOfficer === "all" || d.loan_officer === selectedOfficer;
    return matchesBucket && matchesOfficer;
  });

  const pieData = buckets.filter((b) => b.totalBalance > 0).map((b) => ({
    name: b.name,
    value: b.percentage,
    color: b.color,
  }));

  const exportData = filteredDetails.map((d) => ({
    ...d,
    balance: d.balance.toLocaleString(),
  }));

  const hasActiveFilters = selectedBucket !== "all" || selectedOfficer !== "all";

  const handleReset = () => {
    setSelectedBucket("all");
    setSelectedOfficer("all");
  };

  const filters = (
    <ReportFilters
      title="PAR Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <Select value={selectedBucket} onValueChange={setSelectedBucket}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="PAR Bucket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Buckets</SelectItem>
          <SelectItem value="Current">Current</SelectItem>
          <SelectItem value="PAR 1-30">PAR 1-30</SelectItem>
          <SelectItem value="PAR 31-60">PAR 31-60</SelectItem>
          <SelectItem value="PAR 61-90">PAR 61-90</SelectItem>
          <SelectItem value="PAR 90+">PAR 90+</SelectItem>
        </SelectContent>
      </Select>
      {officers.length > 0 && (
        <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Loan Officer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {officers.map((o) => (
              <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Portfolio at Risk (PAR) Report"
      description="Live analysis of loans at different risk levels based on overdue installments."
      actions={
        <ExportButton data={exportData} filename="par-report" columns={columns} />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Calculating PAR from loan schedules...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat
              label="Total Portfolio"
              value={`KES ${totalPortfolio.toLocaleString()}`}
            />
            <ReportStat
              label="Total at Risk"
              value={`KES ${totalAtRisk.toLocaleString()}`}
            />
            <ReportStat
              label="PAR Ratio"
              value={`${parRatio}%`}
              subValue={
                <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                  <div
                    className={`h-2.5 rounded-full ${parRatio > 10 ? "bg-destructive" : "bg-yellow-400"}`}
                    style={{ width: `${Math.min(parRatio, 100)}%` }}
                  />
                </div>
              }
            />
          </ReportStats>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Pie Chart */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Portfolio Distribution</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Bucket Summary */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Bucket Summary</h3>
                <div className="space-y-3">
                  {buckets.map((b) => (
                    <div key={b.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                        <span className="text-sm font-medium">{b.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">KES {b.totalBalance.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-2">({b.loanCount} loans · {b.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Loan Details Table */}
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Loan Details ({filteredDetails.length} loans)
              </h3>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Loan Officer</TableHead>
                      <TableHead className="text-right">Outstanding Balance</TableHead>
                      <TableHead className="text-right">Days Overdue</TableHead>
                      <TableHead>PAR Bucket</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No loans found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDetails.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.loan_number}</TableCell>
                          <TableCell>{d.client_name}</TableCell>
                          <TableCell>{d.loan_officer}</TableCell>
                          <TableCell className="text-right">KES {d.balance.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{d.days_overdue}</TableCell>
                          <TableCell>
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: `${getBucketColor(d.par_bucket)}20`,
                                color: getBucketColor(d.par_bucket),
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getBucketColor(d.par_bucket) }} />
                              {d.par_bucket}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default PARReport;
