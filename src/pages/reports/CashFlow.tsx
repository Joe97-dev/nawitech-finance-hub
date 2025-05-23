import { useState } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";

// Dummy data for monthly cash flow
const cashFlowData = [
  { month: "Jan", disbursements: 2450000, repayments: 1850000, net: -600000 },
  { month: "Feb", disbursements: 2150000, repayments: 1950000, net: -200000 },
  { month: "Mar", disbursements: 1950000, repayments: 2050000, net: 100000 },
  { month: "Apr", disbursements: 2250000, repayments: 2150000, net: -100000 },
  { month: "May", disbursements: 2350000, repayments: 2250000, net: -100000 },
  { month: "Jun", disbursements: 2150000, repayments: 2350000, net: 200000 },
  { month: "Jul", disbursements: 1950000, repayments: 2450000, net: 500000 },
  { month: "Aug", disbursements: 2050000, repayments: 2550000, net: 500000 },
  { month: "Sep", disbursements: 2250000, repayments: 2650000, net: 400000 },
  { month: "Oct", disbursements: 2450000, repayments: 2750000, net: 300000 },
  { month: "Nov", disbursements: 2650000, repayments: 2850000, net: 200000 },
  { month: "Dec", disbursements: 2850000, repayments: 3050000, net: 200000 }
];

const columns = [
  { key: "month", header: "Month" },
  { key: "disbursements", header: "Disbursements (KES)" },
  { key: "repayments", header: "Repayments (KES)" },
  { key: "net", header: "Net Cash Flow (KES)" }
];

const years = ["2025", "2024", "2023"];

const CashFlowReport = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const yearlyDisbursements = cashFlowData.reduce(
    (acc, month) => acc + month.disbursements, 
    0
  );
  
  const yearlyRepayments = cashFlowData.reduce(
    (acc, month) => acc + month.repayments, 
    0
  );
  
  const yearlyNetCashflow = yearlyRepayments - yearlyDisbursements;

  const hasActiveFilters = selectedYear !== "2025" || (dateRange !== undefined);

  const handleReset = () => {
    setSelectedYear("2025");
    setDateRange(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Cash Flow Analysis Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Year
          </label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Cash Flow Report"
      description="Monthly analysis of cash inflows and outflows."
      actions={
        <ExportButton 
          data={cashFlowData} 
          filename={`cash-flow-report-${selectedYear}`} 
          columns={columns} 
        />
      }
      filters={filters}
    >
      <div className="space-y-6">
        <ReportStats>
          <ReportStat 
            label="Total Disbursements" 
            value={`KES ${yearlyDisbursements.toLocaleString()}`}
            className="border-l-4 border-l-red-500"
          />
          <ReportStat 
            label="Total Repayments" 
            value={`KES ${yearlyRepayments.toLocaleString()}`}
            className="border-l-4 border-l-green-500"
          />
          <ReportStat 
            label="Net Cash Flow" 
            value={`KES ${yearlyNetCashflow.toLocaleString()}`}
            className={`border-l-4 ${yearlyNetCashflow >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
          />
        </ReportStats>
        
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Monthly Cash Flow</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cashFlowData}
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
                  <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="disbursements" name="Disbursements" fill="#ef4444" />
                  <Bar dataKey="repayments" name="Repayments" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </ReportPage>
  );
};

export default CashFlowReport;
