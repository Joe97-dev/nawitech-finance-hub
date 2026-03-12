import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smartphone, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export function MpesaC2BSettings() {
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [result, setResult] = useState<any>(null);

  const registerC2BUrls = async () => {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-c2b-register");

      if (error) throw error;

      if (data?.success) {
        setRegistered(true);
        setResult(data);
        toast.success("C2B URLs registered with Safaricom successfully");
      } else {
        throw new Error(data?.error || "Registration failed");
      }
    } catch (error: any) {
      toast.error("Failed to register C2B URLs: " + error.message);
      setResult({ error: error.message });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          M-Pesa C2B Integration
        </CardTitle>
        <CardDescription>
          Customer-to-Business Paybill payment integration via Safaricom Daraja API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-medium">How it works</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Customer dials M-Pesa on their phone and selects <strong>Lipa na M-Pesa → Pay Bill</strong></li>
            <li>Enters the <strong>Paybill Number</strong> (Business Short Code)</li>
            <li>Enters the <strong>Account Number</strong> — this must be the client's <strong>ID Number</strong></li>
            <li>Enters the <strong>Amount</strong> and confirms payment</li>
            <li>The system automatically matches the payment to the client and applies it to their active loan</li>
          </ol>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">C2B URL Registration</h4>
              <p className="text-sm text-muted-foreground">
                Register validation and confirmation URLs with Safaricom to start receiving payments.
              </p>
            </div>
            {registered ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Registered
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Registered
              </Badge>
            )}
          </div>
          <Button onClick={registerC2BUrls} disabled={registering}>
            {registering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : registered ? (
              "Re-register URLs"
            ) : (
              "Register C2B URLs"
            )}
          </Button>
        </div>

        {result && (
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="font-medium text-sm">Registration Result</h4>
            {result.success ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><strong>Validation URL:</strong> {result.urls?.validationUrl}</p>
                <p><strong>Confirmation URL:</strong> {result.urls?.confirmationUrl}</p>
                <p><strong>Response:</strong> {JSON.stringify(result.data)}</p>
              </div>
            ) : (
              <p className="text-sm text-destructive">{result.error}</p>
            )}
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-2">
          <h4 className="font-medium text-sm">Payment Processing</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Payments are matched using the client's <strong>ID Number</strong> as the account reference</li>
            <li>• Applied automatically to the client's oldest unpaid loan installment</li>
            <li>• Overpayments are deposited into the client's account balance</li>
            <li>• If no active loan exists, the full amount goes to the client's account</li>
            <li>• All transactions appear in loan transactions and reports</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
