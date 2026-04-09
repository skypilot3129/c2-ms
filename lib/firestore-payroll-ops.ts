/**
 * Firestore CRUD for Payroll Operations
 * Collections: employee_advances, monthly_salary_records, loading_sessions,
 *              vehicle_rentals, driver_advances, driver_salaries
 */
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, getDocs, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    EmployeeAdvance, EmployeeAdvanceFormData,
    MonthlySalaryRecord,
    LoadingSession, LoadingSessionFormData,
    VehicleRental, VehicleRentalFormData,
    DriverAdvance, DriverAdvanceFormData,
    DriverSalary, DriverSalaryFormData,
    AttendanceDay,
} from '@/types/payroll-ops';
import { TRUCK_POOL, computeLoadingShares } from '@/types/payroll-ops';

// ─── Collections ──────────────────────────────────────────────────────────────
const COL = {
    advances: 'employee_advances',
    salary: 'monthly_salary_records',
    loading: 'loading_sessions',
    rentals: 'vehicle_rentals',
    driverAdv: 'driver_advances',
    driverSal: 'driver_salaries',
};

const toDate = (v: any): Date => v?.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ADVANCES (Bon Karyawan)
// ═══════════════════════════════════════════════════════════════════════════════
export const addEmployeeAdvance = async (data: EmployeeAdvanceFormData): Promise<string> => {
    const ref = await addDoc(collection(db, COL.advances), {
        ...data,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const updateEmployeeAdvance = async (id: string, data: Partial<EmployeeAdvance>): Promise<void> => {
    const { id: _id, createdAt, ...rest } = data as any;
    await updateDoc(doc(db, COL.advances, id), { ...rest, updatedAt: serverTimestamp() });
};

export const deleteEmployeeAdvance = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.advances, id));
};

export const subscribeToEmployeeAdvances = (
    callback: (data: EmployeeAdvance[]) => void
): (() => void) => {
    const q = query(collection(db, COL.advances), orderBy('date', 'desc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MONTHLY SALARY RECORDS (Rekap Gaji Bulanan Karyawan)
// ═══════════════════════════════════════════════════════════════════════════════
export const saveMonthlySalaryRecord = async (record: Omit<MonthlySalaryRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    // Upsert: check if one already exists for this employee+period
    const q = query(
        collection(db, COL.salary),
        where('employeeId', '==', record.employeeId),
        where('period', '==', record.period)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { ...record, updatedAt: serverTimestamp() });
        return snap.docs[0].id;
    }
    const ref = await addDoc(collection(db, COL.salary), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const subscribeToMonthlySalaries = (
    period: string,
    callback: (data: MonthlySalaryRecord[]) => void
): (() => void) => {
    const q = query(collection(db, COL.salary), where('period', '==', period));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};

export const deleteMonthySalaryRecord = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.salary, id));
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SESSIONS (Operasi Muat)
// ═══════════════════════════════════════════════════════════════════════════════
export const addLoadingSession = async (data: LoadingSessionFormData): Promise<string> => {
    const period = data.date.substring(0, 7); // YYYY-MM
    const pool = TRUCK_POOL[data.truckType];
    const rawSession = { ...data, period, pool, id: '', createdAt: new Date(), updatedAt: new Date() };
    const computedMembers = computeLoadingShares(rawSession as any);
    const ref = await addDoc(collection(db, COL.loading), {
        ...data,
        period,
        pool,
        members: computedMembers,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const updateLoadingSession = async (id: string, data: LoadingSessionFormData): Promise<void> => {
    const period = data.date.substring(0, 7);
    const pool = TRUCK_POOL[data.truckType];
    const rawSession = { ...data, period, pool, id, createdAt: new Date(), updatedAt: new Date() };
    const computedMembers = computeLoadingShares(rawSession as any);
    await updateDoc(doc(db, COL.loading, id), {
        ...data,
        period,
        pool,
        members: computedMembers,
        updatedAt: serverTimestamp(),
    });
};

export const deleteLoadingSession = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.loading, id));
};

export const subscribeToLoadingSessions = (
    period: string,
    callback: (data: LoadingSession[]) => void
): (() => void) => {
    const q = query(collection(db, COL.loading), where('period', '==', period), orderBy('date', 'asc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE RENTALS (Sewa Mobil)
// ═══════════════════════════════════════════════════════════════════════════════
export const addVehicleRental = async (data: VehicleRentalFormData): Promise<string> => {
    const ref = await addDoc(collection(db, COL.rentals), {
        ...data,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const updateVehicleRental = async (id: string, data: Partial<VehicleRental>): Promise<void> => {
    const { id: _id, createdAt, ...rest } = data as any;
    await updateDoc(doc(db, COL.rentals, id), { ...rest, updatedAt: serverTimestamp() });
};

export const deleteVehicleRental = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.rentals, id));
};

export const subscribeToVehicleRentals = (
    callback: (data: VehicleRental[]) => void,
    period?: string
): (() => void) => {
    const q = period
        ? query(collection(db, COL.rentals), where('period', '==', period), orderBy('startDate', 'desc'))
        : query(collection(db, COL.rentals), orderBy('startDate', 'desc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER ADVANCES (Bon Sopir)
// ═══════════════════════════════════════════════════════════════════════════════
export const addDriverAdvance = async (data: DriverAdvanceFormData): Promise<string> => {
    const ref = await addDoc(collection(db, COL.driverAdv), {
        ...data,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const updateDriverAdvance = async (id: string, data: Partial<DriverAdvance>): Promise<void> => {
    const { id: _id, createdAt, ...rest } = data as any;
    await updateDoc(doc(db, COL.driverAdv, id), { ...rest, updatedAt: serverTimestamp() });
};

export const deleteDriverAdvance = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.driverAdv, id));
};

export const subscribeToDriverAdvances = (
    callback: (data: DriverAdvance[]) => void
): (() => void) => {
    const q = query(collection(db, COL.driverAdv), orderBy('date', 'desc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER SALARIES (Gaji Sopir)
// ═══════════════════════════════════════════════════════════════════════════════
export const addDriverSalary = async (data: DriverSalaryFormData): Promise<string> => {
    const netPay = data.baseSalary + data.bonusAmount - data.advanceDeduction;
    const ref = await addDoc(collection(db, COL.driverSal), {
        ...data,
        netPay,
        status: 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const updateDriverSalary = async (id: string, data: Partial<DriverSalary>): Promise<void> => {
    const { id: _id, createdAt, ...rest } = data as any;
    const netPay = (rest.baseSalary ?? 0) + (rest.bonusAmount ?? 0) - (rest.advanceDeduction ?? 0);
    await updateDoc(doc(db, COL.driverSal, id), { ...rest, netPay, updatedAt: serverTimestamp() });
};

export const deleteDriverSalary = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COL.driverSal, id));
};

export const subscribeToDriverSalaries = (
    callback: (data: DriverSalary[]) => void,
    period?: string
): (() => void) => {
    const q = period
        ? query(collection(db, COL.driverSal), where('period', '==', period), orderBy('createdAt', 'desc'))
        : query(collection(db, COL.driverSal), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
            paidAt: d.data().paidAt ? toDate(d.data().paidAt) : undefined,
            createdAt: toDate(d.data().createdAt),
            updatedAt: toDate(d.data().updatedAt),
        })));
    });
};
