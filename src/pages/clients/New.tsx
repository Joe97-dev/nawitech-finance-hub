
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
import { ArrowLeft, Upload, Image, Plus, Trash2 } from "lucide-react";
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
  const [idPhotos, setIdPhotos] = useState<File[]>([]);
  const [businessPhotos, setBusinessPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [referees, setReferees] = useState([
    { name: "", phone: "", relationship: "" },
    { name: "", phone: "", relationship: "" },
    { name: "", phone: "", relationship: "" },
    { name: "", phone: "", relationship: "" }
  ]);
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
    monthlyIncome: "",
    maritalStatus: ""
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
  
  const handleRefereeChange = (index: number, field: string, value: string) => {
    const updatedReferees = [...referees];
    updatedReferees[index] = { ...updatedReferees[index], [field]: value };
    setReferees(updatedReferees);
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

  const handleIdPhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setIdPhotos(prevFiles => [...prevFiles, ...files]);
  };

  const handleBusinessPhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBusinessPhotos(prevFiles => [...prevFiles, ...files]);
  };

  const handleDocumentsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocuments(prevFiles => [...prevFiles, ...files]);
  };

  const removeFile = (index: number, type: 'id' | 'business' | 'documents') => {
    if (type === 'id') {
      setIdPhotos(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'business') {
      setBusinessPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setDocuments(prev => prev.filter((_, i) => i !== index));
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

  const uploadFiles = async (files: File[], bucket: string, clientId: string, prefix: string) => {
    const uploadPromises = files.map(async (file) => {
      const filePath = `${prefix}/${clientId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);
      
      if (error) throw error;
      return filePath;
    });
    
    return Promise.all(uploadPromises);
  };

  const saveClientDocuments = async (clientId: string, filePaths: string[], documentType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const documentRecords = filePaths.map(filePath => ({
      client_id: clientId,
      document_name: filePath.split('/').pop() || 'Unknown',
      file_path: filePath,
      document_type: documentType,
      uploaded_by: user.id
    }));

    const { error } = await supabase
      .from('client_documents')
      .insert(documentRecords);
    
    if (error) throw error;
  };

  const saveReferees = async (clientId: string) => {
    const validReferees = referees.filter(ref => ref.name && ref.phone && ref.relationship);
    
    if (validReferees.length > 0) {
      const { error } = await supabase
        .from('client_referees')
        .insert(validReferees.map(ref => ({
          client_id: clientId,
          name: ref.name,
          phone: ref.phone,
          relationship: ref.relationship
        })));
      
      if (error) throw error;
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
        marital_status: formData.maritalStatus || null,
        photo_url: null, // Will update this after uploading the photo
        status: 'pending'
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

      // Upload ID photos
      if (idPhotos.length > 0 && newClient) {
        try {
          const idPhotoPaths = await uploadFiles(idPhotos, 'client-id-photos', newClient.id, 'id_photos');
          await saveClientDocuments(newClient.id, idPhotoPaths, 'id_photo');
        } catch (error) {
          console.error("Error uploading ID photos:", error);
        }
      }

      // Upload business photos
      if (businessPhotos.length > 0 && newClient) {
        try {
          const businessPhotoPaths = await uploadFiles(businessPhotos, 'client-business-photos', newClient.id, 'business_photos');
          await saveClientDocuments(newClient.id, businessPhotoPaths, 'business_photo');
        } catch (error) {
          console.error("Error uploading business photos:", error);
        }
      }

      // Upload documents
      if (documents.length > 0 && newClient) {
        try {
          const documentPaths = await uploadFiles(documents, 'client-documents', newClient.id, 'documents');
          await saveClientDocuments(newClient.id, documentPaths, 'document');
        } catch (error) {
          console.error("Error uploading documents:", error);
        }
      }

      // Save referees
      if (newClient) {
        try {
          await saveReferees(newClient.id);
        } catch (error) {
          console.error("Error saving referees:", error);
        }
      }
      
      toast({
        title: "Client created",
        description: "The client has been added with pending status. Post a client fee to activate.",
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

                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  <Select
                    value={formData.maritalStatus}
                    onValueChange={(value) => handleSelectChange('maritalStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
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

          {/* Document Uploads Section */}
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>ID & Business Photos</CardTitle>
                <CardDescription>
                  Upload client ID and business photos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="idPhotos">ID Photos</Label>
                  <div className="border border-dashed rounded-md p-4">
                    <input
                      type="file"
                      id="idPhotos"
                      accept="image/*"
                      multiple
                      onChange={handleIdPhotosUpload}
                      className="sr-only"
                    />
                    <Label htmlFor="idPhotos" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload ID photos</p>
                    </Label>
                  </div>
                  {idPhotos.length > 0 && (
                    <div className="space-y-2">
                      {idPhotos.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index, 'id')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessPhotos">Business Photos</Label>
                  <div className="border border-dashed rounded-md p-4">
                    <input
                      type="file"
                      id="businessPhotos"
                      accept="image/*"
                      multiple
                      onChange={handleBusinessPhotosUpload}
                      className="sr-only"
                    />
                    <Label htmlFor="businessPhotos" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload business photos</p>
                    </Label>
                  </div>
                  {businessPhotos.length > 0 && (
                    <div className="space-y-2">
                      {businessPhotos.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index, 'business')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  Upload client documents and files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="documents">Client Documents</Label>
                  <div className="border border-dashed rounded-md p-4">
                    <input
                      type="file"
                      id="documents"
                      multiple
                      onChange={handleDocumentsUpload}
                      className="sr-only"
                    />
                    <Label htmlFor="documents" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload documents</p>
                      <p className="text-xs text-muted-foreground">Any file type allowed</p>
                    </Label>
                  </div>
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index, 'documents')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referees Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Referees/Guarantors</CardTitle>
              <CardDescription>
                Add up to 4 referees or guarantors for this client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {referees.map((referee, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Referee {index + 1}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`referee-name-${index}`}>Full Name</Label>
                      <Input
                        id={`referee-name-${index}`}
                        value={referee.name}
                        onChange={(e) => handleRefereeChange(index, 'name', e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`referee-phone-${index}`}>Phone Number</Label>
                      <Input
                        id={`referee-phone-${index}`}
                        value={referee.phone}
                        onChange={(e) => handleRefereeChange(index, 'phone', e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`referee-relationship-${index}`}>Relationship</Label>
                      <Input
                        id={`referee-relationship-${index}`}
                        value={referee.relationship}
                        onChange={(e) => handleRefereeChange(index, 'relationship', e.target.value)}
                        placeholder="e.g., Spouse, Friend, Colleague"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          
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
