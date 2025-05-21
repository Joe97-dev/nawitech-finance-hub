
import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
        const latestAnalysis: PortfolioAnalysis = data[0];
        
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

  return (
    <ReportPage
      title="Portfolio at Risk (PAR) Report"
      description="Analysis of loans at different risk levels."
      actions={
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal",
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
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <ExportButton data={parData} filename="par-report" columns={columns} />
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Loading PAR data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Portfolio</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalPortfolio.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total at Risk</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalAtRisk.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">PAR Ratio</h3>
                <p className="mt-2 text-2xl font-semibold">{parRatio}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className={`h-2.5 rounded-full ${
                      parRatio > 10 ? 'bg-red-500' : 'bg-yellow-400'
                    }`} 
                    style={{ width: `${parRatio}%` }} 
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
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
