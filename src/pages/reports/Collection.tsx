import { useState } from "react";
import { ReportPage } from "./Base";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";

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

// Data by branch
const branchCollectionData = {
  "all": collectionData,
  "head-office": collectionData.map(item => ({...item, expected: item.expected * 0.4, collected: item.collected * 0.4})),
  "westlands": collectionData.map(item => ({...item, expected: item.expected * 0.25, collected: item.collected * 0.25})),
  "mombasa": collectionData.map(item => ({...item, expected: item.expected * 0.15, collected: item.collected * 0.15})),
  "kisumu": collectionData.map(item => ({...item, expected: item.expected * 0.12, collected: item.collected * 0.12})),
  "nakuru": collectionData.map(item => ({...item, expected: item.expected * 0.08, collected: item.collected * 0.08}))
};

const branches = [
  { value: "all", label: "All Branches" },
  { value: "head-office", label: "HEAD OFFICE" },
  { value: "westlands", label: "Westlands Branch" },
  { value: "mombasa", label: "Mombasa Branch" },
  { value: "kisumu", label: "Kisumu Branch" },
  { value: "nakuru", label: "Nakuru Branch" }
];

const years = ["2025", "2024", "2023"];

const columns = [
  { key: "month", header: "Month" },
  { key: "expected", header: "Expected Collection (KES)" },
  { key: "collected", header: "Actual Collection (KES)" },
  { key: "rate", header: "Collection Rate (%)" }
];

const CollectionRateReport = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 0, 1), // Jan 1, 2025
    to: new Date(2025, 11, 31), // Dec 31, 2025
  });
  const [activeView, setActiveView] = useState("chart");
  
  const filteredData = branchCollectionData[selectedBranch as keyof typeof branchCollectionData] || branchCollectionData.all;
  
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
          data={filteredData} 
          filename={`collection-rate-${selectedBranch}-${selectedYear}`} 
          columns={columns}
        />
      }
      filters={filters}
    >
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
                  style={{ width: `${averageRate}%` }}
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
              </TabsContent>
              
              <TabsContent value="table" className="pt-4">
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
                                  style={{ width: `${item.rate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ReportPage>
  );
};

export default CollectionRateReport;
