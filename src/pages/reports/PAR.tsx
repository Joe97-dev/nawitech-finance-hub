import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { format } from "date-fns";

interface PARData {
  name: string;
  value: number;
  color: string;
}

interface PortfolioAnalysis {
  id: string;
  date: string;
  current_percentage: number;
  par_1_30_percentage: number;
  par_31_60_percentage: number;
  par_61_90_percentage: number;
  par_90_plus_percentage: number;
  total_portfolio: number;
  amount_at_risk: number;
}

const PARReport = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    to: new Date(),
  });
  const [parData, setParData] = useState<PARData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [parRatio, setParRatio] = useState(0);

  const columns = [
    { key: "name", header: "Portfolio Status" },
    { key: "value", header: "Percentage (%)" }
  ];

  useEffect(() => {
    fetchPARData();
  }, [date]);

  const fetchPARData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_portfolio_analysis')
        .select('*')
        .gte('date', date?.from ? format(date.from, 'yyyy-MM-dd') : '')
        .lte('date', date?.to ? format(date.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      // Process the data to get PAR metrics
      if (data && data.length > 0) {
        // Get the most recent analysis
        const latestAnalysis = data[0] as PortfolioAnalysis;
        
        // Create data for the pie chart
        const processedData: PARData[] = [
          { name: "Current", value: latestAnalysis.current_percentage, color: "#22c55e" },
          { name: "PAR 1-30", value: latestAnalysis.par_1_30_percentage, color: "#eab308" },
          { name: "PAR 31-60", value: latestAnalysis.par_31_60_percentage, color: "#f97316" },
          { name: "PAR 61-90", value: latestAnalysis.par_61_90_percentage, color: "#ef4444" },
          { name: "PAR 90+", value: latestAnalysis.par_90_plus_percentage, color: "#7f1d1d" },
        ];

        setParData(processedData);
        
        // Set totals from the database
        setTotalPortfolio(latestAnalysis.total_portfolio);
        setTotalAtRisk(latestAnalysis.amount_at_risk);
        setParRatio(Math.round((latestAnalysis.amount_at_risk / latestAnalysis.total_portfolio) * 100));
      } else {
        // If no data, set defaults
        setParData([
          { name: "Current", value: 100, color: "#22c55e" },
        ]);
        setTotalPortfolio(0);
        setTotalAtRisk(0);
        setParRatio(0);
      }
    } catch (error: any) {
      console.error("Error fetching PAR data:", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch PAR data",
        description: error.message || "An error occurred"
      });
      
      // Set fallback data
      setParData([
        { name: "Current", value: 100, color: "#22c55e" },
      ]);
      setTotalPortfolio(0);
      setTotalAtRisk(0);
      setParRatio(0);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = date !== undefined;

  const handleReset = () => {
    setDate(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Portfolio Analysis Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker
        dateRange={date}
        onDateRangeChange={setDate}
        className="w-full sm:w-auto"
      />
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Portfolio at Risk (PAR) Report"
      description="Analysis of loans at different risk levels."
      actions={
        <ExportButton 
          data={parData} 
          filename="par-report" 
          columns={columns} 
        />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Loading PAR data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat 
              label="Total Portfolio" 
              value={`KES ${totalPortfolio.toLocaleString()}`}
            />
            <ReportStat 
              label="Total at Risk" 
              value={`KES ${totalAtRisk.toLocaleString()}`}
            />
            <ReportStat 
              label="PAR Ratio" 
              value={`${parRatio}%`}
              subValue={
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className={`h-2.5 rounded-full ${
                      parRatio > 10 ? 'bg-red-500' : 'bg-yellow-400'
                    }`} 
                    style={{ width: `${parRatio}%` }} 
                  />
                </div>
              }
            />
          </ReportStats>
          
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={parData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {parData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default PARReport;
