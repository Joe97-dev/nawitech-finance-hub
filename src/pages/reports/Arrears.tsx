
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { ReportPage } from "./Base";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { InterestCalculationToggle } from "@/components/reports/InterestCalculationToggle";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArrearsData {
  id: string;
  clientName: string;
  loanId: string;
  principalAmount: number;
  outstandingBalance: number;
  daysOverdue: number;
  amountOverdue: number;
  lastPaymentDate: string;
  contactInfo: string;
  phone?: string;
  email?: string;
  riskCategory: "low" | "medium" | "high" | "critical";
  photoUrl?: string;
  loanOfficer: string;
}

const branches = [
  { value: "all", label: "All Branches" },
  { value: "head-office", label: "HEAD OFFICE" },
  { value: "westlands", label: "Westlands Branch" },
  { value: "mombasa", label: "Mombasa Branch" },
  { value: "kisumu", label: "Kisumu Branch" },
  { value: "nakuru", label: "Nakuru Branch" }
];

const riskCategories = [
  { value: "all", label: "All Risk Levels" },
  { value: "low", label: "Low Risk (1-30 days)" },
  { value: "medium", label: "Medium Risk (31-60 days)" },
  { value: "high", label: "High Risk (61-90 days)" },
  { value: "critical", label: "Critical Risk (90+ days)" }
];

const columns = [
  { key: "clientName", header: "Client Name" },
  { key: "loanId", header: "Loan ID" },
  { key: "principalAmount", header: "Principal Amount" },
  { key: "outstandingBalance", header: "Outstanding Balance" },
  { key: "daysOverdue", header: "Days Overdue" },
  { key: "amountOverdue", header: "Amount Overdue" },
  { key: "lastPaymentDate", header: "Last Payment" },
  { key: "contactInfo", header: "Contact" },
  { key: "riskCategory", header: "Risk Category" },
  { key: "loanOfficer", header: "Loan Officer" }
];

const ArrearsReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [interestCalculation, setInterestCalculation] = useState<"monthly" | "annually">("annually");
  const [arrearsData, setArrearsData] = useState<ArrearsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArrearsData = async () => {
      try {
        setLoading(true);
        
        // Fetch loans with overdue payments from loan_schedule and join with clients
        // Fetch active/in-arrears loans with their schedule data
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('id, client, loan_number, amount, balance, date, term_months, loan_officer_id, status')
          .in('status', ['active', 'in arrears'])
          .neq('type', 'client_fee_account');

        if (loansError) throw loansError;

        // Calculate loan age and find overdue loans (dayAge > totalDays)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdueLoanIds: string[] = [];
        const loanAgeMap = new Map<string, { daysOverdue: number; loan: any }>();

        (loansData || []).forEach(loan => {
          const disbDate = new Date(loan.date);
          disbDate.setHours(0, 0, 0, 0);
          const dayAge = Math.max(0, Math.round((today.getTime() - disbDate.getTime()) / (1000 * 60 * 60 * 24)));
          const totalDays = Math.round((loan.term_months || 1) * 30);
          const daysOverdue = dayAge - totalDays;

          if (daysOverdue > 0 || loan.status === 'in arrears') {
            overdueLoanIds.push(loan.id);
            loanAgeMap.set(loan.id, { daysOverdue: Math.max(daysOverdue, 1), loan });
          }
        });

        // Fetch schedule data for overdue loans to get amount overdue
        const allSchedules: any[] = [];
        for (let i = 0; i < overdueLoanIds.length; i += 50) {
          const batch = overdueLoanIds.slice(i, i + 50);
          const { data: schedData } = await supabase
            .from('loan_schedule')
            .select('loan_id, total_due, amount_paid')
            .in('loan_id', batch);
          if (schedData) allSchedules.push(...schedData);
        }

        // Fetch clients data to get contact information
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('first_name, last_name, phone, email');

        if (clientsError) throw clientsError;

        // Aggregate schedule data per loan
        const schedByLoan = new Map<string, { totalDue: number; totalPaid: number }>();
        allSchedules.forEach(s => {
          const existing = schedByLoan.get(s.loan_id) || { totalDue: 0, totalPaid: 0 };
          existing.totalDue += Number(s.total_due || 0);
          existing.totalPaid += Number(s.amount_paid || 0);
          schedByLoan.set(s.loan_id, existing);
        });

        // Build client lookup
        const clientByIdMap = new Map<string, { name: string; phone: string; email: string }>();
        const clientByNameMap = new Map<string, { name: string; phone: string; email: string }>();
        (clientsData || []).forEach(c => {
          const fullName = `${c.first_name} ${c.last_name}`;
          const entry = { name: fullName, phone: c.phone || '', email: c.email || '' };
          clientByIdMap.set((c as any).id, entry);
          clientByNameMap.set(fullName.toLowerCase(), entry);
        });

        // Fetch loan officer profiles
        const officerIds = [...new Set(
          Array.from(loanAgeMap.values())
            .map(item => item.loan.loan_officer_id)
            .filter(Boolean)
        )] as string[];
        const profileMap = new Map<string, string>();
        if (officerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', officerIds);
          (profiles || []).forEach(p => {
            profileMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—');
          });
        }

        // Build arrears data from overdue loans
        const arrearsArray: ArrearsData[] = [];

        loanAgeMap.forEach(({ daysOverdue, loan }, loanId) => {
          const sched = schedByLoan.get(loanId) || { totalDue: 0, totalPaid: 0 };
          const amountOverdue = Math.max(0, sched.totalDue - sched.totalPaid);

          // Resolve client
          const clientById = clientByIdMap.get(loan.client);
          const clientByName = clientByNameMap.get(loan.client.toLowerCase());
          const resolvedClient = clientById || clientByName;
          const clientName = resolvedClient?.name || loan.client;
          const clientPhone = resolvedClient?.phone || '';
          const clientEmail = resolvedClient?.email || '';

          // Risk category based on days overdue past term
          let riskCategory: "low" | "medium" | "high" | "critical" = "low";
          if (daysOverdue > 90) riskCategory = "critical";
          else if (daysOverdue > 60) riskCategory = "high";
          else if (daysOverdue > 30) riskCategory = "medium";

          arrearsArray.push({
            id: loanId,
            clientName,
            loanId: loan.loan_number || loanId,
            principalAmount: loan.amount,
            outstandingBalance: loan.balance,
            daysOverdue,
            amountOverdue,
            lastPaymentDate: "N/A",
            contactInfo: `${clientPhone || 'N/A'} | ${clientEmail || 'N/A'}`,
            phone: clientPhone,
            email: clientEmail,
            riskCategory,
            loanOfficer: loan.loan_officer_id ? profileMap.get(loan.loan_officer_id) || '—' : '—'
          });
        });

        arrearsArray.sort((a, b) => b.daysOverdue - a.daysOverdue);
        setArrearsData(arrearsArray);
      } catch (error: any) {
        console.error("Error fetching arrears data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load arrears data."
        });
        setArrearsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArrearsData();
  }, [toast, dateRange, selectedBranch, selectedRisk]);

  // Filter data based on selected filters
  const filteredData = arrearsData.filter(item => {
    const matchesBranch = selectedBranch === "all";
    const matchesRisk = selectedRisk === "all" || item.riskCategory === selectedRisk;
    
    return matchesBranch && matchesRisk;
  });

  // Calculate statistics
  const totalOverdueAmount = filteredData.reduce((sum, item) => sum + item.amountOverdue, 0);
  const totalOutstanding = filteredData.reduce((sum, item) => sum + item.outstandingBalance, 0);
  const avgDaysOverdue = filteredData.length > 0 
    ? Math.round(filteredData.reduce((sum, item) => sum + item.daysOverdue, 0) / filteredData.length)
    : 0;
  const riskDistribution = {
    low: filteredData.filter(item => item.riskCategory === "low").length,
    medium: filteredData.filter(item => item.riskCategory === "medium").length,
    high: filteredData.filter(item => item.riskCategory === "high").length,
    critical: filteredData.filter(item => item.riskCategory === "critical").length
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "low": return "secondary";
      case "medium": return "outline";
      case "high": return "destructive";
      case "critical": return "destructive";
      default: return "secondary";
    }
  };

  const getRiskProgress = (risk: string) => {
    switch (risk) {
      case "low": return 25;
      case "medium": return 50;
      case "high": return 75;
      case "critical": return 100;
      default: return 0;
    }
  };

  const hasActiveFilters = selectedBranch !== "all" || selectedRisk !== "all" || (dateRange !== undefined);

  const handleReset = () => {
    setSelectedBranch("all");
    setSelectedRisk("all");
    setDateRange(undefined);
    setInterestCalculation("annually");
  };

  return (
    <ReportPage
      title="Arrears Report"
      description="Track overdue loans and manage collection activities"
      actions={
        <ExportButton 
          data={filteredData.map(item => ({
            clientName: item.clientName,
            loanId: item.loanId,
            principalAmount: item.principalAmount,
            outstandingBalance: item.outstandingBalance,
            daysOverdue: item.daysOverdue,
            amountOverdue: item.amountOverdue,
            lastPaymentDate: item.lastPaymentDate,
            contactInfo: item.contactInfo,
            riskCategory: item.riskCategory,
            loanOfficer: item.loanOfficer
          }))} 
          filename={`arrears-report-${new Date().toISOString().slice(0, 10)}`} 
          columns={columns} 
        />
      }
    >
      <ReportFilters 
        hasActiveFilters={hasActiveFilters}
        onReset={handleReset}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            className="col-span-2"
          />
          
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Branch
            </label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.value} value={branch.value}>
                    {branch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Risk Category
            </label>
            <Select value={selectedRisk} onValueChange={setSelectedRisk}>
              <SelectTrigger className="border-dashed">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                {riskCategories.map((risk) => (
                  <SelectItem key={risk.value} value={risk.value}>
                    {risk.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <InterestCalculationToggle
          value={interestCalculation}
          onChange={setInterestCalculation}
          className="w-fit"
        />
      </ReportFilters>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat
              label="Total Overdue Amount"
              value={`KES ${totalOverdueAmount.toLocaleString()}`}
              subValue="Across all overdue loans"
              trend="down"
              trendValue="8.2%"
            />
            <ReportStat
              label="Total Outstanding"
              value={`KES ${totalOutstanding.toLocaleString()}`}
              subValue="Principal + interest"
              trend="down"
              trendValue="3.1%"
            />
            <ReportStat
              label="Average Days Overdue"
              value={`${avgDaysOverdue} days`}
              subValue="Across all accounts"
              trend="down"
              trendValue="12.5%"
            />
            <ReportStat
              label="Accounts in Arrears"
              value={filteredData.length.toString()}
              subValue="Requiring attention"
              trend="down"
              trendValue="5.8%"
            />
          </ReportStats>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <ReportCard title="Risk Distribution" className="lg:col-span-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Low Risk</span>
                  <span className="text-sm font-medium">{riskDistribution.low}</span>
                </div>
                <Progress value={(riskDistribution.low / filteredData.length) * 100} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Medium Risk</span>
                  <span className="text-sm font-medium">{riskDistribution.medium}</span>
                </div>
                <Progress value={(riskDistribution.medium / filteredData.length) * 100} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">High Risk</span>
                  <span className="text-sm font-medium">{riskDistribution.high}</span>
                </div>
                <Progress value={(riskDistribution.high / filteredData.length) * 100} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Critical Risk</span>
                  <span className="text-sm font-medium">{riskDistribution.critical}</span>
                </div>
                <Progress value={(riskDistribution.critical / filteredData.length) * 100} className="h-2" />
              </div>
            </ReportCard>

            <ReportCard title="Arrears Details" className="lg:col-span-3">
              {filteredData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No arrears data found for the selected criteria
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Amount Overdue</TableHead>
                      <TableHead>Loan Officer</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.photoUrl} />
                              <AvatarFallback>{item.clientName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{item.clientName}</div>
                              <div className="text-xs text-muted-foreground">{item.contactInfo}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.loanId}</TableCell>
                        <TableCell className="font-medium">
                          KES {item.outstandingBalance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.daysOverdue} days</span>
                            <Progress 
                              value={Math.min(getRiskProgress(item.riskCategory), 100)} 
                              className="h-1 w-12" 
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-destructive">
                          KES {item.amountOverdue.toLocaleString()}
                        </TableCell>
                        <TableCell>{item.loanOfficer}</TableCell>
                        <TableCell>
                          <Badge variant={getRiskBadgeVariant(item.riskCategory)}>
                            {item.riskCategory.charAt(0).toUpperCase() + item.riskCategory.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button 
                              className="text-xs text-primary hover:underline"
                              onClick={() => navigate(`/loans/${item.id}`)}
                            >
                              View
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button 
                              className="text-xs text-primary hover:underline"
                              onClick={() => {
                                if (item.phone) {
                                  window.open(`tel:${item.phone}`, '_self');
                                } else if (item.email) {
                                  window.open(`mailto:${item.email}`, '_self');
                                } else {
                                  alert('No contact information available');
                                }
                              }}
                            >
                              Contact
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ReportCard>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

export default ArrearsReport;
