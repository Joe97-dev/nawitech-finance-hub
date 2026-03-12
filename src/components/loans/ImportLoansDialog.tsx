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
import { getOrganizationId } from "@/lib/get-organization-id";
import { Download, Upload, FileUp, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ImportLoansDialogProps {
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
  "client_number",
  "id_number",
  "loan_type",
  "amount",
  "interest_rate",
  "term_months",
  "frequency",
  "disbursement_date",
  "status",
  "balance",
];

const CSV_SAMPLE_ROW = [
  "CL00001",
  "12345678",
  "Business",
  "50000",
  "15",
  "12",
  "monthly",
  "2025-01-15",
  "active",
  "45000",
];

export function ImportLoansDialog({ open, onOpenChange, onImportComplete }: ImportLoansDialogProps) {
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
    link.download = "loan_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n").filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, "").toLowerCase());

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

  const findClient = (
    record: Record<string, string>,
    clientsByNumber: Map<string, { id: string; first_name: string; last_name: string }>,
    clientsByIdNumber: Map<string, { id: string; first_name: string; last_name: string }>
  ) => {
    const clientNumber = record.client_number || record.clientnumber || record.client_no || "";
    const idNumber = record.id_number || record.idnumber || record.id_no || "";

    if (clientNumber && clientsByNumber.has(clientNumber.toUpperCase())) {
      return clientsByNumber.get(clientNumber.toUpperCase())!;
    }
    if (idNumber && clientsByIdNumber.has(idNumber)) {
      return clientsByIdNumber.get(idNumber)!;
    }
    return null;
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

      const organizationId = await getOrganizationId();

      // Pre-fetch all clients for this organization for matching
      const { data: allClients, error: clientsError } = await supabase
        .from("clients")
        .select("id, first_name, last_name, client_number, id_number")
        .eq("organization_id", organizationId);

      if (clientsError) throw clientsError;

      const clientsByNumber = new Map<string, { id: string; first_name: string; last_name: string }>();
      const clientsByIdNumber = new Map<string, { id: string; first_name: string; last_name: string }>();

      (allClients || []).forEach(c => {
        if (c.client_number) clientsByNumber.set(c.client_number.toUpperCase(), c);
        if (c.id_number) clientsByIdNumber.set(c.id_number, c);
      });

      let success = 0;
      let failed = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];

        // Find the client
        const client = findClient(r, clientsByNumber, clientsByIdNumber);
        if (!client) {
          failed++;
          errors.push({
            row: i + 2,
            message: `Client not found. Provide a valid client_number or id_number. Got: "${r.client_number || r.clientnumber || ""}" / "${r.id_number || r.idnumber || ""}"`,
          });
          setProgress(Math.round(((i + 1) / records.length) * 100));
          continue;
        }

        const amount = parseFloat((r.amount || "0").replace(/[^\d.-]/g, ""));
        const interestRate = parseFloat(r.interest_rate || r.interestrate || "15");
        const termMonths = parseInt(r.term_months || r.termmonths || r.term || "12");
        const frequency = r.frequency || r.repayment_frequency || "monthly";
        const loanType = r.loan_type || r.loantype || r.type || "Business";
        const disbursementDate = r.disbursement_date || r.disbursementdate || r.date || new Date().toISOString().slice(0, 10);
        const status = r.status || "active";

        if (!amount || isNaN(amount) || amount <= 0) {
          failed++;
          errors.push({ row: i + 2, message: "Invalid or missing loan amount" });
          setProgress(Math.round(((i + 1) / records.length) * 100));
          continue;
        }

        // Calculate balance: use provided balance, otherwise calculate from amount + interest
        let balance: number;
        const providedBalance = parseFloat((r.balance || "").replace(/[^\d.-]/g, ""));
        if (!isNaN(providedBalance) && providedBalance > 0) {
          balance = providedBalance;
        } else {
          // Default: flat interest calculation (annual)
          const totalInterest = (amount * interestRate / 100) * (termMonths / 12);
          balance = amount + totalInterest;
        }

        const clientName = `${client.first_name} ${client.last_name}`;

        const loanData: any = {
          client: clientName,
          amount,
          balance,
          type: loanType,
          status,
          date: disbursementDate,
          frequency,
          term_months: termMonths,
          interest_rate: interestRate,
          organization_id: organizationId,
        };

        const { data: loan, error: loanError } = await supabase
          .from("loans")
          .insert(loanData)
          .select()
          .single();

        if (loanError) {
          failed++;
          errors.push({ row: i + 2, message: loanError.message });
        } else {
          // Generate loan schedule
          try {
            await supabase.rpc("generate_loan_schedule", {
              p_loan_id: loan.id,
              p_amount: amount,
              p_interest_rate: interestRate,
              p_term_months: termMonths,
              p_frequency: frequency,
              p_start_date: disbursementDate,
            });
          } catch (scheduleErr: any) {
            console.error("Schedule generation error for row", i + 2, scheduleErr);
            // Loan was still created, just note the schedule issue
          }
          success++;
        }

        setProgress(Math.round(((i + 1) / records.length) * 100));
      }

      setResult({ total: records.length, success, failed, errors: errors.slice(0, 20) });

      if (success > 0) {
        onImportComplete();
        toast({
          title: "Import complete",
          description: `${success} loan(s) imported successfully${failed > 0 ? `, ${failed} failed` : ""}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Import failed",
          description: "No loans were imported. Check the error details below.",
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
          <DialogTitle>Import Loans</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import loans. Each loan is matched to an existing client by <strong>client_number</strong> or <strong>id_number</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-medium">Step 1: Download Template</h4>
            <p className="text-xs text-muted-foreground">
              Get the CSV template. Fill in loan data ensuring each row has a valid <strong>client_number</strong> or <strong>id_number</strong> matching an existing client.
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
              Required: <strong>client_number</strong> or <strong>id_number</strong> (to match client), <strong>amount</strong>. Optional: loan_type, interest_rate, term_months, frequency, disbursement_date, status, balance.
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
                <span className="text-sm">Importing loans...</span>
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
