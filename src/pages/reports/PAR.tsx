
import { useState } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 1), // May 1, 2025
    to: new Date(),
  });

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
          <ExportButton data={data} filename="par-report" columns={columns} />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total Portfolio</h3>
              <p className="mt-2 text-2xl font-semibold">KES 5,250,000</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total at Risk</h3>
              <p className="mt-2 text-2xl font-semibold">KES 1,050,000</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground">PAR Ratio</h3>
              <p className="mt-2 text-2xl font-semibold">20%</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className="h-2.5 rounded-full bg-yellow-400" style={{ width: "20%" }} />
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
          </CardContent>
        </Card>
      </div>
    </ReportPage>
  );
};

export default PARReport;
