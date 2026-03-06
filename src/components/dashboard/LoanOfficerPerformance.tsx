
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { Users, CreditCard, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subMonths, eachMonthOfInterval } from "date-fns";

interface LoanOfficer {
  id: string;
  username: string;
}

interface OfficerStats {
  totalClients: number;
  activeLoans: number;
  totalPortfolio: number;
  totalCollected: number;
  loansInArrears: number;
  collectionRate: number;
}

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444"];

export function LoanOfficerPerformance() {
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<string>("");
  const [stats, setStats] = useState<OfficerStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loanStatusData, setLoanStatusData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount: number) => `Ksh ${amount.toLocaleString()}`;

  useEffect(() => {
    const fetchOfficers = async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'loan_officer');

      if (!roles?.length) return;

      const officerList: LoanOfficer[] = [];
      for (const role of roles) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', role.user_id)
          .single();
        if (profile) {
          officerList.push({ id: profile.id, username: profile.username || profile.id });
        }
      }
      setOfficers(officerList);
    };
    fetchOfficers();
  }, []);

  useEffect(() => {
    if (!selectedOfficer) {
      setStats(null);
      return;
    }
    fetchOfficerData(selectedOfficer);
  }, [selectedOfficer]);

  const fetchOfficerData = async (officerId: string) => {
    setLoading(true);
    try {
      // Clients assigned to officer
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('loan_officer_id', officerId);

      // Loans managed by officer
      const { data: officerLoans } = await supabase
        .from('loans')
        .select('*')
        .eq('loan_officer_id', officerId);

      const loans = officerLoans || [];
      const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'in arrears');
      const arrearsLoans = loans.filter(l => l.status === 'in arrears');
      const totalPortfolio = activeLoans.reduce((sum, l) => sum + Number(l.balance), 0);

      // Loan status distribution
      const statusCounts: Record<string, number> = {};
      loans.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });
      const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Monthly disbursals & collections for last 6 months
      const loanIds = loans.map(l => l.id);
      const sixMonthsAgo = subMonths(new Date(), 6);
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: new Date() });

      let totalCollected = 0;
      let totalDisbursed = 0;

      const monthly = await Promise.all(
        months.map(async (month) => {
          const monthStart = format(month, 'yyyy-MM-01');
          const nextMonth = format(new Date(month.getFullYear(), month.getMonth() + 1, 1), 'yyyy-MM-dd');

          // Disbursals
          const monthLoans = loans.filter(l => l.date >= monthStart && l.date < nextMonth);
          const disbursed = monthLoans.reduce((sum, l) => sum + Number(l.amount), 0);
          totalDisbursed += disbursed;

          // Collections
          let collected = 0;
          if (loanIds.length > 0) {
            const { data: txns } = await supabase
              .from('loan_transactions')
              .select('amount')
              .eq('transaction_type', 'payment')
              .in('loan_id', loanIds)
              .gte('transaction_date', monthStart)
              .lt('transaction_date', nextMonth);
            collected = txns?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          }
          totalCollected += collected;

          return {
            month: format(month, 'MMM'),
            disbursed: Math.round(disbursed / 1000),
            collected: Math.round(collected / 1000),
          };
        })
      );

      const collectionRate = totalDisbursed > 0 ? Math.round((totalCollected / totalDisbursed) * 100) : 0;

      setStats({
        totalClients: clientCount || 0,
        activeLoans: activeLoans.length,
        totalPortfolio,
        totalCollected,
        loansInArrears: arrearsLoans.length,
        collectionRate,
      });
      setMonthlyData(monthly);
      setLoanStatusData(statusData);
    } catch (error) {
      console.error('Error fetching officer data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Loan Officer Performance
            </CardTitle>
            <CardDescription>Select an officer to view their performance dashboard</CardDescription>
          </div>
          <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select loan officer" />
            </SelectTrigger>
            <SelectContent>
              {officers.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedOfficer && (
          <p className="text-muted-foreground text-center py-8">Please select a loan officer to view performance metrics.</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {stats && !loading && (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <DashboardCard title="Clients" value={stats.totalClients} icon={<Users className="h-4 w-4 text-primary" />} />
              <DashboardCard title="Active Loans" value={stats.activeLoans} icon={<CreditCard className="h-4 w-4 text-primary" />} />
              <DashboardCard title="Portfolio" value={formatCurrency(stats.totalPortfolio)} icon={<DollarSign className="h-4 w-4 text-primary" />} />
              <DashboardCard title="Collection Rate" value={`${stats.collectionRate}%`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
              <DashboardCard title="In Arrears" value={stats.loansInArrears} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Disbursals vs Collections (Ksh '000)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`Ksh ${value}K`, '']} />
                        <Legend />
                        <Bar dataKey="disbursed" name="Disbursed" fill="hsl(var(--primary))" />
                        <Bar dataKey="collected" name="Collected" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Loan Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {loanStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={loanStatusData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {loanStatusData.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-center pt-20">No loan data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
