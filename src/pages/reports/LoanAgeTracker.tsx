import { useState, useEffect, useMemo } from "react";
import { ReportPage } from "./Base";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ui/export-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToCSV } from "@/lib/csv-export";
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LoanWithAge {
  id: string;
  loan_number: string | null;
  client: string;
  amount: number;
  balance: number;
  status: string;
  date: string; // disbursement date
  frequency: string | null;
  term_months: number | null;
  interest_rate: number | null;
  dayAge: number; // days since disbursement
  daysRemaining: number;
  totalDays: number;
  progressPercent: number;
  totalDue: number;
  totalPaid: number;
  collectionRate: number;
}

export default function LoanAgeTracker() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanWithAge[]>([]);
  const [filterDay, setFilterDay] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const organizationId = await getOrganizationId();

      // Fetch 30-day loans (term_months <= 1) that are active or in arrears
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, balance, status, date, frequency, term_months, interest_rate")
        .eq("organization_id", organizationId)
        .lte("term_months", 1)
        .in("status", ["active", "in arrears", "pending"]);

      if (loansError) throw loansError;
      if (!loansData || loansData.length === 0) {
        setLoans([]);
        setLoading(false);
        return;
      }

      // Fetch schedules for these loans in batches
      const loanIds = loansData.map(l => l.id);
      const allSchedules: any[] = [];
      for (let i = 0; i < loanIds.length; i += 50) {
        const batch = loanIds.slice(i, i + 50);
        const { data: schedData } = await supabase
          .from("loan_schedule")
          .select("loan_id, total_due, amount_paid")
          .in("loan_id", batch);
        if (schedData) allSchedules.push(...schedData);
      }

      // Aggregate schedule data per loan
      const schedByLoan = new Map<string, { totalDue: number; totalPaid: number }>();
      allSchedules.forEach(s => {
        const existing = schedByLoan.get(s.loan_id) || { totalDue: 0, totalPaid: 0 };
        existing.totalDue += Number(s.total_due || 0);
        existing.totalPaid += Number(s.amount_paid || 0);
        schedByLoan.set(s.loan_id, existing);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processed: LoanWithAge[] = loansData.map(loan => {
        const disbDate = new Date(loan.date);
        disbDate.setHours(0, 0, 0, 0);
        const dayAge = Math.max(0, Math.round((today.getTime() - disbDate.getTime()) / (1000 * 60 * 60 * 24)));
        const totalDays = Math.round((loan.term_months || 1) * 30);
        const daysRemaining = Math.max(0, totalDays - dayAge);
        const progressPercent = Math.min(100, Math.round((dayAge / totalDays) * 100));

        const sched = schedByLoan.get(loan.id) || { totalDue: 0, totalPaid: 0 };
        const collectionRate = sched.totalDue > 0 ? Math.round((sched.totalPaid / sched.totalDue) * 100) : 0;

        return {
          id: loan.id,
          loan_number: loan.loan_number,
          client: loan.client,
          amount: loan.amount,
          balance: loan.balance,
          status: loan.status,
          date: loan.date,
          frequency: loan.frequency,
          term_months: loan.term_months,
          interest_rate: loan.interest_rate,
          dayAge,
          daysRemaining,
          totalDays,
          progressPercent,
          totalDue: sched.totalDue,
          totalPaid: sched.totalPaid,
          collectionRate,
        };
      });

      // Sort by day age descending (oldest first)
      processed.sort((a, b) => b.dayAge - a.dayAge);
      setLoans(processed);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = useMemo(() => {
    let result = loans;

    // Filter by tab
    if (activeTab === "on-track") {
      result = result.filter(l => l.status === "active" && l.collectionRate >= 50);
    } else if (activeTab === "at-risk") {
      result = result.filter(l => l.dayAge >= 14 && l.collectionRate < 50);
    } else if (activeTab === "overdue") {
      result = result.filter(l => l.dayAge > l.totalDays || l.status === "in arrears");
    }

    // Filter by specific day
    if (filterDay.trim()) {
      const day = parseInt(filterDay);
      if (!isNaN(day)) {
        result = result.filter(l => l.dayAge === day);
      }
    }

    return result;
  }, [loans, activeTab, filterDay]);

  // Summary stats
  const stats = useMemo(() => {
    const total = loans.length;
    const onTrack = loans.filter(l => l.status === "active" && l.collectionRate >= 50).length;
    const atRisk = loans.filter(l => l.dayAge >= 14 && l.collectionRate < 50).length;
    const overdue = loans.filter(l => l.dayAge > l.totalDays || l.status === "in arrears").length;
    const avgAge = total > 0 ? Math.round(loans.reduce((sum, l) => sum + l.dayAge, 0) / total) : 0;
    const totalOutstanding = loans.reduce((sum, l) => sum + l.balance, 0);
    return { total, onTrack, atRisk, overdue, avgAge, totalOutstanding };
  }, [loans]);

  const handleExport = () => {
    const data = filteredLoans.map(l => ({
      "Loan Number": l.loan_number || "-",
      "Client": l.client,
      "Amount": l.amount,
      "Balance": l.balance,
      "Status": l.status,
      "Disbursement Date": l.date,
      "Frequency": l.frequency || "-",
      "Day Age": l.dayAge,
      "Days Remaining": l.daysRemaining,
      "Progress %": l.progressPercent,
      "Total Due": l.totalDue,
      "Total Paid": l.totalPaid,
      "Collection Rate %": l.collectionRate,
    }));
    exportToCSV(data, "loan-age-tracker");
  };

  const getStatusBadge = (loan: LoanWithAge) => {
    if (loan.dayAge > loan.totalDays || loan.status === "in arrears") {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (loan.dayAge >= 14 && loan.collectionRate < 50) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">At Risk</Badge>;
    }
    return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">On Track</Badge>;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

  return (
    <ReportPage
      title="Loan Age Tracker"
      description="Monitor active 30-day loans by their current day number, payment progress, and risk status."
      actions={
        <ExportButton onClick={handleExport} disabled={filteredLoans.length === 0} />
      }
      filters={
        <div className="flex items-end gap-4">
          <div className="w-40">
            <Label htmlFor="filterDay" className="text-xs text-muted-foreground">Filter by Day #</Label>
            <Input
              id="filterDay"
              type="number"
              min={0}
              max={30}
              placeholder="e.g. 14"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total Loans</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> On Track</p>
            <p className="text-2xl font-bold text-emerald-600">{loading ? <Skeleton className="h-8 w-16" /> : stats.onTrack}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> At Risk</p>
            <p className="text-2xl font-bold text-amber-600">{loading ? <Skeleton className="h-8 w-16" /> : stats.atRisk}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Overdue</p>
            <p className="text-2xl font-bold text-destructive">{loading ? <Skeleton className="h-8 w-16" /> : stats.overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Avg Age</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${stats.avgAge}d`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Outstanding</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : formatCurrency(stats.totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({loans.length})</TabsTrigger>
          <TabsTrigger value="on-track">On Track</TabsTrigger>
          <TabsTrigger value="at-risk">At Risk</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {activeTab === "all" ? "All 30-Day Loans" :
                 activeTab === "on-track" ? "On Track Loans (≥50% collected)" :
                 activeTab === "at-risk" ? "At Risk Loans (≥14 days, <50% collected)" :
                 "Overdue Loans (past term or in arrears)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : filteredLoans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No loans found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Day</TableHead>
                        <TableHead className="text-center">Remaining</TableHead>
                        <TableHead className="w-32">Progress</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead className="text-center">Collection</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoans.map(loan => (
                        <TableRow
                          key={loan.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/loans/${loan.id}`)}
                        >
                          <TableCell className="font-medium">{loan.loan_number || "-"}</TableCell>
                          <TableCell>{loan.client}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono">{loan.dayAge}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={loan.daysRemaining <= 3 ? "text-destructive font-semibold" : ""}>
                              {loan.daysRemaining}d
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={loan.progressPercent} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8">{loan.progressPercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.totalPaid)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.totalDue)}</TableCell>
                          <TableCell className="text-center">
                            <span className={
                              loan.collectionRate >= 75 ? "text-emerald-600 font-semibold" :
                              loan.collectionRate >= 50 ? "text-amber-600" : "text-destructive"
                            }>
                              {loan.collectionRate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(loan)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ReportPage>
  );
}
