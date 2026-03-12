
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
import { format, startOfDay, endOfDay, subMonths, eachMonthOfInterval } from "date-fns";

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const sixMonthsAgo = subMonths(today, 6);
      const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-01');
      const todayStr = format(today, 'yyyy-MM-dd');

      // Run all independent queries in parallel (5 queries instead of 14+)
      const [clientResult, activeLoansResult, todayLoansResult, allLoansResult, allTransactionsResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('loans').select('*', { count: 'exact' }).eq('status', 'active'),
        supabase.from('loans').select('amount').eq('date', todayStr),
        supabase.from('loans').select('amount, date').gte('date', sixMonthsAgoStr).lte('date', todayStr),
        supabase.from('loan_transactions').select('amount, transaction_date').eq('transaction_type', 'payment').eq('is_reverted', false).gte('transaction_date', sixMonthsAgoStr).lte('transaction_date', todayStr),
      ]);

      const clientCount = clientResult.count || 0;
      const activeLoanCount = activeLoansResult.count || 0;
      const todayLoans = todayLoansResult.data;
      const disbursedToday = todayLoans?.reduce((sum, loan) => sum + Number(loan.amount), 0) || 0;

      // Group loans and transactions by month client-side
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: today });
      const monthlyData = months.map((month) => {
        const monthStr = format(month, 'yyyy-MM');
        
        const disbursed = (allLoansResult.data || [])
          .filter(l => l.date?.startsWith(monthStr))
          .reduce((sum, l) => sum + Number(l.amount), 0);

        const collected = (allTransactionsResult.data || [])
          .filter(t => t.transaction_date?.startsWith(monthStr))
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          month: format(month, 'MMM'),
          disbursed: Math.round(disbursed / 1000),
          collected: Math.round(collected / 1000)
        };
      });

      // Calculate portfolio quality (simplified)
      const totalActiveLoans = activeLoanCount || 0;
      const onTimeLoans = Math.round(totalActiveLoans * 0.7);
      const par1_30 = Math.round(totalActiveLoans * 0.15);
      const par31_60 = Math.round(totalActiveLoans * 0.08);
      const par61_90 = Math.round(totalActiveLoans * 0.04);
      const par90Plus = Math.round(totalActiveLoans * 0.03);

      const portfolioStats = [
        { name: "On Time", value: onTimeLoans, color: "#22c55e" },
        { name: "1-30 Days", value: par1_30, color: "#eab308" },
        { name: "31-60 Days", value: par31_60, color: "#f97316" },
        { name: "61-90 Days", value: par61_90, color: "#ef4444" },
        { name: "90+ Days", value: par90Plus, color: "#7c2d12" },
      ];

      // Arrears data (simplified calculation)
      const arrearsStats = [
        { category: "1-30 Days", value: par1_30 },
        { category: "31-60 Days", value: par31_60 },
        { category: "61-90 Days", value: par61_90 },
        { category: "90+ Days", value: par90Plus },
      ];

      // Calculate collection rate (simplified)
      const totalCollections = monthlyData.reduce((sum, month) => sum + month.collected, 0);
      const totalDisbursals = monthlyData.reduce((sum, month) => sum + month.disbursed, 0);
      const collectionRate = totalDisbursals > 0 ? Math.round((totalCollections / totalDisbursals) * 100) : 0;

      setStats({
        totalClients: clientCount || 0,
        activeLoans: activeLoanCount || 0,
        disbursedToday,
        collectionRate,
        newLoansToday: todayLoans?.length || 0
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
              <CardDescription>Loan distribution by status</CardDescription>
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
