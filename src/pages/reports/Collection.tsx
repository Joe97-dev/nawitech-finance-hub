import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { DateRange } from "react-day-picker";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";

interface CollectionData {
  month: string;
  expected: number;
  collected: number;
  rate: number;
}

const columns = [
  { key: "month", header: "Month" },
  { key: "expected", header: "Expected Collection (KES)" },
  { key: "collected", header: "Actual Collection (KES)" },
  { key: "rate", header: "Collection Rate (%)" }
];

const CollectionRateReport = () => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(currentYear, 0, 1),
    to: new Date(currentYear, 11, 31),
  });
  const [activeView, setActiveView] = useState("chart");
  const [collectionData, setCollectionData] = useState<CollectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollectionData();
  }, [date]);

  const fetchCollectionData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      const startDate = date?.from || new Date(currentYear, 0, 1);
      const endDate = date?.to || new Date(currentYear, 11, 31);

      const formatLocal = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const fromStr = formatLocal(startDate);
      const toStr = formatLocal(endDate);

      // Use loan_schedule as the single source of truth:
      // total_due = expected, amount_paid = collected
      const { data: schedules, error } = await supabase
        .from('loan_schedule')
        .select('total_due, due_date, amount_paid')
        .eq('organization_id', orgId)
        .gte('due_date', fromStr)
        .lte('due_date', toStr);

      if (error) throw error;

      // Group by month
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData: Record<string, { expected: number; collected: number }> = {};
      months.forEach(month => {
        monthlyData[month] = { expected: 0, collected: 0 };
      });

      (schedules || []).forEach(s => {
        const month = months[new Date(s.due_date).getMonth()];
        monthlyData[month].expected += Number(s.total_due);
        monthlyData[month].collected += Number(s.amount_paid || 0);
      });

      const chartData: CollectionData[] = months.map(month => {
        const expected = monthlyData[month].expected;
        const collected = monthlyData[month].collected;
        const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
        return { month, expected, collected, rate };
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

  const filteredData = collectionData;

  const totalExpected = filteredData.reduce((acc, m) => acc + m.expected, 0);
  const totalCollected = filteredData.reduce((acc, m) => acc + m.collected, 0);
  const averageRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const hasActiveFilters = date !== undefined;

  const handleReset = () => {
    setDate({
      from: new Date(currentYear, 0, 1),
      to: new Date(currentYear, 11, 31),
    });
  };

  const filters = (
    <ReportFilters
      title="Collection Rate Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <DateRangePicker
          dateRange={date}
          onDateRangeChange={setDate}
          className="col-span-2"
        />
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
          filename="collection-rate-report"
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
                <div className="w-full bg-muted rounded-full h-2.5 mt-2">
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
                  {filteredData.every(d => d.expected === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No collection data found for the selected period
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: number, name: string) =>
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
                  {filteredData.every(d => d.expected === 0) ? (
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
                                  <div className="w-16 bg-muted rounded-full h-1.5">
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
