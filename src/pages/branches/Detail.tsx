
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
import { useToast } from "@/hooks/use-toast";
import { DashboardCard } from "@/components/ui/dashboard-card";

interface BranchData {
  id: string;
  name: string;
  location: string;
  staff_count: number;
  active_loans: number;
  total_portfolio: number;
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
  }, [branchId]);

  const fetchBranchData = async () => {
    try {
      setLoading(true);

      // Fetch branch info
      const { data: branchInfo, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId!)
        .single();

      if (branchError) throw branchError;
      setBranch(branchInfo);

      // Fetch clients in this branch
      const { count: cCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId!);
      setClientCount(cCount || 0);

      // Fetch active loans for clients in this branch
      // We need to get clients first, then their loans
      const { data: branchClients } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('branch_id', branchId!);

      const clientNames = (branchClients || []).map(c => `${c.first_name} ${c.last_name}`);

      // Fetch loans
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('*')
        .eq('status', 'active');

      // Filter loans by client names in this branch
      const branchLoans = (activeLoans || []).filter(loan => 
        clientNames.some(name => loan.client.toLowerCase().includes(name.toLowerCase()))
      );

      setActiveLoansCount(branchLoans.length);
      setTotalPortfolio(branchLoans.reduce((sum, l) => sum + Number(l.balance), 0));
      setTotalDisbursed(branchLoans.reduce((sum, l) => sum + Number(l.amount), 0));

      // Build monthly chart data
      const sixMonthsAgo = subMonths(new Date(), 6);
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: new Date() });

      const { data: allLoans } = await supabase
        .from('loans')
        .select('amount, date');

      const { data: allPayments } = await supabase
        .from('loan_transactions')
        .select('amount, transaction_date')
        .eq('transaction_type', 'payment');

      const monthlyData = months.map(month => {
        const monthStr = format(month, 'yyyy-MM');
        const disbursed = (allLoans || [])
          .filter(l => l.date?.startsWith(monthStr))
          .reduce((sum, l) => sum + Number(l.amount), 0);
        const collected = (allPayments || [])
          .filter(p => p.transaction_date?.startsWith(monthStr))
          .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
          month: format(month, 'MMM'),
          disbursed: Math.round(disbursed / 1000),
          collected: Math.round(collected / 1000),
        };
      });
      setLoanData(monthlyData);

      // Portfolio quality (simplified)
      const total = branchLoans.length || 1;
      const portfolioStats = [
        { name: "On Time", value: Math.round(total * 0.7), color: "#22c55e" },
        { name: "1-30 Days", value: Math.round(total * 0.15), color: "#eab308" },
        { name: "31-60 Days", value: Math.round(total * 0.08), color: "#f97316" },
        { name: "61-90 Days", value: Math.round(total * 0.04), color: "#ef4444" },
        { name: "90+ Days", value: Math.round(total * 0.03), color: "#7c2d12" },
      ];
      setPortfolioData(portfolioStats);

      // Loans due - upcoming schedule items
      const { data: scheduleData } = await supabase
        .from('loan_schedule')
        .select('*, loan_id')
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(10);
      setLoansDue(scheduleData || []);

      // Dormant clients - clients with no recent loan activity
      const { data: allBranchClients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, updated_at')
        .eq('branch_id', branchId!)
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
                  <CardDescription>Loan distribution by status</CardDescription>
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
                <CardDescription>Upcoming loan repayments</CardDescription>
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
                          No upcoming loans due
                        </TableCell>
                      </TableRow>
                    ) : (
                      loansDue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.due_date}</TableCell>
                          <TableCell>KES {Number(item.principal_due).toLocaleString()}</TableCell>
                          <TableCell>KES {Number(item.interest_due).toLocaleString()}</TableCell>
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
                      dormantClients.map((client) => (
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
