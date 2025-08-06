import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Eye, Play, Square, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/context/RoleContext";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface MigrationJob {
  id: string;
  job_name: string;
  data_type: string;
  source_file_name: string;
  status: string;
  is_scheduled: boolean;
  schedule_frequency?: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  created_at: string;
  updated_at: string;
}

export default function DataMigration() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [newJob, setNewJob] = useState({
    job_name: "",
    data_type: "",
    is_scheduled: false,
    schedule_frequency: ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const [startingMigrations, setStartingMigrations] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMigrationJobs();
    
    // Set up auto-refresh for processing jobs
    const interval = setInterval(() => {
      const hasProcessingJobs = jobs.some(job => job.status === 'processing');
      if (hasProcessingJobs) {
        fetchMigrationJobs();
      }
    }, 3000); // Refresh every 3 seconds if there are processing jobs

    return () => clearInterval(interval);
  }, [jobs]);

  useEffect(() => {
    fetchMigrationJobs();
  }, []);

  const fetchMigrationJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("migration_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching migration jobs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch migration jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV or Excel file",
          variant: "destructive",
        });
        return;
      }
      
      setUploadedFile(file);
    }
  };

  const createMigrationJob = async () => {
    if (!uploadedFile || !newJob.job_name || !newJob.data_type) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and select a file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to storage
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${uploadedFile.name}`;
      const filePath = `${newJob.data_type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('migration-files')
        .upload(filePath, uploadedFile);

      if (uploadError) throw uploadError;

      // Create migration job record
      const { error: jobError } = await supabase
        .from('migration_jobs')
        .insert({
          job_name: newJob.job_name,
          data_type: newJob.data_type,
          source_file_name: uploadedFile.name,
          source_file_path: filePath,
          is_scheduled: newJob.is_scheduled,
          schedule_frequency: newJob.is_scheduled ? newJob.schedule_frequency : null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (jobError) throw jobError;

      toast({
        title: "Success",
        description: "Migration job created successfully",
      });

      // Reset form
      setUploadedFile(null);
      setNewJob({
        job_name: "",
        data_type: "",
        is_scheduled: false,
        schedule_frequency: ""
      });

      // Refresh jobs list
      fetchMigrationJobs();
    } catch (error) {
      console.error("Error creating migration job:", error);
      toast({
        title: "Error",
        description: "Failed to create migration job",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
      cancelled: "outline"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  const getProgressPercentage = (job: MigrationJob) => {
    if (job.total_records === 0) return 0;
    return Math.round((job.processed_records / job.total_records) * 100);
  };

  const startMigration = async (jobId: string) => {
    // Add to starting migrations set to show loading state
    setStartingMigrations(prev => new Set(prev).add(jobId));
    
    try {
      toast({
        title: "Starting Migration",
        description: "Migration process is beginning. Please wait...",
      });

      const { error } = await supabase.functions.invoke('process-migration', {
        body: { jobId }
      });

      if (error) throw error;

      toast({
        title: "Migration Started",
        description: "Migration is now running. The status will update automatically.",
      });

      // Refresh jobs list
      fetchMigrationJobs();
    } catch (error) {
      console.error("Error starting migration:", error);
      toast({
        title: "Migration Failed",
        description: error?.message || "Failed to start migration. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Remove from starting migrations set
      setStartingMigrations(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Data Migration</h1>
          <p className="text-muted-foreground">
            Import client, loan, and transaction data from CSV/Excel files
          </p>
        </div>

        <div className="grid gap-6">
          {/* Upload New Migration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Create New Migration
              </CardTitle>
              <CardDescription>
                Upload CSV or Excel files to import data into the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="job_name">Job Name</Label>
                  <Input
                    id="job_name"
                    placeholder="e.g., Monthly Client Import"
                    value={newJob.job_name}
                    onChange={(e) => setNewJob({ ...newJob, job_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_type">Data Type</Label>
                  <Select
                    value={newJob.data_type}
                    onValueChange={(value) => setNewJob({ ...newJob, data_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select data type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clients">Clients</SelectItem>
                      <SelectItem value="loans">Loans</SelectItem>
                      <SelectItem value="transactions">Transactions</SelectItem>
                      <SelectItem value="all">All Data Types</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Upload File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                  {uploadedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {uploadedFile.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Schedule Options</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_scheduled"
                      checked={newJob.is_scheduled}
                      onChange={(e) => setNewJob({ ...newJob, is_scheduled: e.target.checked })}
                    />
                    <Label htmlFor="is_scheduled">Scheduled Import</Label>
                  </div>
                  {newJob.is_scheduled && (
                    <Select
                      value={newJob.schedule_frequency}
                      onValueChange={(value) => setNewJob({ ...newJob, schedule_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <Button
                onClick={createMigrationJob}
                disabled={isUploading}
                className="w-full md:w-auto"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating Migration...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Create Migration Job
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Migration Jobs List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Migration Jobs
              </CardTitle>
              <CardDescription>
                Track the status of your data migration jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-4">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No migration jobs found. Create your first migration above.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Data Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.job_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.data_type}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={getProgressPercentage(job)} className="w-20" />
                              <span className="text-xs text-muted-foreground">
                                {job.processed_records}/{job.total_records}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-green-600">✓ {job.successful_records}</div>
                              <div className="text-red-600">✗ {job.failed_records}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {job.is_scheduled ? (
                              <Badge variant="secondary">{job.schedule_frequency}</Badge>
                            ) : (
                              <span className="text-muted-foreground">One-time</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(job.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {job.status === 'pending' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => startMigration(job.id)}
                                  disabled={startingMigrations.has(job.id)}
                                >
                                  {startingMigrations.has(job.id) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {job.status === 'processing' && (
                                <Button size="sm" variant="outline" disabled>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}