
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange, ChevronDown, Check } from "lucide-react";

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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [internalDateRange, setInternalDateRange] = useState<DateRange | undefined>(dateRange);

  useEffect(() => {
    setInternalDateRange(dateRange);
  }, [dateRange]);

  const handleSelect = (range: DateRange | undefined) => {
    setInternalDateRange(range);
  };

  const handleConfirm = () => {
    onDateRangeChange(internalDateRange);
    setIsCalendarOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal border-dashed hover:bg-muted/30",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarRange className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Select date range</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align} side={side}>
          <div className="border-b border-border/20 p-3">
            <h3 className="text-sm font-medium">Select date range</h3>
            <p className="text-xs text-muted-foreground pt-1">
              Choose start and end dates for the report
            </p>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={internalDateRange?.from}
            selected={internalDateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
          <div className="flex items-center justify-end gap-2 p-3 border-t border-border/20">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCalendarOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} className="gap-1">
              <Check className="h-4 w-4" />
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
