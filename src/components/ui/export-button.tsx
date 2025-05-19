
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  columns?: { key: string; header: string }[];
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({ 
  data, 
  filename, 
  columns,
  variant = "outline", 
  size = "sm" 
}: ExportButtonProps) {
  const handleExport = () => {
    exportToCSV(data, `${filename}.csv`, columns);
  };

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleExport}
      className="flex items-center gap-1"
    >
      <Download className="h-4 w-4" />
      <span>Export CSV</span>
    </Button>
  );
}
