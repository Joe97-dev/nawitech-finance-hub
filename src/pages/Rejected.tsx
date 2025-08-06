import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, Mail, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Rejected = () => {
  const { logout, user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    const fetchRejectionReason = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_approvals')
          .select('rejection_reason')
          .eq('user_id', user.id)
          .eq('status', 'rejected')
          .single();

        if (!error && data) {
          setRejectionReason(data.rejection_reason);
        }
      } catch (error) {
        console.error('Error fetching rejection reason:', error);
      }
    };

    fetchRejectionReason();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Account Registration Rejected</CardTitle>
          <CardDescription>
            Unfortunately, your account registration has been rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Your registration for Superdon Microfinance has been reviewed by our administrators 
              and was not approved at this time.
            </p>
            
            {rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm mb-4">
                <p className="font-medium text-red-900 mb-2">Reason for rejection:</p>
                <p className="text-red-800">{rejectionReason}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-2">What can you do?</p>
              <ul className="text-blue-800 text-left space-y-1">
                <li>• Contact our support team for more information</li>
                <li>• Address any issues mentioned in the rejection reason</li>
                <li>• You may reapply after resolving any concerns</li>
              </ul>
            </div>

            {user?.email && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Registered email: <span className="font-medium">{user.email}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 mb-2">Need help?</p>
              <div className="flex justify-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  support@superdon.com
                </div>
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-1" />
                  +254 123 456 789
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Rejected;