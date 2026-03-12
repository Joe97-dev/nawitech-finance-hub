import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smartphone, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

export function MpesaC2BSettings() {
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [credentials, setCredentials] = useState({
    consumer_key: "",
    consumer_secret: "",
    shortcode: "",
    passkey: "",
  });

  const [configured, setConfigured] = useState({
    consumer_key: false,
    consumer_secret: false,
    shortcode: false,
    passkey: false,
  });

  const [masked, setMasked] = useState({
    consumer_key: null as string | null,
    shortcode: null as string | null,
  });

  useEffect(() => {
    checkCredentials();
  }, []);

  const checkCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-manage-credentials", {
        body: { action: "check" },
      });
      if (error) throw error;
      if (data?.configured) setConfigured(data.configured);
      if (data?.masked) setMasked(data.masked);
    } catch (error: any) {
      console.error("Failed to check credentials:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateCredentials = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-manage-credentials", {
        body: {
          action: "validate",
          consumer_key: credentials.consumer_key || undefined,
          consumer_secret: credentials.consumer_secret || undefined,
          environment: "sandbox",
        },
      });
      if (error) throw error;

      if (data?.valid) {
        toast.success("Credentials validated successfully! OAuth token generated.");
      } else {
        toast.error("Validation failed: " + (data?.error || "Invalid credentials"));
      }
    } catch (error: any) {
      toast.error("Validation error: " + error.message);
    } finally {
      setValidating(false);
    }
  };

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

  const allConfigured = configured.consumer_key && configured.consumer_secret && configured.shortcode && configured.passkey;

  return (
    <div className="space-y-4">
      {/* API Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            M-Pesa API Credentials
          </CardTitle>
          <CardDescription>
            Configure your Safaricom Daraja API credentials. These are stored securely as encrypted secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "consumer_key" as const, label: "Consumer Key" },
                  { key: "consumer_secret" as const, label: "Consumer Secret" },
                  { key: "shortcode" as const, label: "Shortcode" },
                  { key: "passkey" as const, label: "Passkey" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2 rounded-md border p-2">
                    {configured[key] ? (
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{label}</span>
                  </div>
                ))}
              </div>

              {/* Masked current values */}
              {masked.consumer_key && (
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p><strong>Current Consumer Key:</strong> <code className="text-xs">{masked.consumer_key}</code></p>
                  {masked.shortcode && <p><strong>Current Shortcode:</strong> <code className="text-xs">{masked.shortcode}</code></p>}
                </div>
              )}

              {/* Update credentials form */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Update Credentials</h4>
                <p className="text-xs text-muted-foreground">
                  To update credentials, add them in your Supabase project's Edge Function secrets. The secrets required are:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Consumer Key</Label>
                    <Input
                      placeholder={configured.consumer_key ? "••••••••" : "Enter Consumer Key"}
                      value={credentials.consumer_key}
                      onChange={(e) => setCredentials((p) => ({ ...p, consumer_key: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Consumer Secret</Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? "text" : "password"}
                        placeholder={configured.consumer_secret ? "••••••••" : "Enter Consumer Secret"}
                        value={credentials.consumer_secret}
                        onChange={(e) => setCredentials((p) => ({ ...p, consumer_secret: e.target.value }))}
                        className="text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={validateCredentials}
                    disabled={validating || (!credentials.consumer_key && !configured.consumer_key)}
                  >
                    {validating ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      "Validate Credentials"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: To permanently save credentials, add them as secrets in your{" "}
                  <a
                    href="https://supabase.com/dashboard/project/stleylfmcokqartpldpg/settings/functions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Supabase Edge Function settings
                  </a>.
                  The validate button tests credentials without saving them.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* C2B Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            C2B Paybill Integration
          </CardTitle>
          <CardDescription>
            Customer-to-Business payment integration via Safaricom Daraja API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium">How it works</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Customer dials M-Pesa and selects <strong>Lipa na M-Pesa → Pay Bill</strong></li>
              <li>Enters the <strong>Paybill Number</strong> (Business Short Code)</li>
              <li>Enters the <strong>Account Number</strong> — the client's <strong>ID Number</strong></li>
              <li>Enters the <strong>Amount</strong> and confirms payment</li>
              <li>System automatically matches payment to client and applies it to their active loan</li>
            </ol>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">C2B URL Registration</h4>
                <p className="text-sm text-muted-foreground">
                  Register validation and confirmation URLs with Safaricom.
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
            <Button onClick={registerC2BUrls} disabled={registering || !allConfigured}>
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
            {!allConfigured && (
              <p className="text-xs text-destructive">All API credentials must be configured before registering URLs.</p>
            )}
          </div>

          {result && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium text-sm">Registration Result</h4>
              {result.success ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Validation URL:</strong> <span className="break-all">{result.urls?.validationUrl}</span></p>
                  <p><strong>Confirmation URL:</strong> <span className="break-all">{result.urls?.confirmationUrl}</span></p>
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
              <li>• Payments matched using client's <strong>ID Number</strong> as account reference</li>
              <li>• Applied automatically to oldest unpaid loan installment</li>
              <li>• Overpayments deposited into client's account balance</li>
              <li>• If no active loan, full amount goes to client account</li>
              <li>• All transactions appear in loan transactions and reports</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
