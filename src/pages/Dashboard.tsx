
import { CreditCard, DollarSign, Users, BarChartHorizontal } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { LoanOfficerPerformance } from "@/components/dashboard/LoanOfficerPerformance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { format, subMonths, eachMonthOfInterval } from "date-fns";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeLoans: 0,
    disbursedToday: 0,
    collectionRate: 0,
    newLoansToday: 0
  });
  const [loanData, setLoanData] = useState<any[]>([]);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [arrearsData, setArrearsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    return `Ksh ${amount.toLocaleString()}`;
  };

  /** Paginated fetch helper */
  const fetchAllPages = async (
    table: string,
    selectCols: string,
    buildQuery: (q: any) => any
  ) => {
    const pageSize = 1000;
    const all: any[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from(table).select(selectCols).range(from, from + pageSize - 1);
      q = buildQuery(q);
      const { data, error } = await q;
      if (error) throw error;
      if (data) all.push(...data);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      const today = new Date();
      const sixMonthsAgo = subMonths(today, 6);
      const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-01');
      const todayStr = format(today, 'yyyy-MM-dd');

      // 1. Basic counts + today's disbursals (parallel)
      const [clientResult, activeLoansResult, todayLoansResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('loans').select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId).eq('status', 'active').neq('type', 'client_fee_account'),
        supabase.from('loans').select('amount')
          .eq('organization_id', orgId).eq('date', todayStr)
          .neq('type', 'client_fee_account')
          .in('status', ['active', 'in arrears', 'closed', 'disbursed']),
      ]);

      const clientCount = clientResult.count || 0;
      const activeLoanCount = activeLoansResult.count || 0;
      const todayLoans = todayLoansResult.data || [];
      const disbursedToday = todayLoans.reduce((sum, loan) => sum + Number(loan.amount), 0);

      // 2. Fetch 6-month loan disbursals and collection schedule data (parallel, paginated)
      const [allLoans, allSchedules, activeLoansData] = await Promise.all([
        // Loans for chart (6 months)
        fetchAllPages('loans', 'amount, date', (q: any) =>
          q.eq('organization_id', orgId)
            .neq('type', 'client_fee_account')
            .in('status', ['active', 'in arrears', 'closed', 'disbursed', 'approved'])
            .gte('date', sixMonthsAgoStr).lte('date', todayStr)
        ),
        // Schedules for collection rate + chart (6 months)
        fetchAllPages('loan_schedule', 'total_due, due_date, amount_paid', (q: any) =>
          q.eq('organization_id', orgId)
            .gte('due_date', sixMonthsAgoStr).lte('due_date', todayStr)
        ),
        // All active/in-arrears loans for PAR calculation
        fetchAllPages('loans', 'id, balance, status', (q: any) =>
          q.eq('organization_id', orgId)
            .neq('type', 'client_fee_account')
            .in('status', ['active', 'in arrears'])
        ),
      ]);

      // 3. Build monthly chart data using disbursals from loans, collections from schedule
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: today });
      const monthlyData = months.map((month) => {
        const monthStr = format(month, 'yyyy-MM');

        const disbursed = allLoans
          .filter(l => l.date?.startsWith(monthStr))
          .reduce((sum: number, l: any) => sum + Number(l.amount), 0);

        const collected = allSchedules
          .filter(s => s.due_date?.startsWith(monthStr))
          .reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);

        return {
          month: format(month, 'MMM'),
          disbursed: Math.round(disbursed / 1000),
          collected: Math.round(collected / 1000)
        };
      });

      // 4. Collection rate from loan_schedule (total paid / total due)
      const totalScheduleDue = allSchedules.reduce((sum: number, s: any) => sum + Number(s.total_due), 0);
      const totalSchedulePaid = allSchedules.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);
      const collectionRate = totalScheduleDue > 0 ? Math.round((totalSchedulePaid / totalScheduleDue) * 100) : 0;

      // 5. Real PAR calculation from active/in-arrears loans
      // Fetch overdue schedules for these loans
      const activeLoanIds = activeLoansData.map((l: any) => l.id);
      const balanceMap = new Map(activeLoansData.map((l: any) => [l.id, Number(l.balance)]));

      let allOverdueSchedules: any[] = [];
      if (activeLoanIds.length > 0) {
        for (let i = 0; i < activeLoanIds.length; i += 50) {
          const batch = activeLoanIds.slice(i, i + 50);
          const { data } = await supabase
            .from('loan_schedule')
            .select('loan_id, due_date, total_due, amount_paid')
            .in('loan_id', batch)
            .lt('due_date', todayStr)
            .lt('amount_paid', supabase.rpc as any); // We need unpaid ones

          // Simpler approach: fetch all schedules for active loans that are past due
          const { data: overdueData } = await supabase
            .from('loan_schedule')
            .select('loan_id, due_date')
            .in('loan_id', batch)
            .lt('due_date', todayStr)
            .eq('status', 'pending');

          if (overdueData) allOverdueSchedules.push(...overdueData);
        }
      }

      // Find earliest overdue date per loan
      const earliestOverdue = new Map<string, string>();
      allOverdueSchedules.forEach((s: any) => {
        const existing = earliestOverdue.get(s.loan_id);
        if (!existing || s.due_date < existing) {
          earliestOverdue.set(s.loan_id, s.due_date);
        }
      });

      // Classify into PAR buckets based on days overdue
      const todayMs = new Date(todayStr).getTime();
      let onTimeBalance = 0;
      let par1_30Balance = 0;
      let par31_60Balance = 0;
      let par61_90Balance = 0;
      let par90PlusBalance = 0;
      let onTimeCount = 0;
      let par1_30Count = 0;
      let par31_60Count = 0;
      let par61_90Count = 0;
      let par90PlusCount = 0;

      activeLoanIds.forEach((loanId: string) => {
        const balance = balanceMap.get(loanId) || 0;
        const overdueDate = earliestOverdue.get(loanId);

        if (!overdueDate) {
          onTimeBalance += balance;
          onTimeCount++;
          return;
        }

        const daysOverdue = Math.floor((todayMs - new Date(overdueDate).getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 30) {
          par1_30Balance += balance;
          par1_30Count++;
        } else if (daysOverdue <= 60) {
          par31_60Balance += balance;
          par31_60Count++;
        } else if (daysOverdue <= 90) {
          par61_90Balance += balance;
          par61_90Count++;
        } else {
          par90PlusBalance += balance;
          par90PlusCount++;
        }
      });

      const portfolioStats = [
        { name: "On Time", value: onTimeCount, balance: onTimeBalance, color: "#22c55e" },
        { name: "1-30 Days", value: par1_30Count, balance: par1_30Balance, color: "#eab308" },
        { name: "31-60 Days", value: par31_60Count, balance: par31_60Balance, color: "#f97316" },
        { name: "61-90 Days", value: par61_90Count, balance: par61_90Balance, color: "#ef4444" },
        { name: "90+ Days", value: par90PlusCount, balance: par90PlusBalance, color: "#7c2d12" },
      ];

      const arrearsStats = [
        { category: "1-30 Days", value: par1_30Count, balance: par1_30Balance },
        { category: "31-60 Days", value: par31_60Count, balance: par31_60Balance },
        { category: "61-90 Days", value: par61_90Count, balance: par61_90Balance },
        { category: "90+ Days", value: par90PlusCount, balance: par90PlusBalance },
      ];

      setStats({
        totalClients: clientCount,
        activeLoans: activeLoanCount,
        disbursedToday,
        collectionRate,
        newLoansToday: todayLoans.length
      });

      setLoanData(monthlyData);
      setPortfolioData(portfolioStats);
      setArrearsData(arrearsStats);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your microfinance operation.</p>
          </div>
          <DashboardSearch />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Clients"
            value={stats.totalClients.toLocaleString()}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Active Loans"
            value={stats.activeLoans.toLocaleString()}
            icon={<CreditCard className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Disbursed Today"
            value={formatCurrency(stats.disbursedToday)}
            description={`${stats.newLoansToday} new loans`}
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Collection Rate"
            value={`${stats.collectionRate}%`}
            icon={<BarChartHorizontal className="h-4 w-4 text-primary" />}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Loan Disbursals vs Collections</CardTitle>
              <CardDescription>Monthly performance comparison (in thousands)</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={loanData}
                    margin={{
                      top: 10,
                      right: 30,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`Ksh ${value}K`, '']} />
                    <Legend />
                    <Area type="monotone" dataKey="disbursed" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" name="Disbursed" />
                    <Area type="monotone" dataKey="collected" stackId="2" stroke="#22c55e" fill="#22c55e" name="Collected" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Quality</CardTitle>
              <CardDescription>Loan distribution by PAR status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {portfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Loans in Arrears by Category</CardTitle>
            <CardDescription>Number of loans by days past due</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={arrearsData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Number of loans" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <LoanOfficerPerformance />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
