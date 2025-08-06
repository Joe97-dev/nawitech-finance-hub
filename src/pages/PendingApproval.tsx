import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PendingApproval = () => {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle>Account Pending Approval</CardTitle>
          <CardDescription>
            Your account is currently under review by our administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Thank you for registering with Superdon Microfinance. Your account has been created successfully, 
              but it requires approval from our administrators before you can access the system.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-2">What happens next?</p>
              <ul className="text-blue-800 text-left space-y-1">
                <li>• Our administrators will review your registration</li>
                <li>• You will be notified once your account is approved</li>
                <li>• This process typically takes 1-2 business days</li>
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

export default PendingApproval;