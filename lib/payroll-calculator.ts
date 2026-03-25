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

    const isHelper = employee.role === 'helper';

    // 2. Attendance Pay (Khusus Helper)
    const daysPresent = attendanceSummary.present;
    const daysLate = attendanceSummary.late;
    const daysWorked = daysPresent + daysLate;
    
    const dailyRate = isHelper ? (employee.salaryConfig.dailyRate || 50000) : 0;
    const attendancePay = isHelper ? daysWorked * dailyRate : 0;

    // 3. Late Deductions (Khusus Helper)
    const lateMild = attendanceSummary.lateMild || 0;
    const lateSevere = attendanceSummary.lateSevere || 0;
    const lateMildDeduction = isHelper ? lateMild * (employee.salaryConfig.lateDeduction1 || 10000) : 0;
    const lateSevereDeduction = isHelper ? lateSevere * (employee.salaryConfig.lateDeduction2 || 20000) : 0;
    const totalLateDeductions = lateMildDeduction + lateSevereDeduction;

    // 4. Overtime / Lembur Muat
    const overtimeEvents = attendanceSummary.overtimeCount;
    const overtimeRate = OVERTIME_RATE_PER_EVENT;
    const totalOvertime = overtimeEvents * overtimeRate;

    // 5. Loading Operations (Belum diimplementasikan database-nya)
    const loadingOperations: any[] = [];
    const totalLoadingPay = 0;
    const totalStackingBonus = 0;

    // 6. Allowance (Khusus Admin/Pengurus jika ada)
    const dailyAllowance = employee.salaryConfig.allowance || 0;
    const totalAllowance = dailyAllowance * daysWorked;

    // 7. Legacy commission
    const tripsCompleted = 0;
    const commissionPerTrip = employee.salaryConfig.tripCommission || 0;
    const totalCommission = 0;

    // 8. Deductions list
    const deductions: PayrollDeduction[] = [];
    if (lateMild > 0 && isHelper) {
        deductions.push({ type: 'late_mild', description: `Telat 1-2 Jam (${lateMild}x)`, amount: lateMildDeduction });
    }
    if (lateSevere > 0 && isHelper) {
        deductions.push({ type: 'late_severe', description: `Telat >2 Jam (${lateSevere}x)`, amount: lateSevereDeduction });
    }
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    // 9. Calculate gross and net pay
    const baseSalary = !isHelper ? (employee.salaryConfig.baseSalary || 0) : 0;
    const grossPay = baseSalary + attendancePay + totalAllowance + totalLoadingPay + totalStackingBonus + totalOvertime + totalCommission;
    const netPay = grossPay - totalDeductions;

    // 10. Build result
    const calculation: PayrollCalculation = {
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        employeeRole: employee.role,
        period,

        baseSalary,
        
        dailyRate,
        daysPresent,
        daysLate,
        attendancePay,

        lateMild,
        lateSevere,
        lateMildDeduction,
        lateSevereDeduction,
        totalLateDeductions,

        dailyAllowance,
        daysWorked,
        totalAllowance,

        loadingOperations,
        totalLoadingPay,
        totalStackingBonus,

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
