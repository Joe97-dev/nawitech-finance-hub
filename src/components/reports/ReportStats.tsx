
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ReportStatProps {
  label: string;
  value: string | number | ReactNode;
  className?: string;
  subValue?: string | number | ReactNode;
}

export const ReportStat = ({ label, value, className = "", subValue }: ReportStatProps) => {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardContent className="pt-6 pb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
        )}
      </CardContent>
    </Card>
  );
};

interface ReportStatsProps {
  children: ReactNode;
  className?: string;
}

export const ReportStats = ({ children, className = "" }: ReportStatsProps) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 ${className}`}>
      {children}
    </div>
  );
};
