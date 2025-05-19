
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";

const data = [
  { name: "Current", value: 80, color: "#22c55e" },
  { name: "PAR 1-30", value: 10, color: "#eab308" },
  { name: "PAR 31-60", value: 5, color: "#f97316" },
  { name: "PAR 61-90", value: 3, color: "#ef4444" },
  { name: "PAR 90+", value: 2, color: "#7f1d1d" },
];

const columns = [
  { key: "name", header: "Portfolio Status" },
  { key: "value", header: "Percentage (%)" }
];

const PARReport = () => {
  return (
    <ReportPage
      title="Portfolio at Risk (PAR) Report"
      description="Analysis of loans at different risk levels."
      actions={<ExportButton data={data} filename="par-report" columns={columns} />}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total Portfolio</h3>
            <p className="stats-value">KES 5,250,000</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">Total at Risk</h3>
            <p className="stats-value">KES 1,050,000</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">PAR Ratio</h3>
            <p className="stats-value">20%</p>
          </div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ReportPage>
  );
};

export default PARReport;
