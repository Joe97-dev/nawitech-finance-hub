
import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function ReportCard({
  title,
  description,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  children,
  footer
}: ReportCardProps) {
  return (
    <Card className={cn("shadow-sm overflow-hidden", className)}>
      {(title || description) && (
        <CardHeader className={cn("pb-3", headerClassName)}>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn("pt-3", contentClassName)}>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className={cn("pt-0 border-t bg-muted/20", footerClassName)}>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
