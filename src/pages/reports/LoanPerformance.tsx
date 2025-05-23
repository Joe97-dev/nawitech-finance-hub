import { useState } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";

// Dummy data for loan performance by product
const loanPerformanceData = [
  { 
    product: "Business Loan", 
    disbursed: 12500000, 
    outstanding: 9800000,
    collected: 3450000, 
    interest: 750000,
    onTime: 85,
    defaultRate: 5.2,
    color: "#0ea5e9"
  },
  { 
    product: "Agriculture Loan", 
    disbursed: 8700000, 
    outstanding: 7200000,
    collected: 1950000, 
    interest: 430000,
    onTime: 78,
    defaultRate: 8.7,
    color: "#22c55e" 
  },
  { 
    product: "Emergency Loan", 
    disbursed: 4300000, 
    outstanding: 2800000,
    collected: 1850000, 
    interest: 350000,
    onTime: 92,
    defaultRate: 3.4,
    color: "#f97316" 
  },
  { 
    product: "Education Loan", 
    disbursed: 3200000, 
    outstanding: 2500000,
    collected: 850000, 
    interest: 180000,
    onTime: 89,
    defaultRate: 4.1,
    color: "#8b5cf6" 
  }
];

const columns = [
  { key: "product", header: "Loan Product" },
  { key: "disbursed", header: "Disbursed Amount (KES)" },
  { key: "outstanding", header: "Outstanding (KES)" },
  { key: "collected", header: "Collected (KES)" },
  { key: "interest", header: "Interest Earned (KES)" },
  { key: "onTime", header: "On-Time Repayment (%)" },
  { key: "defaultRate", header: "Default Rate (%)" }
];

// Prepare chart data
const portionByProduct = loanPerformanceData.map(item => ({
  name: item.product,
  value: item.disbursed,
  color: item.color
}));

const LoanPerformanceReport = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const totalDisbursed = loanPerformanceData.reduce((acc, item) => acc + item.disbursed, 0);
  const totalOutstanding = loanPerformanceData.reduce((acc, item) => acc + item.outstanding, 0);
  const totalInterestEarned = loanPerformanceData.reduce((acc, item) => acc + item.interest, 0);
  
  const weightedDefaultRate = loanPerformanceData.reduce((acc, item) => {
    return acc + (item.defaultRate * item.disbursed / totalDisbursed);
  }, 0).toFixed(2);

  const hasActiveFilters = dateRange !== undefined;

  const handleReset = () => {
    setDateRange(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Loan Performance Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        className="w-full sm:w-auto"
      />
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Loan Performance Report"
      description="Analysis of loan performance by product."
      actions={<ExportButton data={loanPerformanceData} filename="loan-performance-report" columns={columns} />}
      filters={filters}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total Disbursed</h3>
            <p className="stats-value">KES {totalDisbursed.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Total Outstanding</h3>
            <p className="stats-value">KES {totalOutstanding.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{Math.round((totalOutstanding / totalDisbursed) * 100)}% of disbursed amount</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Average Default Rate</h3>
            <p className="stats-value">{weightedDefaultRate}%</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-80">
            <h3 className="text-lg font-semibold mb-2">Disbursed Amount by Product</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portionByProduct}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {portionByProduct.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">Interest Earned: KES {totalInterestEarned.toLocaleString()}</h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Product</TableHead>
                    <TableHead>Interest Earned</TableHead>
                    <TableHead>Default Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loanPerformanceData.map((item) => (
                    <TableRow key={item.product}>
                      <TableCell>{item.product}</TableCell>
                      <TableCell>KES {item.interest.toLocaleString()}</TableCell>
                      <TableCell>{item.defaultRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </ReportPage>
  );
};

export default LoanPerformanceReport;
