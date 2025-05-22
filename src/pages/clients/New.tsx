
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  id: string;
  name: string;
}

const NewClientPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idNumber: "",
    gender: "",
    dob: "",
    address: "",
    city: "",
    region: "",
    branch_id: "",
    occupation: "",
    employmentStatus: "",
    monthlyIncome: ""
  });
  
  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name');
        
        if (error) {
          throw error;
        }
        
        setBranches(data || []);
      } catch (error: any) {
        console.error("Error fetching branches:", error);
        toast({
          variant: "destructive",
          title: "Failed to load branches",
          description: error.message || "There was an error loading the branch list."
        });
      }
    };

    fetchBranches();
  }, [toast]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData({ ...formData, [id]: value });
  };
  
  const handleSelectChange = (id: string, value: string) => {
    setFormData({ ...formData, [id]: value });
  };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Photo must be less than 5MB in size."
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload an image file (JPG, PNG)."
        });
        return;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setPhotoFile(file);
    }
  };
  
  const uploadPhoto = async (clientId: string): Promise<string | null> => {
    if (!photoFile) return null;
    
    try {
      // Define file path using client ID and timestamp to ensure uniqueness
      const filePath = `client_photos/${clientId}/${Date.now()}_${photoFile.name}`;
      
      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('client_photos')
        .upload(filePath, photoFile);
        
      if (uploadError) throw uploadError;
      
      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('client_photos')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      // Validate required fields
      const requiredFields = ['firstName', 'lastName', 'phone', 'idNumber'];
      const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
      
      if (missingFields.length > 0) {
        throw new Error("Please fill in all required fields");
      }
      
      // Create client record
      const clientData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email || null,
        phone: formData.phone,
        id_number: formData.idNumber,
        gender: formData.gender || null,
        date_of_birth: formData.dob || null,
        address: formData.address || null,
        city: formData.city || null,
        region: formData.region || null,
        branch_id: formData.branch_id || null,
        occupation: formData.occupation || null,
        employment_status: formData.employmentStatus || null,
        monthly_income: formData.monthlyIncome ? Number(formData.monthlyIncome) : null,
        photo_url: null, // Will update this after uploading the photo
        status: 'active'
      };
      
      // Insert client to database
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Upload photo if available
      if (photoFile && newClient) {
        const photoUrl = await uploadPhoto(newClient.id);
        
        // Update client record with photo URL
        if (photoUrl) {
          const { error: updateError } = await supabase
            .from('clients')
            .update({ photo_url: photoUrl })
            .eq('id', newClient.id);
            
          if (updateError) {
            console.error("Error updating client photo URL:", updateError);
          }
        }
      }
      
      toast({
        title: "Client created",
        description: "The client has been successfully added to the system.",
      });
      
      navigate("/clients");
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast({
        variant: "destructive",
        title: "Failed to create client",
        description: error.message || "There was an error creating the client."
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/clients")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Client</h1>
            <p className="text-muted-foreground">Add a new client to the system.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
                <CardDescription>
                  Enter the client's personal information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Label htmlFor="photo">Passport Photo</Label>
                  <div className="flex flex-col items-center space-y-3">
                    <Avatar className="h-32 w-32">
                      {photoPreview ? (
                        <AvatarImage src={photoPreview} alt="Client photo" />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          <Image className="h-12 w-12 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className="border border-dashed rounded-md p-4 text-center w-full">
                      <input
                        type="file"
                        id="photo"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="sr-only"
                      />
                      <Label htmlFor="photo" className="cursor-pointer flex flex-col items-center">
                        <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-1">
                          Click to upload passport photo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG (Max 5MB)
                        </p>
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input 
                    id="idNumber" 
                    value={formData.idNumber}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleSelectChange('gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input 
                    id="dob" 
                    type="date" 
                    value={formData.dob}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Address & Additional Information</CardTitle>
                <CardDescription>
                  Enter the client's location and other details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Physical Address</Label>
                  <Textarea 
                    id="address" 
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City/Town</Label>
                    <Input 
                      id="city" 
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region/State</Label>
                    <Input 
                      id="region" 
                      value={formData.region}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="branch_id">Branch</Label>
                  <Select
                    value={formData.branch_id}
                    onValueChange={(value) => handleSelectChange('branch_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input 
                    id="occupation" 
                    value={formData.occupation}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="employmentStatus">Employment Status</Label>
                  <Select
                    value={formData.employmentStatus}
                    onValueChange={(value) => handleSelectChange('employmentStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self-employed">Self-employed</SelectItem>
                      <SelectItem value="unemployed">Unemployed</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Monthly Income</Label>
                  <Input 
                    id="monthlyIncome" 
                    type="number" 
                    value={formData.monthlyIncome}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <CardFooter className="flex justify-end pt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/clients")}
              className="mr-2"
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Client"}
            </Button>
          </CardFooter>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewClientPage;
