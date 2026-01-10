import { Timestamp } from 'firebase/firestore';

// Shift Types
export type ShiftType = 'regular' | 'overtime_loading' | 'overtime_unloading';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

// Individual shift record
export interface AttendanceShift {
    type: ShiftType;
    checkIn: Date;
    checkOut: Date | null;
    notes: string;
}

// Daily attendance record (form data)
export interface AttendanceFormData {
    employeeId: string;
    date: string; // YYYY-MM-DD
    shifts: AttendanceShift[];
    status: AttendanceStatus;
    notes?: string;
}

// Firestore document
export interface AttendanceDoc extends Omit<AttendanceFormData, 'shifts'> {
    shifts: {
        type: ShiftType;
        checkIn: Timestamp;
        checkOut: Timestamp | null;
        notes: string;
    }[];
    totalHours: number;
    overtimeCount: number; // Number of loading/unloading events
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Client-side attendance (after fetching)
export interface Attendance extends AttendanceFormData {
    id: string;
    totalHours: number;
    overtimeCount: number;
    createdAt: Date;
    updatedAt: Date;
}

// Shift type labels
export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
    'regular': 'Shift Regular (9-5)',
    'overtime_loading': 'Lembur Bongkar',
    'overtime_unloading': 'Lembur Muat'
};

// Status labels
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
    'present': 'Hadir',
    'absent': 'Tidak Hadir',
    'late': 'Terlambat',
    'leave': 'Izin/Cuti'
};

// Helper: Calculate total hours from shifts
export const calculateTotalHours = (shifts: AttendanceShift[]): number => {
    return shifts.reduce((total, shift) => {
        if (!shift.checkOut) return total;
        const hours = (shift.checkOut.getTime() - shift.checkIn.getTime()) / (1000 * 60 * 60);
        return total + hours;
    }, 0);
};

// Helper: Count overtime events (loading/unloading)
export const countOvertimeEvents = (shifts: AttendanceShift[]): number => {
    return shifts.filter(s => s.type === 'overtime_loading' || s.type === 'overtime_unloading').length;
};

// Helper: Check if late (after 9:15 AM)
export const isLateCheckIn = (checkIn: Date): boolean => {
    const hour = checkIn.getHours();
    const minute = checkIn.getMinutes();

    // Late if after 09:15
    return hour > 9 || (hour === 9 && minute > 15);
};

// Helper: Determine status from shift data
export const determineStatus = (shifts: AttendanceShift[]): AttendanceStatus => {
    if (shifts.length === 0) return 'absent';

    const regularShift = shifts.find(s => s.type === 'regular');
    if (!regularShift) return 'present'; // Only overtime

    return isLateCheckIn(regularShift.checkIn) ? 'late' : 'present';
};
