/**
 * Firestore functions for Expense management
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Expense, ExpenseDoc, ExpenseFormData, ExpenseCategory } from '@/types/voyage';

const EXPENSES_COLLECTION = 'expenses';

/**
 * Convert Firestore document to Expense object
 */
const docToExpense = (id: string, data: any): Expense => {
    return {
        id,
        userId: data.userId,
        type: data.type || 'voyage', // Default to voyage for existing data
        voyageId: data.voyageId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: data.date?.toDate() || new Date(),
        receiptUrl: data.receiptUrl,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

export const addExpense = async (
    data: ExpenseFormData,
    userId: string
): Promise<string> => {
    const now = Timestamp.now();
    const date = Timestamp.fromDate(new Date(data.date));

    const expenseData: any = {
        userId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date,
        createdAt: now,
        updatedAt: now,
    };

    if (data.voyageId) expenseData.voyageId = data.voyageId;
    if (data.receiptUrl) expenseData.receiptUrl = data.receiptUrl;

    const docRef = await addDoc(collection(db, EXPENSES_COLLECTION), expenseData);
    return docRef.id;
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (id: string): Promise<Expense | null> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        return null;
    }

    return docToExpense(docSnap.id, docSnap.data());
};

/**
 * Get all expenses for a voyage
 */
export const getExpensesByVoyage = async (
    voyageId: string,
    userId: string
): Promise<Expense[]> => {
    const q = query(
        collection(db, EXPENSES_COLLECTION),
        where('voyageId', '==', voyageId),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement
    );

    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => docToExpense(doc.id, doc.data()));

    // Sort in memory
    return expenses.sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * Subscribe to expenses for a voyage in real-time
 */
export const subscribeToExpensesByVoyage = (
    voyageId: string,
    userId: string,
    callback: (expenses: Expense[]) => void
): (() => void) => {
    const q = query(
        collection(db, EXPENSES_COLLECTION),
        where('voyageId', '==', voyageId),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const expenses = snapshot.docs.map(doc => docToExpense(doc.id, doc.data()));

        // Sort in memory instead (newest first)
        const sorted = expenses.sort((a, b) => b.date.getTime() - a.date.getTime());

        callback(sorted);
    });

    return unsubscribe;
};

/**
 * Subscribe to all expenses for a user
 */
/**
 * Subscribe to all expenses for a user
 * Optionally filter by date range
 */
export const subscribeToExpenses = (
    userId: string,
    callback: (expenses: Expense[]) => void,
    dateRange?: { startDate: Date; endDate: Date }
): (() => void) => {
    const expensesRef = collection(db, EXPENSES_COLLECTION);
    let constraints: any[] = [];

    constraints.push(where('userId', '==', userId));

    if (dateRange) {
        // Ensure strictly this range. Firestore composite index might be needed.
        const start = Timestamp.fromDate(dateRange.startDate);
        const end = Timestamp.fromDate(dateRange.endDate);
        constraints.push(where('date', '>=', start));
        constraints.push(where('date', '<=', end));
    }

    const q = query(expensesRef, ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const expenses = snapshot.docs.map(doc => docToExpense(doc.id, doc.data()));
        // Sort in memory
        const sorted = expenses.sort((a, b) => b.date.getTime() - a.date.getTime());
        callback(sorted);
    });

    return unsubscribe;
};

/**
 * Update expense
 */
export const updateExpense = async (
    id: string,
    data: Partial<ExpenseFormData>
): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    const updates: any = {
        ...data,
        updatedAt: Timestamp.now(),
    };

    if (data.date) {
        updates.date = Timestamp.fromDate(new Date(data.date));
    }

    await updateDoc(docRef, updates);
};

/**
 * Delete expense
 */
export const deleteExpense = async (id: string): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await deleteDoc(docRef);
};

/**
 * Calculate total expenses by category for a voyage
 */
export const calculateVoyageExpenses = async (
    voyageId: string,
    userId: string
): Promise<{ total: number; byCategory: Record<ExpenseCategory, number> }> => {
    const expenses = await getExpensesByVoyage(voyageId, userId);

    const byCategory: Record<ExpenseCategory, number> = {
        tiket: 0,
        operasional_surabaya: 0,
        operasional_makassar: 0,
        transit: 0,
        sewa_mobil: 0,
        gaji_sopir: 0,
        gaji_karyawan: 0,
        listrik_air_internet: 0,
        sewa_kantor: 0,
        maintenance: 0,
        lainnya: 0,
    };

    let total = 0;

    expenses.forEach(expense => {
        if (byCategory[expense.category] !== undefined) {
            byCategory[expense.category] += expense.amount;
        } else {
            // Fallback for unknown categories if any
            byCategory['lainnya'] += expense.amount;
        }
        total += expense.amount;
    });

    return { total, byCategory };
};

/**
 * Get all expenses for a user
 */
export const getExpenses = async (userId: string): Promise<Expense[]> => {
    const q = query(
        collection(db, EXPENSES_COLLECTION),
        where('userId', '==', userId),
        orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToExpense(doc.id, doc.data()));
};
