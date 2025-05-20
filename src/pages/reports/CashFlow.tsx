
import { useState } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  const yearlyDisbursements = cashFlowData.reduce(
    (acc, month) => acc + month.disbursements, 
    0
  );
  
  const yearlyRepayments = cashFlowData.reduce(
    (acc, month) => acc + month.repayments, 
    0
  );
  
  const yearlyNetCashflow = yearlyRepayments - yearlyDisbursements;

  return (
    <ReportPage
      title="Cash Flow Report"
      description="Monthly analysis of cash inflows and outflows."
      actions={
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
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
          <ExportButton 
            data={cashFlowData} 
            filename={`cash-flow-report-${selectedYear}`} 
            columns={columns} 
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total Disbursements</h3>
            <p className="stats-value">KES {yearlyDisbursements.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Total Repayments</h3>
            <p className="stats-value">KES {yearlyRepayments.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Net Cash Flow</h3>
            <p className={`stats-value ${yearlyNetCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {yearlyNetCashflow.toLocaleString()}
            </p>
          </div>
        </div>
        
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
      </div>
    </ReportPage>
  );
};

export default CashFlowReport;
