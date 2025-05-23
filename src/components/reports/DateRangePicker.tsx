
import { DateRange } from "react-day-picker";
import { DatePicker } from "./DatePicker";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  align = "start",
  side = "bottom",
}: DateRangePickerProps) {
  const handleStartDateChange = (startDate: Date | undefined) => {
    const newRange: DateRange = {
      from: startDate,
      to: dateRange?.to
    };
    onDateRangeChange(newRange);
  };

  const handleEndDateChange = (endDate: Date | undefined) => {
    const newRange: DateRange = {
      from: dateRange?.from,
      to: endDate
    };
    onDateRangeChange(newRange);
  };

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Start Date
        </label>
        <DatePicker
          date={dateRange?.from}
          onDateChange={handleStartDateChange}
          placeholder="Select start date"
          align={align}
          side={side}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          End Date
        </label>
        <DatePicker
          date={dateRange?.to}
          onDateChange={handleEndDateChange}
          placeholder="Select end date"
          align={align}
          side={side}
        />
      </div>
    </div>
  );
}
