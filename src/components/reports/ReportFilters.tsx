
import React, { ReactNode, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ReportFiltersProps {
  children: ReactNode;
  title?: string;
  className?: string;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export const ReportFilters = ({ 
  children, 
  title = "Filters",
  className,
  onReset,
  hasActiveFilters = false
}: ReportFiltersProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className={cn("mb-6 transition-shadow border-muted/40", className, {
      "shadow-md ring-1 ring-primary/10": hasActiveFilters
    })}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-4 border-b border-muted/30">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{title}</h3>
            {hasActiveFilters && (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onReset && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onReset}
                className="text-xs h-8 px-2 hover:text-destructive"
                disabled={!hasActiveFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                {isOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    <span className="text-xs">Hide</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    <span className="text-xs">Show</span>
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="p-4 pt-4 space-y-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
