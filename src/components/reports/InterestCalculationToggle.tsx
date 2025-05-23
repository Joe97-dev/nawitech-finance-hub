
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface InterestCalculationToggleProps {
  value: "monthly" | "annually";
  onChange: (value: "monthly" | "annually") => void;
  className?: string;
}

export function InterestCalculationToggle({
  value,
  onChange,
  className = "",
}: InterestCalculationToggleProps) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-1.5 block">Interest Calculation</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as "monthly" | "annually")}
        className="flex items-center space-x-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="monthly" id="option-monthly" />
          <Label htmlFor="option-monthly" className="cursor-pointer">Monthly</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="annually" id="option-annually" />
          <Label htmlFor="option-annually" className="cursor-pointer">Annually</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
