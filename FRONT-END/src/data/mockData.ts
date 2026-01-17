// Mock data for the Workforce Analytics Dashboard

export interface Employee {
  id: string;
  name: string;
  department: string;
  location: string;
  gender: 'Male' | 'Female';
  status: 'Active' | 'Inactive';
  issuanceMonth: string;
  isEligible: boolean;
}

export interface DepartmentSummary {
  department: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  activePercentage: number;
  locationsPresent: number;
}

export interface DepartmentEligibility {
  department: string;
  isEligible: boolean;
  totalEmployees: number;
  activeEmployees: number;
}

export interface EligibleEmployeeSummary {
  department: string;
  totalHeadcount: number;
  activeHeadcount: number;
  eligibleHeadcount: number;
  eligibilityPercentage: number;
}

export const departments = [
  'Airport Operations & Customer Services',
  'Cargo',
  'Engineering',
  'Flight Operations',
  'Flight Safety',
  'Inflight Services',
  'Operation Control Center',
];

export const locations = [
  "Bengaluru", "Gurgaon", "Delhi", "Mumbai", "Chandigarh", "Chennai",
  "Kolkata", "Hyderabad", "Pune", "Durgapur", "Jabalpur", "Indore",
  "Thiruvananthapuram", "Ahmedabad", "Jaipur", "Kochi", "Bhubaneswar",
  "Srinagar", "Nagpur", "Imphal", "Dehradun", "Lucknow", "Silchar",
  "Agartala", "Patna", "Gorakhpur", "Ranchi", "Deoghar", "Agatti",
  "Raipur", "Bagdogra", "Guwahati", "Vadodara", "Tuticorin", "Jharsuguda",
  "Port Blair", "Singapore", "Visakhapatnam", "Jammu", "Madurai", "Goa",
  "Bhopal", "Varanasi", "Nasik", "Allahabad", "Amritsar", "Kozhikode",
  "Adampur", "Salem", "Tashkent"
].sort();
export const genders: ('Male' | 'Female')[] = ['Male', 'Female'];
export const statuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
export const months = ['Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024', 'Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024'];

// Generate mock employees
export const generateEmployees = (): Employee[] => {
  const employees: Employee[] = [];
  for (let i = 1; i <= 500; i++) {
    employees.push({
      id: `EMP${i.toString().padStart(4, '0')}`,
      name: `Employee ${i}`,
      department: departments[Math.floor(Math.random() * departments.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      gender: genders[Math.floor(Math.random() * genders.length)],
      status: Math.random() > 0.2 ? 'Active' : 'Inactive',
      issuanceMonth: months[Math.floor(Math.random() * months.length)],
      isEligible: Math.random() > 0.3,
    });
  }
  return employees;
};

export const employees = generateEmployees();

// Department summary data
export const getDepartmentSummary = (): DepartmentSummary[] => {
  return departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept);
    const activeCount = deptEmployees.filter(e => e.status === 'Active').length;
    const uniqueLocations = new Set(deptEmployees.map(e => e.location)).size;
    return {
      department: dept,
      totalEmployees: deptEmployees.length,
      activeEmployees: activeCount,
      inactiveEmployees: deptEmployees.length - activeCount,
      activePercentage: Math.round((activeCount / deptEmployees.length) * 100),
      locationsPresent: uniqueLocations,
    };
  });
};

// Department eligibility data
export const getDepartmentEligibility = (): DepartmentEligibility[] => {
  const eligibleDepts = [
    'Airport Operations & Customer Services',
    'Cargo',
    'Engineering',
    'Inflight Services',
  ];
  return departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept);
    const activeCount = deptEmployees.filter(e => e.status === 'Active').length;
    // const eligibleCount = deptEmployees.filter(e => e.isEligible).length;
    return {
      department: dept,
      isEligible: eligibleDepts.includes(dept),
      totalEmployees: deptEmployees.length,
      activeEmployees: activeCount,
    };
  });
};

// Eligible employee summary
export const getEligibleEmployeeSummary = (): EligibleEmployeeSummary[] => {
  return departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept);
    const activeCount = deptEmployees.filter(e => e.status === 'Active').length;
    const eligibleCount = deptEmployees.filter(e => e.isEligible).length;
    return {
      department: dept,
      totalHeadcount: deptEmployees.length,
      activeHeadcount: activeCount,
      eligibleHeadcount: eligibleCount,
      eligibilityPercentage: Math.round((eligibleCount / deptEmployees.length) * 100),
    };
  });
};

// Chart data generators
export const getStatusDistribution = () => {
  const active = employees.filter(e => e.status === 'Active').length;
  const inactive = employees.length - active;
  return [
    { name: 'Active', value: active, fill: 'hsl(var(--success))' },
    { name: 'Inactive', value: inactive, fill: 'hsl(var(--muted-foreground))' },
  ];
};

export const getActiveByDepartment = () => {
  return departments.map((dept, index) => ({
    name: dept,
    value: employees.filter(e => e.department === dept && e.status === 'Active').length,
    fill: `hsl(var(--chart-${(index % 6) + 1}))`,
  }));
};

export const getActiveByGender = () => {
  return genders.map(gender => ({
    name: gender,
    count: employees.filter(e => e.gender === gender && e.status === 'Active').length,
  }));
};

export const getEligibleByMonth = () => {
  return months.map(month => ({
    month,
    count: employees.filter(e => e.issuanceMonth === month && e.isEligible).length,
  }));
};

export const getEligibleByDepartment = () => {
  return departments.map(dept => ({
    department: dept,
    eligible: employees.filter(e => e.department === dept && e.isEligible).length,
    ineligible: employees.filter(e => e.department === dept && !e.isEligible).length,
  }));
};

export const getEligibleByGender = () => {
  return genders.map((gender, index) => ({
    name: gender,
    value: employees.filter(e => e.gender === gender && e.isEligible).length,
    fill: `hsl(var(--chart-${index + 1}))`,
  }));
};

export const getHeadcountTrend = () => {
  return months.map(month => {
    const monthEmployees = employees.filter(e => e.issuanceMonth === month);
    return {
      month: month.split(' ')[0],
      totalHeadcount: monthEmployees.length,
      eligibleEmployees: monthEmployees.filter(e => e.isEligible).length,
    };
  });
};

export const getDeptEligibilityChart = () => {
  const eligibility = getDepartmentEligibility();
  return eligibility.map(dept => ({
    department: dept.department,
    eligible: dept.isEligible ? 1 : 0,
    ineligible: dept.isEligible ? 0 : 1,
  }));
};
