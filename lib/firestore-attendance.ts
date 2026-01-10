import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    Timestamp,
    orderBy,
    setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type { Attendance, AttendanceFormData, AttendanceDoc, AttendanceShift } from '@/types/attendance';
import { calculateTotalHours, countOvertimeEvents, determineStatus } from '@/types/attendance';

const COLLECTION_NAME = 'attendance';

// Convert Firestore document to Attendance type
export const docToAttendance = (id: string, data: AttendanceDoc): Attendance => {
    return {
        id,
        employeeId: data.employeeId,
        date: data.date,
        shifts: data.shifts.map(shift => ({
            type: shift.type,
            checkIn: shift.checkIn?.toDate() || new Date(),
            checkOut: shift.checkOut?.toDate() || null,
            notes: shift.notes || ''
        })),
        status: data.status,
        notes: data.notes,
        totalHours: data.totalHours,
        overtimeCount: data.overtimeCount,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

/**
 * Get or create today's attendance record for an employee
 */
export const getTodayAttendance = async (employeeId: string): Promise<Attendance | null> => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docId = `${employeeId}_${today}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToAttendance(docSnap.id, docSnap.data() as AttendanceDoc);
    }
    return null;
};

/**
 * Check in (start a new shift)
 */
export const checkIn = async (
    employeeId: string,
    shiftType: AttendanceShift['type'],
    notes: string = ''
): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const docId = `${employeeId}_${today}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const now = new Date();

    // Get existing record or create new
    const existing = await getDoc(docRef);

    if (existing.exists()) {
        // Add new shift to existing record
        const data = existing.data() as AttendanceDoc;
        const updatedShifts = [
            ...data.shifts,
            {
                type: shiftType,
                checkIn: Timestamp.fromDate(now),
                checkOut: null,
                notes
            }
        ];

        await updateDoc(docRef, {
            shifts: updatedShifts,
            updatedAt: Timestamp.now()
        });
    } else {
        // Create new attendance record
        const newShift = {
            type: shiftType,
            checkIn: Timestamp.fromDate(now),
            checkOut: null,
            notes
        };

        await setDoc(docRef, {
            employeeId,
            date: today,
            shifts: [newShift],
            status: 'present',
            notes: '',
            totalHours: 0,
            overtimeCount: shiftType !== 'regular' ? 1 : 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    }
};

/**
 * Check out (end the current active shift)
 */
export const checkOut = async (employeeId: string): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const docId = `${employeeId}_${today}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const now = new Date();

    const existing = await getDoc(docRef);
    if (!existing.exists()) {
        throw new Error('No check-in record found for today');
    }

    const data = existing.data() as AttendanceDoc;

    // Find the last shift without check-out
    const updatedShifts = data.shifts.map((shift, index) => {
        if (index === data.shifts.length - 1 && !shift.checkOut) {
            return {
                ...shift,
                checkOut: Timestamp.fromDate(now)
            };
        }
        return shift;
    });

    // Convert to AttendanceShift for calculation
    const shiftsForCalc: AttendanceShift[] = updatedShifts.map(s => ({
        type: s.type,
        checkIn: s.checkIn.toDate(),
        checkOut: s.checkOut?.toDate() || null,
        notes: s.notes
    }));

    const totalHours = calculateTotalHours(shiftsForCalc);
    const overtimeCount = countOvertimeEvents(shiftsForCalc);
    const status = determineStatus(shiftsForCalc);

    await updateDoc(docRef, {
        shifts: updatedShifts,
        totalHours,
        overtimeCount,
        status,
        updatedAt: Timestamp.now()
    });
};

/**
 * Get attendance records for an employee (date range)
 */
export const getEmployeeAttendance = async (
    employeeId: string,
    startDate: string,
    endDate: string
): Promise<Attendance[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToAttendance(doc.id, doc.data() as AttendanceDoc));
};

/**
 * Get all attendance for a specific date (admin view)
 */
export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('date', '==', date)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToAttendance(doc.id, doc.data() as AttendanceDoc));
};

/**
 * Subscribe to today's attendance (real-time for dashboard)
 */
export const subscribeToTodayAttendance = (
    callback: (attendances: Attendance[]) => void
): (() => void) => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
        collection(db, COLLECTION_NAME),
        where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const attendances = snapshot.docs.map(doc =>
            docToAttendance(doc.id, doc.data() as AttendanceDoc)
        );
        callback(attendances);
    });

    return unsubscribe;
};

/**
 * Mark employee as absent (admin function)
 */
export const markAbsent = async (employeeId: string, date: string, notes: string = ''): Promise<void> => {
    const docId = `${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);

    await setDoc(docRef, {
        employeeId,
        date,
        shifts: [],
        status: 'absent',
        notes,
        totalHours: 0,
        overtimeCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
};

/**
 * Update attendance status manually (admin function)
 */
export const updateAttendanceStatus = async (
    employeeId: string,
    date: string,
    status: Attendance['status'],
    notes?: string
): Promise<void> => {
    const docId = `${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);

    const updates: any = {
        status,
        updatedAt: Timestamp.now()
    };

    if (notes !== undefined) {
        updates.notes = notes;
    }

    await updateDoc(docRef, updates);
};

/**
 * Get attendance summary for a period (for reports)
 */
export const getAttendanceSummary = async (
    employeeId: string,
    startDate: string,
    endDate: string
): Promise<{
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    totalHours: number;
    overtimeCount: number;
}> => {
    const attendances = await getEmployeeAttendance(employeeId, startDate, endDate);

    const summary = {
        totalDays: attendances.length,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        totalHours: 0,
        overtimeCount: 0
    };

    attendances.forEach(att => {
        summary[att.status]++;
        summary.totalHours += att.totalHours;
        summary.overtimeCount += att.overtimeCount;
    });

    return summary;
};
