import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, UserCheck, BarChart3 } from 'lucide-react';
import { ActiveEmployeesTab } from '@/components/dashboard/ActiveEmployeesTab';
import { DepartmentEligibilityTab } from '@/components/dashboard/DepartmentEligibilityTab';
import { EligibleEmployeesTab } from '@/components/dashboard/EligibleEmployeesTab';
import UniformEntitlementCoverageTab from '@/components/dashboard/UniformEntitlementCoverageTab';
import DemandForecastTab from '@/components/dashboard/DemandForecastTab';


const Index = () => {
  const [activeTab, setActiveTab] = useState('active-employees');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Uniform Demand Forecast</h1>
              <p className="text-sm text-muted-foreground">Master Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
            <TabsTrigger 
              value="active-employees" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Active Employees</span>
              <span className="sm:hidden">Active</span>
            </TabsTrigger>
            <TabsTrigger 
              value="department-eligibility" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Department Eligibility</span>
              <span className="sm:hidden">Departments</span>
            </TabsTrigger>
            <TabsTrigger 
              value="eligible-employees" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5"
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Eligible Employees</span>
              <span className="sm:hidden">Eligible</span>
            </TabsTrigger>
          

            <TabsTrigger 
              value="entitlement-coverage" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5"
>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Uniform Entitlement Coverage</span>
              <span className="sm:hidden">Coverage</span>
           </TabsTrigger>

            <TabsTrigger
              value="demand-forecast"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5"
>
             <BarChart3 className="h-4 w-4" />
             <span className="hidden sm:inline">Demand Forecast</span>
             <span className="sm:hidden">Forecast</span>
            </TabsTrigger>

          </TabsList>

          <TabsContent value="active-employees" className="mt-6">
            <ActiveEmployeesTab />
          </TabsContent>

          <TabsContent value="department-eligibility" className="mt-6">
            <DepartmentEligibilityTab />
          </TabsContent>

          <TabsContent value="eligible-employees" className="mt-6">
            <EligibleEmployeesTab />
          </TabsContent>

          <TabsContent value="entitlement-coverage" className="mt-6">
            <UniformEntitlementCoverageTab />
          </TabsContent>

          <TabsContent value="demand-forecast" className="mt-6">
            <DemandForecastTab />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default Index;
