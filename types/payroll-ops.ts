/**
 * Payroll Operations Types
 * Covers: Employee advances, loading sessions, vehicle rentals, driver advances, driver salaries
 */

// ─── Employee Advances (Bon Karyawan) ─────────────────────────────────────────
export type AdvanceStatus = 'active' | 'deducted' | 'cancelled';

export interface EmployeeAdvance {
    id: string;
    employeeId: string;
    employeeName: string;
    amount: number;
    date: string;       // YYYY-MM-DD
    description: string;
    status: AdvanceStatus;
    deductedMonth?: string; // YYYY-MM if deducted
    createdAt: Date;
    updatedAt: Date;
}

export interface EmployeeAdvanceFormData {
    employeeId: string;
    employeeName: string;
    amount: number;
    date: string;
    description: string;
}

// ─── Attendance Day (per karyawan per hari) ────────────────────────────────────
export type AttendanceType = 'present' | 'late_mild' | 'late_severe' | 'absent';

export interface AttendanceDay {
    date: string;           // YYYY-MM-DD
    type: AttendanceType;
    overridden: boolean;    // kelonggaran flag — treat as present even if late
    note?: string;
}

// ─── Monthly Salary Record ─────────────────────────────────────────────────────
export interface MonthlySalaryRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    period: string;         // YYYY-MM
    attendance: AttendanceDay[];

    // Computed
    daysPresent: number;    // hadir (incl. overridden)
    daysLateMild: number;
    daysLateSevere: number;
    daysAbsent: number;

    basePay: number;        // daysPresent * 50_000
    lateMildDeduction: number;
    lateSevereDeduction: number;
    advanceDeduction: number;   // total bon dipotong bulan ini
    advanceIds: string[];       // IDs of deducted advances

    grossPay: number;
    netPay: number;

    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Loading Session (Operasi Muat) ───────────────────────────────────────────
export type TruckType = 'fuso' | 'tronton';

export interface LoadingMember {
    employeeId: string;
    employeeName: string;
    present: boolean;
    isStacker: boolean;     // tukang susun
    shareAmount: number;    // computed: pool / presentCount
    stackingBonus: number;  // computed: 50_000 / 2 if stacker
    total: number;
}

export interface LoadingSession {
    id: string;
    date: string;           // YYYY-MM-DD
    period: string;         // YYYY-MM
    truckType: TruckType;
    truckLabel?: string;    // e.g. "Fuso B 1234 XY"

    pool: number;           // 650_000 (fuso) | 850_000 (tronton)
    members: LoadingMember[];
    notes?: string;

    createdAt: Date;
    updatedAt: Date;
}

export interface LoadingSessionFormData {
    date: string;
    truckType: TruckType;
    truckLabel?: string;
    members: Pick<LoadingMember, 'employeeId' | 'employeeName' | 'present' | 'isStacker'>[];
    notes?: string;
}

export const TRUCK_POOL: Record<TruckType, number> = {
    fuso: 650_000,
    tronton: 850_000,
};

export const TRUCK_LABELS: Record<TruckType, string> = {
    fuso: 'Fuso',
    tronton: 'Tronton',
};

/** Compute share amounts for a loading session */
export function computeLoadingShares(session: Omit<LoadingSession, 'id' | 'createdAt' | 'updatedAt'>): LoadingMember[] {
    const pool = TRUCK_POOL[session.truckType];
    const presentMembers = session.members.filter(m => m.present);
    const presentCount = presentMembers.length;
    if (presentCount === 0) return session.members;

    const sharePerPerson = Math.floor(pool / presentCount);
    const stackersPresent = presentMembers.filter(m => m.isStacker).length;
    const stackingBonusPerPerson = stackersPresent >= 2 ? 25_000 : stackersPresent === 1 ? 50_000 : 0;

    return session.members.map(m => {
        if (!m.present) return { ...m, shareAmount: 0, stackingBonus: 0, total: 0 };
        const bonus = m.isStacker ? stackingBonusPerPerson : 0;
        return { ...m, shareAmount: sharePerPerson, stackingBonus: bonus, total: sharePerPerson + bonus };
    });
}

// ─── Vehicle Rental (Sewa Mobil) ──────────────────────────────────────────────
export type RentalStatus = 'active' | 'completed' | 'cancelled';

export interface VehicleRental {
    id: string;
    vehicleName: string;    // nama/plat mobil
    driverName?: string;
    startDate: string;      // YYYY-MM-DD
    endDate?: string;
    amount: number;
    period: string;         // YYYY-MM (bulan tagih)
    status: RentalStatus;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface VehicleRentalFormData {
    vehicleName: string;
    driverName?: string;
    startDate: string;
    endDate?: string;
    amount: number;
    period: string;
    description?: string;
}

// ─── Driver Advance (Bon Sopir) ────────────────────────────────────────────────
export interface DriverAdvance {
    id: string;
    driverName: string;
    amount: number;
    date: string;           // YYYY-MM-DD
    description: string;
    status: AdvanceStatus;
    deductedMonth?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DriverAdvanceFormData {
    driverName: string;
    amount: number;
    date: string;
    description: string;
}

// ─── Driver Salary (Gaji Sopir) ───────────────────────────────────────────────
export type DriverSalaryStatus = 'unpaid' | 'paid';

export interface DriverSalary {
    id: string;
    driverName: string;
    period: string;         // YYYY-MM
    baseSalary: number;
    bonusAmount: number;
    advanceDeduction: number;
    netPay: number;
    status: DriverSalaryStatus;
    notes?: string;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface DriverSalaryFormData {
    driverName: string;
    period: string;
    baseSalary: number;
    bonusAmount: number;
    advanceDeduction: number;
    notes?: string;
}

// ─── Labels ───────────────────────────────────────────────────────────────────
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
    present: 'Hadir',
    late_mild: 'Telat Ringan (9-11)',
    late_severe: 'Telat Berat (>11)',
    absent: 'Tidak Hadir',
};

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
    active: 'Aktif',
    deducted: 'Sudah Dipotong',
    cancelled: 'Dibatalkan',
};

export const DRIVER_SALARY_STATUS_LABELS: Record<DriverSalaryStatus, string> = {
    unpaid: 'Belum Dibayar',
    paid: 'Sudah Dibayar',
};

// ─── Daily Pay Constants ───────────────────────────────────────────────────────
export const DAILY_RATE = 50_000;
export const LATE_MILD_DEDUCTION = 10_000;
export const LATE_SEVERE_DEDUCTION = 20_000;

/** Compute net daily pay for one AttendanceDay */
export function computeDayPay(day: AttendanceDay): number {
    if (day.type === 'absent') return 0;
    if (day.overridden || day.type === 'present') return DAILY_RATE;
    if (day.type === 'late_mild') return DAILY_RATE - LATE_MILD_DEDUCTION;
    if (day.type === 'late_severe') return DAILY_RATE - LATE_SEVERE_DEDUCTION;
    return 0;
}
