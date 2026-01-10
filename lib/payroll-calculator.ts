import type { Employee } from '@/types/employee';
import type { PayrollCalculation, PayrollPeriod, PayrollDeduction } from '@/types/payroll';
import { getPeriodDateRange } from '@/types/payroll';
import { getEmployeeAttendance, getAttendanceSummary } from './firestore-attendance';

// Fixed rates
const OVERTIME_RATE_PER_EVENT = 50000; // Rp 50,000 per loading/unloading event

/**
 * Calculate payroll for a single employee for a given period
 */
export const calculateEmployeePayroll = async (
    employee: Employee,
    period: PayrollPeriod
): Promise<PayrollCalculation> => {
    const { startDate, endDate } = getPeriodDateRange(period);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 1. Get attendance summary for the period
    const attendanceSummary = await getAttendanceSummary(
        employee.employeeId,
        startDateStr,
        endDateStr
    );

    // Days worked = present + late (tidak termasuk absent/leave)
    const daysWorked = attendanceSummary.present + attendanceSummary.late;

    // 2. Calculate allowance
    const dailyAllowance = employee.salaryConfig.allowance;
    const totalAllowance = dailyAllowance * daysWorked;

    // 3. Calculate overtime
    const overtimeEvents = attendanceSummary.overtimeCount;
    const overtimeRate = OVERTIME_RATE_PER_EVENT;
    const totalOvertime = overtimeEvents * overtimeRate;

    // 4. Calculate trip commission
    // TODO: Implement when voyage/trip tracking is ready
    // For now, use placeholder values
    const tripsCompleted = 0;
    const commissionPerTrip = employee.salaryConfig.tripCommission;
    const totalCommission = 0;

    // If driver/helper role, we would calculate:
    // if (['driver', 'helper'].includes(employee.role)) {
    //     const trips = await getEmployeeTripsForPeriod(employee.employeeId, period);
    //     tripsCompleted = trips.length;
    //     if (employee.salaryConfig.commissionType === 'fixed') {
    //         totalCommission = tripsCompleted * employee.salaryConfig.tripCommission;
    //     } else {
    //         // Percentage of trip revenue
    //         const tripRevenue = trips.reduce((sum, t) => sum + t.revenue, 0);
    //         totalCommission = tripRevenue * (employee.salaryConfig.tripCommission / 100);
    //     }
    // }

    // 5. Calculate deductions
    const deductions: PayrollDeduction[] = [];
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    // 6. Calculate gross and net pay
    const baseSalary = employee.salaryConfig.baseSalary;
    const grossPay = baseSalary + totalAllowance + totalCommission + totalOvertime;
    const netPay = grossPay - totalDeductions;

    // 7. Build result
    const calculation: PayrollCalculation = {
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        employeeRole: employee.role,
        period,

        baseSalary,
        dailyAllowance,
        daysWorked,
        totalAllowance,

        tripsCompleted,
        commissionPerTrip,
        totalCommission,

        overtimeEvents,
        overtimeRate,
        totalOvertime,

        deductions,
        totalDeductions,

        grossPay,
        netPay,

        status: 'draft',
        generatedAt: new Date()
    };

    return calculation;
};

/**
 * Calculate payroll for multiple employees
 */
export const calculateBulkPayroll = async (
    employees: Employee[],
    period: PayrollPeriod
): Promise<PayrollCalculation[]> => {
    const calculations: PayrollCalculation[] = [];

    for (const employee of employees) {
        try {
            const calc = await calculateEmployeePayroll(employee, period);
            calculations.push(calc);
        } catch (error) {
            console.error(`Error calculating payroll for ${employee.fullName}:`, error);
            // Skip this employee and continue
        }
    }

    return calculations;
};

/**
 * Add deduction to a calculation
 */
export const addDeduction = (
    calculation: PayrollCalculation,
    deduction: PayrollDeduction
): PayrollCalculation => {
    const updatedDeductions = [...calculation.deductions, deduction];
    const totalDeductions = updatedDeductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = calculation.grossPay - totalDeductions;

    return {
        ...calculation,
        deductions: updatedDeductions,
        totalDeductions,
        netPay
    };
};

/**
 * Remove deduction from a calculation
 */
export const removeDeduction = (
    calculation: PayrollCalculation,
    deductionIndex: number
): PayrollCalculation => {
    const updatedDeductions = calculation.deductions.filter((_, i) => i !== deductionIndex);
    const totalDeductions = updatedDeductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = calculation.grossPay - totalDeductions;

    return {
        ...calculation,
        deductions: updatedDeductions,
        totalDeductions,
        netPay
    };
};

/**
 * Validate payroll calculation
 */
export const validatePayrollCalculation = (calculation: PayrollCalculation): string[] => {
    const errors: string[] = [];

    if (calculation.daysWorked < 0) {
        errors.push('Days worked cannot be negative');
    }

    if (calculation.grossPay < 0) {
        errors.push('Gross pay cannot be negative');
    }

    if (calculation.netPay < 0) {
        errors.push('Net pay cannot be negative (deductions exceed gross pay)');
    }

    if (calculation.daysWorked > 31) {
        errors.push('Days worked cannot exceed 31');
    }

    return errors;
};
