
import { PropsWithChildren, ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ReportPageProps {
  title: string;
  description: string;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
}

export const ReportPage = ({ 
  title, 
  description, 
  actions, 
  filters, 
  className,
  children 
}: PropsWithChildren<ReportPageProps>) => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className={cn("space-y-6 animate-fade-in", className)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="h-10 w-10 rounded-full p-0 border-dashed shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Dashboard</span>
              </Button>
              
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{description}</p>
              </div>
            </div>
            
            {actions && (
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                {actions}
              </div>
            )}
          </div>

          {filters}
        </div>
        
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportPage;
