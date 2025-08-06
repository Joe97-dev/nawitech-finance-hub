import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CollectionData {
  month: string;
  expected: number;
  collected: number;
  rate: number;
}

const years = ["2025", "2024", "2023"];

const columns = [
  { key: "month", header: "Month" },
  { key: "expected", header: "Expected Collection (KES)" },
  { key: "collected", header: "Actual Collection (KES)" },
  { key: "rate", header: "Collection Rate (%)" }
];

const CollectionRateReport = () => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 0, 1), // Jan 1, 2025
    to: new Date(2025, 11, 31), // Dec 31, 2025
  });
  const [activeView, setActiveView] = useState("chart");
  const [collectionData, setCollectionData] = useState<CollectionData[]>([]);
  const [branches, setBranches] = useState([{ value: "all", label: "All Branches" }]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name')
          .order('name');

        if (error) throw error;
        
        const branchOptions = [
          { value: "all", label: "All Branches" },
          ...(data || []).map(branch => ({ 
            value: branch.id, 
            label: branch.name 
          }))
        ];
        
        setBranches(branchOptions);
      } catch (error: any) {
        console.error("Error fetching branches:", error);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchCollectionData = async () => {
      try {
        setLoading(true);
        
        const startDate = date?.from || new Date(parseInt(selectedYear), 0, 1);
        const endDate = date?.to || new Date(parseInt(selectedYear), 11, 31);
        
        // Get expected amounts from loan schedule
        let scheduleQuery = supabase
          .from('loan_schedule')
          .select('total_due, due_date, amount_paid')
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0]);

        // Get actual payments from transactions
        let transactionQuery = supabase
          .from('loan_transactions')
          .select('amount, transaction_date')
          .eq('transaction_type', 'payment')
          .gte('transaction_date', startDate.toISOString())
          .lte('transaction_date', endDate.toISOString());

        const [scheduleResult, transactionResult] = await Promise.all([
          scheduleQuery,
          transactionQuery
        ]);

        if (scheduleResult.error) throw scheduleResult.error;
        if (transactionResult.error) throw transactionResult.error;

        // Group by month
        const monthlyData: Record<string, { expected: number; collected: number }> = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize all months
        months.forEach(month => {
          monthlyData[month] = { expected: 0, collected: 0 };
        });

        // Process expected amounts
        scheduleResult.data?.forEach(schedule => {
          const month = months[new Date(schedule.due_date).getMonth()];
          monthlyData[month].expected += Number(schedule.total_due);
          monthlyData[month].collected += Number(schedule.amount_paid || 0);
        });

        // Process actual payments
        transactionResult.data?.forEach(transaction => {
          const month = months[new Date(transaction.transaction_date).getMonth()];
          monthlyData[month].collected += Number(transaction.amount);
        });

        // Convert to chart format
        const chartData: CollectionData[] = months.map(month => {
          const expected = monthlyData[month].expected;
          const collected = monthlyData[month].collected;
          const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
          
          return {
            month,
            expected,
            collected,
            rate
          };
        });

        setCollectionData(chartData);
      } catch (error: any) {
        console.error("Error fetching collection data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load collection data."
        });
        setCollectionData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionData();
  }, [toast, selectedYear, selectedBranch, date]);
  
  const filteredData = collectionData;
  
  const totalExpected = filteredData.reduce(
    (acc, month) => acc + month.expected, 
    0
  );
  
  const totalCollected = filteredData.reduce(
    (acc, month) => acc + month.collected, 
    0
  );
  
  const averageRate = Math.round((totalCollected / totalExpected) * 100);

  const hasActiveFilters = selectedBranch !== "all" || selectedYear !== "2025" || (date !== undefined);

  const handleReset = () => {
    setSelectedBranch("all");
    setSelectedYear("2025");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Collection Rate Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DateRangePicker
          dateRange={date}
          onDateRangeChange={setDate}
          className="md:col-span-2"
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
        
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Branch
          </label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
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
      title="Collection Rate Report"
      description="Analysis of monthly loan collection performance."
      actions={
        <ExportButton 
          data={filteredData.map(item => ({
            month: item.month,
            expected: item.expected,
            collected: item.collected,
            rate: item.rate
          }))} 
          filename={`collection-rate-${selectedBranch}-${selectedYear}`} 
          columns={columns}
        />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Expected</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalExpected.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Collected</h3>
                <p className="mt-2 text-2xl font-semibold">KES {totalCollected.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Average Collection Rate</h3>
                <p className="mt-2 text-2xl font-semibold">{averageRate}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className={`h-2.5 rounded-full ${
                      averageRate >= 95 ? 'bg-green-600' : 
                      averageRate >= 90 ? 'bg-yellow-400' : 'bg-red-600'
                    }`} 
                    style={{ width: `${Math.min(averageRate, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <Tabs defaultValue="chart" value={activeView} onValueChange={setActiveView} className="mb-4">
                <TabsList>
                  <TabsTrigger value="chart">Chart View</TabsTrigger>
                  <TabsTrigger value="table">Table View</TabsTrigger>
                </TabsList>
                
                <TabsContent value="chart" className="pt-4">
                  {filteredData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No collection data found for the selected period
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filteredData}
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
                          <Area type="monotone" dataKey="expected" name="Expected Collection" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                          <Area type="monotone" dataKey="collected" name="Actual Collection" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="table" className="pt-4">
                  {filteredData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No collection data found for the selected period
                    </div>
                  ) : (
                    <div className="relative w-full overflow-auto">
                      <table className="w-full caption-bottom text-sm">
                        <thead>
                          <tr className="border-b transition-colors hover:bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Month</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Expected (KES)</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Collected (KES)</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rate (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.map((item, index) => (
                            <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                              <td className="p-4 align-middle">{item.month}</td>
                              <td className="p-4 align-middle">{item.expected.toLocaleString()}</td>
                              <td className="p-4 align-middle">{item.collected.toLocaleString()}</td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center">
                                  <span className="mr-2">{item.rate}%</span>
                                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${
                                        item.rate >= 95 ? 'bg-green-600' : 
                                        item.rate >= 90 ? 'bg-yellow-400' : 'bg-red-600'
                                      }`} 
                                      style={{ width: `${Math.min(item.rate, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default CollectionRateReport;
