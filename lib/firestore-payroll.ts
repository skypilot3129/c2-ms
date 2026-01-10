import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    limit
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    MonthlyPayroll,
    MonthlyPayrollDoc,
    MonthlyPayrollFormData,
    PayrollCalculation,
    PayrollPeriod,
    PayrollStatus,
    PayrollSummary
} from '@/types/payroll';

const COLLECTION_NAME = 'payrolls';

// Convert Firestore document to MonthlyPayroll
export const docToMonthlyPayroll = (id: string, data: MonthlyPayrollDoc): MonthlyPayroll => {
    return {
        id,
        period: data.period,
        calculations: data.calculations.map(calc => ({
            ...calc,
            generatedAt: calc.generatedAt.toDate(),
            approvedAt: calc.approvedAt?.toDate(),
            paidAt: calc.paidAt?.toDate()
        })),
        totalGrossPay: data.totalGrossPay,
        totalNetPay: data.totalNetPay,
        totalEmployees: data.totalEmployees,
        status: data.status,
        notes: data.notes,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        finalizedAt: data.finalizedAt?.toDate()
    };
};

/**
 * Save monthly payroll to Firestore
 */
export const saveMonthlyPayroll = async (
    payrollData: MonthlyPayrollFormData
): Promise<string> => {
    const now = Timestamp.now();

    const docData: Omit<MonthlyPayrollDoc, 'createdAt' | 'updatedAt'> & {
        createdAt: Timestamp;
        updatedAt: Timestamp;
    } = {
        period: payrollData.period,
        calculations: payrollData.calculations.map(calc => ({
            ...calc,
            generatedAt: Timestamp.fromDate(calc.generatedAt),
            approvedAt: calc.approvedAt ? Timestamp.fromDate(calc.approvedAt) : undefined,
            paidAt: calc.paidAt ? Timestamp.fromDate(calc.paidAt) : undefined
        })),
        totalGrossPay: payrollData.totalGrossPay,
        totalNetPay: payrollData.totalNetPay,
        totalEmployees: payrollData.totalEmployees,
        status: payrollData.status,
        notes: payrollData.notes,
        createdAt: now,
        updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
};

/**
 * Get payroll by period
 */
export const getPayrollByPeriod = async (
    period: PayrollPeriod
): Promise<MonthlyPayroll | null> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('period', '==', period),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const docSnap = snapshot.docs[0];
    return docToMonthlyPayroll(docSnap.id, docSnap.data() as MonthlyPayrollDoc);
};

/**
 * Get payroll by ID
 */
export const getPayrollById = async (payrollId: string): Promise<MonthlyPayroll | null> => {
    const docRef = doc(db, COLLECTION_NAME, payrollId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToMonthlyPayroll(docSnap.id, docSnap.data() as MonthlyPayrollDoc);
    }

    return null;
};

/**
 * Get all payrolls (ordered by period descending)
 */
export const getAllPayrolls = async (maxResults: number = 12): Promise<MonthlyPayroll[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('period', 'desc'),
        limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToMonthlyPayroll(doc.id, doc.data() as MonthlyPayrollDoc));
};

/**
 * Get employee's payroll history
 */
export const getEmployeePayrollHistory = async (
    employeeId: string,
    maxResults: number = 6
): Promise<PayrollCalculation[]> => {
    // Get all payrolls and filter calculations
    const allPayrolls = await getAllPayrolls(maxResults);

    const employeeCalculations: PayrollCalculation[] = [];

    for (const payroll of allPayrolls) {
        const calc = payroll.calculations.find(c => c.employeeId === employeeId);
        if (calc) {
            employeeCalculations.push(calc);
        }
    }

    return employeeCalculations;
};

/**
 * Update payroll status
 */
export const updatePayrollStatus = async (
    payrollId: string,
    status: PayrollStatus
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, payrollId);
    const updates: any = {
        status,
        updatedAt: Timestamp.now()
    };

    if (status === 'approved') {
        updates.finalizedAt = Timestamp.now();
    }

    await updateDoc(docRef, updates);
};

/**
 * Update individual employee payroll status within a monthly payroll
 */
export const updateEmployeePayrollStatus = async (
    payrollId: string,
    employeeId: string,
    status: PayrollStatus
): Promise<void> => {
    const payroll = await getPayrollById(payrollId);
    if (!payroll) {
        throw new Error('Payroll not found');
    }

    const updatedCalculations = payroll.calculations.map(calc => {
        if (calc.employeeId === employeeId) {
            const now = new Date();
            const updated = { ...calc, status };

            if (status === 'approved' && !calc.approvedAt) {
                updated.approvedAt = now;
            }
            if (status === 'paid' && !calc.paidAt) {
                updated.paidAt = now;
            }

            return updated;
        }
        return calc;
    });

    const docRef = doc(db, COLLECTION_NAME, payrollId);
    await updateDoc(docRef, {
        calculations: updatedCalculations.map(calc => ({
            ...calc,
            generatedAt: Timestamp.fromDate(calc.generatedAt),
            approvedAt: calc.approvedAt ? Timestamp.fromDate(calc.approvedAt) : undefined,
            paidAt: calc.paidAt ? Timestamp.fromDate(calc.paidAt) : undefined
        })),
        updatedAt: Timestamp.now()
    });
};

/**
 * Get payroll summaries for reporting
 */
export const getPayrollSummaries = async (
    limit: number = 6
): Promise<PayrollSummary[]> => {
    const payrolls = await getAllPayrolls(limit);

    return payrolls.map(p => ({
        period: p.period,
        totalGrossPay: p.totalGrossPay,
        totalNetPay: p.totalNetPay,
        totalEmployees: p.totalEmployees,
        averagePerEmployee: p.totalEmployees > 0 ? p.totalNetPay / p.totalEmployees : 0,
        status: p.status
    }));
};

/**
 * Check if payroll exists for period
 */
export const payrollExistsForPeriod = async (period: PayrollPeriod): Promise<boolean> => {
    const payroll = await getPayrollByPeriod(period);
    return payroll !== null;
};

/**
 * Delete payroll (admin only - use with caution)
 */
export const deletePayroll = async (payrollId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, payrollId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw new Error('Payroll not found');
    }

    const data = docSnap.data() as MonthlyPayrollDoc;

    if (data.status === 'paid') {
        throw new Error('Cannot delete paid payroll');
    }

    // Note: In production, you might want to soft-delete instead
    // await updateDoc(docRef, { deleted: true, updatedAt: Timestamp.now() });
};
