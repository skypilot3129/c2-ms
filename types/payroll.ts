import { Timestamp } from 'firebase/firestore';

// Payroll period (Month-Year format)
export type PayrollPeriod = string; // "2026-01" format

// Payroll status
export type PayrollStatus = 'draft' | 'approved' | 'paid';

// Deduction types
export type DeductionType = 'tax' | 'insurance' | 'advance' | 'other';

// Deduction detail
export interface PayrollDeduction {
    type: DeductionType;
    description: string;
    amount: number;
}

// Individual employee payroll calculation
export interface PayrollCalculation {
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    period: PayrollPeriod;

    // Base Salary Components
    baseSalary: number;
    dailyAllowance: number; // Per day rate
    daysWorked: number; // Actual days present
    totalAllowance: number; // allowance * daysWorked

    // Commission (for drivers/helpers)
    tripsCompleted: number;
    commissionPerTrip: number;
    totalCommission: number;

    // Overtime (loading/unloading events)
    overtimeEvents: number;
    overtimeRate: number; // Per event
    totalOvertime: number;

    // Deductions
    deductions: PayrollDeduction[];
    totalDeductions: number;

    // Final Calculation
    grossPay: number; // Sum of all income
    netPay: number; // Gross - Deductions

    // Metadata
    status: PayrollStatus;
    generatedAt: Date;
    approvedAt?: Date;
    paidAt?: Date;
}

// Monthly payroll summary (contains all employees)
export interface MonthlyPayrollFormData {
    period: PayrollPeriod;
    calculations: PayrollCalculation[];
    totalGrossPay: number;
    totalNetPay: number;
    totalEmployees: number;
    status: PayrollStatus;
    notes?: string;
}

// Firestore document
export interface MonthlyPayrollDoc extends Omit<MonthlyPayrollFormData, 'calculations'> {
    calculations: Array<Omit<PayrollCalculation, 'generatedAt' | 'approvedAt' | 'paidAt'> & {
        generatedAt: Timestamp;
        approvedAt?: Timestamp;
        paidAt?: Timestamp;
    }>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    finalizedAt?: Timestamp;
}

// Client-side monthly payroll
export interface MonthlyPayroll extends MonthlyPayrollFormData {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    finalizedAt?: Date;
}

// Payroll summary for reporting
export interface PayrollSummary {
    period: PayrollPeriod;
    totalGrossPay: number;
    totalNetPay: number;
    totalEmployees: number;
    averagePerEmployee: number;
    status: PayrollStatus;
}

// Deduction type labels
export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
    'tax': 'Pajak',
    'insurance': 'Asuransi',
    'advance': 'Kasbon',
    'other': 'Lainnya'
};

// Status labels
export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
    'draft': 'Draft',
    'approved': 'Disetujui',
    'paid': 'Dibayar'
};

// Helper: Format period to readable string
export const formatPeriod = (period: PayrollPeriod): string => {
    const [year, month] = period.split('-');
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
};

// Helper: Get current period
export const getCurrentPeriod = (): PayrollPeriod => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// Helper: Get previous period
export const getPreviousPeriod = (period: PayrollPeriod): PayrollPeriod => {
    const [year, month] = period.split('-').map(Number);
    if (month === 1) {
        return `${year - 1}-12`;
    }
    return `${year}-${String(month - 1).padStart(2, '0')}`;
};

// Helper: Parse period to date range
export const getPeriodDateRange = (period: PayrollPeriod): { startDate: Date; endDate: Date } => {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month
    return { startDate, endDate };
};
