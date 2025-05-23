
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportStatProps {
  label: string;
  value: string | number | ReactNode;
  className?: string;
  subValue?: string | number | ReactNode;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export const ReportStat = ({ 
  label, 
  value, 
  className = "", 
  subValue,
  icon,
  trend,
  trendValue
}: ReportStatProps) => {
  return (
    <Card className={cn("shadow-sm border-muted/40 overflow-hidden transition-all hover:shadow-md", className)}>
      <CardContent className="pt-6 pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            <div className="flex items-center gap-1">
              {typeof value === "string" || typeof value === "number" ? (
                <p className="text-2xl font-semibold">{value}</p>
              ) : (
                value
              )}
            </div>
            
            {subValue && (
              <div className="text-xs text-muted-foreground">{subValue}</div>
            )}

            {trend && trendValue && (
              <div className="flex items-center mt-1">
                {trend === "up" ? (
                  <span className="text-green-500 text-xs flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3 h-3 mr-1"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.919z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {trendValue}
                  </span>
                ) : trend === "down" ? (
                  <span className="text-red-500 text-xs flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3 h-3 mr-1"
                    >
                      <path
                        fillRule="evenodd"
                        d="M1.22 5.222a.75.75 0 011.06 0L7 9.942l3.768-3.769a.75.75 0 011.113.058 20.908 20.908 0 013.813 7.254l1.574-2.727a.75.75 0 011.3.75l-2.475 4.286a.75.75 0 01-1.025.275l-4.287-2.475a.75.75 0 01.75-1.3l2.71 1.565a19.422 19.422 0 00-3.013-6.024L7.53 11.533a.75.75 0 01-1.06 0l-5.25-5.25a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {trendValue}
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3 h-3 mr-1"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              {icon}
            </div>
          )}
        </div>
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
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 mb-6", className)}>
      {children}
    </div>
  );
};
