import type { Attendance } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import type { MonthlyPayroll, PayrollPeriod } from '@/types/payroll';
import { formatPeriod } from '@/types/payroll';

// Attendance Statistics Types
export interface AttendanceStats {
    period: string;
    startDate: string; endDate: string;
    totalEmployees: number;
    totalWorkingDays: number;
    attendanceRate: number; // percentage
    totalOvertimeEvents: number;
    totalLateCheckins: number;
    employeeBreakdown: EmployeeAttendanceBreakdown[];
}

export interface EmployeeAttendanceBreakdown {
    employeeId: string;
    employeeName: string;
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    daysLeave: number;
    overtimeCount: number;
    attendanceRate: number;
    totalHours: number;
}

// Payroll Trend Types
export interface PayrollTrend {
    period: PayrollPeriod;
    totalGrossPay: number;
    totalNetPay: number;
    employeeCount: number;
    averagePerEmployee: number;
    changeFromPrevious?: number; // percentage
}

export interface RoleCostBreakdown {
    role: string;
    totalCost: number;
    employeeCount: number;
    percentage: number;
}

/**
 * Calculate attendance statistics for a period
 */
export const calculateAttendanceStats = (
    attendances: Attendance[],
    employees: Employee[],
    startDate: string,
    endDate: string
): AttendanceStats => {
    // Count working days in period
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Skip Sundays (0 = Sunday)
        if (d.getDay() !== 0) {
            workingDays++;
        }
    }

    // Build employee breakdown
    const employeeBreakdown: EmployeeAttendanceBreakdown[] = employees.map(emp => {
        const empAttendances = attendances.filter(a => a.employeeId === emp.employeeId);

        const daysPresent = empAttendances.filter(a => a.status === 'present').length;
        const daysLate = empAttendances.filter(a => a.status === 'late').length;
        const daysAbsent = empAttendances.filter(a => a.status === 'absent').length;
        const daysLeave = empAttendances.filter(a => a.status === 'leave').length;
        const overtimeCount = empAttendances.reduce((sum, a) => sum + a.overtimeCount, 0);
        const totalHours = empAttendances.reduce((sum, a) => sum + a.totalHours, 0);

        const attendanceRate = workingDays > 0
            ? ((daysPresent + daysLate) / workingDays) * 100
            : 0;

        return {
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            daysPresent,
            daysAbsent,
            daysLate,
            daysLeave,
            overtimeCount,
            attendanceRate: Math.round(attendanceRate * 10) / 10,
            totalHours: Math.round(totalHours * 10) / 10
        };
    });

    // Calculate aggregates
    const totalPresent = employeeBreakdown.reduce((sum, e) => sum + e.daysPresent + e.daysLate, 0);
    const totalPossible = employees.length * workingDays;
    const attendanceRate = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;
    const totalOvertimeEvents = employeeBreakdown.reduce((sum, e) => sum + e.overtimeCount, 0);
    const totalLateCheckins = employeeBreakdown.reduce((sum, e) => sum + e.daysLate, 0);

    return {
        period: `${startDate} to ${endDate}`,
        startDate,
        endDate,
        totalEmployees: employees.length,
        totalWorkingDays: workingDays,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalOvertimeEvents,
        totalLateCheckins,
        employeeBreakdown
    };
};

/**
 * Calculate payroll trends from historical data
 */
export const calculatePayrollTrends = (payrolls: MonthlyPayroll[]): PayrollTrend[] => {
    const sorted = [...payrolls].sort((a, b) => a.period.localeCompare(b.period));

    return sorted.map((payroll, index) => {
        const avgPerEmployee = payroll.totalEmployees > 0
            ? payroll.totalNetPay / payroll.totalEmployees
            : 0;

        let changeFromPrevious: number | undefined;
        if (index > 0) {
            const prev = sorted[index - 1];
            if (prev.totalNetPay > 0) {
                changeFromPrevious = ((payroll.totalNetPay - prev.totalNetPay) / prev.totalNetPay) * 100;
                changeFromPrevious = Math.round(changeFromPrevious * 10) / 10;
            }
        }

        return {
            period: payroll.period,
            totalGrossPay: payroll.totalGrossPay,
            totalNetPay: payroll.totalNetPay,
            employeeCount: payroll.totalEmployees,
            averagePerEmployee: Math.round(avgPerEmployee),
            changeFromPrevious
        };
    });
};

/**
 * Calculate cost breakdown by role
 */
export const calculateRoleCostBreakdown = (payroll: MonthlyPayroll): RoleCostBreakdown[] => {
    const roleMap = new Map<string, { totalCost: number; count: number }>();

    payroll.calculations.forEach(calc => {
        const existing = roleMap.get(calc.employeeRole) || { totalCost: 0, count: 0 };
        roleMap.set(calc.employeeRole, {
            totalCost: existing.totalCost + calc.netPay,
            count: existing.count + 1
        });
    });

    const breakdown: RoleCostBreakdown[] = [];
    roleMap.forEach((data, role) => {
        breakdown.push({
            role,
            totalCost: data.totalCost,
            employeeCount: data.count,
            percentage: (data.totalCost / payroll.totalNetPay) * 100
        });
    });

    return breakdown.sort((a, b) => b.totalCost - a.totalCost);
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data: any[][], filename: string): void => {
    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Export attendance report to CSV
 */
export const exportAttendanceToCSV = (stats: AttendanceStats): void => {
    const headers = ['Employee', 'Present', 'Late', 'Absent', 'Leave', 'Overtime', 'Hours', 'Rate'];
    const rows = stats.employeeBreakdown.map(emp => [
        emp.employeeName,
        emp.daysPresent.toString(),
        emp.daysLate.toString(),
        emp.daysAbsent.toString(),
        emp.daysLeave.toString(),
        emp.overtimeCount.toString(),
        emp.totalHours.toFixed(1),
        emp.attendanceRate.toFixed(1) + '%'
    ]);

    exportToCSV([headers, ...rows], `attendance_report_${stats.startDate}_to_${stats.endDate}.csv`);
};

/**
 * Export payroll report to CSV
 */
export const exportPayrollToCSV = (payroll: MonthlyPayroll): void => {
    const headers = ['Employee', 'Role', 'Days Worked', 'Base Salary', 'Allowance', 'Overtime', 'Gross Pay', 'Net Pay'];
    const rows = payroll.calculations.map(calc => [
        calc.employeeName,
        calc.employeeRole,
        calc.daysWorked.toString(),
        calc.baseSalary.toString(),
        calc.totalAllowance.toString(),
        calc.totalOvertime.toString(),
        calc.grossPay.toString(),
        calc.netPay.toString()
    ]);

    exportToCSV([headers, ...rows], `payroll_${formatPeriod(payroll.period)}.csv`);
};

/**
 * Get preset date ranges
 */
export const getDateRange = (
    preset: 'this_month' | 'last_month' | 'last_3_months' | 'custom'
): { startDate: string; endDate: string } => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (preset) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'last_3_months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};
