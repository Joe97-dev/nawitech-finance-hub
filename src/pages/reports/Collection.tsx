
import { useState } from "react";
import { ReportPage } from "./Base";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dummy data for collection rates
const collectionData = [
  { month: "Jan", expected: 2350000, collected: 2185500, rate: 93 },
  { month: "Feb", expected: 2480000, collected: 2331200, rate: 94 },
  { month: "Mar", expected: 2620000, collected: 2489000, rate: 95 },
  { month: "Apr", expected: 2750000, collected: 2557500, rate: 93 },
  { month: "May", expected: 2890000, collected: 2716600, rate: 94 },
  { month: "Jun", expected: 3050000, collected: 2927450, rate: 96 },
  { month: "Jul", expected: 3175000, collected: 3080750, rate: 97 },
  { month: "Aug", expected: 3250000, collected: 3120000, rate: 96 },
  { month: "Sep", expected: 3320000, collected: 3187200, rate: 96 },
  { month: "Oct", expected: 3450000, collected: 3312000, rate: 96 },
  { month: "Nov", expected: 3570000, collected: 3391500, rate: 95 },
  { month: "Dec", expected: 3680000, collected: 3532800, rate: 96 }
];

const columns = [
  { key: "month", header: "Month" },
  { key: "expected", header: "Expected Collection (KES)" },
  { key: "collected", header: "Actual Collection (KES)" },
  { key: "rate", header: "Collection Rate (%)" }
];

const years = ["2025", "2024", "2023"];

const CollectionRateReport = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  
  const totalExpected = collectionData.reduce(
    (acc, month) => acc + month.expected, 
    0
  );
  
  const totalCollected = collectionData.reduce(
    (acc, month) => acc + month.collected, 
    0
  );
  
  const averageRate = Math.round((totalCollected / totalExpected) * 100);

  return (
    <ReportPage
      title="Collection Rate Report"
      description="Analysis of monthly loan collection performance."
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
            data={collectionData} 
            filename={`collection-rate-report-${selectedYear}`} 
            columns={columns} 
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total Expected</h3>
            <p className="stats-value">KES {totalExpected.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Total Collected</h3>
            <p className="stats-value">KES {totalCollected.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Average Collection Rate</h3>
            <p className="stats-value">{averageRate}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className={`h-2.5 rounded-full ${
                  averageRate >= 95 ? 'bg-green-600' : 
                  averageRate >= 90 ? 'bg-yellow-400' : 'bg-red-600'
                }`} 
                style={{ width: `${averageRate}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={collectionData}
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
      </div>
    </ReportPage>
  );
};

export default CollectionRateReport;
