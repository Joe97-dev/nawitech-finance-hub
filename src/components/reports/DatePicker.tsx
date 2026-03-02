
import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronDown, Check } from "lucide-react";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  align = "start",
  side = "bottom",
}: DatePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [internalDate, setInternalDate] = useState<Date | undefined>(date);

  const handleSelect = (selectedDate: Date | undefined) => {
    setInternalDate(selectedDate);
  };

  const handleConfirm = () => {
    onDateChange(internalDate);
    setIsCalendarOpen(false);
  };

  const handleCancel = () => {
    setInternalDate(date);
    setIsCalendarOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal border-dashed hover:bg-muted/30",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "LLL dd, y") : <span>{placeholder}</span>}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align={align} side={side} sideOffset={4} avoidCollisions>
          <div className="border-b border-border/20 p-3">
            <h3 className="text-sm font-medium">{placeholder}</h3>
            <p className="text-xs text-muted-foreground pt-1">
              Choose a date for your report
            </p>
          </div>
          <Calendar
            mode="single"
            selected={internalDate}
            onSelect={handleSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
          <div className="flex items-center justify-end gap-2 p-3 border-t border-border/20">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
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
