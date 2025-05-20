
import { useState } from "react";
import { ReportPage } from "./Base";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";

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

  return (
    <ReportPage
      title="Collection Rate Report"
      description="Analysis of monthly loan collection performance."
      actions={
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal w-full sm:w-auto",
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
              />
            </PopoverContent>
          </Popover>
          
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-32">
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
          
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full sm:w-48">
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
          
          <ExportButton 
            data={filteredData} 
            filename={`collection-rate-${selectedBranch}-${selectedYear}${date?.from ? '-' + format(date.from, 'yyyy-MM-dd') : ''}${date?.to ? '-to-' + format(date.to, 'yyyy-MM-dd') : ''}` } 
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
