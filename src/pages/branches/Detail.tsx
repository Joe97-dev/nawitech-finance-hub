
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/ui/export-button";

// Dummy data for branches
const branchesData = {
  "head-office": {
    id: "head-office",
    name: "HEAD OFFICE",
    location: "Nairobi CBD",
    staffCount: 15,
    activeLoans: 450,
    totalPortfolio: 12500000,
    performanceData: {
      income: [
        { month: "Jan", amount: 1250000 },
        { month: "Feb", amount: 1320000 },
        { month: "Mar", amount: 1400000 },
        { month: "Apr", amount: 1380000 },
        { month: "May", amount: 1450000 },
        { month: "Jun", amount: 1520000 },
      ],
      disbursements: [
        { month: "Jan", amount: 3200000 },
        { month: "Feb", amount: 2900000 },
        { month: "Mar", amount: 3400000 },
        { month: "Apr", amount: 3600000 },
        { month: "May", amount: 3300000 },
        { month: "Jun", amount: 3700000 },
      ],
      collections: [
        { month: "Jan", expected: 2800000, collected: 2600000, rate: 92.9 },
        { month: "Feb", expected: 2900000, collected: 2750000, rate: 94.8 },
        { month: "Mar", expected: 3000000, collected: 2880000, rate: 96.0 },
        { month: "Apr", expected: 3100000, collected: 2950000, rate: 95.2 },
        { month: "May", expected: 3200000, collected: 3070000, rate: 95.9 },
        { month: "Jun", expected: 3300000, collected: 3190000, rate: 96.7 },
      ],
      portfolio: [
        { name: "On Time", value: 9375000, color: "#0ea5e9" },
        { name: "1-30 Days", value: 2000000, color: "#22c55e" },
        { name: "31-60 Days", value: 750000, color: "#eab308" },
        { name: "61-90 Days", value: 250000, color: "#f97316" },
        { name: "90+ Days", value: 125000, color: "#ef4444" },
      ],
    },
    loansDue: [
      { id: 1, clientName: "John Kamau", phoneNumber: "0712345678", amountDue: 35000, dueDate: "2025-05-25" },
      { id: 2, clientName: "Mary Wanjiku", phoneNumber: "0723456789", amountDue: 42000, dueDate: "2025-05-26" },
      { id: 3, clientName: "Peter Ochieng", phoneNumber: "0734567890", amountDue: 28000, dueDate: "2025-05-27" },
      { id: 4, clientName: "Lucy Muthoni", phoneNumber: "0745678901", amountDue: 50000, dueDate: "2025-05-28" },
      { id: 5, clientName: "David Kiprop", phoneNumber: "0756789012", amountDue: 65000, dueDate: "2025-05-29" },
    ],
    dormantClients: [
      { id: 1, clientName: "Jane Akinyi", phoneNumber: "0767890123", lastActivity: "2024-12-15", daysInactive: 156 },
      { id: 2, clientName: "Samuel Maina", phoneNumber: "0778901234", lastActivity: "2025-01-20", daysInactive: 120 },
      { id: 3, clientName: "Grace Atieno", phoneNumber: "0789012345", lastActivity: "2025-02-05", daysInactive: 104 },
      { id: 4, clientName: "Daniel Mutua", phoneNumber: "0790123456", lastActivity: "2025-01-10", daysInactive: 130 },
      { id: 5, clientName: "Sarah Njeri", phoneNumber: "0701234567", lastActivity: "2024-11-30", daysInactive: 171 },
    ],
  },
  "westlands": {
    id: "westlands",
    name: "Westlands Branch",
    location: "Westlands, Nairobi",
    staffCount: 8,
    activeLoans: 230,
    totalPortfolio: 7800000,
    performanceData: {
      income: [
        { month: "Jan", amount: 780000 },
        { month: "Feb", amount: 820000 },
        { month: "Mar", amount: 850000 },
        { month: "Apr", amount: 840000 },
        { month: "May", amount: 890000 },
        { month: "Jun", amount: 920000 },
      ],
      disbursements: [
        { month: "Jan", amount: 1800000 },
        { month: "Feb", amount: 1600000 },
        { month: "Mar", amount: 1900000 },
        { month: "Apr", amount: 2000000 },
        { month: "May", amount: 1800000 },
        { month: "Jun", amount: 2100000 },
      ],
      collections: [
        { month: "Jan", expected: 1600000, collected: 1520000, rate: 95.0 },
        { month: "Feb", expected: 1650000, collected: 1570000, rate: 95.2 },
        { month: "Mar", expected: 1700000, collected: 1640000, rate: 96.5 },
        { month: "Apr", expected: 1750000, collected: 1680000, rate: 96.0 },
        { month: "May", expected: 1800000, collected: 1720000, rate: 95.6 },
        { month: "Jun", expected: 1850000, collected: 1790000, rate: 96.8 },
      ],
      portfolio: [
        { name: "On Time", value: 5850000, color: "#0ea5e9" },
        { name: "1-30 Days", value: 1248000, color: "#22c55e" },
        { name: "31-60 Days", value: 468000, color: "#eab308" },
        { name: "61-90 Days", value: 156000, color: "#f97316" },
        { name: "90+ Days", value: 78000, color: "#ef4444" },
      ],
    },
    loansDue: [
      { id: 1, clientName: "Alice Wairimu", phoneNumber: "0712345679", amountDue: 22000, dueDate: "2025-05-25" },
      { id: 2, clientName: "Bob Mugo", phoneNumber: "0723456780", amountDue: 30000, dueDate: "2025-05-26" },
      { id: 3, clientName: "Carol Wekesa", phoneNumber: "0734567891", amountDue: 18000, dueDate: "2025-05-27" },
    ],
    dormantClients: [
      { id: 1, clientName: "Dennis Mutiso", phoneNumber: "0745678902", lastActivity: "2024-12-25", daysInactive: 146 },
      { id: 2, clientName: "Elizabeth Njoki", phoneNumber: "0756789013", lastActivity: "2025-01-30", daysInactive: 110 },
    ],
  },
  "mombasa": {
    id: "mombasa",
    name: "Mombasa Branch",
    location: "Mombasa Town",
    staffCount: 6,
    activeLoans: 180,
    totalPortfolio: 5200000,
    performanceData: {
      income: [
        { month: "Jan", amount: 520000 },
        { month: "Feb", amount: 540000 },
        { month: "Mar", amount: 560000 },
        { month: "Apr", amount: 550000 },
        { month: "May", amount: 580000 },
        { month: "Jun", amount: 600000 },
      ],
      disbursements: [
        { month: "Jan", amount: 1300000 },
        { month: "Feb", amount: 1200000 },
        { month: "Mar", amount: 1400000 },
        { month: "Apr", amount: 1450000 },
        { month: "May", amount: 1350000 },
        { month: "Jun", amount: 1500000 },
      ],
      collections: [
        { month: "Jan", expected: 1100000, collected: 1034000, rate: 94.0 },
        { month: "Feb", expected: 1150000, collected: 1080000, rate: 93.9 },
        { month: "Mar", expected: 1200000, collected: 1140000, rate: 95.0 },
        { month: "Apr", expected: 1250000, collected: 1175000, rate: 94.0 },
        { month: "May", expected: 1300000, collected: 1235000, rate: 95.0 },
        { month: "Jun", expected: 1350000, collected: 1295000, rate: 95.9 },
      ],
      portfolio: [
        { name: "On Time", value: 3900000, color: "#0ea5e9" },
        { name: "1-30 Days", value: 832000, color: "#22c55e" },
        { name: "31-60 Days", value: 312000, color: "#eab308" },
        { name: "61-90 Days", value: 104000, color: "#f97316" },
        { name: "90+ Days", value: 52000, color: "#ef4444" },
      ],
    },
    loansDue: [
      { id: 1, clientName: "Frank Odinga", phoneNumber: "0767890124", amountDue: 25000, dueDate: "2025-05-25" },
      { id: 2, clientName: "Gloria Hassan", phoneNumber: "0778901235", amountDue: 33000, dueDate: "2025-05-26" },
    ],
    dormantClients: [
      { id: 1, clientName: "Hassan Ali", phoneNumber: "0789012346", lastActivity: "2025-01-05", daysInactive: 135 },
      { id: 2, clientName: "Isabella Mohammed", phoneNumber: "0790123457", lastActivity: "2024-12-10", daysInactive: 161 },
      { id: 3, clientName: "James Mbugua", phoneNumber: "0701234568", lastActivity: "2025-02-15", daysInactive: 94 },
    ],
  },
  "kisumu": {
    id: "kisumu",
    name: "Kisumu Branch",
    location: "Kisumu CBD",
    staffCount: 5,
    activeLoans: 120,
    totalPortfolio: 4100000,
    performanceData: {
      income: [
        { month: "Jan", amount: 410000 },
        { month: "Feb", amount: 420000 },
        { month: "Mar", amount: 440000 },
        { month: "Apr", amount: 430000 },
        { month: "May", amount: 450000 },
        { month: "Jun", amount: 470000 },
      ],
      disbursements: [
        { month: "Jan", amount: 1000000 },
        { month: "Feb", amount: 950000 },
        { month: "Mar", amount: 1100000 },
        { month: "Apr", amount: 1150000 },
        { month: "May", amount: 1050000 },
        { month: "Jun", amount: 1200000 },
      ],
      collections: [
        { month: "Jan", expected: 900000, collected: 846000, rate: 94.0 },
        { month: "Feb", expected: 920000, collected: 874000, rate: 95.0 },
        { month: "Mar", expected: 940000, collected: 902400, rate: 96.0 },
        { month: "Apr", expected: 960000, collected: 912000, rate: 95.0 },
        { month: "May", expected: 980000, collected: 940800, rate: 96.0 },
        { month: "Jun", expected: 1000000, collected: 970000, rate: 97.0 },
      ],
      portfolio: [
        { name: "On Time", value: 3075000, color: "#0ea5e9" },
        { name: "1-30 Days", value: 656000, color: "#22c55e" },
        { name: "31-60 Days", value: 246000, color: "#eab308" },
        { name: "61-90 Days", value: 82000, color: "#f97316" },
        { name: "90+ Days", value: 41000, color: "#ef4444" },
      ],
    },
    loansDue: [
      { id: 1, clientName: "Kevin Onyango", phoneNumber: "0712345670", amountDue: 20000, dueDate: "2025-05-25" },
      { id: 2, clientName: "Linda Achieng", phoneNumber: "0723456781", amountDue: 28000, dueDate: "2025-05-26" },
    ],
    dormantClients: [
      { id: 1, clientName: "Michael Oduor", phoneNumber: "0734567892", lastActivity: "2025-01-15", daysInactive: 125 },
      { id: 2, clientName: "Nancy Adhiambo", phoneNumber: "0745678903", lastActivity: "2024-11-20", daysInactive: 181 },
    ],
  },
  "nakuru": {
    id: "nakuru",
    name: "Nakuru Branch",
    location: "Nakuru Town",
    staffCount: 4,
    activeLoans: 90,
    totalPortfolio: 2800000,
    performanceData: {
      income: [
        { month: "Jan", amount: 280000 },
        { month: "Feb", amount: 290000 },
        { month: "Mar", amount: 300000 },
        { month: "Apr", amount: 295000 },
        { month: "May", amount: 310000 },
        { month: "Jun", amount: 320000 },
      ],
      disbursements: [
        { month: "Jan", amount: 700000 },
        { month: "Feb", amount: 650000 },
        { month: "Mar", amount: 750000 },
        { month: "Apr", amount: 780000 },
        { month: "May", amount: 720000 },
        { month: "Jun", amount: 800000 },
      ],
      collections: [
        { month: "Jan", expected: 600000, collected: 558000, rate: 93.0 },
        { month: "Feb", expected: 620000, collected: 583000, rate: 94.0 },
        { month: "Mar", expected: 640000, collected: 608000, rate: 95.0 },
        { month: "Apr", expected: 660000, collected: 627000, rate: 95.0 },
        { month: "May", expected: 680000, collected: 653000, rate: 96.0 },
        { month: "Jun", expected: 700000, collected: 679000, rate: 97.0 },
      ],
      portfolio: [
        { name: "On Time", value: 2100000, color: "#0ea5e9" },
        { name: "1-30 Days", value: 448000, color: "#22c55e" },
        { name: "31-60 Days", value: 168000, color: "#eab308" },
        { name: "61-90 Days", value: 56000, color: "#f97316" },
        { name: "90+ Days", value: 28000, color: "#ef4444" },
      ],
    },
    loansDue: [
      { id: 1, clientName: "Oscar Kipchoge", phoneNumber: "0756789014", amountDue: 15000, dueDate: "2025-05-25" },
      { id: 2, clientName: "Patricia Cherono", phoneNumber: "0767890125", amountDue: 22000, dueDate: "2025-05-26" },
    ],
    dormantClients: [
      { id: 1, clientName: "Quentin Korir", phoneNumber: "0778901236", lastActivity: "2025-02-10", daysInactive: 99 },
      { id: 2, clientName: "Rose Chebet", phoneNumber: "0789012347", lastActivity: "2025-01-25", daysInactive: 115 },
    ],
  },
};

const BranchDetail = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 1), // May 1, 2025
    to: new Date(2025, 4, 31), // May 31, 2025
  });

  // Default to HEAD OFFICE if branch ID is not found
  const branch = branchesData[branchId as keyof typeof branchesData] || branchesData["head-office"];

  const loansDueColumns = [
    { key: "clientName", header: "Client Name" },
    { key: "phoneNumber", header: "Phone Number" },
    { key: "amountDue", header: "Amount Due (KES)" },
    { key: "dueDate", header: "Due Date" },
  ];

  const dormantClientsColumns = [
    { key: "clientName", header: "Client Name" },
    { key: "phoneNumber", header: "Phone Number" },
    { key: "lastActivity", header: "Last Activity" },
    { key: "daysInactive", header: "Days Inactive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{branch.name}</h1>
          <p className="text-muted-foreground">{branch.location}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branch.staffCount}</div>
              <p className="text-xs text-muted-foreground">Personnel</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Active Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branch.activeLoans}</div>
              <p className="text-xs text-muted-foreground">Current loans</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KES {branch.totalPortfolio.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total outstanding</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance">
          <TabsList className="grid w-full md:w-auto grid-cols-3 md:grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="loans-due">Loans Due</TabsTrigger>
            <TabsTrigger value="dormant">Dormant Clients</TabsTrigger>
          </TabsList>

          <div className="mt-4 mb-6">
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarRange className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Income</CardTitle>
                  <CardDescription>Monthly income from interest</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={branch.performanceData.income}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`KES ${value.toLocaleString()}`, "Income"]} />
                        <Legend />
                        <Bar dataKey="amount" name="Income (KES)" fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Disbursements</CardTitle>
                  <CardDescription>Monthly loan disbursals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={branch.performanceData.disbursements}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`KES ${value.toLocaleString()}`, "Disbursed"]} />
                        <Legend />
                        <Bar dataKey="amount" name="Disbursed (KES)" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Collection Rate</CardTitle>
                  <CardDescription>Monthly collection performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={branch.performanceData.collections}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => 
                          name === "rate" ? `${value}%` : `KES ${value.toLocaleString()}`
                        } />
                        <Legend />
                        <Area type="monotone" dataKey="expected" name="Expected Collection" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="collected" name="Actual Collection" stroke="#22c55e" fill="#22c55e" />
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
                          data={branch.performanceData.portfolio}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {branch.performanceData.portfolio.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`KES ${value.toLocaleString()}`]} />
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
                <CardTitle>Loans Due Report</CardTitle>
                <CardDescription>Upcoming loan repayments</CardDescription>
                <div className="flex justify-end mt-2">
                  <ExportButton
                    data={branch.loansDue}
                    filename={`loans-due-${branch.id}`}
                    columns={loansDueColumns}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Amount Due (KES)</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branch.loansDue.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">{loan.clientName}</TableCell>
                        <TableCell>{loan.phoneNumber}</TableCell>
                        <TableCell>{loan.amountDue.toLocaleString()}</TableCell>
                        <TableCell>{loan.dueDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dormant">
            <Card>
              <CardHeader>
                <CardTitle>Dormant Clients</CardTitle>
                <CardDescription>Clients with no active loans</CardDescription>
                <div className="flex justify-end mt-2">
                  <ExportButton
                    data={branch.dormantClients}
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
                      <TableHead>Days Inactive</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branch.dormantClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell>{client.phoneNumber}</TableCell>
                        <TableCell>{client.lastActivity}</TableCell>
                        <TableCell>{client.daysInactive}</TableCell>
                      </TableRow>
                    ))}
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
