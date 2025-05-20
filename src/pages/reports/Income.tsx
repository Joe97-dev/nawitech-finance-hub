
import { useState } from "react";
import { ReportPage } from "./Base";
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dummy data for monthly income from interest
const monthlyIncomeData = [
  { month: "Jan", interest: 324500, fees: 45000, penalties: 12000, total: 381500 },
  { month: "Feb", interest: 356200, fees: 48500, penalties: 15600, total: 420300 },
  { month: "Mar", interest: 378900, fees: 52000, penalties: 18200, total: 449100 },
  { month: "Apr", interest: 412500, fees: 55000, penalties: 21000, total: 488500 },
  { month: "May", interest: 430800, fees: 58500, penalties: 23500, total: 512800 },
  { month: "Jun", interest: 452100, fees: 62000, penalties: 25800, total: 539900 },
  { month: "Jul", interest: 468700, fees: 64500, penalties: 27200, total: 560400 },
  { month: "Aug", interest: 482300, fees: 67000, penalties: 29500, total: 578800 },
  { month: "Sep", interest: 495800, fees: 69500, penalties: 31000, total: 596300 },
  { month: "Oct", interest: 510200, fees: 72000, penalties: 32500, total: 614700 },
  { month: "Nov", interest: 524500, fees: 74500, penalties: 34000, total: 633000 },
  { month: "Dec", interest: 542000, fees: 78000, penalties: 36000, total: 656000 }
];

const columns = [
  { key: "month", header: "Month" },
  { key: "interest", header: "Interest Income (KES)" },
  { key: "fees", header: "Fees Income (KES)" },
  { key: "penalties", header: "Penalties (KES)" },
  { key: "total", header: "Total Income (KES)" }
];

const years = ["2025", "2024", "2023"];

const IncomeReport = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  
  const yearlyTotal = monthlyIncomeData.reduce(
    (acc, month) => acc + month.total, 
    0
  );
  
  const yearlyInterest = monthlyIncomeData.reduce(
    (acc, month) => acc + month.interest, 
    0
  );
  
  const yearlyFees = monthlyIncomeData.reduce(
    (acc, month) => acc + month.fees, 
    0
  );

  return (
    <ReportPage
      title="Income Report"
      description="Monthly analysis of income from interest, fees, and penalties."
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
            data={monthlyIncomeData} 
            filename={`income-report-${selectedYear}`} 
            columns={columns} 
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total Income</h3>
            <p className="stats-value">KES {yearlyTotal.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Interest Income</h3>
            <p className="stats-value">KES {yearlyInterest.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{Math.round((yearlyInterest / yearlyTotal) * 100)}% of total income</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Fee Income</h3>
            <p className="stats-value">KES {yearlyFees.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{Math.round((yearlyFees / yearlyTotal) * 100)}% of total income</p>
          </div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyIncomeData}
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
              <Line type="monotone" dataKey="interest" name="Interest" stroke="#0ea5e9" strokeWidth={2} />
              <Line type="monotone" dataKey="fees" name="Fees" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="penalties" name="Penalties" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="total" name="Total Income" stroke="#8884d8" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ReportPage>
  );
};

export default IncomeReport;
