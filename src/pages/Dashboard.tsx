
import { CreditCard, DollarSign, Users, BarChartHorizontal } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { DashboardCard } from "@/components/ui/dashboard-card";
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

const loanData = [
  { month: "Jan", disbursed: 4000, collected: 2400 },
  { month: "Feb", disbursed: 3000, collected: 1398 },
  { month: "Mar", disbursed: 2000, collected: 9800 },
  { month: "Apr", disbursed: 2780, collected: 3908 },
  { month: "May", disbursed: 1890, collected: 4800 },
  { month: "Jun", disbursed: 2390, collected: 3800 },
];

const portfolioData = [
  { name: "On Time", value: 400, color: "#0ea5e9" },
  { name: "1-30 Days", value: 300, color: "#22c55e" },
  { name: "31-60 Days", value: 300, color: "#eab308" },
  { name: "61-90 Days", value: 200, color: "#f97316" },
  { name: "90+ Days", value: 100, color: "#ef4444" },
];

const arrearsData = [
  { category: "1-30 Days", value: 12 },
  { category: "31-60 Days", value: 9 },
  { category: "61-90 Days", value: 6 },
  { category: "90+ Days", value: 3 },
];

const Dashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your microfinance operation.</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Clients"
            value="2,834"
            trend="up"
            trendValue="12% from last month"
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Active Loans"
            value="1,452"
            trend="up"
            trendValue="8% from last month"
            icon={<CreditCard className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Disbursed Today"
            value="$12,560"
            description="8 new loans"
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
          <DashboardCard
            title="Collection Rate"
            value="96.3%"
            trend="up"
            trendValue="2.1% from last month"
            icon={<BarChartHorizontal className="h-4 w-4 text-primary" />}
          />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Loan Disbursals vs Collections</CardTitle>
              <CardDescription>Monthly performance comparison</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-80 w-full">
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
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="disbursed" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" />
                    <Area type="monotone" dataKey="collected" stackId="2" stroke="#22c55e" fill="#22c55e" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Quality</CardTitle>
              <CardDescription>Loan distribution by days in arrears</CardDescription>
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
        
        <Card>
          <CardHeader>
            <CardTitle>Loans in Arrears by Category</CardTitle>
            <CardDescription>Number of loans by days past due</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
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
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
