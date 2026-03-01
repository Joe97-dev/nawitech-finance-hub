import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, FileUp, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const CSV_TEMPLATE_HEADERS = [
  "first_name",
  "last_name",
  "phone",
  "id_number",
  "email",
  "gender",
  "date_of_birth",
  "marital_status",
  "address",
  "city",
  "region",
  "occupation",
  "employment_status",
  "monthly_income",
];

const CSV_SAMPLE_ROW = [
  "Jane",
  "Doe",
  "0712345678",
  "12345678",
  "jane@example.com",
  "female",
  "1990-01-15",
  "single",
  "123 Main St",
  "Nairobi",
  "Nairobi",
  "Business Owner",
  "self-employed",
  "50000",
];

export function ImportClientsDialog({ open, onOpenChange, onImportComplete }: ImportClientsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      CSV_SAMPLE_ROW.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n").filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ""));

    return lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ""));
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        record[header] = values[i] || "";
      });
      return record;
    }).filter(r => Object.values(r).some(v => v.length > 0));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith(".csv")) {
        toast({ variant: "destructive", title: "Invalid file", description: "Please upload a CSV file." });
        return;
      }
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      const text = await file.text();
      const records = parseCSV(text);

      if (records.length === 0) {
        toast({ variant: "destructive", title: "Empty file", description: "No valid records found in the CSV file." });
        setImporting(false);
        return;
      }

      let success = 0;
      let failed = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];

        const firstName = r.first_name || r.First_Name || r.FirstName || "";
        const lastName = r.last_name || r.Last_Name || r.LastName || "";
        const phone = r.phone || r.Phone || r.mobile || "";
        const idNumber = r.id_number || r.ID_Number || r.IdNumber || "";

        if (!firstName || !lastName || !phone || !idNumber) {
          failed++;
          errors.push({ row: i + 2, message: "Missing required field (first_name, last_name, phone, or id_number)" });
          setProgress(Math.round(((i + 1) / records.length) * 100));
          continue;
        }

        const clientData = {
          first_name: firstName,
          last_name: lastName,
          phone,
          id_number: idNumber,
          email: r.email || r.Email || null,
          gender: r.gender || r.Gender || null,
          date_of_birth: r.date_of_birth || r.Date_of_Birth || r.dob || null,
          marital_status: r.marital_status || r.Marital_Status || null,
          address: r.address || r.Address || null,
          city: r.city || r.City || null,
          region: r.region || r.Region || null,
          occupation: r.occupation || r.Occupation || null,
          employment_status: r.employment_status || r.Employment_Status || null,
          monthly_income: (() => {
            const val = r.monthly_income || r.Monthly_Income || "";
            const parsed = parseFloat(val.replace(/[^\d.-]/g, ""));
            return isNaN(parsed) ? null : parsed;
          })(),
          status: "pending",
        };

        const { error } = await supabase.from("clients").insert(clientData);

        if (error) {
          failed++;
          errors.push({ row: i + 2, message: error.message });
        } else {
          success++;
        }

        setProgress(Math.round(((i + 1) / records.length) * 100));
      }

      setResult({ total: records.length, success, failed, errors: errors.slice(0, 20) });

      if (success > 0) {
        onImportComplete();
        toast({
          title: "Import complete",
          description: `${success} client(s) imported successfully${failed > 0 ? `, ${failed} failed` : ""}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Import failed",
          description: "No clients were imported. Check the error details below.",
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import error", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setResult(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Clients</DialogTitle>
          <DialogDescription>
            Download the CSV template, fill in client data, then upload the file to import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-medium">Step 1: Download Template</h4>
            <p className="text-xs text-muted-foreground">
              Get the CSV template with the correct column headers. Fill in your client data and save as CSV.
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Step 2: Upload File */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-medium">Step 2: Upload CSV File</h4>
            <p className="text-xs text-muted-foreground">
              Required columns: <strong>first_name, last_name, phone, id_number</strong>. Other columns are optional.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                {!importing && (
                  <Button variant="ghost" size="sm" onClick={() => { setFile(null); setResult(null); }}>
                    Change
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importing clients...</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="text-sm font-medium">Import Results</h4>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{result.success} imported</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span>{result.failed} failed</span>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs space-y-1 mt-2">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-destructive">Row {err.row}: {err.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
