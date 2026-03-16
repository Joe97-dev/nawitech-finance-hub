
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, Users, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, subMonths, eachMonthOfInterval } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/ui/export-button";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";
import { DashboardCard } from "@/components/ui/dashboard-card";

interface BranchData {
  id: string;
  name: string;
  location: string;
}

const BranchDetail = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [activeLoansCount, setActiveLoansCount] = useState(0);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [totalDisbursed, setTotalDisbursed] = useState(0);
  const [loanData, setLoanData] = useState<any[]>([]);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [loansDue, setLoansDue] = useState<any[]>([]);
  const [dormantClients, setDormantClients] = useState<any[]>([]);

  const [date, setDate] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });

  useEffect(() => {
    if (branchId) fetchBranchData();
  }, [branchId, date]);

  const fetchBranchData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      // Fetch branch info
      const { data: branchInfo, error: branchError } = await supabase
        .from('branches')
        .select('id, name, location')
        .eq('id', branchId!)
        .single();

      if (branchError) throw branchError;
      setBranch(branchInfo);

      // Fetch clients in this branch (paginated)
      const allBranchClientIds: string[] = [];
      let cFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('branch_id', branchId!)
          .eq('organization_id', orgId)
          .range(cFrom, cFrom + 999);
        if (data) allBranchClientIds.push(...data.map(c => c.id));
        if (!data || data.length < 1000) break;
        cFrom += 1000;
      }
      setClientCount(allBranchClientIds.length);

      // Also build name-based lookup for legacy client fields
      const clientNameSet = new Set<string>();
      let cnFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('clients')
          .select('first_name, last_name')
          .eq('branch_id', branchId!)
          .eq('organization_id', orgId)
          .range(cnFrom, cnFrom + 999);
        if (data) data.forEach(c => clientNameSet.add(`${c.first_name} ${c.last_name}`.toLowerCase()));
        if (!data || data.length < 1000) break;
        cnFrom += 1000;
      }

      const branchClientIdSet = new Set(allBranchClientIds);

      // Fetch all active/in-arrears loans for this org (paginated), excluding fee accounts
      const allLoans: { id: string; client: string; amount: number; balance: number; status: string; date: string }[] = [];
      let lFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('loans')
          .select('id, client, amount, balance, status, date')
          .eq('organization_id', orgId)
          .neq('type', 'client_fee_account')
          .in('status', ['active', 'in arrears', 'closed', 'disbursed', 'approved'])
          .range(lFrom, lFrom + 999);
        if (data) allLoans.push(...data);
        if (!data || data.length < 1000) break;
        lFrom += 1000;
      }

      // Filter loans belonging to this branch (UUID or name match)
      const branchLoans = allLoans.filter(loan =>
        branchClientIdSet.has(loan.client) || clientNameSet.has(loan.client.toLowerCase())
      );

      const activeBranchLoans = branchLoans.filter(l => l.status === 'active' || l.status === 'in arrears');
      setActiveLoansCount(activeBranchLoans.length);
      setTotalPortfolio(activeBranchLoans.reduce((sum, l) => sum + Number(l.balance), 0));
      setTotalDisbursed(branchLoans.reduce((sum, l) => sum + Number(l.amount), 0));

      // Date range for charts
      const startDate = date?.from || subMonths(new Date(), 6);
      const endDate = date?.to || new Date();
      const fromStr = format(startDate, 'yyyy-MM-dd');
      const toStr = format(endDate, 'yyyy-MM-dd');

      // Fetch schedules for branch loans (batched) for chart + collection + PAR
      const branchLoanIds = branchLoans.map(l => l.id);
      const allSchedules: { loan_id: string; total_due: number; amount_paid: number; due_date: string; status: string }[] = [];
      for (let i = 0; i < branchLoanIds.length; i += 50) {
        const batch = branchLoanIds.slice(i, i + 50);
        const { data } = await supabase
          .from('loan_schedule')
          .select('loan_id, total_due, amount_paid, due_date, status')
          .in('loan_id', batch);
        if (data) allSchedules.push(...data);
      }

      // Build monthly chart data from branch loans and schedules within date range
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const monthlyData = months.map(month => {
        const monthStr = format(month, 'yyyy-MM');

        const disbursed = branchLoans
          .filter(l => l.date?.startsWith(monthStr))
          .reduce((sum, l) => sum + Number(l.amount), 0);

        const collected = allSchedules
          .filter(s => s.due_date?.startsWith(monthStr))
          .reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);

        return {
          month: format(month, 'MMM'),
          disbursed: Math.round(disbursed / 1000),
          collected: Math.round(collected / 1000),
        };
      });
      setLoanData(monthlyData);

      // Real PAR calculation for active branch loans
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const activeBranchLoanIds = activeBranchLoans.map(l => l.id);
      const balanceMap = new Map(activeBranchLoans.map(l => [l.id, Number(l.balance)]));

      // Find overdue (pending, past due) schedules
      const overdueSchedules = allSchedules.filter(
        s => activeBranchLoanIds.includes(s.loan_id) && s.status === 'pending' && s.due_date < todayStr
      );

      const earliestOverdue = new Map<string, string>();
      overdueSchedules.forEach(s => {
        const existing = earliestOverdue.get(s.loan_id);
        if (!existing || s.due_date < existing) {
          earliestOverdue.set(s.loan_id, s.due_date);
        }
      });

      const todayMs = new Date(todayStr).getTime();
      let onTimeCount = 0, par1_30 = 0, par31_60 = 0, par61_90 = 0, par90Plus = 0;

      activeBranchLoanIds.forEach(id => {
        const od = earliestOverdue.get(id);
        if (!od) { onTimeCount++; return; }
        const days = Math.floor((todayMs - new Date(od).getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) par1_30++;
        else if (days <= 60) par31_60++;
        else if (days <= 90) par61_90++;
        else par90Plus++;
      });

      setPortfolioData([
        { name: "On Time", value: onTimeCount, color: "#22c55e" },
        { name: "1-30 Days", value: par1_30, color: "#eab308" },
        { name: "31-60 Days", value: par31_60, color: "#f97316" },
        { name: "61-90 Days", value: par61_90, color: "#ef4444" },
        { name: "90+ Days", value: par90Plus, color: "#7c2d12" },
      ]);

      // Loans due — pending schedules for branch loans within date range
      const branchLoansDue = allSchedules
        .filter(s => s.status === 'pending' && s.due_date >= fromStr && s.due_date <= toStr)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 20);
      setLoansDue(branchLoansDue);

      // Dormant clients
      const { data: allBranchClients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, updated_at')
        .eq('branch_id', branchId!)
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: true })
        .limit(10);

      const dormant = (allBranchClients || []).map(c => ({
        id: c.id,
        clientName: `${c.first_name} ${c.last_name}`,
        phoneNumber: c.phone,
        lastActivity: c.updated_at ? format(new Date(c.updated_at), 'yyyy-MM-dd') : 'N/A',
      }));
      setDormantClients(dormant);

    } catch (error: any) {
      console.error("Error fetching branch data:", error);
      toast({
        variant: "destructive",
        title: "Failed to load branch",
        description: error.message || "Could not load branch details.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loansDueColumns = [
    { key: "due_date", header: "Due Date" },
    { key: "total_due", header: "Amount Due (KES)" },
    { key: "status", header: "Status" },
  ];

  const dormantClientsColumns = [
    { key: "clientName", header: "Client Name" },
    { key: "phoneNumber", header: "Phone Number" },
    { key: "lastActivity", header: "Last Activity" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!branch) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">Branch not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{branch.name}</h1>
          <p className="text-muted-foreground">{branch.location}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Clients"
            value={clientCount.toLocaleString()}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Active Loans"
            value={activeLoansCount.toLocaleString()}
            icon={<CreditCard className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Total Portfolio"
            value={`KES ${totalPortfolio.toLocaleString()}`}
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Total Disbursed"
            value={`KES ${totalDisbursed.toLocaleString()}`}
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
        </div>

        <Tabs defaultValue="performance">
          <TabsList className="grid w-full md:w-auto grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="loans-due">Loans Due</TabsTrigger>
            <TabsTrigger value="dormant">Dormant Clients</TabsTrigger>
          </TabsList>

          <div className="mt-4 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Disbursals vs Collections</CardTitle>
                  <CardDescription>Monthly performance (in thousands)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={loanData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`KES ${value}K`, '']} />
                        <Legend />
                        <Area type="monotone" dataKey="disbursed" stroke="#0ea5e9" fill="#0ea5e9" name="Disbursed" />
                        <Area type="monotone" dataKey="collected" stroke="#22c55e" fill="#22c55e" name="Collected" />
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
                  <div className="h-80 w-full">
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
          </TabsContent>

          <TabsContent value="loans-due">
            <Card>
              <CardHeader>
                <CardTitle>Loans Due</CardTitle>
                <CardDescription>Upcoming loan repayments for this branch</CardDescription>
                <div className="flex justify-end mt-2">
                  <ExportButton
                    data={loansDue}
                    filename={`loans-due-${branch.id}`}
                    columns={loansDueColumns}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Principal Due</TableHead>
                      <TableHead>Interest Due</TableHead>
                      <TableHead>Total Due (KES)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loansDue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No upcoming loans due for this branch
                        </TableCell>
                      </TableRow>
                    ) : (
                      loansDue.map((item: any) => (
                        <TableRow key={item.loan_id + item.due_date}>
                          <TableCell>{item.due_date}</TableCell>
                          <TableCell>KES {Number(item.total_due - (item.total_due * 0)).toLocaleString()}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell className="font-medium">KES {Number(item.total_due).toLocaleString()}</TableCell>
                          <TableCell className="capitalize">{item.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dormant">
            <Card>
              <CardHeader>
                <CardTitle>Dormant Clients</CardTitle>
                <CardDescription>Clients with least recent activity</CardDescription>
                <div className="flex justify-end mt-2">
                  <ExportButton
                    data={dormantClients}
                    filename={`dormant-clients-${branch.id}`}
                    columns={dormantClientsColumns}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dormantClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                          No clients found for this branch
                        </TableCell>
                      </TableRow>
                    ) : (
                      dormantClients.map((client: any) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.clientName}</TableCell>
                          <TableCell>{client.phoneNumber}</TableCell>
                          <TableCell>{client.lastActivity}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BranchDetail;
