
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { category: "1-7 days", amount: 24500 },
  { category: "8-14 days", amount: 18200 },
  { category: "15-30 days", amount: 12000 },
  { category: "31-60 days", amount: 9000 },
  { category: "61-90 days", amount: 4500 },
  { category: "90+ days", amount: 2000 },
];

const ArrearsReport = () => {
  return (
    <ReportPage
      title="Arrears Report"
      description="Analysis of loans in arrears by time period."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stats-card">
            <h3 className="stats-label">Total in Arrears</h3>
            <p className="stats-value">KES 70,200</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">PAR 30</h3>
            <p className="stats-value">5.2%</p>
          </div>
          <div className="stats-card">
            <h3 className="stats-label">PAR 90</h3>
            <p className="stats-value">1.8%</p>
          </div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
              <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="amount" name="Amount in Arrears" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ReportPage>
  );
};

export default ArrearsReport;
