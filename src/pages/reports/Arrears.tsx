
import { useState } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";

const data = [
  { category: "1-7 days", amount: 24500 },
  { category: "8-14 days", amount: 18200 },
  { category: "15-30 days", amount: 12000 },
  { category: "31-60 days", amount: 9000 },
  { category: "61-90 days", amount: 4500 },
  { category: "90+ days", amount: 2000 },
];

const columns = [
  { key: "category", header: "Days Past Due" },
  { key: "amount", header: "Amount in Arrears (KES)" }
];

const ArrearsReport = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 1), // May 1, 2025
    to: new Date(),
  });
  
  const filters = (
    <ReportFilters title="Arrears Analysis Filters">
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis Period</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal",
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
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Arrears Report"
      description="Analysis of loans in arrears by time period."
      actions={
        <ExportButton data={data} filename="arrears-report" columns={columns} />
      }
      filters={filters}
    >
      <div className="space-y-6">
        <ReportStats>
          <ReportStat 
            label="Total in Arrears" 
            value="KES 70,200"
          />
          <ReportStat 
            label="PAR 30" 
            value="5.2%"
            subValue={
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className="h-2.5 rounded-full bg-yellow-400" style={{ width: "5.2%" }} />
              </div>
            }
          />
          <ReportStat 
            label="PAR 90" 
            value="1.8%"
            subValue={
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className="h-2.5 rounded-full bg-green-600" style={{ width: "1.8%" }} />
              </div>
            }
          />
        </ReportStats>
        
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Arrears Breakdown</h3>
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
                  <Bar dataKey="amount" name="Amount in Arrears" fill="#9b87f5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </ReportPage>
  );
};

export default ArrearsReport;
