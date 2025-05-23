
import { PropsWithChildren, ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ReportPageProps {
  title: string;
  description: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

export const ReportPage = ({ title, description, actions, filters, children }: PropsWithChildren<ReportPageProps>) => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
              </div>
            </div>
            {actions && (
              <div className="flex items-center gap-2">
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
